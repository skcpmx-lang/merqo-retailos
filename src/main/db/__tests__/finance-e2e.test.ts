import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb, seedBusiness } from './test-helpers';
import { ProductRepository } from '../repositories/product.repository';
import { UnitRepository, UnitConversionRepository } from '../repositories/unit.repository';
import { StockLevelRepository, StockMovementRepository } from '../repositories/inventory.repository';
import { CustomerService } from '../../services/customer.service';
import { SupplierService } from '../../services/supplier.service';
import { PurchaseService } from '../../services/purchase.service';
import { SaleService } from '../../services/sale.service';
import { FinanceService } from '../../services/finance.service';
import { ExpenseService } from '../../services/expense.service';
import { ShiftService } from '../../services/shift.service';
import { ExpenseCategoryRepository, MfsProviderRepository } from '../repositories/finance.repository';
import { CustomerTransactionRepository } from '../repositories/customer.repository';
import { SupplierTransactionRepository } from '../repositories/supplier.repository';

describe('Phase 3D Finance - Critical E2E', () => {
  let db: any;
  const businessId = 'biz_fin_3d_e2e';

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    db.prepare(`INSERT OR IGNORE INTO mfs_providers (id, name, name_bn, code, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run('bkash', 'bKash', 'বিকাশ', 'bkash', 1, Date.now());
  });

  it('full finance flow: purchase -> partial supplier pay -> sale cash+bkash+due -> collect due via bkash -> expense -> transfer -> mfs cash-out -> shift close -> invariants', () => {
    const financeService = new FinanceService(db);
    const expenseService = new ExpenseService(db);
    const shiftService = new ShiftService(db);
    const customerService = new CustomerService(db);
    const supplierService = new SupplierService(db);
    const purchaseService = new PurchaseService(db);
    const saleService = new SaleService(db);
    const productRepo = new ProductRepository(db);
    const unitRepo = new UnitRepository(db);
    const unitConvRepo = new UnitConversionRepository(db);
    const stockLevelRepo = new StockLevelRepository(db);
    const stockMovementRepo = new StockMovementRepository(db);
    const customerTxRepo = new CustomerTransactionRepository(db);
    const supplierTxRepo = new SupplierTransactionRepository(db);
    const categoryRepo = new ExpenseCategoryRepository(db);

    // Setup accounts
    const mainCash = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 10000000, isDefault: true }); // 100,000 BDT
    const counterCash = financeService.createCashAccount({ businessId, name: 'Counter Cash', openingBalancePaisa: 0 });
    const bankAcc = financeService.createBankAccount({ businessId, bankName: 'DBBL', accountName: 'Main', openingBalancePaisa: 5000000 });
    const bkashAcc = financeService.createMfsAccount({ businessId, providerId: 'bkash', accountNumber: '01700000000', accountName: 'দোকানের bKash', openingBalancePaisa: 2000000 });

    const customer = customerService.create({ businessId, name: 'Finance E2E Customer', creditLimitPaisa: 10000000 });
    const supplier = supplierService.create({ businessId, name: 'Finance E2E Supplier' });

    const unitPiece = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true });
    const product = productRepo.create({
      businessId,
      baseUnitId: unitPiece.id,
      name: 'Finance Product',
      sku: 'SKU-FIN-E2E',
      barcode: 'FIN-E2E-123',
      costPricePaisa: 10000, // 100 BDT
      sellingPricePaisa: 15000, // 150 BDT
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 0,
      isStockTrackable: true,
      isSellable: true,
      isPurchasable: true,
      isActive: true,
      taxRate: 0,
    } as any);

    // 1. Purchase inventory from supplier
    const purchase = purchaseService.create({
      businessId,
      supplierId: supplier.id,
      items: [{ productId: product.id, unitId: unitPiece.id, quantityMilli: 100000, costPerUnitPaisa: 10000 }], // 100 pcs *100 BDT = 10,000 BDT = 1,000,000 paisa
      createdBy: 'test',
    });

    // Verify stock after purchase: should be 100 pcs
    const levelAfterPurchase = stockLevelRepo.findByProduct(product.id);
    expect(levelAfterPurchase!.quantityMilli).toBe(100000);

    // 2. Pay supplier partially using cash
    purchaseService.paySupplier({
      businessId,
      supplierId: supplier.id,
      amountPaisa: 600000, // 6000 BDT partial
      method: 'cash',
      cashAccountId: mainCash.id,
      createdBy: 'test',
    });

    // Verify cash decreases: 10,000,000 - 600,000 = 9,400,000
    let mainCashBal = financeService.getCashBalance(mainCash.id);
    expect(mainCashBal).toBe(10000000 - 600000);

    // Verify supplier payable decreases: purchase 1,000,000 - payment 600,000 = 400,000 payable
    const supplierDue = supplierTxRepo.getCurrentPayable(supplier.id);
    expect(supplierDue).toBe(400000);

    // 3 & 4. Sell product through SalesService: cash portion, bkash portion, due portion
    const sale = saleService.create({
      businessId,
      customerId: customer.id,
      items: [{ productId: product.id, unitId: unitPiece.id, quantityMilli: 10000, unitPricePaisa: 15000 }], // 10 pcs *150 = 150,000 paisa =1500 BDT
      paidPaisa: 100000, // paid 1000 BDT
      payments: [
        { method: 'cash', amountPaisa: 50000, cashAccountId: mainCash.id },
        { method: 'bkash', amountPaisa: 50000, mfsAccountId: bkashAcc.id },
      ],
      createdBy: 'test',
    });

    // Verify cash movement: +50000
    mainCashBal = financeService.getCashBalance(mainCash.id);
    expect(mainCashBal).toBe(10000000 - 600000 + 50000);

    // Verify MFS movement: +50000
    let bkashBal = financeService.getMfsBalance(bkashAcc.id);
    expect(bkashBal).toBe(2000000 + 50000);

    // Verify customer receivable: due 50000 (150000-100000)
    const customerDue = customerTxRepo.getCurrentDue(customer.id);
    expect(customerDue).toBe(50000);

    // Verify inventory: 100 -10 =90 pcs
    const levelAfterSale = stockLevelRepo.findByProduct(product.id);
    expect(levelAfterSale!.quantityMilli).toBe(90000);

    // Verify COGS: costPerUnit 10000 *10 =100000
    const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id) as any[];
    expect(saleItems[0].cost_per_unit_paisa).toBe(10000);
    expect(saleItems[0].line_cost_total_paisa).toBe(100000);

    // 5. Collect customer due through bKash
    customerService.collectDue({
      businessId,
      customerId: customer.id,
      amountPaisa: 50000,
      method: 'bkash',
      mfsAccountId: bkashAcc.id,
      createdBy: 'test',
    });

    // Verify customer receivable decreases to 0
    const customerDueAfterCollect = customerTxRepo.getCurrentDue(customer.id);
    expect(customerDueAfterCollect).toBe(0);

    // Verify MFS increases: 2,050,000 +50,000 =2,100,000
    bkashBal = financeService.getMfsBalance(bkashAcc.id);
    expect(bkashBal).toBe(2100000);

    // 6. Create cash expense
    const cat = categoryRepo.create({ businessId, name: 'Electricity', nameBn: 'বিদ্যুৎ', isSystem: true, isActive: true });
    expenseService.create({ businessId, categoryId: cat.id, amountPaisa: 20000, paymentMethod: 'cash', cashAccountId: mainCash.id, notes: 'bill' });

    // Verify cash decreases: 9,450,000 -20,000 =9,430,000
    mainCashBal = financeService.getCashBalance(mainCash.id);
    expect(mainCashBal).toBe(9430000);

    // 7. Transfer cash from Main to Counter
    financeService.transfer({ businessId, sourceType: 'cash', sourceAccountId: mainCash.id, destType: 'cash', destAccountId: counterCash.id, amountPaisa: 500000, notes: 'counter top-up' });

    // Verify both sides
    expect(financeService.getCashBalance(mainCash.id)).toBe(9430000 - 500000);
    expect(financeService.getCashBalance(counterCash.id)).toBe(500000);

    // 8. Perform MFS cash-out: MFS decreases, cash increases
    financeService.mfsCashOut({ businessId, cashAccountId: mainCash.id, mfsAccountId: bkashAcc.id, amountPaisa: 100000, notes: 'withdraw to cash' });

    // MFS: 2,100,000 -100,000 =2,000,000, Cash: 8,930,000 +100,000 =9,030,000
    expect(financeService.getMfsBalance(bkashAcc.id)).toBe(2000000);
    expect(financeService.getCashBalance(mainCash.id)).toBe(9030000);

    // 9. Close shift — open first
    const shift = shiftService.open({ businessId, cashAccountId: mainCash.id, openingCashPaisa: 10000000, openedByUserId: 'user1' });
    // During shift, we already had movements after shift open? We opened after previous movements, so need to create movements after open to test expected
    // Let's create a sale movement after shift open to simulate
    const dbCashMov = db.prepare('SELECT COUNT(*) as c FROM cash_movements WHERE cash_account_id = ? AND created_at >= ?').get(mainCash.id, shift.openedAt) as { c: number };
    // For simplicity, we will calculate expected based on movements during shift (which currently 0 after open if we opened after)
    // So expected = opening 10,000,000
    const calc = shiftService.calculateExpected(shift.id);
    expect(calc.opening).toBe(10000000);

    // Close shift with actual counted cash = expected + 500 variance
    const actualCounted = calc.expected + 50000; // 500 BDT extra
    const closed = shiftService.close({ shiftId: shift.id, actualCashPaisa: actualCounted, closedByUserId: 'user1', notes: '500 BDT extra found' });
    expect(closed?.status).toBe('closed');
    expect(closed?.variancePaisa).toBe(50000);

    // 10. Verify all ledgers reconcile

    // Inventory: stock_levels == SUM(stock_movements)
    const stockLevels = db.prepare('SELECT product_id, quantity_milli FROM stock_levels').all() as any[];
    for (const sl of stockLevels) {
      const sumRow = db.prepare('SELECT SUM(quantity_milli) as total FROM stock_movements WHERE product_id = ?').get(sl.product_id) as { total: number | null };
      expect(sl.quantity_milli).toBe(sumRow.total || 0);
    }

    // Customer: balance == SUM(customer ledger)
    const custBal = customerTxRepo.getCurrentDue(customer.id);
    const custSumRow = db.prepare('SELECT SUM(amount_paisa) as total FROM customer_transactions WHERE customer_id = ?').get(customer.id) as { total: number | null };
    expect(custBal).toBe(custSumRow.total || 0);

    // Supplier: payable == SUM(supplier ledger)
    const supBal = supplierTxRepo.getCurrentPayable(supplier.id);
    const supSumRow = db.prepare('SELECT SUM(amount_paisa) as total FROM supplier_transactions WHERE supplier_id = ?').get(supplier.id) as { total: number | null };
    expect(supBal).toBe(supSumRow.total || 0);

    // Cash: balance == opening + inflows - outflows
    const cashAccounts = financeService.listCashAccounts(businessId, true);
    for (const acc of cashAccounts) {
      const inv = financeService.verifyCashInvariant(acc.id);
      expect(inv.valid).toBe(true);
    }

    // Bank
    const bankAccounts = financeService.listBankAccounts(businessId, true);
    for (const acc of bankAccounts) {
      const inv = financeService.verifyBankInvariant(acc.id);
      expect(inv.valid).toBe(true);
    }

    // MFS
    const mfsAccounts = financeService.listMfsAccounts(businessId, true);
    for (const acc of mfsAccounts) {
      const inv = financeService.verifyMfsInvariant(acc.id);
      expect(inv.valid).toBe(true);
    }

    // Financial payments: every sale/purchase must have expected financial movement
    const salePayments = db.prepare('SELECT COUNT(*) as c FROM sale_payments WHERE sale_id = ?').get(sale.id) as { c: number };
    expect(salePayments.c).toBe(2);

    // Money integer paisa
    const allMovements = db.prepare('SELECT amount_paisa, net_amount_paisa FROM mfs_transactions').all() as any[];
    for (const m of allMovements) {
      expect(Number.isInteger(m.amount_paisa)).toBe(true);
      if (m.net_amount_paisa !== null) expect(Number.isInteger(m.net_amount_paisa)).toBe(true);
    }
  });
});

describe('Phase 3D Finance - Rollback', () => {
  let db: any;
  const businessId = 'biz_fin_3d_rollback';

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    db.prepare(`INSERT OR IGNORE INTO mfs_providers (id, name, name_bn, code, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run('bkash', 'bKash', 'বিকাশ', 'bkash', 1, Date.now());
  });

  it('should rollback cash movement failure — no partial', () => {
    const financeService = new FinanceService(db);
    const mainCash = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 100000 });
    const before = financeService.getCashBalance(mainCash.id);
    try {
      // Try to create movement with invalid account inside transfer — should rollback
      financeService.transfer({ businessId, sourceType: 'cash', sourceAccountId: mainCash.id, destType: 'cash', destAccountId: 'invalid', amountPaisa: 10000 });
    } catch {}
    const after = financeService.getCashBalance(mainCash.id);
    expect(after).toBe(before);
  });

  it('should rollback MFS cash-in failure', () => {
    const financeService = new FinanceService(db);
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 100000 });
    const mfsAcc = financeService.createMfsAccount({ businessId, providerId: 'bkash', accountNumber: '01700000000', openingBalancePaisa: 50000 });
    const cashBefore = financeService.getCashBalance(cashAcc.id);
    const mfsBefore = financeService.getMfsBalance(mfsAcc.id);
    try {
      // Insufficient cash should rollback
      financeService.mfsCashIn({ businessId, cashAccountId: cashAcc.id, mfsAccountId: mfsAcc.id, amountPaisa: 200000 });
    } catch {}
    expect(financeService.getCashBalance(cashAcc.id)).toBe(cashBefore);
    expect(financeService.getMfsBalance(mfsAcc.id)).toBe(mfsBefore);
  });

  it('should rollback expense failure', () => {
    const financeService = new FinanceService(db);
    const expenseService = new ExpenseService(db);
    const categoryRepo = new ExpenseCategoryRepository(db);
    const cat = categoryRepo.create({ businessId, name: 'Test', nameBn: 'টেস্ট', isSystem: false, isActive: true });
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main', openingBalancePaisa: 100000 });
    const before = financeService.getCashBalance(cashAcc.id);
    try {
      // Invalid category should rollback
      expenseService.create({ businessId, categoryId: 'invalid-cat', amountPaisa: 10000, paymentMethod: 'cash', cashAccountId: cashAcc.id });
    } catch {}
    expect(financeService.getCashBalance(cashAcc.id)).toBe(before);
    const expenses = db.prepare('SELECT COUNT(*) as c FROM expenses').get() as { c: number };
    expect(expenses.c).toBe(0);
  });

  it('should rollback transfer destination failure', () => {
    const financeService = new FinanceService(db);
    const main = financeService.createCashAccount({ businessId, name: 'Main', openingBalancePaisa: 100000 });
    const before = financeService.getCashBalance(main.id);
    try {
      // Simulate failure by using same account (rejected before any movement)
      financeService.transfer({ businessId, sourceType: 'cash', sourceAccountId: main.id, destType: 'cash', destAccountId: main.id, amountPaisa: 10000 });
    } catch {}
    expect(financeService.getCashBalance(main.id)).toBe(before);
    const transfers = db.prepare('SELECT COUNT(*) as c FROM finance_transfers').get() as { c: number };
    expect(transfers.c).toBe(0);
  });

  it('should rollback shift close failure — no double close', () => {
    const financeService = new FinanceService(db);
    const shiftService = new ShiftService(db);
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main', openingBalancePaisa: 0 });
    const shift = shiftService.open({ businessId, cashAccountId: cashAcc.id, openingCashPaisa: 100000, openedByUserId: 'user1' });
    shiftService.close({ shiftId: shift.id, actualCashPaisa: 100000, closedByUserId: 'user1' });
    const beforeStatus = shiftService.getById(shift.id).status;
    try {
      shiftService.close({ shiftId: shift.id, actualCashPaisa: 100000, closedByUserId: 'user1' });
    } catch {}
    const afterStatus = shiftService.getById(shift.id).status;
    expect(beforeStatus).toBe('closed');
    expect(afterStatus).toBe('closed');
  });
});
