import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb, seedBusiness } from './test-helpers';
import { ProductRepository } from '../repositories/product.repository';
import { UnitRepository, UnitConversionRepository } from '../repositories/unit.repository';
import { StockLevelRepository, StockMovementRepository } from '../repositories/inventory.repository';
import { CustomerService } from '../../services/customer.service';
import { SaleService } from '../../services/sale.service';
import { PurchaseService } from '../../services/purchase.service';
import { SupplierService } from '../../services/supplier.service';
import { CustomerTransactionRepository } from '../repositories/customer.repository';

/**
 * E2E: Customer→Purchase→Sell 10ctn*24=240pcs→WAC COGS→partial pay→collection→partial return 2ctn 48pcs→invariants
 */
describe('E2E Customer→Purchase→Sell 10ctn*24=240pcs', () => {
  let db: any;
  const businessId = 'biz_e2e_3b';
  let productRepo: ProductRepository;
  let unitRepo: UnitRepository;
  let unitConvRepo: UnitConversionRepository;
  let stockLevelRepo: StockLevelRepository;
  let stockMovementRepo: StockMovementRepository;
  let customerService: CustomerService;
  let saleService: SaleService;
  let purchaseService: PurchaseService;
  let supplierService: SupplierService;
  let customerTxRepo: CustomerTransactionRepository;

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    productRepo = new ProductRepository(db);
    unitRepo = new UnitRepository(db);
    unitConvRepo = new UnitConversionRepository(db);
    stockLevelRepo = new StockLevelRepository(db);
    stockMovementRepo = new StockMovementRepository(db);
    customerService = new CustomerService(db);
    saleService = new SaleService(db);
    purchaseService = new PurchaseService(db);
    supplierService = new SupplierService(db);
    customerTxRepo = new CustomerTransactionRepository(db);
  });

  it('full flow with invariants stock/customer/financial integer paisa', () => {
    // Setup units: pcs base, ctn = 24 pcs
    const unitPiece = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', nameBn: 'পিস', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const unitCarton = unitRepo.create({ businessId, name: 'Carton', shortName: 'ctn', nameBn: 'কার্টন', isBaseUnit: false, unitGroup: 'piece', isActive: true });
    unitConvRepo.create({ businessId, fromUnitId: unitCarton.id, toUnitId: unitPiece.id, conversionFactor: 24, isBaseConversion: false });

    // Customer
    const customer = customerService.create({
      businessId,
      name: 'ই-২-ই গ্রাহক',
      phone: '01700000001',
      openingDuePaisa: 0,
      creditLimitPaisa: 10000000, // 100k BDT
    });

    // Supplier
    const supplier = supplierService.create({ businessId, name: 'E2E Supplier' });

    // Product
    const product = productRepo.create({
      businessId,
      baseUnitId: unitPiece.id,
      name: 'E2E Product',
      sku: 'SKU-E2E-3B',
      barcode: '1234567890123',
      costPricePaisa: 0,
      sellingPricePaisa: 15000, // 150 BDT per pcs
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 0,
      isStockTrackable: true,
      isSellable: true,
      isPurchasable: true,
      isActive: true,
      taxRate: 0,
    } as any);

    // Purchase 10 ctn = 240 pcs at 2400 BDT per ctn = 100 BDT per pcs
    const purchase = purchaseService.create({
      businessId,
      supplierId: supplier.id,
      items: [
        { productId: product.id, unitId: unitCarton.id, quantityMilli: 10000, costPerUnitPaisa: 240000 },
      ],
      paidPaisa: 0,
    });

    expect(purchase.totalPaisa).toBe(2400000); // 10 * 2400 = 24000 BDT

    // WAC should be 100 BDT per pcs
    const productAfterPurchase = productRepo.findById(product.id);
    expect(productAfterPurchase!.costPricePaisa).toBe(10000);

    // Stock should be 240 pcs = 240000 milli
    let level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(240000);

    // Stock invariant: SUM(movements) == stock_levels
    let movementsSum = stockMovementRepo.getCurrentStock(product.id, 'main');
    expect(movementsSum).toBe(level!.quantityMilli);

    // Sale 10 ctn = 240 pcs at 150 BDT per pcs = 3600 BDT per ctn = 36000 BDT total
    // Partial pay: 20000 BDT paid, 16000 BDT due
    const sale = saleService.create({
      businessId,
      customerId: customer.id,
      items: [
        { productId: product.id, unitId: unitCarton.id, quantityMilli: 10000, unitPricePaisa: 360000 },
      ],
      discountPaisa: 0,
      taxPaisa: 0,
      shippingPaisa: 0,
      paidPaisa: 2000000, // 20000 BDT
    });

    expect(sale.totalPaisa).toBe(3600000);
    expect(sale.paidPaisa).toBe(2000000);
    expect(sale.duePaisa).toBe(1600000);
    expect(sale.status).toBe('partially_paid');

    // Stock deduct: 240 pcs
    level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(0);

    // WAC COGS snapshot immutable
    const saleDetail = saleService.findById(sale.id);
    expect(saleDetail!.items[0].costPerUnitPaisa).toBe(10000); // WAC snapshot
    expect(saleDetail!.items[0].lineCostTotalPaisa).toBe(2400000); // 240 * 100 = 24000 BDT
    expect(saleDetail!.items[0].baseQuantityMilli).toBe(240000);

    // Customer ledger: current due should be 16000 BDT = 1600000 paisa
    let currentDue = customerTxRepo.getCurrentDue(customer.id);
    expect(currentDue).toBe(1600000);

    // Balance derivable SUM
    const sumDue = db.prepare('SELECT SUM(amount_paisa) as total FROM customer_transactions WHERE customer_id = ?').get(customer.id) as { total: number };
    expect(sumDue.total).toBe(currentDue);

    // Collection: pay 10000 BDT
    customerService.collectDue({
      businessId,
      customerId: customer.id,
      amountPaisa: 1000000,
      method: 'cash',
    });

    currentDue = customerTxRepo.getCurrentDue(customer.id);
    expect(currentDue).toBe(600000); // 6000 BDT remaining

    // Partial return 2 ctn = 48 pcs
    const ret = saleService.createReturn({
      businessId,
      saleId: sale.id,
      items: [
        { productId: product.id, unitId: unitCarton.id, quantityMilli: 2000 }, // 2 ctn
      ],
      reason: 'ক্ষতিগ্রস্ত',
      refundMethod: 'cash',
    });

    // Return total: 2 * 3600 = 7200 BDT = 720000 paisa
    expect(ret.return.totalPaisa).toBe(720000);

    // Stock should be +48 pcs
    level = stockLevelRepo.findByProduct(product.id);
    expect(level!.quantityMilli).toBe(48000);

    // Customer due after return: 6000 - 7200 = -1200 (advance) ??? But logic: return reduces receivable
    // After collection due was 6000, return 7200 reduces to -1200? Actually receivable reduces by return amount
    // Our customer ledger: sale +16000, payment -10000 = 6000, return -7200 = -1200 (customer advance)
    currentDue = customerTxRepo.getCurrentDue(customer.id);
    expect(currentDue).toBe(600000 - 720000); // -120000

    // Stock invariant still holds
    movementsSum = stockMovementRepo.getCurrentStock(product.id, 'main');
    expect(movementsSum).toBe(level!.quantityMilli);

    // Financial integer paisa invariant: all paisa values are integers
    const sales = db.prepare('SELECT * FROM sales WHERE id = ?').get(sale.id) as any;
    expect(Number.isInteger(sales.total_paisa)).toBe(true);
    expect(Number.isInteger(sales.paid_paisa)).toBe(true);
    expect(Number.isInteger(sales.due_paisa)).toBe(true);

    const customerTxs = db.prepare('SELECT * FROM customer_transactions WHERE customer_id = ?').all(customer.id) as any[];
    for (const tx of customerTxs) {
      expect(Number.isInteger(tx.amount_paisa)).toBe(true);
    }

    const stockMovements = db.prepare('SELECT * FROM stock_movements WHERE product_id = ?').all(product.id) as any[];
    for (const mov of stockMovements) {
      expect(Number.isInteger(mov.quantity_milli)).toBe(true);
      expect(Number.isInteger(mov.cost_paisa)).toBe(true);
    }

    // Running balance deterministic
    const statement = customerService.getStatement(customer.id);
    let running = 0;
    for (const tx of statement.transactions) {
      running += tx.amountPaisa;
      expect(tx.runningBalance).toBe(running);
    }
    expect(running).toBe(currentDue);

    // Sale status should be partially_returned
    const updatedSale = saleService.findById(sale.id);
    expect(updatedSale!.sale.status).toBe('partially_returned');
  });
});
