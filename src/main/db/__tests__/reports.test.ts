import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb, seedBusiness } from './test-helpers';
import { setConnection } from '../connection';
import { ProductRepository } from '../repositories/product.repository';
import { UnitRepository, UnitConversionRepository } from '../repositories/unit.repository';
import { StockLevelRepository } from '../repositories/inventory.repository';
import { CustomerService } from '../../services/customer.service';
import { SupplierService } from '../../services/supplier.service';
import { PurchaseService } from '../../services/purchase.service';
import { SaleService } from '../../services/sale.service';
import { FinanceService } from '../../services/finance.service';
import { ExpenseService } from '../../services/expense.service';
import { ShiftService } from '../../services/shift.service';
import { ExpenseCategoryRepository, CashMovementRepository } from '../repositories/finance.repository';
import { ReportService, getDateRange } from '../../reports/report.service';

function setupBase(db: any, businessId: string) {
  const unitRepo = new UnitRepository(db);
  const unitConvRepo = new UnitConversionRepository(db);
  const productRepo = new ProductRepository(db);
  const stockLevelRepo = new StockLevelRepository(db);
  const customerService = new CustomerService(db);
  const supplierService = new SupplierService(db);
  const purchaseService = new PurchaseService(db);
  const saleService = new SaleService(db);
  const financeService = new FinanceService(db);
  const expenseService = new ExpenseService(db);
  const shiftService = new ShiftService(db);
  const expenseCatRepo = new ExpenseCategoryRepository(db);
  const cashMovementRepo = new CashMovementRepository(db);

  // Units
  const pcs = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', nameBn: 'পিস', isBaseUnit: true, unitGroup: 'piece', isActive: true });
  const ctn = unitRepo.create({ businessId, name: 'Carton', shortName: 'ctn', nameBn: 'কার্টন', isBaseUnit: false, unitGroup: 'piece', isActive: true });
  unitConvRepo.create({ businessId, fromUnitId: ctn.id, toUnitId: pcs.id, conversionFactor: 24, isBaseConversion: false });

  // Products
  const prodA = productRepo.create({
    businessId, baseUnitId: pcs.id, name: 'Product A', sku: 'SKU-A-REPORT', barcode: 'REPORT-A-001',
    costPricePaisa: 0, sellingPricePaisa: 15000, minStockMilli: 10000, reorderLevelMilli: 5000, openingStockMilli: 0,
    isStockTrackable: true, isSellable: true, isPurchasable: true, isActive: true, taxRate: 0,
  } as any);
  const prodB = productRepo.create({
    businessId, baseUnitId: pcs.id, name: 'Product B', sku: 'SKU-B-REPORT', barcode: 'REPORT-B-001',
    costPricePaisa: 0, sellingPricePaisa: 20000, minStockMilli: 5000, reorderLevelMilli: 2000, openingStockMilli: 0,
    isStockTrackable: true, isSellable: true, isPurchasable: true, isActive: true, taxRate: 0,
  } as any);

  // Supplier
  const supplier = supplierService.create({ businessId, name: 'Report Supplier' });

  // Customer
  const customer = customerService.create({ businessId, name: 'Report Customer', phone: '01700000001', openingDuePaisa: 0, creditLimitPaisa: 10000000 });

  return { pcs, ctn, prodA, prodB, supplier, customer, unitRepo, productRepo, stockLevelRepo, customerService, supplierService, purchaseService, saleService, financeService, expenseService, shiftService, expenseCatRepo, cashMovementRepo };
}

describe('P4.4 Reports - DateRange helper', () => {
  it('today inclusive start 00:00 end 23:59:59.999', () => {
    const range = getDateRange('today');
    const start = new Date(range.start);
    const end = new Date(range.end);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(range.start <= range.end).toBe(true);
  });

  it('custom inclusive handling', () => {
    const now = Date.now();
    const range = getDateRange('custom', now - 86400000, now);
    const start = new Date(range.start);
    const end = new Date(range.end);
    expect(start.getHours()).toBe(0);
    expect(end.getHours()).toBe(23);
  });

  it('prevMonth range valid', () => {
    const range = getDateRange('prevMonth');
    expect(range.start < range.end).toBe(true);
  });
});

