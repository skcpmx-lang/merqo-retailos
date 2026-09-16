/**
 * Product Application Service — orchestrates product lifecycle
 * Handles validation, WAC, stock opening, barcodes, cost history, audit
 */

import { ProductRepository, ProductBarcodeRepository, ProductCostHistoryRepository } from '../db/repositories/product.repository';
import { StockLevelRepository, StockMovementRepository } from '../db/repositories/inventory.repository';
import { ProductValidationService } from '@core/domain/services/product-validation.service';
import { InventoryDomainService } from '@core/domain/services/inventory.service';
import { Money } from '@core/domain/Money';
import { AuditService } from './audit.service';

export interface CreateProductInput {
  businessId: string;
  name: string;
  nameBn?: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
  brandId?: string;
  baseUnitId: string;
  purchaseUnitId?: string;
  saleUnitId?: string;
  costPricePaisa: number;
  sellingPricePaisa: number;
  mrpPaisa?: number;
  minStockMilli?: number;
  reorderLevelMilli?: number;
  openingStockMilli?: number;
  isStockTrackable?: boolean;
  isSellable?: boolean;
  isPurchasable?: boolean;
  taxRate?: number;
  createdBy?: string;
  barcodes?: { barcode: string; unitId?: string; quantityMilli?: number; isPrimary?: boolean }[];
}

export class ProductService {
  private productRepo: ProductRepository;
  private barcodeRepo: ProductBarcodeRepository;
  private costHistoryRepo: ProductCostHistoryRepository;
  private stockLevelRepo: StockLevelRepository;
  private stockMovementRepo: StockMovementRepository;
  private validationService = new ProductValidationService();
  private inventoryService = new InventoryDomainService();
  private auditService: AuditService;

  constructor(db?: any) {
    this.productRepo = new ProductRepository(db);
    this.barcodeRepo = new ProductBarcodeRepository(db);
    this.costHistoryRepo = new ProductCostHistoryRepository(db);
    this.stockLevelRepo = new StockLevelRepository(db);
    this.stockMovementRepo = new StockMovementRepository(db);
    this.auditService = new AuditService(db);
  }

  create(input: CreateProductInput) {
    // Validation
    this.validationService.validate({
      businessId: input.businessId,
      name: input.name,
      sku: input.sku,
      barcode: input.barcode,
      categoryId: input.categoryId,
      brandId: input.brandId,
      baseUnitId: input.baseUnitId,
      purchaseUnitId: input.purchaseUnitId,
      saleUnitId: input.saleUnitId,
      costPricePaisa: input.costPricePaisa,
      sellingPricePaisa: input.sellingPricePaisa,
      mrpPaisa: input.mrpPaisa,
      minStockMilli: input.minStockMilli,
      reorderLevelMilli: input.reorderLevelMilli,
      openingStockMilli: input.openingStockMilli,
      taxRate: input.taxRate,
    });

    if (input.barcode) {
      this.validationService.validateBarcode(input.barcode);
    }

    // Check duplicate SKU
    const existingSku = this.productRepo.findBySku(input.sku);
    if (existingSku) {
      throw new Error(`SKU ইতিমধ্যে বিদ্যমান: ${input.sku}`);
    }

    // Check duplicate barcode
    if (input.barcode) {
      const existingBarcode = this.productRepo.findByBarcode(input.barcode);
      if (existingBarcode) {
        throw new Error(`বারকোড ইতিমধ্যে বিদ্যমান: ${input.barcode}`);
      }
    }

    // Atomic transaction: product + barcodes + opening stock + cost history + stock movement
    const db = (this.productRepo as any).db;
    const transaction = db.transaction(() => {
      const product = this.productRepo.create({
        businessId: input.businessId,
        categoryId: input.categoryId || null,
        brandId: input.brandId || null,
        baseUnitId: input.baseUnitId,
        purchaseUnitId: input.purchaseUnitId || null,
        saleUnitId: input.saleUnitId || null,
        name: input.name,
        nameBn: input.nameBn || null,
        description: null,
        sku: input.sku,
        barcode: input.barcode || null,
        costPricePaisa: input.costPricePaisa,
        sellingPricePaisa: input.sellingPricePaisa,
        mrpPaisa: input.mrpPaisa || null,
        minStockMilli: input.minStockMilli ?? 0,
        reorderLevelMilli: input.reorderLevelMilli ?? 0,
        openingStockMilli: input.openingStockMilli ?? 0,
        isStockTrackable: input.isStockTrackable ?? true,
        isSellable: input.isSellable ?? true,
        isPurchasable: input.isPurchasable ?? true,
        isActive: true,
        imagePath: null,
        taxRate: input.taxRate ?? 0,
        createdBy: input.createdBy || null,
        updatedBy: null,
      });

      // Barcodes
      if (input.barcodes && input.barcodes.length > 0) {
        for (const bc of input.barcodes) {
          this.validationService.validateBarcode(bc.barcode);
          this.barcodeRepo.create({
            productId: product.id,
            unitId: bc.unitId || null,
            barcode: bc.barcode,
            quantityMilli: bc.quantityMilli ?? 1000,
            isPrimary: bc.isPrimary ?? false,
          });
        }
      } else if (input.barcode) {
        // Primary barcode from product.barcode also stored in product_barcodes for consistency?
        // We keep it only in products.barcode to avoid duplication, but optional
      }

      // Cost history for initial cost
      this.costHistoryRepo.create({
        productId: product.id,
        purchaseId: null,
        oldCostPaisa: 0,
        newCostPaisa: product.costPricePaisa,
        oldWacPaisa: 0,
        newWacPaisa: product.costPricePaisa,
        reason: 'opening',
        createdBy: input.createdBy || null,
      });

      // Opening stock movement + level
      if (product.openingStockMilli > 0) {
        const openingMovement = this.inventoryService.buildOpeningMovement(
          product.businessId,
          product.id,
          product.openingStockMilli,
          product.costPricePaisa,
          input.createdBy
        );

        if (openingMovement) {
          this.stockMovementRepo.create(openingMovement);
          this.stockLevelRepo.upsert({
            businessId: product.businessId,
            productId: product.id,
            locationId: 'main',
            quantityMilli: product.openingStockMilli,
            reservedMilli: 0,
            lastMovementAt: Date.now(),
          });
        }
      }

      // Audit
      this.auditService.log({
        businessId: product.businessId,
        userId: input.createdBy || null,
        action: 'create',
        entityType: 'product',
        entityId: product.id,
        newValues: JSON.stringify({ name: product.name, sku: product.sku, cost: Money.fromPaisa(product.costPricePaisa).formatBDT() }),
      });

      return product;
    });

    return transaction();
  }

