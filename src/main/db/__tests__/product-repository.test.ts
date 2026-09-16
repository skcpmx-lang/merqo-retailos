import { describe, it, expect, beforeEach } from 'vitest';
import { ProductRepository, ProductBarcodeRepository, ProductCostHistoryRepository } from '../repositories/product.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { UnitRepository } from '../repositories/unit.repository';
import { getTestDb, seedBusiness } from './test-helpers';

describe('ProductRepository', () => {
  let db: any;
  let productRepo: ProductRepository;
  let categoryRepo: CategoryRepository;
  let unitRepo: UnitRepository;
  let barcodeRepo: ProductBarcodeRepository;
  let costHistoryRepo: ProductCostHistoryRepository;
  const businessId = 'biz_test';

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);

    productRepo = new ProductRepository(db);
    categoryRepo = new CategoryRepository(db);
    unitRepo = new UnitRepository(db);
    barcodeRepo = new ProductBarcodeRepository(db);
    costHistoryRepo = new ProductCostHistoryRepository(db);
  });

  it('should create product with SKU unique constraint', () => {
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
      name: 'Test Product',
      nameBn: null,
      description: null,
      sku: 'SKU-001',
      barcode: '1234567890123',
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

    expect(product.id).toBeDefined();
    expect(product.sku).toBe('SKU-001');

    // Duplicate SKU should throw ConflictError
    expect(() =>
      productRepo.create({
        businessId,
        categoryId: null,
        brandId: null,
        baseUnitId: unit.id,
        purchaseUnitId: null,
        saleUnitId: null,
        name: 'Another',
        nameBn: null,
        description: null,
        sku: 'SKU-001',
        barcode: '999999',
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
      })
    ).toThrow();
  });

  it('should find by barcode', () => {
    const unit = unitRepo.create({
      businessId,
      name: 'Piece',
      shortName: 'pcs',
      nameBn: 'পিস',
      isBaseUnit: true,
      unitGroup: 'piece',
      isActive: true,
    });

    productRepo.create({
      businessId,
      categoryId: null,
      brandId: null,
      baseUnitId: unit.id,
      purchaseUnitId: null,
      saleUnitId: null,
      name: 'Barcode Product',
      nameBn: null,
      description: null,
      sku: 'SKU-BC-001',
      barcode: 'BC123456',
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

    const found = productRepo.findByBarcode('BC123456');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Barcode Product');
  });

  it('should manage barcodes', () => {
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
      name: 'Multi Barcode',
      nameBn: null,
      description: null,
      sku: 'SKU-MB-001',
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

    barcodeRepo.create({
      productId: product.id,
      unitId: unit.id,
      barcode: 'BARCODE1',
      quantityMilli: 1000,
      isPrimary: true,
    });

    barcodeRepo.create({
      productId: product.id,
      unitId: unit.id,
      barcode: 'BARCODE2',
      quantityMilli: 12000,
      isPrimary: false,
    });

    const barcodes = barcodeRepo.findByProduct(product.id);
    expect(barcodes.length).toBe(2);

    const found = productRepo.findByBarcode('BARCODE2');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(product.id);
  });

  it('should track cost history immutable', () => {
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
      name: 'Cost History Product',
      nameBn: null,
      description: null,
      sku: 'SKU-CH-001',
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

    costHistoryRepo.create({
      productId: product.id,
      purchaseId: null,
      oldCostPaisa: 0,
      newCostPaisa: 10000,
      oldWacPaisa: 0,
      newWacPaisa: 10000,
      reason: 'opening',
      createdBy: null,
    });

    costHistoryRepo.create({
      productId: product.id,
      purchaseId: null,
      oldCostPaisa: 10000,
      newCostPaisa: 11000,
      oldWacPaisa: 10000,
      newWacPaisa: 10500,
      reason: 'purchase',
      createdBy: null,
    });

    const history = costHistoryRepo.findByProduct(product.id);
    expect(history.length).toBe(2);
    expect(history[0].newCostPaisa).toBe(11000); // most recent first
  });

  it('should soft delete', () => {
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
      name: 'Delete Product',
      nameBn: null,
      description: null,
      sku: 'SKU-DEL-001',
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

    productRepo.softDelete(product.id);
    const found = productRepo.findById(product.id);
    expect(found).toBeNull();
  });
});
