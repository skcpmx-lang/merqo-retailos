import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb, seedBusiness } from './test-helpers';
import {
  CashAccountRepository,
  CashMovementRepository,
  BankAccountRepository,
  BankTransactionRepository,
  MfsAccountRepository,
  MfsTransactionRepository,
  MfsProviderRepository,
  ExpenseCategoryRepository,
  ExpenseRepository,
  FinanceTransferRepository,
  ShiftRepository,
} from '../repositories/finance.repository';
import { FinanceService } from '../../services/finance.service';
import { ExpenseService } from '../../services/expense.service';
import { ShiftService } from '../../services/shift.service';

describe('Phase 3D Finance - Cash', () => {
  let db: any;
  const businessId = 'biz_fin_3d_cash';
  let cashAccountRepo: CashAccountRepository;
  let cashMovementRepo: CashMovementRepository;
  let financeService: FinanceService;

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    cashAccountRepo = new CashAccountRepository(db);
    cashMovementRepo = new CashMovementRepository(db);
    financeService = new FinanceService(db);
  });

  it('should create cash account', () => {
    const acc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 500000, isDefault: true });
    expect(acc.name).toBe('Main Cash');
    expect(acc.openingBalancePaisa).toBe(500000);
    expect(acc.currentBalancePaisa).toBe(500000);
  });

  it('should handle cash inflow', () => {
    const acc = financeService.createCashAccount({ businessId, name: 'Counter Cash', openingBalancePaisa: 0 });
    cashMovementRepo.create({ businessId, cashAccountId: acc.id, movementType: 'sale', amountPaisa: 100000, notes: 'cash sale' });
    const bal = financeService.getCashBalance(acc.id);
    expect(bal).toBe(100000);
  });

  it('should handle cash outflow', () => {
    const acc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 200000 });
    cashMovementRepo.create({ businessId, cashAccountId: acc.id, movementType: 'expense', amountPaisa: -50000, notes: 'expense' });
    const bal = financeService.getCashBalance(acc.id);
    expect(bal).toBe(150000);
  });

  it('should calculate balance = opening + inflows - outflows', () => {
    const acc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 100000 });
    cashMovementRepo.create({ businessId, cashAccountId: acc.id, movementType: 'sale', amountPaisa: 50000 });
    cashMovementRepo.create({ businessId, cashAccountId: acc.id, movementType: 'customer_collection', amountPaisa: 30000 });
    cashMovementRepo.create({ businessId, cashAccountId: acc.id, movementType: 'expense', amountPaisa: -20000 });
    cashMovementRepo.create({ businessId, cashAccountId: acc.id, movementType: 'supplier_payment', amountPaisa: -40000 });
    const bal = financeService.getCashBalance(acc.id);
    expect(bal).toBe(100000 + 50000 + 30000 - 20000 - 40000);
  });

  it('should handle transfer atomic both sides', () => {
    const main = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 100000 });
    const counter = financeService.createCashAccount({ businessId, name: 'Counter Cash', openingBalancePaisa: 0 });
    const tr = financeService.transfer({ businessId, sourceType: 'cash', sourceAccountId: main.id, destType: 'cash', destAccountId: counter.id, amountPaisa: 50000, notes: 'test transfer' });
    expect(tr.transferNumber).toMatch(/TRF-/);
    const mainBal = financeService.getCashBalance(main.id);
    const counterBal = financeService.getCashBalance(counter.id);
    expect(mainBal).toBe(50000);
    expect(counterBal).toBe(50000);
  });

  it('should reject zero amount transfer', () => {
    const main = financeService.createCashAccount({ businessId, name: 'Main', openingBalancePaisa: 100000 });
    const counter = financeService.createCashAccount({ businessId, name: 'Counter', openingBalancePaisa: 0 });
    expect(() => financeService.transfer({ businessId, sourceType: 'cash', sourceAccountId: main.id, destType: 'cash', destAccountId: counter.id, amountPaisa: 0 })).toThrow(/০ এর বেশি/);
  });

  it('should reject negative amount transfer', () => {
    const main = financeService.createCashAccount({ businessId, name: 'Main', openingBalancePaisa: 100000 });
    const counter = financeService.createCashAccount({ businessId, name: 'Counter', openingBalancePaisa: 0 });
    expect(() => financeService.transfer({ businessId, sourceType: 'cash', sourceAccountId: main.id, destType: 'cash', destAccountId: counter.id, amountPaisa: -1000 })).toThrow(/০ এর বেশি/);
  });

  it('should reject insufficient balance', () => {
    const main = financeService.createCashAccount({ businessId, name: 'Main', openingBalancePaisa: 10000 });
    const counter = financeService.createCashAccount({ businessId, name: 'Counter', openingBalancePaisa: 0 });
    expect(() => financeService.transfer({ businessId, sourceType: 'cash', sourceAccountId: main.id, destType: 'cash', destAccountId: counter.id, amountPaisa: 50000 })).toThrow(/অপর্যাপ্ত/);
  });

  it('should reject same-account transfer', () => {
    const main = financeService.createCashAccount({ businessId, name: 'Main', openingBalancePaisa: 100000 });
    expect(() => financeService.transfer({ businessId, sourceType: 'cash', sourceAccountId: main.id, destType: 'cash', destAccountId: main.id, amountPaisa: 10000 })).toThrow(/একই হিসাবে/);
  });

  it('should rollback on failure — no partial', () => {
    const main = financeService.createCashAccount({ businessId, name: 'Main', openingBalancePaisa: 100000 });
    const counter = financeService.createCashAccount({ businessId, name: 'Counter', openingBalancePaisa: 0 });
    const mainBefore = financeService.getCashBalance(main.id);
    const counterBefore = financeService.getCashBalance(counter.id);
    try {
      // Invalid dest account should rollback
      financeService.transfer({ businessId, sourceType: 'cash', sourceAccountId: main.id, destType: 'cash', destAccountId: 'invalid-id', amountPaisa: 10000 });
    } catch {}
    const mainAfter = financeService.getCashBalance(main.id);
    const counterAfter = financeService.getCashBalance(counter.id);
    expect(mainAfter).toBe(mainBefore);
    expect(counterAfter).toBe(counterBefore);
  });

  it('should provide statement with running balance deterministic ORDER BY created_at ASC rowid ASC', () => {
    const acc = financeService.createCashAccount({ businessId, name: 'Main', openingBalancePaisa: 100000 });
    cashMovementRepo.create({ businessId, cashAccountId: acc.id, movementType: 'sale', amountPaisa: 10000 });
    cashMovementRepo.create({ businessId, cashAccountId: acc.id, movementType: 'sale', amountPaisa: 20000 });
    cashMovementRepo.create({ businessId, cashAccountId: acc.id, movementType: 'expense', amountPaisa: -5000 });
    const stmt = financeService.getCashStatement(acc.id);
    expect(stmt.length).toBe(3);
    expect(stmt[0].runningBalance).toBe(110000);
    expect(stmt[1].runningBalance).toBe(130000);
    expect(stmt[2].runningBalance).toBe(125000);
  });
});