  update(id: string, input: Partial<CreateProductInput> & { updatedBy?: string }) {
    const existing = this.productRepo.findById(id);
    if (!existing) throw new Error('পণ্য পাওয়া যায়নি');

    if (input.sku && input.sku !== existing.sku) {
      const dup = this.productRepo.findBySku(input.sku);
      if (dup) throw new Error(`SKU ইতিমধ্যে বিদ্যমান: ${input.sku}`);
    }

    if (input.barcode && input.barcode !== existing.barcode) {
      this.validationService.validateBarcode(input.barcode);
      const dup = this.productRepo.findByBarcode(input.barcode);
      if (dup) throw new Error(`বারকোড ইতিমধ্যে বিদ্যমান: ${input.barcode}`);
    }

    const oldCost = existing.costPricePaisa;

    const db = (this.productRepo as any).db;
    const transaction = db.transaction(() => {
      const updated = this.productRepo.update(id, {
        categoryId: input.categoryId ?? existing.categoryId,
        brandId: input.brandId ?? existing.brandId,
        baseUnitId: input.baseUnitId ?? existing.baseUnitId,
        purchaseUnitId: input.purchaseUnitId ?? existing.purchaseUnitId,
        saleUnitId: input.saleUnitId ?? existing.saleUnitId,
        name: input.name ?? existing.name,
        nameBn: input.nameBn ?? existing.nameBn,
        sku: input.sku ?? existing.sku,
        barcode: input.barcode ?? existing.barcode,
        costPricePaisa: input.costPricePaisa ?? existing.costPricePaisa,
        sellingPricePaisa: input.sellingPricePaisa ?? existing.sellingPricePaisa,
        mrpPaisa: input.mrpPaisa ?? existing.mrpPaisa,
        minStockMilli: input.minStockMilli ?? existing.minStockMilli,
        reorderLevelMilli: input.reorderLevelMilli ?? existing.reorderLevelMilli,
        isStockTrackable: input.isStockTrackable ?? existing.isStockTrackable,
        isSellable: input.isSellable ?? existing.isSellable,
        isPurchasable: input.isPurchasable ?? existing.isPurchasable,
        taxRate: input.taxRate ?? existing.taxRate,
        updatedBy: input.updatedBy || null,
      });

      // Cost history if cost changed
      if (input.costPricePaisa !== undefined && input.costPricePaisa !== oldCost) {
        // Calculate WAC - for simplicity, new WAC = new cost if no stock, else weighted
        const currentStock = this.stockLevelRepo.findByProduct(id);
        const currentWac = oldCost; // simplified, should fetch actual WAC
        const newWac = currentStock && currentStock.quantityMilli > 0
          ? this.inventoryService.calculateNewWAC(currentStock.quantityMilli, currentWac, 0, input.costPricePaisa)
          : input.costPricePaisa;

        this.costHistoryRepo.create({
          productId: id,
          purchaseId: null,
          oldCostPaisa: oldCost,
          newCostPaisa: input.costPricePaisa,
          oldWacPaisa: currentWac,
          newWacPaisa: newWac,
          reason: 'manual_update',
          createdBy: input.updatedBy || null,
        });
      }

      this.auditService.log({
        businessId: existing.businessId,
        userId: input.updatedBy || null,
        action: 'update',
        entityType: 'product',
        entityId: id,
        oldValues: JSON.stringify({ cost: oldCost, name: existing.name }),
        newValues: JSON.stringify({ cost: input.costPricePaisa ?? oldCost, name: input.name ?? existing.name }),
      });

      return updated;
    });

    return transaction();
  }

  findById(id: string) {
    return this.productRepo.findById(id);
  }

  findByBarcode(barcode: string) {
    return this.productRepo.findByBarcode(barcode);
  }

  search(businessId: string, query: string) {
    return this.productRepo.search(businessId, query);
  }
}
