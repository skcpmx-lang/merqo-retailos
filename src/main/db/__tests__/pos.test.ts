import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb, seedBusiness } from './test-helpers';
import { ProductRepository, ProductBarcodeRepository } from '../repositories/product.repository';
import { UnitRepository, UnitConversionRepository } from '../repositories/unit.repository';
import { StockLevelRepository, StockMovementRepository } from '../repositories/inventory.repository';
import { CustomerService } from '../../services/customer.service';
import { SaleService } from '../../services/sale.service';
import { HeldSaleService } from '../../services/held-sale.service';
import { HeldSaleRepository } from '../repositories/held-sale.repository';
import { CustomerTransactionRepository } from '../repositories/customer.repository';
import { SaleRepository } from '../repositories/sale.repository';

describe('Phase 3C POS', () => {
  let db: any;
  const businessId = 'biz_pos_3c';
  let productRepo: ProductRepository;
  let barcodeRepo: ProductBarcodeRepository;
  let unitRepo: UnitRepository;
  let unitConvRepo: UnitConversionRepository;
  let stockLevelRepo: StockLevelRepository;
  let stockMovementRepo: StockMovementRepository;
  let customerService: CustomerService;
  let saleService: SaleService;
  let heldSaleService: HeldSaleService;
  let heldRepo: HeldSaleRepository;
  let customerTxRepo: CustomerTransactionRepository;
  let saleRepo: SaleRepository;

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    productRepo = new ProductRepository(db);
    barcodeRepo = new ProductBarcodeRepository(db);
    unitRepo = new UnitRepository(db);
    unitConvRepo = new UnitConversionRepository(db);
    stockLevelRepo = new StockLevelRepository(db);
    stockMovementRepo = new StockMovementRepository(db);
    customerService = new CustomerService(db);
    saleService = new SaleService(db);
    heldSaleService = new HeldSaleService(db);
    heldRepo = new HeldSaleRepository(db);
    customerTxRepo = new CustomerTransactionRepository(db);
    saleRepo = new SaleRepository(db);
  });

  it('should lookup product by barcode - known barcode', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Barcode Product',
      sku: 'SKU-BAR-1',
      barcode: '1234567890123',
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

    const found = productRepo.findByBarcode('1234567890123');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(product.id);

    const withDetails = productRepo.findByBarcodeWithDetails('1234567890123');
    expect(withDetails).not.toBeNull();
    expect(withDetails!.product.id).toBe(product.id);
  });

  it('should handle unknown barcode', () => {
    const found = productRepo.findByBarcode('UNKNOWN-BARCODE-999');
    expect(found).toBeNull();

    const withDetails = productRepo.findByBarcodeWithDetails('UNKNOWN-BARCODE-999');
    expect(withDetails).toBeNull();
  });

  it('should handle multiple barcode mappings', () => {
    const unitPiece = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const unitCarton = unitRepo.create({ businessId, name: 'Carton', shortName: 'ctn', isBaseUnit: false, unitGroup: 'piece', isActive: true });

    const product = productRepo.create({
      businessId,
      baseUnitId: unitPiece.id,
      saleUnitId: unitPiece.id,
      name: 'Multi Barcode Product',
      sku: 'SKU-MULTI-BAR',
      barcode: '1111111111111',
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

    barcodeRepo.create({
      productId: product.id,
      unitId: unitCarton.id,
      barcode: '2222222222222',
      quantityMilli: 24000, // 24 pcs
      isPrimary: false,
    });

    // Primary barcode lookup
    const primary = productRepo.findByBarcodeWithDetails('1111111111111');
    expect(primary).not.toBeNull();
    expect(primary!.barcodeDetail).toBeNull();

    // Secondary barcode lookup with unit and qty
    const secondary = productRepo.findByBarcodeWithDetails('2222222222222');
    expect(secondary).not.toBeNull();
    expect(secondary!.barcodeDetail).not.toBeNull();
    expect(secondary!.barcodeDetail!.unitId).toBe(unitCarton.id);
    expect(secondary!.barcodeDetail!.quantityMilli).toBe(24000);

    // All mappings for same barcode (if duplicate)
    const all = productRepo.findByBarcodeAll('1111111111111');
    expect(all.length).toBe(1);
  });

  it('should handle barcode with Enter suffix (trim)', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Enter Suffix Product',
      sku: 'SKU-ENTER',
      barcode: '3333333333333',
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

    // Simulate scanner with Enter and whitespace
    const rawInput = '  3333333333333 \n';
    const normalized = rawInput.trim().replace(/\s+/g, '');
    const found = productRepo.findByBarcode(normalized);
    expect(found).not.toBeNull();
  });

  it('should prevent sale of inactive product', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Inactive Product',
      sku: 'SKU-INACTIVE',
      barcode: '4444444444444',
      costPricePaisa: 10000,
      sellingPricePaisa: 12000,
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 0,
      isStockTrackable: true,
      isSellable: true,
      isPurchasable: true,
      isActive: false,
      taxRate: 0,
    } as any);

    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 10000, reservedMilli: 0, lastMovementAt: Date.now() });

    expect(() =>
      saleService.create({
        businessId,
        items: [{ productId: product.id, unitId: unit.id, quantityMilli: 1000, unitPricePaisa: 12000 }],
        paidPaisa: 12000,
      })
    ).toThrow(/নিষ্ক্রিয়/);
  });

  it('should prevent sale of non-sellable product', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Non-sellable',
      sku: 'SKU-NONSELL',
      costPricePaisa: 10000,
      sellingPricePaisa: 12000,
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 0,
      isStockTrackable: true,
      isSellable: false,
      isPurchasable: true,
      isActive: true,
      taxRate: 0,
    } as any);

    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 10000, reservedMilli: 0, lastMovementAt: Date.now() });

    expect(() =>
      saleService.create({
        businessId,
        items: [{ productId: product.id, unitId: unit.id, quantityMilli: 1000, unitPricePaisa: 12000 }],
        paidPaisa: 12000,
      })
    ).toThrow(/বিক্রয়যোগ্য নয়/);
  });

  it('should prevent sale with insufficient stock', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Low Stock',
      sku: 'SKU-LOW-POS',
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

    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 1000, reservedMilli: 0, lastMovementAt: Date.now() });

    expect(() =>
      saleService.create({
        businessId,
        items: [{ productId: product.id, unitId: unit.id, quantityMilli: 5000, unitPricePaisa: 12000 }],
        paidPaisa: 60000,
      })
    ).toThrow(/পর্যাপ্ত স্টক নেই/);
  });

  it('should handle duplicate cart item — increment quantity logic via service (POS cart logic)', () => {
    // POS cart logic is in renderer, but we test that sale with duplicate product IDs is allowed and sums correctly
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Dup Product',
      sku: 'SKU-DUP',
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
      'mov-dup', businessId, product.id, 'opening', 100000, 10000, 'opening', product.id, 'main', Date.now()
    );
    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 100000, reservedMilli: 0, lastMovementAt: Date.now() });

    // Two lines same product — should be allowed, total 2 pcs
    const sale = saleService.create({
      businessId,
      items: [
        { productId: product.id, unitId: unit.id, quantityMilli: 1000, unitPricePaisa: 12000 },
        { productId: product.id, unitId: unit.id, quantityMilli: 1000, unitPricePaisa: 12000 },
      ],
      paidPaisa: 24000,
    });

    expect(sale.totalPaisa).toBe(24000);
    const level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(98000); // 100 -2 =98
  });

  it('should handle unit conversion 10 ctn *24 =240 pcs', () => {
    const unitPiece = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const unitCarton = unitRepo.create({ businessId, name: 'Carton', shortName: 'ctn', isBaseUnit: false, unitGroup: 'piece', isActive: true });
    unitConvRepo.create({ businessId, fromUnitId: unitCarton.id, toUnitId: unitPiece.id, conversionFactor: 24, isBaseConversion: false });

    const product = productRepo.create({
      businessId,
      baseUnitId: unitPiece.id,
      name: 'Converted POS',
      sku: 'SKU-CONV-POS',
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
      'mov-conv-pos', businessId, product.id, 'opening', 500000, 5000, 'opening', product.id, 'main', Date.now()
    );
    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 500000, reservedMilli: 0, lastMovementAt: Date.now() });

    const sale = saleService.create({
      businessId,
      items: [{ productId: product.id, unitId: unitCarton.id, quantityMilli: 10000, unitPricePaisa: 168000 }], // 10 ctn
      paidPaisa: 1680000,
    });

    const level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(500000 - 240000);
  });

  it('should handle walk-in customer (no customer)', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Walkin Product',
      sku: 'SKU-WALKIN',
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
      'mov-walkin', businessId, product.id, 'opening', 10000, 10000, 'opening', product.id, 'main', Date.now()
    );
    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 10000, reservedMilli: 0, lastMovementAt: Date.now() });

    const sale = saleService.create({
      businessId,
      items: [{ productId: product.id, unitId: unit.id, quantityMilli: 1000, unitPricePaisa: 12000 }],
      paidPaisa: 12000,
    });

    expect(sale.customerId).toBeNull();
    expect(sale.duePaisa).toBe(0);
  });

  it('should handle existing customer and credit sale', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const customer = customerService.create({ businessId, name: 'Credit Customer POS', creditLimitPaisa: 1000000 });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Credit Product POS',
      sku: 'SKU-CRED-POS',
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
      'mov-cred-pos', businessId, product.id, 'opening', 10000, 10000, 'opening', product.id, 'main', Date.now()
    );
    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 10000, reservedMilli: 0, lastMovementAt: Date.now() });

    const sale = saleService.create({
      businessId,
      customerId: customer.id,
      items: [{ productId: product.id, unitId: unit.id, quantityMilli: 1000, unitPricePaisa: 12000 }],
      paidPaisa: 0,
    });

    expect(sale.duePaisa).toBe(12000);
    const due = customerTxRepo.getCurrentDue(customer.id);
    expect(due).toBe(12000);
  });

  it('should block credit limit exceeded', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const customer = customerService.create({ businessId, name: 'Limit Customer', openingDuePaisa: 90000, creditLimitPaisa: 100000 });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Limit Product',
      sku: 'SKU-LIMIT',
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
      'mov-limit', businessId, product.id, 'opening', 10000, 10000, 'opening', product.id, 'main', Date.now()
    );
    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 10000, reservedMilli: 0, lastMovementAt: Date.now() });

    expect(() =>
      saleService.create({
        businessId,
        customerId: customer.id,
        items: [{ productId: product.id, unitId: unit.id, quantityMilli: 2000, unitPricePaisa: 12000 }], // 24000 due, current 90000 +24000=114000 >100000
        paidPaisa: 0,
      })
    ).toThrow(/ক্রেডিট লিমিট/);
  });

  it('should handle exact cash, overpayment/change, partial, split, due', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Payment Product',
      sku: 'SKU-PAY',
      costPricePaisa: 10000,
      sellingPricePaisa: 10000,
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
      'mov-pay', businessId, product.id, 'opening', 100000, 10000, 'opening', product.id, 'main', Date.now()
    );
    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 100000, reservedMilli: 0, lastMovementAt: Date.now() });

    // Exact cash
    const saleExact = saleService.create({
      businessId,
      items: [{ productId: product.id, unitId: unit.id, quantityMilli: 1000, unitPricePaisa: 10000 }],
      paidPaisa: 10000,
    });
    expect(saleExact.duePaisa).toBe(0);
    expect(saleExact.paidPaisa).toBe(10000);

    // Overpayment should be blocked (paid > total)
    expect(() =>
      saleService.create({
        businessId,
        items: [{ productId: product.id, unitId: unit.id, quantityMilli: 1000, unitPricePaisa: 10000 }],
        paidPaisa: 15000,
      })
    ).toThrow(/পরিশোধিত টাকা মোট টাকার চেয়ে বেশি/);

    // Split payment with due requires customer
    const customerForSplit = customerService.create({ businessId, name: 'Split Customer' });
    const saleSplit = saleService.create({
      businessId,
      customerId: customerForSplit.id,
      items: [{ productId: product.id, unitId: unit.id, quantityMilli: 2000, unitPricePaisa: 10000 }], // 20000 total
      payments: [
        { method: 'cash', amountPaisa: 8000 },
        { method: 'bkash', amountPaisa: 5000 },
        { method: 'card', amountPaisa: 2000 },
      ],
      paidPaisa: 15000,
    });
    expect(saleSplit.paidPaisa).toBe(15000);
    expect(saleSplit.duePaisa).toBe(5000);

    // Due requires customer
    expect(() =>
      saleService.create({
        businessId,
        items: [{ productId: product.id, unitId: unit.id, quantityMilli: 1000, unitPricePaisa: 10000 }],
        paidPaisa: 5000,
      })
    ).toThrow(/গ্রাহক নির্বাচন/);
  });

  it('should handle held sale — hold, list, resume, cancel, no stock/ledger impact', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Held Product',
      sku: 'SKU-HELD',
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
      'mov-held', businessId, product.id, 'opening', 10000, 10000, 'opening', product.id, 'main', Date.now()
    );
    stockLevelRepo.upsert({ businessId, productId: product.id, locationId: 'main', quantityMilli: 10000, reservedMilli: 0, lastMovementAt: Date.now() });

    const cart = {
      items: [
        {
          id: 'cart_1',
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unitId: unit.id,
          quantity: 2,
          quantityMilli: 2000,
          unitPricePaisa: 12000,
          lineTotalPaisa: 24000,
          stockMilli: 10000,
        },
      ],
      subtotalPaisa: 24000,
      totalPaisa: 24000,
      customerId: null,
    };

    const held = heldSaleService.hold({ businessId, cart, notes: 'test hold' });
    expect(held.heldNumber).toMatch(/HOLD-/);

    // Stock should NOT be deducted
    const levelAfterHold = stockLevelRepo.findByProduct(product.id);
    expect(levelAfterHold!.quantityMilli).toBe(10000);

    // No sale created
    const sales = saleRepo.findByBusiness(businessId);
    expect(sales.length).toBe(0);

    // No customer ledger
    const customerTxs = db.prepare('SELECT COUNT(*) as c FROM customer_transactions').get() as { c: number };
    expect(customerTxs.c).toBe(0);

    // List
    const list = heldSaleService.list(businessId);
    expect(list.length).toBe(1);
    expect(list[0].itemCount).toBe(1);

    // Resume
    const resumed = heldSaleService.resume(held.id);
    expect(resumed.cart.items.length).toBe(1);

    // After resume, held should still exist until deleteAfterResume
    heldSaleService.deleteAfterResume(held.id);
    const afterDelete = heldRepo.findById(held.id);
    expect(afterDelete).toBeNull();

    // Test cancel
    const held2 = heldSaleService.hold({ businessId, cart, notes: 'test hold 2' });
    heldSaleService.cancel(held2.id);
    expect(heldRepo.findById(held2.id)).toBeNull();
  });

  it('should rollback atomically on failure — inventory/payment/ledger', () => {
    const unit = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const product = productRepo.create({
      businessId,
      baseUnitId: unit.id,
      name: 'Atomic POS Product',
      sku: 'SKU-ATOM-POS',
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
    const stockBefore = stockLevelRepo.findByProduct(product.id)!.quantityMilli;

    try {
      saleService.create({
        businessId,
        items: [
          { productId: product.id, unitId: unit.id, quantityMilli: 2000, unitPricePaisa: 12000 },
          { productId: 'non-existent-id', unitId: unit.id, quantityMilli: 1000, unitPricePaisa: 12000 },
        ],
        paidPaisa: 36000,
      });
    } catch {}

    const salesAfter = saleRepo.findByBusiness(businessId).length;
    expect(salesAfter).toBe(salesBefore);

    const stockAfter = stockLevelRepo.findByProduct(product.id)!.quantityMilli;
    expect(stockAfter).toBe(stockBefore);

    const movements = db.prepare('SELECT COUNT(*) as c FROM stock_movements WHERE reference_id IN (SELECT id FROM sales)').get() as { c: number };
    // No new movements for failed sale — only opening if exists
    // Check that no sale_payments for failed sale
    const payments = db.prepare('SELECT COUNT(*) as c FROM sale_payments WHERE business_id = ?').get(businessId) as { c: number };
    expect(payments.c).toBe(0);
  });
});
