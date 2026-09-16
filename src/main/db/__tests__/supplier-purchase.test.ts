import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb, seedBusiness } from './test-helpers';
import { SupplierRepository, SupplierTransactionRepository } from '../repositories/supplier.repository';
import { PurchaseRepository, PurchaseItemRepository, PurchasePaymentRepository, PurchaseReturnRepository, PurchaseReturnItemRepository } from '../repositories/purchase.repository';
import { ProductRepository } from '../repositories/product.repository';
import { UnitRepository, UnitConversionRepository } from '../repositories/unit.repository';
import { StockLevelRepository, StockMovementRepository } from '../repositories/inventory.repository';
import { SupplierService } from '../../services/supplier.service';
import { PurchaseService } from '../../services/purchase.service';

describe('Supplier & Purchase Integration', () => {
  let db: any;
  const businessId = 'biz_phase3a';
  let supplierRepo: SupplierRepository;
  let supplierTxRepo: SupplierTransactionRepository;
  let productRepo: ProductRepository;
  let unitRepo: UnitRepository;
  let unitConvRepo: UnitConversionRepository;
  let stockLevelRepo: StockLevelRepository;
  let stockMovementRepo: StockMovementRepository;
  let purchaseRepo: PurchaseRepository;
  let supplierService: SupplierService;
  let purchaseService: PurchaseService;

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    supplierRepo = new SupplierRepository(db);
    supplierTxRepo = new SupplierTransactionRepository(db);
    productRepo = new ProductRepository(db);
    unitRepo = new UnitRepository(db);
    unitConvRepo = new UnitConversionRepository(db);
    stockLevelRepo = new StockLevelRepository(db);
    stockMovementRepo = new StockMovementRepository(db);
    purchaseRepo = new PurchaseRepository(db);
    supplierService = new SupplierService(db);
    purchaseService = new PurchaseService(db);
  });

  it('should create supplier with extended fields', () => {
    const supplier = supplierService.create({
      businessId,
      name: 'রহিম ট্রেডার্স',
      companyName: 'Rahim Traders Ltd',
      phone: '01711111111',
      alternatePhone: '01822222222',
      email: 'rahim@example.com',
      address: 'Dhaka',
      contactPerson: 'Rahim',
      notes: 'Regular supplier',
      openingPayablePaisa: 50000,
    });

    expect(supplier.id).toBeDefined();
    expect(supplier.name).toBe('রহিম ট্রেডার্স');
    expect((supplier as any).companyName).toBe('Rahim Traders Ltd');
    expect((supplier as any).alternatePhone).toBe('01822222222');
    expect(supplier.openingPayablePaisa).toBe(50000);

    const txs = supplierTxRepo.findBySupplier(supplier.id);
    expect(txs.length).toBe(1);
    expect(txs[0].amountPaisa).toBe(50000);
    expect(txs[0].transactionType).toBe('opening_payable');
  });

  it('should prevent hard delete with transactions', () => {
    const supplier = supplierService.create({
      businessId,
      name: 'Test Supplier',
      openingPayablePaisa: 10000,
    });

    expect(() => supplierService.delete(supplier.id)).toThrow(/লেনদেন/);
  });

  it('should search suppliers', () => {
    supplierService.create({ businessId, name: 'Alpha Traders', phone: '01711111111' });
    supplierService.create({ businessId, name: 'Beta Suppliers', companyName: 'Beta Ltd', phone: '01722222222' });
    supplierService.create({ businessId, name: 'Gamma', phone: '01733333333' });

    const results = supplierRepo.search(businessId, 'Beta');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Beta Suppliers');

    const phoneResults = supplierRepo.search(businessId, '0171111');
    expect(phoneResults.length).toBe(1);
  });

  it('should create purchase with inventory and WAC', () => {
    const unitPiece = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', nameBn: 'পিস', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const unitCarton = unitRepo.create({ businessId, name: 'Carton', shortName: 'ctn', nameBn: 'কার্টন', isBaseUnit: false, unitGroup: 'piece', isActive: true });
    unitConvRepo.create({ businessId, fromUnitId: unitCarton.id, toUnitId: unitPiece.id, conversionFactor: 24, isBaseConversion: false });

    const supplier = supplierService.create({ businessId, name: 'Supplier A' });

    const product = productRepo.create({
      businessId,
      baseUnitId: unitPiece.id,
      name: 'Test Product',
      sku: 'SKU-001',
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

    // Purchase 5 cartons at 2400 BDT per carton = 100 BDT per piece
    const purchase = purchaseService.create({
      businessId,
      supplierId: supplier.id,
      items: [
        {
          productId: product.id,
          unitId: unitCarton.id,
          quantityMilli: 5000, // 5 cartons
          costPerUnitPaisa: 240000, // 2400 BDT per carton
        },
      ],
      paidPaisa: 0,
    });

    expect(purchase.id).toBeDefined();
    expect(purchase.totalPaisa).toBe(1200000); // 5 * 2400 = 12000 BDT = 1200000 paisa
    expect(purchase.duePaisa).toBe(1200000);

    // Inventory should be 5*24 = 120 pieces = 120000 milli
    const level = stockLevelRepo.findByProduct(product.id);
    expect(level).not.toBeNull();
    expect(level!.quantityMilli).toBe(120000);

    // WAC should be 100 BDT per piece = 10000 paisa
    const updatedProduct = productRepo.findById(product.id);
    expect(updatedProduct!.costPricePaisa).toBe(10000);

    // Supplier payable
    const payable = supplierTxRepo.getCurrentPayable(supplier.id);
    expect(payable).toBe(1200000);

    // Stock ledger invariant
    const movementsSum = stockMovementRepo.getCurrentStock(product.id, 'main');
    expect(movementsSum).toBe(level!.quantityMilli);
  });

  it('should handle split payment', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const supplier = supplierService.create({ businessId, name: 'Supplier Split' });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Split Product',
      sku: 'SKU-SPLIT',
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

    const purchase = purchaseService.create({
      businessId,
      supplierId: supplier.id,
      items: [
        { productId: product.id, unitId: unit.id, quantityMilli: 10000, costPerUnitPaisa: 10000 }, // 10 pcs at 100 BDT = 1000 BDT
      ],
      payments: [
        { method: 'cash', amountPaisa: 40000 }, // 400 BDT
        { method: 'bkash', amountPaisa: 20000 }, // 200 BDT
      ],
    });

    expect(purchase.totalPaisa).toBe(100000);
    expect(purchase.paidPaisa).toBe(60000);
    expect(purchase.duePaisa).toBe(40000);
    expect(purchase.status).toBe('partially_paid');

    const payable = supplierTxRepo.getCurrentPayable(supplier.id);
    // Purchase +100000, payments -40000 -20000 = +40000
    expect(payable).toBe(40000);
  });

  it('should handle purchase return', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const supplier = supplierService.create({ businessId, name: 'Supplier Return' });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Return Product',
      sku: 'SKU-RET',
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

    const purchase = purchaseService.create({
      businessId,
      supplierId: supplier.id,
      items: [{ productId: product.id, unitId: unit.id, quantityMilli: 10000, costPerUnitPaisa: 10000 }],
    });

    let level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(10000);

    // Return 3 pieces
    const ret = purchaseService.createReturn({
      businessId,
      purchaseId: purchase.id,
      items: [{ productId: product.id, quantityMilli: 3000 }],
      reason: 'Damaged',
    });

    expect(ret.return.totalPaisa).toBe(30000);

    level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(7000);

    const payable = supplierTxRepo.getCurrentPayable(supplier.id);
    // 100000 - 30000 = 70000
    expect(payable).toBe(70000);

    // Try to return more than eligible
    expect(() =>
      purchaseService.createReturn({
        businessId,
        purchaseId: purchase.id,
        items: [{ productId: product.id, quantityMilli: 8000 }],
      })
    ).toThrow();
  });

  it('should enforce purchase numbering uniqueness', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const supplier = supplierService.create({ businessId, name: 'Numbering Supplier' });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Number Product',
      sku: 'SKU-NUM',
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

    const p1 = purchaseService.create({
      businessId,
      supplierId: supplier.id,
      items: [{ productId: product.id, unitId: unit.id, quantityMilli: 1000, costPerUnitPaisa: 10000 }],
    });
    const p2 = purchaseService.create({
      businessId,
      supplierId: supplier.id,
      items: [{ productId: product.id, unitId: unit.id, quantityMilli: 1000, costPerUnitPaisa: 10000 }],
    });

    expect(p1.purchaseNumber).not.toBe(p2.purchaseNumber);
    expect(p1.purchaseNumber).toMatch(/PUR-/);
  });

  it('should generate supplier statement with running balance', () => {
    const supplier = supplierService.create({ businessId, name: 'Statement Supplier', openingPayablePaisa: 10000 });

    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Stmt Product',
      sku: 'SKU-STMT',
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

    const purchase = purchaseService.create({
      businessId,
      supplierId: supplier.id,
      items: [{ productId: product.id, unitId: unit.id, quantityMilli: 5000, costPerUnitPaisa: 10000 }],
    });

    purchaseService.paySupplier({
      businessId,
      supplierId: supplier.id,
      amountPaisa: 20000,
      method: 'cash',
    });

    const statement = supplierService.getStatement(supplier.id);

    expect(statement.openingBalance).toBe(0); // No fromDate, so opening 0
    expect(statement.transactions.length).toBe(3); // opening, purchase, payment
    expect(statement.currentPayable).toBe(40000); // 10000 + 50000 - 20000

    // Check running balance
    expect(statement.transactions[0].runningBalance).toBe(10000);
    expect(statement.transactions[1].runningBalance).toBe(60000);
    expect(statement.transactions[2].runningBalance).toBe(40000);
  });
});