describe('Phase 3D Finance - Bank', () => {
  let db: any;
  const businessId = 'biz_fin_3d_bank';
  let financeService: FinanceService;
  let bankAccountRepo: BankAccountRepository;
  let bankTxRepo: BankTransactionRepository;

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    financeService = new FinanceService(db);
    bankAccountRepo = new BankAccountRepository(db);
    bankTxRepo = new BankTransactionRepository(db);
  });

  it('should create bank account', () => {
    const acc = financeService.createBankAccount({ businessId, bankName: 'DBBL', accountName: 'Main', accountNumber: '123456', openingBalancePaisa: 1000000 });
    expect(acc.bankName).toBe('DBBL');
    expect(acc.currentBalancePaisa).toBe(1000000);
  });

  it('should handle bank inflow', () => {
    const acc = financeService.createBankAccount({ businessId, bankName: 'DBBL', openingBalancePaisa: 0 });
    bankTxRepo.create({ businessId, bankAccountId: acc.id, transactionType: 'sale', amountPaisa: 200000 });
    const bal = financeService.getBankBalance(acc.id);
    expect(bal).toBe(200000);
  });

  it('should handle bank outflow', () => {
    const acc = financeService.createBankAccount({ businessId, bankName: 'DBBL', openingBalancePaisa: 500000 });
    bankTxRepo.create({ businessId, bankAccountId: acc.id, transactionType: 'expense', amountPaisa: -100000 });
    const bal = financeService.getBankBalance(acc.id);
    expect(bal).toBe(400000);
  });

  it('should handle bank transfer', () => {
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 100000 });
    const bankAcc = financeService.createBankAccount({ businessId, bankName: 'DBBL', openingBalancePaisa: 0 });
    financeService.transfer({ businessId, sourceType: 'cash', sourceAccountId: cashAcc.id, destType: 'bank', destAccountId: bankAcc.id, amountPaisa: 50000 });
    expect(financeService.getCashBalance(cashAcc.id)).toBe(50000);
    expect(financeService.getBankBalance(bankAcc.id)).toBe(50000);
  });
});

