/**
 * End-to-end integration test for Phase 3A
 * Supplier -> Purchase -> Receive -> Inventory -> WAC -> Payable -> Partial Payment -> Return -> Ledger consistency
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb, seedBusiness } from './test-helpers';
import { SupplierService } from '../../services/supplier.service';
import { PurchaseService } from '../../services/purchase.service';
import { ProductRepository } from '../repositories/product.repository';
import { UnitRepository, UnitConversionRepository } from '../repositories/unit.repository';
import { StockLevelRepository, StockMovementRepository } from '../repositories/inventory.repository';
import { SupplierTransactionRepository } from '../repositories/supplier.repository';

describe('Purchase E2E — Full Ledger Consistency', () => {
  let db: any;
  const businessId = 'biz_e2e';

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
  });

  it('should maintain all ledgers through full workflow', () => {
    const unitPiece = new UnitRepository(db).create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const unitCarton = new UnitRepository(db).create({ businessId, name: 'Carton', shortName: 'ctn', isBaseUnit: false, unitGroup: 'piece', isActive: true });
    new UnitConversionRepository(db).create({ businessId, fromUnitId: unitCarton.id, toUnitId: unitPiece.id, conversionFactor: 24, isBaseConversion: false });

    const supplierService = new SupplierService(db);
    const purchaseService = new PurchaseService(db);
    const productRepo = new ProductRepository(db);
    const stockLevelRepo = new StockLevelRepository(db);
    const stockMovementRepo = new StockMovementRepository(db);
    const supplierTxRepo = new SupplierTransactionRepository(db);

    // Step 1: Create supplier
    const supplier = supplierService.create({
      businessId,
      name: 'E2E Supplier',
      phone: '01700000000',
      openingPayablePaisa: 0,
    });
    expect(supplier.currentPayablePaisa).toBe(0);

    // Step 2: Create product with zero stock
    const product = productRepo.create({
      businessId,
      baseUnitId: unitPiece.id,
      name: 'E2E Product',
      sku: 'E2E-001',
      costPricePaisa: 0,
      sellingPricePaisa: 15000,
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 0,
      isStockTrackable: true,
      isSellable: true,
      isPurchasable: true,
      isActive: true,
      taxRate: 0,
    } as any);

    // Step 3: Purchase 10 cartons at 2400 BDT per carton = 100 BDT per piece, total 24000 BDT
    const purchase1 = purchaseService.create({
      businessId,
      supplierId: supplier.id,
      items: [
        {
          productId: product.id,
          unitId: unitCarton.id,
          quantityMilli: 10000, // 10 cartons
          costPerUnitPaisa: 240000, // 2400 BDT
        },
      ],
      paidPaisa: 0,
    });

    // Verify inventory: 10*24 = 240 pieces = 240000 milli
    let level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(240000);

    // Verify WAC: 100 BDT = 10000 paisa
    let updatedProduct = productRepo.findById(product.id);
    expect(updatedProduct!.costPricePaisa).toBe(10000);

    // Verify supplier payable: 24000 BDT = 2400000 paisa
    let payable = supplierTxRepo.getCurrentPayable(supplier.id);
    expect(payable).toBe(2400000);

    // Verify stock ledger invariant
    let movementsSum = stockMovementRepo.getCurrentStock(product.id, 'main');
    expect(movementsSum).toBe(level!.quantityMilli);

    // Step 4: Second purchase at higher cost: 5 cartons at 3000 BDT per carton = 125 BDT per piece
    const purchase2 = purchaseService.create({
      businessId,
      supplierId: supplier.id,
      items: [
        {
          productId: product.id,
          unitId: unitCarton.id,
          quantityMilli: 5000, // 5 cartons = 120 pieces
          costPerUnitPaisa: 300000, // 3000 BDT
        },
      ],
      paidPaisa: 0,
    });

    // Inventory: 240 + 120 = 360 pieces = 360000 milli
    level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(360000);

    // WAC: (240*100 + 120*125)/360 = (24000+15000)/360 = 39000/360 = 108.333... = 10833 paisa
    updatedProduct = productRepo.findById(product.id);
    expect(updatedProduct!.costPricePaisa).toBeGreaterThan(10000);
    expect(updatedProduct!.costPricePaisa).toBeLessThan(12500);
    expect(updatedProduct!.costPricePaisa).toBe(10833);

    // Payable: 24000 + 15000 = 39000 BDT = 3900000 paisa
    payable = supplierTxRepo.getCurrentPayable(supplier.id);
    expect(payable).toBe(3900000);

    // Stock invariant still holds
    movementsSum = stockMovementRepo.getCurrentStock(product.id, 'main');
    expect(movementsSum).toBe(level!.quantityMilli);

    // Step 5: Partial payment 10000 BDT
    const payment = purchaseService.paySupplier({
      businessId,
      supplierId: supplier.id,
      amountPaisa: 1000000, // 10000 BDT
      method: 'cash',
    });

    expect(payment.newPayable).toBe(2900000); // 39000-10000 = 29000 BDT
    payable = supplierTxRepo.getCurrentPayable(supplier.id);
    expect(payable).toBe(2900000);

    // Step 6: Return 2 cartons from first purchase (48 pieces)
    const ret = purchaseService.createReturn({
      businessId,
      purchaseId: purchase1.id,
      items: [
        {
          productId: product.id,
          unitId: unitCarton.id,
          quantityMilli: 2000, // 2 cartons
        },
      ],
      reason: 'Damaged',
    });

    // Inventory: 360 - 48 = 312 pieces = 312000 milli
    level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(312000);

    // Payable: 29000 - (2*100 BDT?) Actually return uses cost from purchase item base cost 100 BDT per piece = 48*100=4800 BDT
    // So 29000 - 4800 = 24200 BDT = 2420000 paisa
    payable = supplierTxRepo.getCurrentPayable(supplier.id);
    expect(payable).toBe(2420000);

    // Final ledger invariants
    movementsSum = stockMovementRepo.getCurrentStock(product.id, 'main');
    expect(movementsSum).toBe(level!.quantityMilli);

    // Verify supplier ledger SUM matches current
    const txs = supplierTxRepo.findBySupplier(supplier.id, 100);
    const sumTxs = txs.reduce((sum, tx) => sum + tx.amountPaisa, 0);
    expect(sumTxs).toBe(payable);

    // All money integer paisa
    expect(Number.isInteger(payable)).toBe(true);
    expect(Number.isInteger(level!.quantityMilli)).toBe(true);
  });

  it('should rollback on failure', () => {
    const unit = new UnitRepository(db).create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const supplierService = new SupplierService(db);
    const purchaseService = new PurchaseService(db);
    const productRepo = new ProductRepository(db);
    const stockLevelRepo = new StockLevelRepository(db);

    const supplier = supplierService.create({ businessId, name: 'Rollback Supplier' });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Rollback Product',
      sku: 'ROLL-001',
      costPricePaisa: 10000,
      sellingPricePaisa: 12000,
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 0,
      isStockTrackable: true,
      isSellable: true,
      isPurchasable: true,
      isActive: true,
      taxRate: 0,
    } as any);

    // Try to create purchase with invalid product
    expect(() =>
      purchaseService.create({
        businessId,
        supplierId: supplier.id,
        items: [
          { productId: 'invalid-id', unitId: unit.id, quantityMilli: 1000, costPerUnitPaisa: 10000 },
        ],
      })
    ).toThrow();

    // Ensure no stock was added
    const level = stockLevelRepo.findByProduct(product.id);
    expect(level).toBeNull();

    // Ensure no purchase created
    const count = db.prepare('SELECT COUNT(*) as count FROM purchases').get() as { count: number };
    expect(count.count).toBe(0);

    // Ensure supplier payable still 0
    const supplierTxRepo = new SupplierTransactionRepository(db);
    const payable = supplierTxRepo.getCurrentPayable(supplier.id);
    expect(payable).toBe(0);
  });
});
