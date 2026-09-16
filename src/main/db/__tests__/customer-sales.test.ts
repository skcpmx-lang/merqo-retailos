import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb, seedBusiness } from './test-helpers';
import { CustomerRepository, CustomerTransactionRepository } from '../repositories/customer.repository';
import { ProductRepository } from '../repositories/product.repository';
import { UnitRepository, UnitConversionRepository } from '../repositories/unit.repository';
import { StockLevelRepository, StockMovementRepository } from '../repositories/inventory.repository';
import { CustomerService } from '../../services/customer.service';
import { SaleService } from '../../services/sale.service';
import { PurchaseService } from '../../services/purchase.service';
import { SupplierService } from '../../services/supplier.service';
import { SaleRepository } from '../repositories/sale.repository';

describe('Phase 3B Customer & Sales', () => {
  let db: any;
  const businessId = 'biz_phase3b';
  let customerRepo: CustomerRepository;
  let customerTxRepo: CustomerTransactionRepository;
  let customerService: CustomerService;
  let saleService: SaleService;
  let productRepo: ProductRepository;
  let unitRepo: UnitRepository;
  let unitConvRepo: UnitConversionRepository;
  let stockLevelRepo: StockLevelRepository;
  let stockMovementRepo: StockMovementRepository;
  let saleRepo: SaleRepository;
  let purchaseService: PurchaseService;
  let supplierService: SupplierService;

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    customerRepo = new CustomerRepository(db);
    customerTxRepo = new CustomerTransactionRepository(db);
    customerService = new CustomerService(db);
    saleService = new SaleService(db);
    productRepo = new ProductRepository(db);
    unitRepo = new UnitRepository(db);
    unitConvRepo = new UnitConversionRepository(db);
    stockLevelRepo = new StockLevelRepository(db);
    stockMovementRepo = new StockMovementRepository(db);
    saleRepo = new SaleRepository(db);
    purchaseService = new PurchaseService(db);
    supplierService = new SupplierService(db);
  });

  it('should create customer with opening due and ledger', () => {
    const customer = customerService.create({
      businessId,
      name: 'করিম ট্রেডার্স',
      phone: '01711111111',
      openingDuePaisa: 50000,
    });

    expect(customer.id).toBeDefined();
    expect(customer.openingDuePaisa).toBe(50000);
    expect(customer.currentDuePaisa).toBe(50000);

    const txs = customerTxRepo.findByCustomer(customer.id);
    expect(txs.length).toBe(1);
    expect(txs[0].transactionType).toBe('opening_due');
    expect(txs[0].amountPaisa).toBe(50000);

    const due = customerTxRepo.getCurrentDue(customer.id);
    expect(due).toBe(50000);
  });

  it('should search customers', () => {
    customerService.create({ businessId, name: 'Alpha Customer', phone: '01711111111' });
    customerService.create({ businessId, name: 'Beta Buyer', phone: '01722222222' });

    const results = customerRepo.search(businessId, 'Beta');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Beta Buyer');
  });

  it('should enforce customer statement running balance deterministic', () => {
    const customer = customerService.create({ businessId, name: 'Statement Customer', openingDuePaisa: 10000 });
    // Sale simulation via transaction
    const saleTx = {
      businessId,
      customerId: customer.id,
      transactionType: 'sale',
      amountPaisa: 20000,
      referenceType: 'sale',
      referenceId: 'sale-1',
      notes: 'test sale',
      createdBy: null,
    };
    customerTxRepo.create(saleTx as any);

    const paymentTx = {
      businessId,
      customerId: customer.id,
      transactionType: 'payment',
      amountPaisa: -5000,
      referenceType: 'customer_payment',
      referenceId: 'pay-1',
      notes: 'payment',
      createdBy: null,
    };
    customerTxRepo.create(paymentTx as any);

    const statement = customerService.getStatement(customer.id);
    expect(statement.transactions.length).toBe(3);
    // opening 10000, sale +20000 = 30000, payment -5000 = 25000
    expect(statement.transactions[0].runningBalance).toBe(10000);
    expect(statement.transactions[1].runningBalance).toBe(30000);
    expect(statement.transactions[2].runningBalance).toBe(25000);
    expect(statement.currentDue).toBe(25000);
  });

  it('should create sale cash with inventory deduction and WAC COGS snapshot', () => {
    const unitPiece = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', nameBn: 'পিস', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const unitCarton = unitRepo.create({ businessId, name: 'Carton', shortName: 'ctn', nameBn: 'কার্টন', isBaseUnit: false, unitGroup: 'piece', isActive: true });
    unitConvRepo.create({ businessId, fromUnitId: unitCarton.id, toUnitId: unitPiece.id, conversionFactor: 24, isBaseConversion: false });

    const supplier = supplierService.create({ businessId, name: 'Supplier for WAC' });
    const product = productRepo.create({
      businessId,
      baseUnitId: unitPiece.id,
      name: 'WAC Product',
      sku: 'SKU-WAC',
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

    // Purchase 10 cartons * 24 = 240 pcs at 2400 BDT per carton = 100 BDT per piece
    purchaseService.create({
      businessId,
      supplierId: supplier.id,
      items: [{ productId: product.id, unitId: unitCarton.id, quantityMilli: 10000, costPerUnitPaisa: 240000 }],
      paidPaisa: 0,
    });

    const updatedProduct = productRepo.findById(product.id);
    expect(updatedProduct!.costPricePaisa).toBe(10000); // WAC 100 BDT

    let level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(240000); // 240 pcs

    // Create sale 2 cartons = 48 pcs
    const sale = saleService.create({
      businessId,
      items: [
        { productId: product.id, unitId: unitCarton.id, quantityMilli: 2000, unitPricePaisa: 288000 }, // 2 cartons at 2880 BDT per carton = 120 BDT per piece
      ],
      paidPaisa: 576000, // 5760 BDT
    });

    expect(sale.totalPaisa).toBe(576000);
    expect(sale.paidPaisa).toBe(576000);
    expect(sale.duePaisa).toBe(0);
    expect(sale.status).toBe('paid');

    level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(192000); // 240 - 48 = 192 pcs

    // Check COGS snapshot immutable
    const saleDetail = saleService.findById(sale.id);
    expect(saleDetail!.items[0].costPerUnitPaisa).toBe(10000); // WAC at sale time
    expect(saleDetail!.items[0].lineCostTotalPaisa).toBe(480000); // 48 * 100 = 4800 BDT

    // Stock movements sum invariant
    const stockSum = stockMovementRepo.getCurrentStock(product.id, 'main');
    expect(stockSum).toBe(level!.quantityMilli);
  });

  it('should create sale credit with due and customer ledger', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const customer = customerService.create({ businessId, name: 'Credit Customer' });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Credit Product',
      sku: 'SKU-CRED',
      costPricePaisa: 10000,
      sellingPricePaisa: 12000,
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 10000,
      isStockTrackable: true,
      isSellable: true,
      isPurchasable: true,
      isActive: true,
      taxRate: 0,
    } as any);

    // Seed stock movement for opening stock
    db.prepare(`INSERT INTO stock_movements (id, business_id, product_id, movement_type, quantity_milli, cost_paisa, reference_type, reference_id, location_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'mov-open', businessId, product.id, 'opening', 10000, 10000, 'opening', product.id, 'main', Date.now()
    );
    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 10000, reservedMilli: 0, lastMovementAt: Date.now() });

    const sale = saleService.create({
      businessId,
      customerId: customer.id,
      items: [{ productId: product.id, unitId: unit.id, quantityMilli: 5000, unitPricePaisa: 12000 }],
      paidPaisa: 20000, // partial
    });

    expect(sale.totalPaisa).toBe(60000);
    expect(sale.paidPaisa).toBe(20000);
    expect(sale.duePaisa).toBe(40000);
    expect(sale.status).toBe('partially_paid');

    const due = customerTxRepo.getCurrentDue(customer.id);
    expect(due).toBe(40000);

    // Collect due
    customerService.collectDue({
      businessId,
      customerId: customer.id,
      amountPaisa: 20000,
      method: 'cash',
    });

    const dueAfter = customerTxRepo.getCurrentDue(customer.id);
    expect(dueAfter).toBe(20000);
  });

  it('should prevent over-collection unless advance allowed', () => {
    const customer = customerService.create({ businessId, name: 'OverCollect', openingDuePaisa: 10000 });

    expect(() =>
      customerService.collectDue({
        businessId,
        customerId: customer.id,
        amountPaisa: 20000,
        method: 'cash',
      })
    ).toThrow(/বকেয়ার/);

    // Allow advance
    const result = customerService.collectDue({
      businessId,
      customerId: customer.id,
      amountPaisa: 20000,
      method: 'cash',
      allowAdvance: true,
    });
    expect(result.newDue).toBe(-10000); // advance
  });

  it('should handle sale return partial with inventory + and receivable -', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const customer = customerService.create({ businessId, name: 'Return Customer' });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Return Product',
      sku: 'SKU-RET-SALE',
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

    db.prepare(`INSERT INTO stock_movements (id, business_id, product_id, movement_type, quantity_milli, cost_paisa, reference_type, reference_id, location_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'mov-open2', businessId, product.id, 'opening', 100000, 10000, 'opening', product.id, 'main', Date.now()
    );
    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 100000, reservedMilli: 0, lastMovementAt: Date.now() });

    const sale = saleService.create({
      businessId,
      customerId: customer.id,
      items: [{ productId: product.id, unitId: unit.id, quantityMilli: 10000, unitPricePaisa: 12000 }], // 10 pcs = 1200 BDT
      paidPaisa: 0,
    });

    let due = customerTxRepo.getCurrentDue(customer.id);
    expect(due).toBe(120000);

    // Return 2 pcs
    const ret = saleService.createReturn({
      businessId,
      saleId: sale.id,
      items: [{ productId: product.id, quantityMilli: 2000 }],
      reason: 'Damaged',
      refundMethod: 'cash',
    });

    expect(ret.return.totalPaisa).toBe(24000); // 2 * 120

    due = customerTxRepo.getCurrentDue(customer.id);
    expect(due).toBe(96000); // 120000 - 24000

    const level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(92000); // 100000 - 10000 + 2000

    // Over-return should fail
    expect(() =>
      saleService.createReturn({
        businessId,
        saleId: sale.id,
        items: [{ productId: product.id, quantityMilli: 9000 }],
      })
    ).toThrow(/সর্বোচ্চ/);
  });

  it('should handle converted unit sale 10 ctn * 24 = 240 pcs deduct', () => {
    const unitPiece = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const unitCarton = unitRepo.create({ businessId, name: 'Carton', shortName: 'ctn', isBaseUnit: false, unitGroup: 'piece', isActive: true });
    unitConvRepo.create({ businessId, fromUnitId: unitCarton.id, toUnitId: unitPiece.id, conversionFactor: 24, isBaseConversion: false });

    const product = productRepo.create({
      businessId,
      baseUnitId: unitPiece.id,
      name: 'Converted Product',
      sku: 'SKU-CONV',
      costPricePaisa: 5000,
      sellingPricePaisa: 7000,
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 0,
      isStockTrackable: true,
      isSellable: true,
      isPurchasable: true,
      isActive: true,
      taxRate: 0,
    } as any);

    db.prepare(`INSERT INTO stock_movements (id, business_id, product_id, movement_type, quantity_milli, cost_paisa, reference_type, reference_id, location_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'mov-conv', businessId, product.id, 'opening', 500000, 5000, 'opening', product.id, 'main', Date.now()
    );
    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 500000, reservedMilli: 0, lastMovementAt: Date.now() });

    const sale = saleService.create({
      businessId,
      items: [{ productId: product.id, unitId: unitCarton.id, quantityMilli: 10000, unitPricePaisa: 168000 }], // 10 ctn at 1680 BDT per ctn = 70 BDT per pcs
      paidPaisa: 1680000,
    });

    const level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(500000 - 240000); // 500 - 240 = 260 pcs
  });

  it('should prevent sale with insufficient stock Bengali message', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Low Stock Product',
      sku: 'SKU-LOW',
      costPricePaisa: 10000,
      sellingPricePaisa: 12000,
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 1000,
      isStockTrackable: true,
      isSellable: true,
      isPurchasable: true,
      isActive: true,
      taxRate: 0,
    } as any);

    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 1000, reservedMilli: 0, lastMovementAt: Date.now() });

    expect(() =>
      saleService.create({
        businessId,
        items: [{ productId: product.id, unitId: unit.id, quantityMilli: 5000, unitPricePaisa: 12000 }],
        paidPaisa: 60000,
      })
    ).toThrow(/পর্যাপ্ত স্টক নেই/);
  });

  it('should enforce numbering uniqueness SAL-XXXXX', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Numbering Product',
      sku: 'SKU-NUM-SALE',
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

    db.prepare(`INSERT INTO stock_movements (id, business_id, product_id, movement_type, quantity_milli, cost_paisa, reference_type, reference_id, location_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'mov-num', businessId, product.id, 'opening', 100000, 10000, 'opening', product.id, 'main', Date.now()
    );
    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 100000, reservedMilli: 0, lastMovementAt: Date.now() });

    const s1 = saleService.create({
      businessId,
      items: [{ productId: product.id, unitId: unit.id, quantityMilli: 1000, unitPricePaisa: 12000 }],
      paidPaisa: 12000,
    });
    const s2 = saleService.create({
      businessId,
      items: [{ productId: product.id, unitId: unit.id, quantityMilli: 1000, unitPricePaisa: 12000 }],
      paidPaisa: 12000,
    });

    expect(s1.saleNumber).not.toBe(s2.saleNumber);
    expect(s1.saleNumber).toMatch(/SAL-/);
  });

  it('should rollback atomically on failure at inventory/payment/ledger', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Atomic Product',
      sku: 'SKU-ATOM',
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

    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 5000, reservedMilli: 0, lastMovementAt: Date.now() });

    const salesBefore = saleRepo.findByBusiness(businessId).length;

    try {
      saleService.create({
        businessId,
        items: [
          { productId: product.id, unitId: unit.id, quantityMilli: 2000, unitPricePaisa: 12000 },
          { productId: 'non-existent', unitId: unit.id, quantityMilli: 1000, unitPricePaisa: 12000 },
        ],
        paidPaisa: 36000,
      });
    } catch (e) {
      // expected
    }

    const salesAfter = saleRepo.findByBusiness(businessId).length;
    expect(salesAfter).toBe(salesBefore);

    const level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(5000); // not deducted
  });
});