describe('Phase 3D Finance - MFS', () => {
  let db: any;
  const businessId = 'biz_fin_3d_mfs';
  let financeService: FinanceService;
  let mfsAccountRepo: MfsAccountRepository;
  let mfsTxRepo: MfsTransactionRepository;
  let providerRepo: MfsProviderRepository;

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    // Seed providers
    providerRepo = new MfsProviderRepository(db);
    db.prepare(`INSERT OR IGNORE INTO mfs_providers (id, name, name_bn, code, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run('bkash', 'bKash', 'বিকাশ', 'bkash', 1, Date.now());
    db.prepare(`INSERT OR IGNORE INTO mfs_providers (id, name, name_bn, code, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run('nagad', 'Nagad', 'নগদ', 'nagad', 1, Date.now());
    db.prepare(`INSERT OR IGNORE INTO mfs_providers (id, name, name_bn, code, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run('rocket', 'Rocket', 'রকেট', 'rocket', 1, Date.now());
    db.prepare(`INSERT OR IGNORE INTO mfs_providers (id, name, name_bn, code, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run('upay', 'Upay', 'উপায়', 'upay', 1, Date.now());
    financeService = new FinanceService(db);
    mfsAccountRepo = new MfsAccountRepository(db);
    mfsTxRepo = new MfsTransactionRepository(db);
  });

  it('should list MFS providers including bKash Nagad Rocket Upay', () => {
    const providers = financeService.listMfsProviders();
    const codes = providers.map((p: any) => p.code);
    expect(codes).toContain('bkash');
    expect(codes).toContain('nagad');
    expect(codes).toContain('rocket');
    expect(codes).toContain('upay');
  });

  it('should create MFS account', () => {
    const acc = financeService.createMfsAccount({ businessId, providerId: 'bkash', accountNumber: '01700000000', accountName: 'দোকানের bKash', openingBalancePaisa: 500000 });
    expect(acc.accountNumber).toBe('01700000000');
    expect(acc.currentBalancePaisa).toBe(500000);
  });

  it('should handle MFS sale collection', () => {
    const acc = financeService.createMfsAccount({ businessId, providerId: 'bkash', accountNumber: '01700000000', openingBalancePaisa: 0 });
    mfsTxRepo.create({ businessId, mfsAccountId: acc.id, transactionType: 'sale', amountPaisa: 100000, customerChargePaisa: 0, commissionPaisa: 0, netAmountPaisa: 100000, notes: 'sale' });
    const bal = financeService.getMfsBalance(acc.id);
    expect(bal).toBe(100000);
  });

  it('should handle MFS cash-in: Cash -> MFS (store top-up)', () => {
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 200000 });
    const mfsAcc = financeService.createMfsAccount({ businessId, providerId: 'bkash', accountNumber: '01700000000', openingBalancePaisa: 0 });
    financeService.mfsCashIn({ businessId, cashAccountId: cashAcc.id, mfsAccountId: mfsAcc.id, amountPaisa: 100000, chargePaisa: 0, commissionPaisa: 0, notes: 'cash-in' });
    expect(financeService.getCashBalance(cashAcc.id)).toBe(100000);
    expect(financeService.getMfsBalance(mfsAcc.id)).toBe(100000);
  });

  it('should handle MFS cash-out: MFS -> Cash (store withdraw)', () => {
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 0 });
    const mfsAcc = financeService.createMfsAccount({ businessId, providerId: 'bkash', accountNumber: '01700000000', openingBalancePaisa: 200000 });
    financeService.mfsCashOut({ businessId, cashAccountId: cashAcc.id, mfsAccountId: mfsAcc.id, amountPaisa: 100000, notes: 'cash-out' });
    expect(financeService.getMfsBalance(mfsAcc.id)).toBe(100000);
    expect(financeService.getCashBalance(cashAcc.id)).toBe(100000);
  });

  it('should handle MFS charge explicit', () => {
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 600000 });
    const mfsAcc = financeService.createMfsAccount({ businessId, providerId: 'bkash', accountNumber: '01700000000', openingBalancePaisa: 0 });
    // Cash-in with charge 50 BDT = 5000 paisa, principal 5000 BDT = 500000 paisa
    financeService.mfsCashIn({ businessId, cashAccountId: cashAcc.id, mfsAccountId: mfsAcc.id, amountPaisa: 500000, chargePaisa: 5000, commissionPaisa: 0, notes: 'cash-in with charge' });
    // Cash should decrease by principal+charge = 505000, MFS increase by principal 500000
    expect(financeService.getCashBalance(cashAcc.id)).toBe(600000 - 505000);
    expect(financeService.getMfsBalance(mfsAcc.id)).toBe(500000);
    // Charge recorded as part of mfs transaction customerChargePaisa
    const stmt = financeService.getMfsStatement(mfsAcc.id);
    expect(stmt[0].transaction.customerChargePaisa).toBe(5000);
  });

  it('should handle MFS commission explicit', () => {
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 0 });
    const mfsAcc = financeService.createMfsAccount({ businessId, providerId: 'bkash', accountNumber: '01700000000', openingBalancePaisa: 100000 });
    financeService.mfsCashOut({ businessId, cashAccountId: cashAcc.id, mfsAccountId: mfsAcc.id, amountPaisa: 100000, commissionPaisa: 10000, notes: 'cash-out with commission' });
    // MFS: -100000 +10000 commission = -90000 net, so balance 10000
    // But we create two transactions: cash_out -100000 and commission +10000
    const bal = financeService.getMfsBalance(mfsAcc.id);
    expect(bal).toBe(10000);
    const stmt = financeService.getMfsStatement(mfsAcc.id);
    expect(stmt.length).toBe(2);
    expect(stmt[1].transaction.transactionType).toBe('commission');
    expect(stmt[1].transaction.commissionPaisa).toBe(10000);
  });

  it('should verify MFS invariant opening + inflows - outflows = balance', () => {
    const acc = financeService.createMfsAccount({ businessId, providerId: 'bkash', accountNumber: '01700000000', openingBalancePaisa: 100000 });
    mfsTxRepo.create({ businessId, mfsAccountId: acc.id, transactionType: 'sale', amountPaisa: 50000, customerChargePaisa: 0, commissionPaisa: 0, netAmountPaisa: 50000 });
    mfsTxRepo.create({ businessId, mfsAccountId: acc.id, transactionType: 'expense', amountPaisa: 20000, customerChargePaisa: 0, commissionPaisa: 0, netAmountPaisa: -20000 });
    const inv = financeService.verifyMfsInvariant(acc.id);
    expect(inv.valid).toBe(true);
    expect(inv.expected).toBe(130000);
    expect(inv.actual).toBe(130000);
  });
});

