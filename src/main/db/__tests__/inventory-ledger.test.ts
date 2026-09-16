import { describe, it, expect, beforeEach } from 'vitest';
import { StockLevelRepository, StockMovementRepository } from '../repositories/inventory.repository';
import { ProductRepository } from '../repositories/product.repository';
import { UnitRepository } from '../repositories/unit.repository';
import { getTestDb, seedBusiness } from './test-helpers';

describe('Inventory Ledger Invariants', () => {
  let db: any;
  let stockLevelRepo: StockLevelRepository;
  let stockMovementRepo: StockMovementRepository;
  let productRepo: ProductRepository;
  let unitRepo: UnitRepository;
  const businessId = 'biz_inv';

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);

    stockLevelRepo = new StockLevelRepository(db);
    stockMovementRepo = new StockMovementRepository(db);
    productRepo = new ProductRepository(db);
    unitRepo = new UnitRepository(db);
  });

  it('should enforce stock_movements quantity !=0 CHECK', () => {
    const unit = unitRepo.create({
      businessId,
      name: 'Piece',
      shortName: 'pcs',
      nameBn: 'পিস',
      isBaseUnit: true,
      unitGroup: 'piece',
      isActive: true,
    });

    const product = productRepo.create({
      businessId,
      categoryId: null,
      brandId: null,
      baseUnitId: unit.id,
      purchaseUnitId: null,
      saleUnitId: null,
      name: 'Stock Product',
      nameBn: null,
      description: null,
      sku: 'SKU-STK-001',
      barcode: null,
      costPricePaisa: 10000,
      sellingPricePaisa: 12000,
      mrpPaisa: null,
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 0,
      isStockTrackable: true,
      isSellable: true,
      isPurchasable: true,
      isActive: true,
      imagePath: null,
      taxRate: 0,
      createdBy: null,
      updatedBy: null,
    });

    expect(() =>
      stockMovementRepo.create({
        businessId,
        productId: product.id,
        movementType: 'purchase',
        quantityMilli: 0,
        costPaisa: 10000,
        locationId: 'main',
      })
    ).toThrow();
  });

  it('should maintain stock_levels UNIQUE product+location', () => {
    const unit = unitRepo.create({
      businessId,
      name: 'Piece',
      shortName: 'pcs',
      nameBn: 'পিস',
      isBaseUnit: true,
      unitGroup: 'piece',
      isActive: true,
    });

    const product = productRepo.create({
      businessId,
      categoryId: null,
      brandId: null,
      baseUnitId: unit.id,
      purchaseUnitId: null,
      saleUnitId: null,
      name: 'Unique Stock Product',
      nameBn: null,
      description: null,
      sku: 'SKU-UNQ-001',
      barcode: null,
      costPricePaisa: 10000,
      sellingPricePaisa: 12000,
      mrpPaisa: null,
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 0,
      isStockTrackable: true,
      isSellable: true,
      isPurchasable: true,
      isActive: true,
      imagePath: null,
      taxRate: 0,
      createdBy: null,
      updatedBy: null,
    });

    stockLevelRepo.upsert({
      businessId,
      productId: product.id,
      locationId: 'main',
      quantityMilli: 5000,
      reservedMilli: 0,
    });

    // Second upsert should update, not create duplicate
    stockLevelRepo.upsert({
      businessId,
      productId: product.id,
      locationId: 'main',
      quantityMilli: 10000,
      reservedMilli: 0,
    });

    const levels = db.prepare('SELECT COUNT(*) as count FROM stock_levels WHERE product_id = ? AND location_id = ?').get(product.id, 'main') as { count: number };
    expect(levels.count).toBe(1);

    const level = stockLevelRepo.findByProductAndLocation(product.id, 'main');
    expect(level!.quantityMilli).toBe(10000);
  });

  it('should calculate current stock from movements', () => {
    const unit = unitRepo.create({
      businessId,
      name: 'Piece',
      shortName: 'pcs',
      nameBn: 'পিস',
      isBaseUnit: true,
      unitGroup: 'piece',
      isActive: true,
    });

    const product = productRepo.create({
      businessId,
      categoryId: null,
      brandId: null,
      baseUnitId: unit.id,
      purchaseUnitId: null,
      saleUnitId: null,
      name: 'Ledger Product',
      nameBn: null,
      description: null,
      sku: 'SKU-LED-001',
      barcode: null,
      costPricePaisa: 10000,
      sellingPricePaisa: 12000,
      mrpPaisa: null,
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 0,
      isStockTrackable: true,
      isSellable: true,
      isPurchasable: true,
      isActive: true,
      imagePath: null,
      taxRate: 0,
      createdBy: null,
      updatedBy: null,
    });

    stockMovementRepo.create({
      businessId,
      productId: product.id,
      movementType: 'purchase',
      quantityMilli: 10000,
      costPaisa: 10000,
      locationId: 'main',
    });

    stockMovementRepo.create({
      businessId,
      productId: product.id,
      movementType: 'purchase',
      quantityMilli: 5000,
      costPaisa: 11000,
      locationId: 'main',
    });

    stockMovementRepo.create({
      businessId,
      productId: product.id,
      movementType: 'sale',
      quantityMilli: -3000,
      costPaisa: 10000,
      locationId: 'main',
    });

    const currentStock = stockMovementRepo.getCurrentStock(product.id, 'main');
    expect(currentStock).toBe(12000); // 10+5-3 =12

    // Stock level should match movements sum after proper upsert
    stockLevelRepo.upsert({
      businessId,
      productId: product.id,
      locationId: 'main',
      quantityMilli: currentStock,
      reservedMilli: 0,
    });

    const level = stockLevelRepo.findByProductAndLocation(product.id, 'main');
    expect(level!.quantityMilli).toBe(currentStock);
  });

  it('should enforce ledger invariant via transaction', () => {
    const unit = unitRepo.create({
      businessId,
      name: 'Piece',
      shortName: 'pcs',
      nameBn: 'পিস',
      isBaseUnit: true,
      unitGroup: 'piece',
      isActive: true,
    });

    const product = productRepo.create({
      businessId,
      categoryId: null,
      brandId: null,
      baseUnitId: unit.id,
      purchaseUnitId: null,
      saleUnitId: null,
      name: 'Invariant Product',
      nameBn: null,
      description: null,
      sku: 'SKU-INV-001',
      barcode: null,
      costPricePaisa: 10000,
      sellingPricePaisa: 12000,
      mrpPaisa: null,
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 0,
      isStockTrackable: true,
      isSellable: true,
      isPurchasable: true,
      isActive: true,
      imagePath: null,
      taxRate: 0,
      createdBy: null,
      updatedBy: null,
    });

    // Simulate atomic transaction that updates both movement and level
    const transaction = db.transaction(() => {
      stockMovementRepo.create({
        businessId,
        productId: product.id,
        movementType: 'purchase',
        quantityMilli: 5000,
        costPaisa: 10000,
        locationId: 'main',
      });

      stockLevelRepo.upsert({
        businessId,
        productId: product.id,
        locationId: 'main',
        quantityMilli: 5000,
        reservedMilli: 0,
      });
    });

    transaction();

    const movementsSum = stockMovementRepo.getCurrentStock(product.id, 'main');
    const level = stockLevelRepo.findByProductAndLocation(product.id, 'main');

    expect(movementsSum).toBe(level!.quantityMilli);
  });
});
