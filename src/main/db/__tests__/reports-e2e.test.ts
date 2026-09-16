import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb, seedBusiness } from './test-helpers';
import { setConnection } from '../connection';
import { UnitRepository, UnitConversionRepository } from '../repositories/unit.repository';
import { ProductRepository } from '../repositories/product.repository';
import { CustomerService } from '../../services/customer.service';
import { SupplierService } from '../../services/supplier.service';
import { PurchaseService } from '../../services/purchase.service';
import { SaleService } from '../../services/sale.service';
import { FinanceService } from '../../services/finance.service';
import { ExpenseService } from '../../services/expense.service';
import { ShiftService } from '../../services/shift.service';
import { ExpenseCategoryRepository } from '../repositories/finance.repository';
import { ReportService } from '../../reports/report.service';

describe('P4.4 E2E Reports - Full Business Cycle', () => {
  let db: any;
  const businessId = 'biz_report_e2e';
  let reportService: ReportService;
  let purchaseService: PurchaseService;
  let saleService: SaleService;
  let customerService: CustomerService;
  let supplierService: SupplierService;
  let financeService: FinanceService;
  let expenseService: ExpenseService;
  let shiftService: ShiftService;
  let productRepo: ProductRepository;
  let unitRepo: UnitRepository;
  let unitConvRepo: UnitConversionRepository;
  let expenseCatRepo: ExpenseCategoryRepository;
  let customer: any;
  let supplier: any;
  let prodA: any;
  let prodB: any;

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    setConnection(db);

    unitRepo = new UnitRepository(db);
    unitConvRepo = new UnitConversionRepository(db);
    productRepo = new ProductRepository(db);
    customerService = new CustomerService(db);
    supplierService = new SupplierService(db);
    purchaseService = new PurchaseService(db);
    saleService = new SaleService(db);
    financeService = new FinanceService(db);
    expenseService = new ExpenseService(db);
    shiftService = new ShiftService(db);
    expenseCatRepo = new ExpenseCategoryRepository(db);
    reportService = new ReportService();

    const pcs = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', nameBn: 'পিস', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    prodA = productRepo.create({
      businessId, baseUnitId: pcs.id, name: 'E2E A', sku: 'SKU-E2E-A', barcode: 'E2E-A', costPricePaisa: 0, sellingPricePaisa: 15000,
      minStockMilli: 0, reorderLevelMilli: 0, openingStockMilli: 0, isStockTrackable: true, isSellable: true, isPurchasable: true, isActive: true, taxRate: 0,
    } as any);
    prodB = productRepo.create({
      businessId, baseUnitId: pcs.id, name: 'E2E B', sku: 'SKU-E2E-B', barcode: 'E2E-B', costPricePaisa: 0, sellingPricePaisa: 20000,
      minStockMilli: 0, reorderLevelMilli: 0, openingStockMilli: 0, isStockTrackable: true, isSellable: true, isPurchasable: true, isActive: true, taxRate: 0,
    } as any);

    supplier = supplierService.create({ businessId, name: 'E2E Supplier' });
    customer = customerService.create({ businessId, name: 'E2E Customer', phone: '01700000001', openingDuePaisa: 0, creditLimitPaisa: 10000000 });
  });

  it('full cycle: purchase -> sale -> expense -> shift -> reports invariants', () => {
    // Purchase 100 pcs A at 100 BDT, 50 pcs B at 150 BDT
    const pur1 = purchaseService.create({
      businessId, supplierId: supplier.id,
      items: [
        { productId: prodA.id, unitId: prodA.baseUnitId, quantityMilli: 100000, costPerUnitPaisa: 10000 },
        { productId: prodB.id, unitId: prodB.baseUnitId, quantityMilli: 50000, costPerUnitPaisa: 15000 },
      ],
      paidPaisa: 500000,
    });
    expect(pur1.totalPaisa).toBe(100*10000 + 50*15000); // 1000000+750000=1750000

    // Sale 10 pcs A at 150 BDT, 5 pcs B at 200 BDT, paid full
    const sale1 = saleService.create({
      businessId, customerId: customer.id,
      items: [
        { productId: prodA.id, unitId: prodA.baseUnitId, quantityMilli: 10000, unitPricePaisa: 15000 },
        { productId: prodB.id, unitId: prodB.baseUnitId, quantityMilli: 5000, unitPricePaisa: 20000 },
      ],
      paidPaisa: 250000,
    });
    expect(sale1.totalPaisa).toBe(10*15000 + 5*20000); // 250000

    // Expense 5000 BDT
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 1000000 });
    const cat = expenseCatRepo.create({ businessId, name: 'Rent', nameBn: 'ভাড়া', isSystem: true, isActive: true });
    expenseService.create({ businessId, categoryId: cat.id, amountPaisa: 500000, paymentMethod: 'cash', cashAccountId: cashAcc.id });

    // Shift
    const shift = shiftService.open({ businessId, cashAccountId: cashAcc.id, openingCashPaisa: 1000000, openedByUserId: 'user1' });

    // Reports
    const salesSummary = reportService.getSalesSummary({ businessId });
    expect(salesSummary.transactionCount).toBe(1);
    expect(salesSummary.netSalesPaisa).toBe(250000);

    const salesByProduct = reportService.getSalesByProduct({ businessId });
    expect(salesByProduct.length).toBe(2);
    const prodAReport = salesByProduct.find((r: any) => r.productId === prodA.id);
    expect(prodAReport!.cogsPaisa).toBe(10*10000); // 100000 snapshot
    expect(prodAReport!.grossProfitPaisa).toBe(150000-100000); // 50000

    const purchaseSummary = reportService.getPurchaseSummary({ businessId });
    expect(purchaseSummary.purchaseCount).toBe(1);
    expect(purchaseSummary.totalPaisa).toBe(1750000);

    const stock = reportService.getCurrentStock({ businessId });
    const stockA = stock.find((s: any) => s.productId === prodA.id);
    expect(stockA!.currentQuantityMilli).toBe(90000); // 100-10 pcs

    const pl = reportService.getProfitLoss({ businessId });
    // Revenue 250000, COGS = 10*10000+5*15000=175000, gross=75000, expense 500000, net = -425000
    expect(pl.revenue.netSalesPaisa).toBe(250000);
    expect(pl.cogs.cogsPaisa).toBe(175000);
    expect(pl.grossProfit.grossProfitPaisa).toBe(75000);
    expect(pl.expenses.operatingExpensesPaisa).toBe(500000);
    expect(pl.netProfit.netProfitPaisa).toBe(75000-500000);

    const dashboard = reportService.getDashboardMetrics({ businessId });
    expect(dashboard.totalProducts).toBe(2);
    expect(dashboard.today.transactionCount).toBe(1);
    expect(dashboard.salesTrend.length).toBe(7);
    expect(dashboard.recentSales.length).toBe(1);
    expect(dashboard.paymentMix.length).toBeGreaterThanOrEqual(0);

    const shifts = reportService.getShiftReport({ businessId });
    expect(shifts.length).toBe(1);
    expect(shifts[0].id).toBe(shift.id);

    // Customer due
    const custDue = reportService.getCustomerDue({ businessId });
    const custRow = custDue.find((r: any) => r.customerId === customer.id);
    expect(custRow).toBeTruthy();
    expect(custRow!.currentDuePaisa).toBe(0); // paid full

    // Supplier payable
    const supPay = reportService.getSupplierPayable({ businessId });
    const supRow = supPay.find((r: any) => r.supplierId === supplier.id);
    expect(supRow!.currentPayablePaisa).toBe(1250000); // 1750000-500000
  });
});