describe('Phase 3D Finance - Expenses', () => {
  let db: any;
  const businessId = 'biz_fin_3d_exp';
  let financeService: FinanceService;
  let expenseService: ExpenseService;
  let categoryRepo: ExpenseCategoryRepository;

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    financeService = new FinanceService(db);
    expenseService = new ExpenseService(db);
    categoryRepo = new ExpenseCategoryRepository(db);
  });

  it('should create expense category and expense', () => {
    const cat = categoryRepo.create({ businessId, name: 'Electricity', nameBn: 'বিদ্যুৎ', isSystem: false, isActive: true });
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 200000 });
    const exp = expenseService.create({ businessId, categoryId: cat.id, amountPaisa: 50000, paymentMethod: 'cash', cashAccountId: cashAcc.id, notes: 'electric bill' });
    expect(exp.expenseNumber).toMatch(/EXP-/);
    expect(exp.amountPaisa).toBe(50000);
  });

  it('should handle cash expense decreases cash', () => {
    const cat = categoryRepo.create({ businessId, name: 'Rent', nameBn: 'ভাড়া', isSystem: true, isActive: true });
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 200000 });
    expenseService.create({ businessId, categoryId: cat.id, amountPaisa: 100000, paymentMethod: 'cash', cashAccountId: cashAcc.id });
    expect(financeService.getCashBalance(cashAcc.id)).toBe(100000);
  });

  it('should handle bank expense', () => {
    const cat = categoryRepo.create({ businessId, name: 'Transport', nameBn: 'পরিবহন', isSystem: true, isActive: true });
    const bankAcc = financeService.createBankAccount({ businessId, bankName: 'DBBL', openingBalancePaisa: 500000 });
    expenseService.create({ businessId, categoryId: cat.id, amountPaisa: 100000, paymentMethod: 'bank', bankAccountId: bankAcc.id });
    expect(financeService.getBankBalance(bankAcc.id)).toBe(400000);
  });

  it('should validate expense amount >0', () => {
    const cat = categoryRepo.create({ businessId, name: 'Misc', nameBn: 'বিবিধ', isSystem: true, isActive: true });
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main', openingBalancePaisa: 100000 });
    expect(() => expenseService.create({ businessId, categoryId: cat.id, amountPaisa: 0, paymentMethod: 'cash', cashAccountId: cashAcc.id })).toThrow(/০ এর বেশি/);
  });

  it('should void expense and restore balance', () => {
    const cat = categoryRepo.create({ businessId, name: 'Electricity', nameBn: 'বিদ্যুৎ', isSystem: true, isActive: true });
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 200000 });
    const exp = expenseService.create({ businessId, categoryId: cat.id, amountPaisa: 50000, paymentMethod: 'cash', cashAccountId: cashAcc.id });
    expect(financeService.getCashBalance(cashAcc.id)).toBe(150000);
    expenseService.void(exp.id, 'ভুল এন্ট্রি', businessId, 'user1');
    expect(financeService.getCashBalance(cashAcc.id)).toBe(200000);
    const after = expenseService.get(exp.id);
    expect(after.status).toBe('voided');
  });

  it('should audit expense creation', () => {
    const cat = categoryRepo.create({ businessId, name: 'Rent', nameBn: 'ভাড়া', isSystem: true, isActive: true });
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main', openingBalancePaisa: 100000 });
    expenseService.create({ businessId, categoryId: cat.id, amountPaisa: 10000, paymentMethod: 'cash', cashAccountId: cashAcc.id });
    const logs = db.prepare('SELECT COUNT(*) as c FROM audit_logs WHERE entity_type = ?').get('expense') as { c: number };
    expect(logs.c).toBe(1);
  });
});

