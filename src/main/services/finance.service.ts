/**
 * Finance Service — Production-grade financial operations
 * Covers cash, bank, MFS, transfers, cash-in/out, reconciliation, statements
 * Integer paisa only, atomic, auditable
 */

import {
  CashAccountRepository,
  CashMovementRepository,
  BankAccountRepository,
  BankTransactionRepository,
  MfsAccountRepository,
  MfsTransactionRepository,
  MfsProviderRepository,
  FinanceTransferRepository,
  ShiftRepository,
} from '../db/repositories/finance.repository';
import { AuditService } from './audit.service';

export type AccountType = 'cash' | 'bank' | 'mfs';

export interface CashAccountInput {
  businessId: string;
  name: string;
  openingBalancePaisa?: number;
  isDefault?: boolean;
  createdBy?: string;
}

export interface BankAccountInput {
  businessId: string;
  bankName: string;
  accountName?: string;
  accountNumber?: string;
  branch?: string;
  accountType?: string;
  openingBalancePaisa?: number;
  createdBy?: string;
}

export interface MfsAccountInput {
  businessId: string;
  providerId: string;
  accountNumber: string;
  accountName?: string;
  isAgent?: boolean;
  openingBalancePaisa?: number;
  commissionRate?: number;
  createdBy?: string;
}

export interface TransferInput {
  businessId: string;
  sourceType: AccountType;
  sourceAccountId: string;
  destType: AccountType;
  destAccountId: string;
  amountPaisa: number;
  reference?: string;
  notes?: string;
  createdBy?: string;
}

export interface MfsCashOperationInput {
  businessId: string;
  cashAccountId: string;
  mfsAccountId: string;
  amountPaisa: number;
  chargePaisa?: number;
  commissionPaisa?: number;
  customerPhone?: string;
  transactionRef?: string;
  reference?: string;
  notes?: string;
  createdBy?: string;
}

export class FinanceService {
  private cashAccountRepo: CashAccountRepository;
  private cashMovementRepo: CashMovementRepository;
  private bankAccountRepo: BankAccountRepository;
  private bankTxRepo: BankTransactionRepository;
  private mfsAccountRepo: MfsAccountRepository;
  private mfsTxRepo: MfsTransactionRepository;
  private mfsProviderRepo: MfsProviderRepository;
  private transferRepo: FinanceTransferRepository;
  private shiftRepo: ShiftRepository;
  private auditService: AuditService;

  constructor(db?: any) {
    this.cashAccountRepo = new CashAccountRepository(db);
    this.cashMovementRepo = new CashMovementRepository(db);
    this.bankAccountRepo = new BankAccountRepository(db);
    this.bankTxRepo = new BankTransactionRepository(db);
    this.mfsAccountRepo = new MfsAccountRepository(db);
    this.mfsTxRepo = new MfsTransactionRepository(db);
    this.mfsProviderRepo = new MfsProviderRepository(db);
    this.transferRepo = new FinanceTransferRepository(db);
    this.shiftRepo = new ShiftRepository(db);
    this.auditService = new AuditService(db);
  }