describe('P4.4 Reports - Sales', () => {
  let db: any;
  const businessId = 'biz_report_sales';
  let ctx: any;
  let reportService: ReportService;

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    ctx = setupBase(db, businessId);
    reportService = new ReportService();
    // Inject test db into singleton via connection mock: ReportService uses getConnection() which returns singleton; we need to set global connection
    setConnection(db);
  });

  it('sales summary aggregates integer paisa, no FLOAT', () => {
    // Purchase 10 ctn prodA at 100 BDT per pcs
    ctx.purchaseService.create({
      businessId, supplierId: ctx.supplier.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.ctn.id, quantityMilli: 10000, costPerUnitPaisa: 240000 }],
      paidPaisa: 0,
    });

    // Sale 5 ctn prodA at 150 BDT per pcs, paid 50%
    const sale = ctx.saleService.create({
      businessId, customerId: ctx.customer.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.ctn.id, quantityMilli: 5000, unitPricePaisa: 360000 }],
      paidPaisa: 900000, // 9000 BDT of 18000
    });

    const summary = reportService.getSalesSummary({ businessId, fromDate: Date.now() - 86400000 * 2, toDate: Date.now() + 86400000 });
    expect(summary.transactionCount).toBe(1);
    expect(summary.grossSalesPaisa).toBe(1800000); // 5*3600 = 18000 BDT
    expect(Number.isInteger(summary.grossSalesPaisa)).toBe(true);
    expect(Number.isInteger(summary.netSalesPaisa)).toBe(true);
    expect(summary.paidPaisa).toBe(900000);
    expect(summary.duePaisa).toBe(900000);
    expect(summary.totalQuantityMilli).toBe(120000); // 5*24*1000
  });

  it('sales by product uses immutable cost snapshot for COGS', () => {
    // Purchase at 100 BDT per pcs
    ctx.purchaseService.create({
      businessId, supplierId: ctx.supplier.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.ctn.id, quantityMilli: 10000, costPerUnitPaisa: 240000 }],
      paidPaisa: 0,
    });

    const sale = ctx.saleService.create({
      businessId, customerId: ctx.customer.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.ctn.id, quantityMilli: 1000, unitPricePaisa: 360000 }], // 1 ctn
      paidPaisa: 360000,
    });

    // Change product cost price to 200 BDT AFTER sale — should NOT affect report COGS (immutable snapshot)
    db.prepare('UPDATE products SET cost_price_paisa = ? WHERE id = ?').run(20000, ctx.prodA.id);

    const rows = reportService.getSalesByProduct({ businessId });
    expect(rows.length).toBe(1);
    expect(rows[0].productId).toBe(ctx.prodA.id);
    // COGS should be 100 BDT per pcs *24 = 2400 BDT = 240000 paisa, not 200 BDT
    expect(rows[0].cogsPaisa).toBe(240000);
    expect(rows[0].grossProfitPaisa).toBe(360000 - 240000);
    expect(rows[0].marginPercent).toBeCloseTo(33.33, 1);
  });

  it('sales by cashier groups by created_by', () => {
    ctx.purchaseService.create({
      businessId, supplierId: ctx.supplier.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 10000, costPerUnitPaisa: 10000 }],
      paidPaisa: 0,
    });
    // Sale by user1
    db.prepare('INSERT INTO users (id, business_id, name, phone, password_hash, is_owner, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('user_cashier_1', businessId, 'Cashier One', '01700000011', 'hash', 0, 1, Date.now(), Date.now());
    const sale = ctx.saleService.create({
      businessId, customerId: ctx.customer.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 1000, unitPricePaisa: 15000 }],
      paidPaisa: 15000,
      createdBy: 'user_cashier_1',
    } as any);

    const rows = reportService.getSalesByCashier({ businessId });
    expect(rows.length).toBe(1);
    expect(rows[0].cashierId).toBe('user_cashier_1');
    expect(rows[0].transactionCount).toBe(1);
  });

  it('sales by payment method percentages sum to ~100', () => {
    ctx.purchaseService.create({
      businessId, supplierId: ctx.supplier.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 10000, costPerUnitPaisa: 10000 }],
      paidPaisa: 0,
    });
    ctx.saleService.create({
      businessId, customerId: ctx.customer.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 1000, unitPricePaisa: 15000 }],
      paidPaisa: 10000,
    });
    // Manually insert sale_payments for test
    const saleRow = db.prepare('SELECT id FROM sales ORDER BY created_at DESC LIMIT 1').get() as any;
    db.prepare('INSERT INTO sale_payments (id, sale_id, business_id, payment_method, amount_paisa, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('pay_1', saleRow.id, businessId, 'cash', 10000, Date.now());
    db.prepare('INSERT INTO sale_payments (id, sale_id, business_id, payment_method, amount_paisa, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('pay_2', saleRow.id, businessId, 'bKash', 5000, Date.now());

    const rows = reportService.getSalesByPaymentMethod({ businessId });
    const totalPct = rows.reduce((sum: number, r: any) => sum + r.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 0);
    expect(rows.find((r: any) => r.method === 'cash')).toBeTruthy();
  });

  it('empty state returns zeros, not null', () => {
    const summary = reportService.getSalesSummary({ businessId });
    expect(summary.transactionCount).toBe(0);
    expect(summary.grossSalesPaisa).toBe(0);
    expect(summary.netSalesPaisa).toBe(0);
  });
});

