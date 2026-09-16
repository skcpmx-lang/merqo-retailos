/**
 * Inventory Transaction Service — atomic stock movements + WAC + ledger
 */

import { StockLevelRepository, StockMovementRepository } from '../db/repositories/inventory.repository';
import { ProductRepository, ProductCostHistoryRepository } from '../db/repositories/product.repository';
import { InventoryDomainService } from '@core/domain/services/inventory.service';
import { AuditService } from './audit.service';

export interface PurchaseReceiptItem {
  productId: string;
  quantityMilli: number;
  costPaisa: number;
  unitId?: string;
}

export interface PurchaseReceiptInput {
  businessId: string;
  purchaseId: string;
  items: PurchaseReceiptItem[];
  createdBy?: string;
}

export class InventoryTransactionService {
  private stockLevelRepo: StockLevelRepository;
  private stockMovementRepo: StockMovementRepository;
  private productRepo: ProductRepository;
  private costHistoryRepo: ProductCostHistoryRepository;
  private inventoryDomain = new InventoryDomainService();
  private auditService: AuditService;

  constructor(db?: any) {
    this.stockLevelRepo = new StockLevelRepository(db);
    this.stockMovementRepo = new StockMovementRepository(db);
    this.productRepo = new ProductRepository(db);
    this.costHistoryRepo = new ProductCostHistoryRepository(db);
    this.auditService = new AuditService(db);
  }

  /**
   * Receive purchase — atomic: update stock_levels, create stock_movements, update WAC, cost history
   */
  receivePurchase(input: PurchaseReceiptInput) {
    const db = (this.stockLevelRepo as any).db;

    const transaction = db.transaction(() => {
      const results = [];

      for (const item of input.items) {
        if (item.quantityMilli <= 0) throw new Error('Quantity must be >0 for purchase');
        if (item.costPaisa < 0) throw new Error('Cost cannot be negative');

        const product = this.productRepo.findById(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);

        const currentLevel = this.stockLevelRepo.findByProductAndLocation(item.productId, 'main');
        const currentStockMilli = currentLevel?.quantityMilli ?? 0;
        const currentWac = product.costPricePaisa;

        // Calculate new WAC
        const newWac = this.inventoryDomain.calculateNewWAC(
          currentStockMilli,
          currentWac,
          item.quantityMilli,
          item.costPaisa
        );

        // Create movement
        const movement = this.inventoryDomain.buildPurchaseMovement(
          input.businessId,
          item.productId,
          item.quantityMilli,
          item.costPaisa,
          input.purchaseId,
          input.createdBy
        );

        this.stockMovementRepo.create(movement);

        // Upsert stock level
        const newQuantity = currentStockMilli + item.quantityMilli;
        this.stockLevelRepo.upsert({
          businessId: input.businessId,
          productId: item.productId,
          locationId: 'main',
          quantityMilli: newQuantity,
          reservedMilli: currentLevel?.reservedMilli ?? 0,
          lastMovementAt: Date.now(),
        });

        // Update product cost_price_paisa to new WAC
        this.productRepo.update(item.productId, {
          costPricePaisa: newWac,
          updatedBy: input.createdBy || null,
        } as any);

        // Cost history
        this.costHistoryRepo.create({
          productId: item.productId,
          purchaseId: input.purchaseId,
          oldCostPaisa: currentWac,
          newCostPaisa: item.costPaisa,
          oldWacPaisa: currentWac,
          newWacPaisa: newWac,
          reason: 'purchase',
          createdBy: input.createdBy || null,
        });

        results.push({
          productId: item.productId,
          oldStock: currentStockMilli,
          newStock: newQuantity,
          oldWac: currentWac,
          newWac,
        });
      }

      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'stock_in',
        entityType: 'purchase',
        entityId: input.purchaseId,
        newValues: JSON.stringify({ items: input.items.length }),
      });

      return results;
    });

    return transaction();
  }

  /**
   * Deduct stock for sale — atomic check + movement
   */
  deductForSale(input: {
    businessId: string;
    saleId: string;
    items: { productId: string; quantityMilli: number; costPaisa: number }[];
    createdBy?: string;
  }) {
    const db = (this.stockLevelRepo as any).db;

    const transaction = db.transaction(() => {
      const results = [];

      // First pass: check all stock availability
      for (const item of input.items) {
        const product = this.productRepo.findById(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);

        const currentLevel = this.stockLevelRepo.findByProductAndLocation(item.productId, 'main');
        const currentStock = currentLevel?.quantityMilli ?? 0;

        const check = this.inventoryDomain.canDeduct(currentStock, item.quantityMilli, product.isStockTrackable);
        if (!check.allowed) {
          throw new Error(check.reason);
        }
      }

      // Second pass: deduct
      for (const item of input.items) {
        const currentLevel = this.stockLevelRepo.findByProductAndLocation(item.productId, 'main');
        const currentStock = currentLevel?.quantityMilli ?? 0;

        const movement = this.inventoryDomain.buildSaleMovement(
          input.businessId,
          item.productId,
          item.quantityMilli,
          item.costPaisa,
          input.saleId,
          input.createdBy
        );

        this.stockMovementRepo.create(movement);

        const newQuantity = currentStock - item.quantityMilli;
        this.stockLevelRepo.upsert({
          businessId: input.businessId,
          productId: item.productId,
          locationId: 'main',
          quantityMilli: newQuantity,
          reservedMilli: currentLevel?.reservedMilli ?? 0,
          lastMovementAt: Date.now(),
        });

        results.push({
          productId: item.productId,
          oldStock: currentStock,
          newStock: newQuantity,
        });
      }

      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'stock_out',
        entityType: 'sale',
        entityId: input.saleId,
        newValues: JSON.stringify({ items: input.items.length }),
      });

      return results;
    });

    return transaction();
  }

  /**
   * Verify ledger invariant for a product
   */
  verifyProductLedger(productId: string, locationId = 'main') {
    const level = this.stockLevelRepo.findByProductAndLocation(productId, locationId);
    const movementsSum = this.stockMovementRepo.getCurrentStock(productId, locationId);

    const levelQty = level?.quantityMilli ?? 0;

    return this.inventoryDomain.verifyLedgerInvariant(levelQty, movementsSum);
  }
}