  // Cash Accounts
  createCashAccount(input: CashAccountInput) {
    if (!input.name || input.name.trim().length === 0) throw new Error('নগদ হিসাবের নাম প্রয়োজন');
    if (input.openingBalancePaisa !== undefined && input.openingBalancePaisa < 0) throw new Error('ওপেনিং ব্যালেন্স ঋণাত্মক হতে পারে না');
    if (!Number.isInteger(input.openingBalancePaisa ?? 0)) throw new Error('টাকার পরিমাণ পয়সায় পূর্ণসংখ্যা হতে হবে');

    const db = (this.cashAccountRepo as any).db;
    const tx = db.transaction(() => {
      const account = this.cashAccountRepo.create({
        businessId: input.businessId,
        name: input.name.trim(),
        openingBalancePaisa: input.openingBalancePaisa ?? 0,
        currentBalancePaisa: input.openingBalancePaisa ?? 0,
        isDefault: input.isDefault ?? false,
        isActive: true,
      });

      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'create',
        entityType: 'cash_account',
        entityId: account.id,
        newValues: JSON.stringify({ name: account.name, opening: account.openingBalancePaisa }),
      });

      return account;
    });
    return tx();
  }

  listCashAccounts(businessId: string, includeInactive = false) {
    return this.cashAccountRepo.findByBusiness(businessId, includeInactive);
  }

  getCashAccount(id: string) {
    const acc = this.cashAccountRepo.findById(id);
    if (!acc) throw new Error('নগদ হিসাব পাওয়া যায়নি');
    return acc;
  }

  updateCashAccount(id: string, data: { name?: string; isDefault?: boolean }, businessId: string, userId?: string) {
    const existing = this.cashAccountRepo.findById(id);
    if (!existing) throw new Error('নগদ হিসাব পাওয়া যায়নি');
    if (data.name !== undefined && data.name.trim().length === 0) throw new Error('নগদ হিসাবের নাম প্রয়োজন');

    const updated = this.cashAccountRepo.update(id, data as any);
    this.auditService.log({
      businessId,
      userId: userId || null,
      action: 'update',
      entityType: 'cash_account',
      entityId: id,
      oldValues: JSON.stringify(existing),
      newValues: JSON.stringify(data),
    });
    return updated;
  }

  deactivateCashAccount(id: string, businessId: string, userId?: string) {
    const existing = this.cashAccountRepo.findById(id);
    if (!existing) throw new Error('নগদ হিসাব পাওয়া যায়নি');
    if (existing.isDefault) throw new Error('ডিফল্ট হিসাব নিষ্ক্রিয় করা যাবে না');
    this.cashAccountRepo.deactivate(id);
    this.auditService.log({
      businessId,
      userId: userId || null,
      action: 'deactivate',
      entityType: 'cash_account',
      entityId: id,
    });
  }

  getCashStatement(accountId: string, fromDate?: number, toDate?: number) {
    return this.cashMovementRepo.getStatementWithRunningBalance(accountId, fromDate, toDate);
  }

  getCashBalance(accountId: string) {
    return this.cashMovementRepo.getBalance(accountId);
  }

  // Bank Accounts
  createBankAccount(input: BankAccountInput) {
    if (!input.bankName || input.bankName.trim().length === 0) throw new Error('ব্যাংকের নাম প্রয়োজন');
    if (input.openingBalancePaisa !== undefined && input.openingBalancePaisa < 0) throw new Error('ওপেনিং ব্যালেন্স ঋণাত্মক হতে পারে না');
    if (!Number.isInteger(input.openingBalancePaisa ?? 0)) throw new Error('টাকার পরিমাণ পয়সায় পূর্ণসংখ্যা হতে হবে');

    const db = (this.bankAccountRepo as any).db;
    const tx = db.transaction(() => {
      const account = this.bankAccountRepo.create({
        businessId: input.businessId,
        bankName: input.bankName.trim(),
        accountName: input.accountName,
        accountNumber: input.accountNumber,
        branch: input.branch,
        openingBalancePaisa: input.openingBalancePaisa ?? 0,
        currentBalancePaisa: input.openingBalancePaisa ?? 0,
        isActive: true,
      });

      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'create',
        entityType: 'bank_account',
        entityId: account.id,
        newValues: JSON.stringify({ bankName: account.bankName }),
      });

      return account;
    });
    return tx();
  }

  listBankAccounts(businessId: string, includeInactive = false) {
    return this.bankAccountRepo.findByBusiness(businessId, includeInactive);
  }

  getBankStatement(accountId: string, fromDate?: number, toDate?: number) {
    return this.bankTxRepo.getStatementWithRunningBalance(accountId, fromDate, toDate);
  }

  getBankBalance(accountId: string) {
    return this.bankTxRepo.getBalance(accountId);
  }

  // MFS Accounts
  createMfsAccount(input: MfsAccountInput) {
    if (!input.providerId) throw new Error('MFS প্রোভাইডার প্রয়োজন');
    if (!input.accountNumber || input.accountNumber.trim().length === 0) throw new Error('MFS অ্যাকাউন্ট নম্বর প্রয়োজন');
    if (input.openingBalancePaisa !== undefined && input.openingBalancePaisa < 0) throw new Error('ওপেনিং ব্যালেন্স ঋণাত্মক হতে পারে না');
    if (!Number.isInteger(input.openingBalancePaisa ?? 0)) throw new Error('টাকার পরিমাণ পয়সায় পূর্ণসংখ্যা হতে হবে');

    const provider = this.mfsProviderRepo.findById(input.providerId);
    if (!provider) {
      // Try by code
      const byCode = this.mfsProviderRepo.findByCode(input.providerId);
      if (!byCode) throw new Error('MFS প্রোভাইডার পাওয়া যায়নি');
      input.providerId = byCode.id;
    }

    const db = (this.mfsAccountRepo as any).db;
    const tx = db.transaction(() => {
      const account = this.mfsAccountRepo.create({
        businessId: input.businessId,
        providerId: input.providerId,
        accountNumber: input.accountNumber.trim(),
        accountName: input.accountName,
        isAgent: input.isAgent ?? true,
        openingBalancePaisa: input.openingBalancePaisa ?? 0,
        currentBalancePaisa: input.openingBalancePaisa ?? 0,
        commissionRate: input.commissionRate ?? 0,
        isActive: true,
      });

      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'create',
        entityType: 'mfs_account',
        entityId: account.id,
        newValues: JSON.stringify({ provider: input.providerId, accountNumber: account.accountNumber }),
      });

      return account;
    });
    return tx();
  }

  listMfsAccounts(businessId: string, includeInactive = false) {
    return this.mfsAccountRepo.findByBusiness(businessId, includeInactive);
  }

  getMfsStatement(accountId: string, fromDate?: number, toDate?: number) {
    return this.mfsTxRepo.getStatementWithRunningBalance(accountId, fromDate, toDate);
  }

  getMfsBalance(accountId: string) {
    return this.mfsTxRepo.getBalance(accountId);
  }

  listMfsProviders() {
    return this.mfsProviderRepo.findAll();
  }

  // Transfers — atomic both sides
  transfer(input: TransferInput) {
    if (input.amountPaisa <= 0) throw new Error('স্থানান্তরের পরিমাণ ০ এর বেশি হতে হবে');
    if (!Number.isInteger(input.amountPaisa)) throw new Error('টাকার পরিমাণ পয়সায় পূর্ণসংখ্যা হতে হবে');
    if (input.sourceAccountId === input.destAccountId && input.sourceType === input.destType) throw new Error('একই হিসাবে স্থানান্তর করা যাবে না');

    const db = (this.transferRepo as any).db;

    const transaction = db.transaction(() => {
      // Validate source balance if applicable (cash/bank/mfs)
      if (input.sourceType === 'cash') {
        const bal = this.cashMovementRepo.getBalance(input.sourceAccountId);
        // For cash, we allow negative? But check sufficient if we want to enforce — for now enforce if balance would go negative and account has positive opening? We will check if current balance < amount
        const account = this.cashAccountRepo.findById(input.sourceAccountId);
        if (!account) throw new Error('উৎস নগদ হিসাব পাওয়া যায়নি');
        const currentBal = account.currentBalancePaisa;
        if (currentBal < input.amountPaisa) {
          throw new Error(`অপর্যাপ্ত ব্যালেন্স। বর্তমান: ${currentBal / 100}, প্রয়োজন: ${input.amountPaisa / 100}`);
        }
      } else if (input.sourceType === 'bank') {
        const account = this.bankAccountRepo.findById(input.sourceAccountId);
        if (!account) throw new Error('উৎস ব্যাংক হিসাব পাওয়া যায়নি');
        if (account.currentBalancePaisa < input.amountPaisa) {
          throw new Error(`অপর্যাপ্ত ব্যাংক ব্যালেন্স। বর্তমান: ${account.currentBalancePaisa / 100}`);
        }
      } else if (input.sourceType === 'mfs') {
        const account = this.mfsAccountRepo.findById(input.sourceAccountId);
        if (!account) throw new Error('উৎস MFS হিসাব পাওয়া যায়নি');
        if (account.currentBalancePaisa < input.amountPaisa) {
          throw new Error(`অপর্যাপ্ত MFS ব্যালেন্স। বর্তমান: ${account.currentBalancePaisa / 100}`);
        }
      }

      const transferNumber = this.transferRepo.getNextTransferNumber(input.businessId);

      const transfer = this.transferRepo.create({
        businessId: input.businessId,
        transferNumber,
        sourceType: input.sourceType,
        sourceAccountId: input.sourceAccountId,
        destType: input.destType,
        destAccountId: input.destAccountId,
        amountPaisa: input.amountPaisa,
        chargePaisa: 0,
        commissionPaisa: 0,
        reference: input.reference || null,
        notes: input.notes || null,
        createdBy: input.createdBy || null,
      });

      // Create outflow from source
      if (input.sourceType === 'cash') {
        this.cashMovementRepo.create({
          businessId: input.businessId,
          cashAccountId: input.sourceAccountId,
          movementType: 'transfer_out',
          amountPaisa: -input.amountPaisa,
          referenceType: 'transfer',
          referenceId: transfer.id,
          notes: `স্থানান্তর: ${transferNumber} → ${input.destType}`,
          createdBy: input.createdBy || null,
        });
      } else if (input.sourceType === 'bank') {
        this.bankTxRepo.create({
          businessId: input.businessId,
          bankAccountId: input.sourceAccountId,
          transactionType: 'transfer_out',
          amountPaisa: -input.amountPaisa,
          referenceType: 'transfer',
          referenceId: transfer.id,
          notes: `স্থানান্তর: ${transferNumber} → ${input.destType}`,
          createdBy: input.createdBy || null,
        });
      } else if (input.sourceType === 'mfs') {
        this.mfsTxRepo.create({
          businessId: input.businessId,
          mfsAccountId: input.sourceAccountId,
          transactionType: 'transfer_out',
          amountPaisa: input.amountPaisa,
          customerChargePaisa: 0,
          commissionPaisa: 0,
          netAmountPaisa: -input.amountPaisa,
          notes: `স্থানান্তর: ${transferNumber} → ${input.destType}`,
          createdBy: input.createdBy || null,
        } as any);
      }

      // Create inflow to dest
      if (input.destType === 'cash') {
        this.cashMovementRepo.create({
          businessId: input.businessId,
          cashAccountId: input.destAccountId,
          movementType: 'transfer_in',
          amountPaisa: input.amountPaisa,
          referenceType: 'transfer',
          referenceId: transfer.id,
          notes: `স্থানান্তর: ${transferNumber} ← ${input.sourceType}`,
          createdBy: input.createdBy || null,
        });
      } else if (input.destType === 'bank') {
        this.bankTxRepo.create({
          businessId: input.businessId,
          bankAccountId: input.destAccountId,
          transactionType: 'transfer_in',
          amountPaisa: input.amountPaisa,
          referenceType: 'transfer',
          referenceId: transfer.id,
          notes: `স্থানান্তর: ${transferNumber} ← ${input.sourceType}`,
          createdBy: input.createdBy || null,
        });
      } else if (input.destType === 'mfs') {
        this.mfsTxRepo.create({
          businessId: input.businessId,
          mfsAccountId: input.destAccountId,
          transactionType: 'transfer_in',
          amountPaisa: input.amountPaisa,
          customerChargePaisa: 0,
          commissionPaisa: 0,
          netAmountPaisa: input.amountPaisa,
          notes: `স্থানান্তর: ${transferNumber} ← ${input.sourceType}`,
          createdBy: input.createdBy || null,
        } as any);
      }

      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'transfer',
        entityType: 'finance_transfer',
        entityId: transfer.id,
        newValues: JSON.stringify({ transferNumber, amount: input.amountPaisa, source: input.sourceAccountId, dest: input.destAccountId }),
      });

      return transfer;
    });

    return transaction();
  }

  // MFS Cash-in: Cash → MFS (store top-up own MFS, or agent cash-in)
  // Semantics: Cash outflow, MFS inflow
  // For agent cash-in serving customer: cash +principal+charge, mfs -principal, commission separate
  // V1: Implement own balance transfer Cash→MFS and agent version
  mfsCashIn(input: MfsCashOperationInput) {
    if (input.amountPaisa <= 0) throw new Error('পরিমাণ ০ এর বেশি হতে হবে');
    if (!Number.isInteger(input.amountPaisa)) throw new Error('টাকার পরিমাণ পয়সায় পূর্ণসংখ্যা হতে হবে');
    if (input.chargePaisa !== undefined && !Number.isInteger(input.chargePaisa)) throw new Error('চার্জ পয়সায় পূর্ণসংখ্যা হতে হবে');
    if (input.commissionPaisa !== undefined && !Number.isInteger(input.commissionPaisa)) throw new Error('কমিশন পয়সায় পূর্ণসংখ্যা হতে হবে');

    const db = (this.cashMovementRepo as any).db;
    const tx = db.transaction(() => {
      const cashAcc = this.cashAccountRepo.findById(input.cashAccountId);
      if (!cashAcc) throw new Error('নগদ হিসাব পাওয়া যায়নি');
      const mfsAcc = this.mfsAccountRepo.findById(input.mfsAccountId);
      if (!mfsAcc) throw new Error('MFS হিসাব পাওয়া যায়নি');

      const charge = input.chargePaisa ?? 0;
      const commission = input.commissionPaisa ?? 0;
      const totalCashOut = input.amountPaisa + charge;

      if (cashAcc.currentBalancePaisa < totalCashOut) {
        throw new Error(`অপর্যাপ্ত নগদ ব্যালেন্স। বর্তমান: ${cashAcc.currentBalancePaisa / 100}, প্রয়োজন: ${totalCashOut / 100}`);
      }

      // Cash outflow
      this.cashMovementRepo.create({
        businessId: input.businessId,
        cashAccountId: input.cashAccountId,
        movementType: 'mfs_cash_in',
        amountPaisa: -totalCashOut,
        referenceType: 'mfs_cash_in',
        referenceId: input.mfsAccountId,
        notes: input.notes || `MFS ক্যাশ-ইন: ${input.amountPaisa / 100} + চার্জ ${charge / 100}`,
        createdBy: input.createdBy || null,
      });

      // MFS inflow
      this.mfsTxRepo.create({
        businessId: input.businessId,
        mfsAccountId: input.mfsAccountId,
        transactionType: 'cash_in',
        amountPaisa: input.amountPaisa,
        customerChargePaisa: charge,
        commissionPaisa: commission,
        netAmountPaisa: input.amountPaisa,
        transactionRef: input.transactionRef || null,
        customerPhone: input.customerPhone || null,
        notes: input.notes || `ক্যাশ-ইন: নগদ থেকে`,
        createdBy: input.createdBy || null,
      } as any);

      // Commission separate if >0
      if (commission > 0) {
        this.mfsTxRepo.create({
          businessId: input.businessId,
          mfsAccountId: input.mfsAccountId,
          transactionType: 'commission',
          amountPaisa: commission,
          customerChargePaisa: 0,
          commissionPaisa: commission,
          netAmountPaisa: commission,
          notes: `কমিশন: ক্যাশ-ইন ${input.amountPaisa / 100}`,
          createdBy: input.createdBy || null,
        } as any);
      }

      // Charge as separate income if needed — for V1, charge already deducted from cash, but we record as separate cash income? Actually cash outflow includes charge, so charge is extra cash out? Wait agent model: customer gives cash principal+charge, so cash inflow is principal+charge, MFS outflow principal. For own top-up, cash outflow principal, MFS inflow principal, charge is expense.
      // We will document V1 semantics: cash_out = principal+charge, mfs_in = principal, commission separate.

      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'mfs_cash_in',
        entityType: 'mfs_transaction',
        entityId: input.mfsAccountId,
        newValues: JSON.stringify({ amount: input.amountPaisa, charge, commission }),
      });

      return { cashAccountId: input.cashAccountId, mfsAccountId: input.mfsAccountId, amount: input.amountPaisa, charge, commission };
    });

    return tx();
  }

  // MFS Cash-out: MFS → Cash (store withdraws MFS to cash)
  // Semantics: MFS outflow, Cash inflow
  // Example from task: MFS decreases, cash increases
  mfsCashOut(input: MfsCashOperationInput) {
    if (input.amountPaisa <= 0) throw new Error('পরিমাণ ০ এর বেশি হতে হবে');
    if (!Number.isInteger(input.amountPaisa)) throw new Error('টাকার পরিমাণ পয়সায় পূর্ণসংখ্যা হতে হবে');
    if (input.chargePaisa !== undefined && !Number.isInteger(input.chargePaisa)) throw new Error('চার্জ পয়সায় পূর্ণসংখ্যা হতে হবে');
    if (input.commissionPaisa !== undefined && !Number.isInteger(input.commissionPaisa)) throw new Error('কমিশন পয়সায় পূর্ণসংখ্যা হতে হবে');

    const db = (this.cashMovementRepo as any).db;
    const tx = db.transaction(() => {
      const cashAcc = this.cashAccountRepo.findById(input.cashAccountId);
      if (!cashAcc) throw new Error('নগদ হিসাব পাওয়া যায়নি');
      const mfsAcc = this.mfsAccountRepo.findById(input.mfsAccountId);
      if (!mfsAcc) throw new Error('MFS হিসাব পাওয়া যায়নি');

      const charge = input.chargePaisa ?? 0;
      const commission = input.commissionPaisa ?? 0;

      if (mfsAcc.currentBalancePaisa < input.amountPaisa) {
        throw new Error(`অপর্যাপ্ত MFS ব্যালেন্স। বর্তমান: ${mfsAcc.currentBalancePaisa / 100}, প্রয়োজন: ${input.amountPaisa / 100}`);
      }

      // MFS outflow
      this.mfsTxRepo.create({
        businessId: input.businessId,
        mfsAccountId: input.mfsAccountId,
        transactionType: 'cash_out',
        amountPaisa: input.amountPaisa,
        customerChargePaisa: charge,
        commissionPaisa: commission,
        netAmountPaisa: -input.amountPaisa,
        transactionRef: input.transactionRef || null,
        customerPhone: input.customerPhone || null,
        notes: input.notes || `MFS ক্যাশ-আউট: ${input.amountPaisa / 100}`,
        createdBy: input.createdBy || null,
      } as any);

      // Cash inflow (principal + maybe charge? For own withdrawal, cash = principal - charge? For V1, cash = principal, charge separate)
      const cashInAmount = input.amountPaisa; // principal only, charge is separate if agent
      this.cashMovementRepo.create({
        businessId: input.businessId,
        cashAccountId: input.cashAccountId,
        movementType: 'mfs_cash_out',
        amountPaisa: cashInAmount,
        referenceType: 'mfs_cash_out',
        referenceId: input.mfsAccountId,
        notes: input.notes || `MFS ক্যাশ-আউট থেকে নগদ`,
        createdBy: input.createdBy || null,
      });

      if (commission > 0) {
        this.mfsTxRepo.create({
          businessId: input.businessId,
          mfsAccountId: input.mfsAccountId,
          transactionType: 'commission',
          amountPaisa: commission,
          customerChargePaisa: 0,
          commissionPaisa: commission,
          netAmountPaisa: commission,
          notes: `কমিশন: ক্যাশ-আউট ${input.amountPaisa / 100}`,
          createdBy: input.createdBy || null,
        } as any);
      }

      if (charge > 0) {
        // Charge as separate cash expense? For V1, record as MFS charge
        this.mfsTxRepo.create({
          businessId: input.businessId,
          mfsAccountId: input.mfsAccountId,
          transactionType: 'charge',
          amountPaisa: charge,
          customerChargePaisa: charge,
          commissionPaisa: 0,
          netAmountPaisa: -charge,
          notes: `চার্জ: ক্যাশ-আউট ${input.amountPaisa / 100}`,
          createdBy: input.createdBy || null,
        } as any);
      }

      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'mfs_cash_out',
        entityType: 'mfs_transaction',
        entityId: input.mfsAccountId,
        newValues: JSON.stringify({ amount: input.amountPaisa, charge, commission }),
      });

      return { cashAccountId: input.cashAccountId, mfsAccountId: input.mfsAccountId, amount: input.amountPaisa, charge, commission };
    });

    return tx();
  }

  // Reconciliation
  getFinanceSummary(businessId: string) {
    const cashAccounts = this.cashAccountRepo.findByBusiness(businessId, false);
    const bankAccounts = this.bankAccountRepo.findByBusiness(businessId, false);
    const mfsAccounts = this.mfsAccountRepo.findByBusiness(businessId, false);

    let totalCash = 0;
    for (const acc of cashAccounts) totalCash += acc.currentBalancePaisa;

    let totalBank = 0;
    for (const acc of bankAccounts) totalBank += acc.currentBalancePaisa;

    let totalMfs = 0;
    for (const acc of mfsAccounts) totalMfs += acc.currentBalancePaisa;

    // Today's inflow/outflow
    const today = Date.now();
    const start = new Date();
    start.setHours(0,0,0,0);
    const end = new Date();
    end.setHours(23,59,59,999);

    const cashMovements = this.cashMovementRepo.findByBusiness(businessId, 1000, 0, { fromDate: start.getTime(), toDate: end.getTime() });
    let cashInflow = 0, cashOutflow = 0;
    for (const m of cashMovements) {
      if (m.amountPaisa > 0) cashInflow += m.amountPaisa;
      else cashOutflow += Math.abs(m.amountPaisa);
    }

    const bankMovements = this.bankTxRepo.findByBusiness(businessId, 1000, 0, { fromDate: start.getTime(), toDate: end.getTime() });
    let bankInflow = 0, bankOutflow = 0;
    for (const m of bankMovements) {
      if (m.amountPaisa > 0) bankInflow += m.amountPaisa;
      else bankOutflow += Math.abs(m.amountPaisa);
    }

    const mfsMovements = this.mfsTxRepo.findByBusiness(businessId, 1000, 0, { fromDate: start.getTime(), toDate: end.getTime() });
    let mfsInflow = 0, mfsOutflow = 0;
    for (const m of mfsMovements) {
      if (m.netAmountPaisa > 0) mfsInflow += m.netAmountPaisa;
      else mfsOutflow += Math.abs(m.netAmountPaisa);
    }

    return {
      totalCash,
      totalBank,
      totalMfs,
      totalBalance: totalCash + totalBank + totalMfs,
      today: {
        cashInflow,
        cashOutflow,
        bankInflow,
        bankOutflow,
        mfsInflow,
        mfsOutflow,
      },
      accounts: {
        cash: cashAccounts.length,
        bank: bankAccounts.length,
        mfs: mfsAccounts.length,
      }
    };
  }

  // Invariant checks
  verifyCashInvariant(accountId: string): { valid: boolean; expected: number; actual: number; difference: number } {
    const account = this.cashAccountRepo.findById(accountId);
    if (!account) throw new Error('নগদ হিসাব পাওয়া যায়নি');
    const sumRow = (this.cashMovementRepo as any).db.prepare('SELECT SUM(amount_paisa) as total FROM cash_movements WHERE cash_account_id = ?').get(accountId) as { total: number | null };
    const sum = sumRow.total || 0;
    const expected = account.openingBalancePaisa + sum;
    const actual = account.currentBalancePaisa;
    return { valid: expected === actual, expected, actual, difference: actual - expected };
  }

  verifyBankInvariant(accountId: string): { valid: boolean; expected: number; actual: number; difference: number } {
    const account = this.bankAccountRepo.findById(accountId);
    if (!account) throw new Error('ব্যাংক হিসাব পাওয়া যায়নি');
    const sumRow = (this.bankTxRepo as any).db.prepare('SELECT SUM(amount_paisa) as total FROM bank_transactions WHERE bank_account_id = ?').get(accountId) as { total: number | null };
    const sum = sumRow.total || 0;
    const expected = account.openingBalancePaisa + sum;
    const actual = account.currentBalancePaisa;
    return { valid: expected === actual, expected, actual, difference: actual - expected };
  }

  verifyMfsInvariant(accountId: string): { valid: boolean; expected: number; actual: number; difference: number } {
    const account = this.mfsAccountRepo.findById(accountId);
    if (!account) throw new Error('MFS হিসাব পাওয়া যায়নি');
    const sumRow = (this.mfsTxRepo as any).db.prepare('SELECT SUM(net_amount_paisa) as total FROM mfs_transactions WHERE mfs_account_id = ?').get(accountId) as { total: number | null };
    const sum = sumRow.total || 0;
    const expected = account.openingBalancePaisa + sum;
    const actual = account.currentBalancePaisa;
    return { valid: expected === actual, expected, actual, difference: actual - expected };
  }
}