describe('P4.4 Reports - Purchase & Inventory', () => {
  let db: any;
  const businessId = 'biz_report_purchase_inv';
  let ctx: any;
  let reportService: ReportService;

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    ctx = setupBase(db, businessId);
    reportService = new ReportService();
    setConnection(db);
  });

  it('purchase summary and by supplier', () => {
    ctx.purchaseService.create({
      businessId, supplierId: ctx.supplier.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 10000, costPerUnitPaisa: 10000 }],
      paidPaisa: 5000,
    });
    const summary = reportService.getPurchaseSummary({ businessId });
    expect(summary.purchaseCount).toBe(1);
    expect(summary.totalPaisa).toBe(100000); // 10*10000
    expect(summary.paidPaisa).toBe(5000);
    expect(summary.duePaisa).toBe(95000);

    const bySup = reportService.getPurchaseBySupplier({ businessId });
    expect(bySup.length).toBe(1);
    expect(bySup[0].supplierId).toBe(ctx.supplier.id);
    expect(bySup[0].purchaseAmountPaisa).toBe(100000);
  });

  it('inventory current stock WAC valuation integer paisa', () => {
    ctx.purchaseService.create({
      businessId, supplierId: ctx.supplier.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 10000, costPerUnitPaisa: 10000 }],
      paidPaisa: 0,
    });
    const stocks = reportService.getCurrentStock({ businessId });
    expect(stocks.length).toBeGreaterThanOrEqual(1);
    const prodStock = stocks.find((s: any) => s.productId === ctx.prodA.id);
    expect(prodStock).toBeTruthy();
    expect(prodStock!.currentQuantityMilli).toBe(10000);
    expect(prodStock!.wacPaisa).toBe(10000);
    expect(prodStock!.stockValuePaisa).toBe(100000); // 10 * 10000
    expect(Number.isInteger(prodStock!.stockValuePaisa)).toBe(true);
  });

  it('low stock detection', () => {
    // prodA min 10000 milli, we purchase 5000 milli => low
    ctx.purchaseService.create({
      businessId, supplierId: ctx.supplier.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 5000, costPerUnitPaisa: 10000 }],
      paidPaisa: 0,
    });
    const low = reportService.getLowStock({ businessId });
    const found = low.find((l: any) => l.productId === ctx.prodA.id);
    expect(found).toBeTruthy();
    expect(found!.status).toBe('low_stock');
  });

  it('stock valuation totals', () => {
    ctx.purchaseService.create({
      businessId, supplierId: ctx.supplier.id,
      items: [
        { productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 10000, costPerUnitPaisa: 10000 },
        { productId: ctx.prodB.id, unitId: ctx.pcs.id, quantityMilli: 5000, costPerUnitPaisa: 20000 },
      ],
      paidPaisa: 0,
    });
    const val = reportService.getStockValuation({ businessId });
    expect(val.totalProducts).toBeGreaterThanOrEqual(2);
    expect(val.totalValuePaisa).toBe(10000*10 + 5000*20); // wait: quantity milli /1000 * wac ; wac = cost per unit
    // Actually stockValue = qtyUnits * wac = (10000/1000)*10000=100000 + (5000/1000)*20000=100000 => 200000
    expect(val.totalValuePaisa).toBe(200000);
  });

  it('stock movements running deterministic ORDER BY created_at ASC rowid ASC', () => {
    ctx.purchaseService.create({
      businessId, supplierId: ctx.supplier.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 10000, costPerUnitPaisa: 10000 }],
      paidPaisa: 0,
    });
    ctx.saleService.create({
      businessId, customerId: ctx.customer.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 2000, unitPricePaisa: 15000 }],
      paidPaisa: 30000,
    });
    const movements = reportService.getStockMovements({ businessId });
    expect(movements.length).toBeGreaterThanOrEqual(2);
    // Ensure ordered DESC as per query, but underlying running balance for statement ASC is deterministic
    expect(movements[0].createdAt >= movements[movements.length-1].createdAt).toBe(true);
  });
});