describe('Phase 3D Finance - Shifts', () => {
  let db: any;
  const businessId = 'biz_fin_3d_shift';
  let shiftService: ShiftService;
  let financeService: FinanceService;
  let cashAccountRepo: CashAccountRepository;
  let cashMovementRepo: CashMovementRepository;

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    shiftService = new ShiftService(db);
    financeService = new FinanceService(db);
    cashAccountRepo = new CashAccountRepository(db);
    cashMovementRepo = new CashMovementRepository(db);
  });

  it('should open shift', () => {
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 100000 });
    const shift = shiftService.open({ businessId, cashAccountId: cashAcc.id, openingCashPaisa: 50000, openedByUserId: 'user1' });
    expect(shift.shiftNumber).toMatch(/SHIFT-/);
    expect(shift.status).toBe('open');
  });

  it('should prevent double open', () => {
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 100000 });
    shiftService.open({ businessId, cashAccountId: cashAcc.id, openingCashPaisa: 50000, openedByUserId: 'user1' });
    expect(() => shiftService.open({ businessId, cashAccountId: cashAcc.id, openingCashPaisa: 10000, openedByUserId: 'user1' })).toThrow(/ইতিমধ্যে খোলা/);
  });

  it('should calculate expected closing: opening + inflows - outflows', () => {
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 0 });
    const shift = shiftService.open({ businessId, cashAccountId: cashAcc.id, openingCashPaisa: 100000, openedByUserId: 'user1' });
    // Simulate transactions during shift
    cashMovementRepo.create({ businessId, cashAccountId: cashAcc.id, movementType: 'sale', amountPaisa: 50000, notes: 'sale' });
    cashMovementRepo.create({ businessId, cashAccountId: cashAcc.id, movementType: 'customer_collection', amountPaisa: 20000 });
    cashMovementRepo.create({ businessId, cashAccountId: cashAcc.id, movementType: 'expense', amountPaisa: -10000 });
    const calc = shiftService.calculateExpected(shift.id);
    expect(calc.opening).toBe(100000);
    expect(calc.inflows).toBe(70000);
    expect(calc.outflows).toBe(10000);
    expect(calc.expected).toBe(160000);
  });

  it('should close shift with actual vs expected and variance', () => {
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 0 });
    const shift = shiftService.open({ businessId, cashAccountId: cashAcc.id, openingCashPaisa: 100000, openedByUserId: 'user1' });
    cashMovementRepo.create({ businessId, cashAccountId: cashAcc.id, movementType: 'sale', amountPaisa: 50000 });
    const closed = shiftService.close({ shiftId: shift.id, actualCashPaisa: 160000, closedByUserId: 'user1', notes: 'closed' });
    expect(closed?.status).toBe('closed');
    expect(closed?.expectedCashPaisa).toBe(150000);
    expect(closed?.actualCashPaisa).toBe(160000);
    expect(closed?.variancePaisa).toBe(10000);
  });

  it('should prevent double close', () => {
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 0 });
    const shift = shiftService.open({ businessId, cashAccountId: cashAcc.id, openingCashPaisa: 100000, openedByUserId: 'user1' });
    shiftService.close({ shiftId: shift.id, actualCashPaisa: 100000, closedByUserId: 'user1' });
    expect(() => shiftService.close({ shiftId: shift.id, actualCashPaisa: 100000, closedByUserId: 'user1' })).toThrow(/ইতিমধ্যে বন্ধ/);
  });

  it('should require reason for material variance', () => {
    const cashAcc = financeService.createCashAccount({ businessId, name: 'Main Cash', openingBalancePaisa: 0 });
    const shift = shiftService.open({ businessId, cashAccountId: cashAcc.id, openingCashPaisa: 100000, openedByUserId: 'user1' });
    // Expected 100000, actual 50000 => variance -50000 (>10000 material) without notes should throw
    expect(() => shiftService.close({ shiftId: shift.id, actualCashPaisa: 50000, closedByUserId: 'user1' })).toThrow(/কারণ/);
  });
});
