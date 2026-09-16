import { describe, it, expect, beforeEach } from 'vitest';
import { ProductService } from '../../services/product.service';
import { InventoryTransactionService } from '../../services/inventory-transaction.service';
import { UnitRepository } from '../repositories/unit.repository';
import { getTestDb, seedBusiness } from './test-helpers';

describe('Transaction Atomicity', () => {
  let db: any;
  let productService: ProductService;
  let inventoryService: InventoryTransactionService;
  let unitRepo: UnitRepository;
  const businessId = 'biz_atomic';

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);

    unitRepo = new UnitRepository(db);
    productService = new ProductService(db);
    inventoryService = new InventoryTransactionService(db);
  });

  it('should create product atomically with opening stock', () => {
    const unit = unitRepo.create({
      businessId,
      name: 'Piece',
      shortName: 'pcs',
      nameBn: 'পিস',
      isBaseUnit: true,
      unitGroup: 'piece',
      isActive: true,
    });

    const product = productService.create({
      businessId,
      name: 'Atomic Product',
      sku: 'ATOMIC-001',
      baseUnitId: unit.id,
      costPricePaisa: 10000,
      sellingPricePaisa: 12000,
      openingStockMilli: 5000,
      createdBy: 'user1',
    });

    expect(product.id).toBeDefined();

    // Check stock movement created
    const movements = db.prepare('SELECT COUNT(*) as count FROM stock_movements WHERE product_id = ?').get(product.id) as { count: number };
    expect(movements.count).toBe(1);

    // Check stock level created
    const level = db.prepare('SELECT * FROM stock_levels WHERE product_id = ?').get(product.id) as any;
    expect(level).toBeDefined();
    expect(level.quantity_milli).toBe(5000);

    // Check cost history
    const history = db.prepare('SELECT COUNT(*) as count FROM product_cost_history WHERE product_id = ?').get(product.id) as { count: number };
    expect(history.count).toBe(1);
  });

  it('should rollback product creation if barcode duplicate', () => {
    const unit = unitRepo.create({
      businessId,
      name: 'Piece',
      shortName: 'pcs',
      nameBn: 'পিস',
      isBaseUnit: true,
      unitGroup: 'piece',
      isActive: true,
    });

    // First product with barcode
    productService.create({
      businessId,
      name: 'First Product',
      sku: 'FIRST-001',
      barcode: 'DUPLICATE-BC',
      baseUnitId: unit.id,
      costPricePaisa: 10000,
      sellingPricePaisa: 12000,
    });

    // Second product with same barcode should fail and rollback
    expect(() =>
      productService.create({
        businessId,
        name: 'Second Product',
        sku: 'SECOND-001',
        barcode: 'DUPLICATE-BC',
        baseUnitId: unit.id,
        costPricePaisa: 10000,
        sellingPricePaisa: 12000,
      })
    ).toThrow();

    // Ensure second product not created
    const count = db.prepare('SELECT COUNT(*) as count FROM products WHERE sku = ?').get('SECOND-001') as { count: number };
    expect(count.count).toBe(0);

    // Ensure no orphan stock movements
    const movements = db.prepare('SELECT COUNT(*) as count FROM stock_movements').get() as { count: number };
    expect(movements.count).toBe(0); // First product had no opening stock, so 0
  });

  it('should receive purchase atomically with WAC update', () => {
    const unit = unitRepo.create({
      businessId,
      name: 'Piece',
      shortName: 'pcs',
      nameBn: 'পিস',
      isBaseUnit: true,
      unitGroup: 'piece',
      isActive: true,
    });

    const product = productService.create({
      businessId,
      name: 'WAC Product',
      sku: 'WAC-001',
      baseUnitId: unit.id,
      costPricePaisa: 10000,
      sellingPricePaisa: 12000,
      openingStockMilli: 10000, // 10 pieces at 100 Tk
    });

    // Purchase 5 pieces at 120 Tk
    const result = inventoryService.receivePurchase({
      businessId,
      purchaseId: 'purchase1',
      items: [
        {
          productId: product.id,
          quantityMilli: 5000,
          costPaisa: 12000,
        },
      ],
      createdBy: 'user1',
    });

    expect(result.length).toBe(1);
    expect(result[0].oldStock).toBe(10000);
    expect(result[0].newStock).toBe(15000);
    expect(result[0].newWac).toBeGreaterThan(10000);
    expect(result[0].newWac).toBeLessThan(12000);

    // Check product cost updated to WAC
    const updatedProduct = db.prepare('SELECT cost_price_paisa FROM products WHERE id = ?').get(product.id) as { cost_price_paisa: number };
    expect(updatedProduct.cost_price_paisa).toBe(result[0].newWac);

    // Check ledger invariant
    const invariant = inventoryService.verifyProductLedger(product.id);
    expect(invariant.valid).toBe(true);
  });

  it('should deduct for sale atomically and prevent oversell', () => {
    const unit = unitRepo.create({
      businessId,
      name: 'Piece',
      shortName: 'pcs',
      nameBn: 'পিস',
      isBaseUnit: true,
      unitGroup: 'piece',
      isActive: true,
    });

    const product = productService.create({
      businessId,
      name: 'Sale Product',
      sku: 'SALE-001',
      baseUnitId: unit.id,
      costPricePaisa: 10000,
      sellingPricePaisa: 12000,
      openingStockMilli: 5000,
    });

    // Deduct 3 pieces
    const result = inventoryService.deductForSale({
      businessId,
      saleId: 'sale1',
      items: [
        {
          productId: product.id,
          quantityMilli: 3000,
          costPaisa: 10000,
        },
      ],
    });

    expect(result[0].newStock).toBe(2000);

    // Try to deduct 3 more when only 2 left - should fail
    expect(() =>
      inventoryService.deductForSale({
        businessId,
        saleId: 'sale2',
        items: [
          {
            productId: product.id,
            quantityMilli: 3000,
            costPaisa: 10000,
          },
        ],
      })
    ).toThrow();

    // Stock should still be 2
    const level = db.prepare('SELECT quantity_milli FROM stock_levels WHERE product_id = ?').get(product.id) as { quantity_milli: number };
    expect(level.quantity_milli).toBe(2000);
  });

  it('should maintain ledger invariant after multiple operations', () => {
    const unit = unitRepo.create({
      businessId,
      name: 'Piece',
      shortName: 'pcs',
      nameBn: 'পিস',
      isBaseUnit: true,
      unitGroup: 'piece',
      isActive: true,
    });

    const product = productService.create({
      businessId,
      name: 'Ledger Product',
      sku: 'LEDGER-001',
      baseUnitId: unit.id,
      costPricePaisa: 10000,
      sellingPricePaisa: 12000,
      openingStockMilli: 10000,
    });

    inventoryService.receivePurchase({
      businessId,
      purchaseId: 'pur1',
      items: [{ productId: product.id, quantityMilli: 5000, costPaisa: 11000 }],
    });

    inventoryService.deductForSale({
      businessId,
      saleId: 'sale1',
      items: [{ productId: product.id, quantityMilli: 3000, costPaisa: 10000 }],
    });

    inventoryService.receivePurchase({
      businessId,
      purchaseId: 'pur2',
      items: [{ productId: product.id, quantityMilli: 2000, costPaisa: 10500 }],
    });

    const invariant = inventoryService.verifyProductLedger(product.id);
    expect(invariant.valid).toBe(true);
    expect(invariant.difference).toBe(0);

    const movementsSum = db.prepare('SELECT SUM(quantity_milli) as total FROM stock_movements WHERE product_id = ?').get(product.id) as { total: number };
    const level = db.prepare('SELECT quantity_milli FROM stock_levels WHERE product_id = ?').get(product.id) as { quantity_milli: number };
    expect(movementsSum.total).toBe(level.quantity_milli);
    expect(level.quantity_milli).toBe(14000); // 10+5-3+2
  });
});