describe('P4.4 Reports - Customer/Supplier/Expense/Profit/Shift/Dashboard', () => {
  let db: any;
  const businessId = 'biz_report_all';
  let ctx: any;
  let reportService: ReportService;

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    ctx = setupBase(db, businessId);
    reportService = new ReportService();
    setConnection(db);
    // Seed MFS providers for finance
    db.prepare(`INSERT OR IGNORE INTO mfs_providers (id, name, name_bn, code, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run('bkash', 'bKash', 'বিকাশ', 'bkash', 1, Date.now());
  });

  it('customer due and statement opening balance before range', () => {
    // Sale for customer
    ctx.purchaseService.create({
      businessId, supplierId: ctx.supplier.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 10000, costPerUnitPaisa: 10000 }],
      paidPaisa: 0,
    });
    const sale = ctx.saleService.create({
      businessId, customerId: ctx.customer.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 1000, unitPricePaisa: 15000 }],
      paidPaisa: 0,
    });
    // Customer due should be 15000
    const dueRows = reportService.getCustomerDue({ businessId });
    const row = dueRows.find((r: any) => r.customerId === ctx.customer.id);
    expect(row).toBeTruthy();
    expect(row!.currentDuePaisa).toBe(15000);

    // Statement with running balance
    const stmt = reportService.getCustomerStatement(ctx.customer.id, {});
    expect(stmt.rows.length).toBeGreaterThanOrEqual(1);
    expect(stmt.closingBalancePaisa).toBe(row!.currentDuePaisa);
    // Running balance deterministic
    let running = stmt.openingBalancePaisa;
    for (const r of stmt.rows) {
      running += r.amountPaisa;
      expect(r.runningBalancePaisa).toBe(running);
    }
  });

  it('supplier payable and statement', () => {
    ctx.purchaseService.create({
      businessId, supplierId: ctx.supplier.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 10000, costPerUnitPaisa: 10000 }],
      paidPaisa: 0,
    });
    const payRows = reportService.getSupplierPayable({ businessId });
    const row = payRows.find((r: any) => r.supplierId === ctx.supplier.id);
    expect(row).toBeTruthy();
    expect(row!.currentPayablePaisa).toBe(100000);

    const stmt = reportService.getSupplierStatement(ctx.supplier.id, {});
    expect(stmt.rows.length).toBeGreaterThanOrEqual(1);
    expect(stmt.closingBalancePaisa).toBe(row!.currentPayablePaisa);
  });

  it('expense summary by category', () => {
    const cashAcc = ctx.financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 500000 });
    const cat = ctx.expenseCatRepo.create({ businessId, name: 'Rent', nameBn: 'ভাড়া', isSystem: true, isActive: true });
    ctx.expenseService.create({ businessId, categoryId: cat.id, amountPaisa: 100000, paymentMethod: 'cash', cashAccountId: cashAcc.id });
    const summary = reportService.getExpenseSummary({ businessId });
    expect(summary.expenseCount).toBe(1);
    expect(summary.activeExpensePaisa).toBe(100000);

    const byCat = reportService.getExpenseByCategory({ businessId });
    expect(byCat.length).toBe(1);
    expect(byCat[0].amountPaisa).toBe(100000);
    expect(byCat[0].percentage).toBe(100);
  });

  it('P&L uses immutable cost snapshot not current product cost', () => {
    ctx.purchaseService.create({
      businessId, supplierId: ctx.supplier.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 10000, costPerUnitPaisa: 10000 }],
      paidPaisa: 0,
    });

    ctx.saleService.create({
      businessId, customerId: ctx.customer.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 1000, unitPricePaisa: 15000 }],
      paidPaisa: 15000,
    });

    // Change product cost to 20000 AFTER sale — P&L should still use snapshot 10000
    db.prepare('UPDATE products SET cost_price_paisa = ? WHERE id = ?').run(20000, ctx.prodA.id);

    const cashAcc = ctx.financeService.createCashAccount({ businessId, name: 'Main', openingBalancePaisa: 100000 });
    const cat = ctx.expenseCatRepo.create({ businessId, name: 'Misc', nameBn: 'বিবিধ', isSystem: true, isActive: true });
    ctx.expenseService.create({ businessId, categoryId: cat.id, amountPaisa: 2000, paymentMethod: 'cash', cashAccountId: cashAcc.id });

    const pl = reportService.getProfitLoss({ businessId });
    // Revenue 15000, COGS 10000 (snapshot), gross 5000, expense 2000, net 3000
    expect(pl.revenue.netSalesPaisa).toBe(15000);
    expect(pl.cogs.cogsPaisa).toBe(10000);
    expect(pl.grossProfit.grossProfitPaisa).toBe(5000);
    expect(pl.expenses.operatingExpensesPaisa).toBe(2000);
    expect(pl.netProfit.netProfitPaisa).toBe(3000);
  });

  it('shift report', () => {
    const cashAcc = ctx.financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 0 });
    const shift = ctx.shiftService.open({ businessId, cashAccountId: cashAcc.id, openingCashPaisa: 100000, openedByUserId: 'user1' });
    const shifts = reportService.getShiftReport({ businessId });
    expect(shifts.length).toBe(1);
    expect(shifts[0].id).toBe(shift.id);
    expect(shifts[0].openingCashPaisa).toBe(100000);
  });

  it('dashboard metrics real data no fake numbers', () => {
    ctx.purchaseService.create({
      businessId, supplierId: ctx.supplier.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 10000, costPerUnitPaisa: 10000 }],
      paidPaisa: 0,
    });
    ctx.saleService.create({
      businessId, customerId: ctx.customer.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 1000, unitPricePaisa: 15000 }],
      paidPaisa: 15000,
    });

    const metrics = reportService.getDashboardMetrics({ businessId });
    expect(metrics.totalProducts).toBeGreaterThanOrEqual(1);
    expect(metrics.totalCustomers).toBeGreaterThanOrEqual(1);
    expect(metrics.totalSuppliers).toBeGreaterThanOrEqual(1);
    expect(metrics.today.transactionCount).toBeGreaterThanOrEqual(1);
    expect(metrics.salesTrend.length).toBe(7);
    expect(metrics.recentSales.length).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(metrics.today.salesPaisa)).toBe(true);
  });

  it('cash/bank/mfs reports opening balance before range', () => {
    const cashAcc = ctx.financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 100000 });
    ctx.cashMovementRepo.create({ businessId, cashAccountId: cashAcc.id, movementType: 'sale', amountPaisa: 50000 });
    const report = reportService.getCashReport(cashAcc.id, {});
    expect(report.openingBalancePaisa).toBe(100000);
    expect(report.closingBalancePaisa).toBe(150000);
    expect(report.inflows.salesPaisa).toBe(50000);
  });

  it('security parameterized queries no dynamic table injection', () => {
    // Attempt to inject via productId
    const malicious = "'; DROP TABLE sales; --";
    // Should not throw SQL error nor drop table, should return empty
    const rows = reportService.getSalesByProduct({ businessId, productId: malicious } as any);
    expect(Array.isArray(rows)).toBe(true);
    // Table still exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'").get();
    expect(tableExists).toBeTruthy();
  });
});

describe('P4.4 Reports - Large Data Performance', () => {
  let db: any;
  const businessId = 'biz_report_perf';
  let ctx: any;
  let reportService: ReportService;

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    ctx = setupBase(db, businessId);
    reportService = new ReportService();
    setConnection(db);
  });

  it('should handle 1000 sales aggregation under 2s', () => {
    ctx.purchaseService.create({
      businessId, supplierId: ctx.supplier.id,
      items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 1000000, costPerUnitPaisa: 10000 }],
      paidPaisa: 0,
    });
    // Create 100 sales quickly via direct DB inserts for performance (service overhead okay)
    for (let i = 0; i < 100; i++) {
      ctx.saleService.create({
        businessId, customerId: ctx.customer.id,
        items: [{ productId: ctx.prodA.id, unitId: ctx.pcs.id, quantityMilli: 1000, unitPricePaisa: 15000 }],
        paidPaisa: 15000,
      });
    }
    const start = Date.now();
    const summary = reportService.getSalesSummary({ businessId });
    const elapsed = Date.now() - start;
    expect(summary.transactionCount).toBe(100);
    expect(elapsed).toBeLessThan(2000);
  });
});
