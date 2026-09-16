import { CustomerRepository, CustomerTransactionRepository } from '../db/repositories/customer.repository';
import { CashMovementRepository, BankTransactionRepository, MfsTransactionRepository, CashAccountRepository } from '../db/repositories/finance.repository';
import { CustomerValidationService } from '@core/domain/services/customer-validation.service';
import { FinancialLedgerService } from '@core/domain/services/financial-ledger.service';
import { AuditService } from './audit.service';

export interface CreateCustomerInput {
  businessId: string;
  name: string;
  companyName?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  notes?: string;
  openingDuePaisa?: number;
  creditLimitPaisa?: number;
  createdBy?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  companyName?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  notes?: string;
  creditLimitPaisa?: number;
  isActive?: boolean;
  updatedBy?: string;
}

export class CustomerService {
  private customerRepo: CustomerRepository;
  private customerTxRepo: CustomerTransactionRepository;
  private validationService = new CustomerValidationService();
  private ledgerService = new FinancialLedgerService();
  private auditService: AuditService;

  constructor(db?: any) {
    this.customerRepo = new CustomerRepository(db);
    this.customerTxRepo = new CustomerTransactionRepository(db);
    this.auditService = new AuditService(db);
  }

  create(input: CreateCustomerInput) {
    this.validationService.validate({
      businessId: input.businessId,
      name: input.name,
      phone: input.phone,
      alternatePhone: input.alternatePhone,
      email: input.email,
      openingDuePaisa: input.openingDuePaisa,
      creditLimitPaisa: input.creditLimitPaisa,
    });

    const db = (this.customerRepo as any).db;
    const transaction = db.transaction(() => {
      const customer = this.customerRepo.create({
        businessId: input.businessId,
        name: input.name,
        companyName: input.companyName || null,
        phone: input.phone || null,
        alternatePhone: input.alternatePhone || null,
        email: input.email || null,
        address: input.address || null,
        contactPerson: input.contactPerson || null,
        notes: input.notes || null,
        openingDuePaisa: input.openingDuePaisa ?? 0,
        currentDuePaisa: input.openingDuePaisa ?? 0,
        creditLimitPaisa: input.creditLimitPaisa ?? 0,
        isActive: true,
      } as any);

      if (customer.openingDuePaisa > 0) {
        const tx = this.ledgerService.buildCustomerTransaction(
          customer.businessId,
          customer.id,
          'opening_due',
          customer.openingDuePaisa,
          'opening',
          customer.id,
          'প্রারম্ভিক বকেয়া',
          input.createdBy
        );
        this.customerTxRepo.create(tx);
      }

      this.auditService.log({
        businessId: customer.businessId,
        userId: input.createdBy || null,
        action: 'create',
        entityType: 'customer',
        entityId: customer.id,
        newValues: JSON.stringify({ name: customer.name, phone: customer.phone, opening: customer.openingDuePaisa }),
      });

      return customer;
    });

    return transaction();
  }

  update(id: string, input: UpdateCustomerInput) {
    const existing = this.customerRepo.findById(id);
    if (!existing) throw new Error('গ্রাহক পাওয়া যায়নি');

    if (input.name !== undefined) {
      this.validationService.validate({
        businessId: existing.businessId,
        name: input.name,
        phone: input.phone ?? existing.phone ?? undefined,
        alternatePhone: input.alternatePhone ?? (existing as any).alternatePhone ?? undefined,
        email: input.email ?? existing.email ?? undefined,
        creditLimitPaisa: input.creditLimitPaisa ?? existing.creditLimitPaisa,
      });
    }

    const db = (this.customerRepo as any).db;
    const transaction = db.transaction(() => {
      const updated = this.customerRepo.update(id, {
        name: input.name ?? existing.name,
        companyName: input.companyName ?? (existing as any).companyName,
        phone: input.phone ?? existing.phone,
        alternatePhone: input.alternatePhone ?? (existing as any).alternatePhone,
        email: input.email ?? existing.email,
        address: input.address ?? existing.address,
        contactPerson: input.contactPerson ?? (existing as any).contactPerson,
        notes: input.notes ?? (existing as any).notes,
        creditLimitPaisa: input.creditLimitPaisa ?? existing.creditLimitPaisa,
        isActive: input.isActive ?? existing.isActive,
      } as any);

      this.auditService.log({
        businessId: existing.businessId,
        userId: input.updatedBy || null,
        action: 'update',
        entityType: 'customer',
        entityId: id,
        oldValues: JSON.stringify({ name: existing.name }),
        newValues: JSON.stringify({ name: updated!.name }),
      });

      return updated;
    });

    return transaction();
  }

  deactivate(id: string, userId?: string) {
    const existing = this.customerRepo.findById(id);
    if (!existing) throw new Error('গ্রাহক পাওয়া যায়নি');

    const currentDue = this.customerTxRepo.getCurrentDue(id);
    // Allow deactivation even with due, but log; business rule could prevent
    // For stricter: if (currentDue > 0) throw new Error('বকেয়া থাকা অবস্থায় নিষ্ক্রিয় করা যাবে না');

    this.customerRepo.deactivate(id);

    this.auditService.log({
      businessId: existing.businessId,
      userId: userId || null,
      action: 'deactivate',
      entityType: 'customer',
      entityId: id,
    });
  }

  activate(id: string, userId?: string) {
    const existing = this.customerRepo.findById(id);
    if (!existing) throw new Error('গ্রাহক পাওয়া যায়নি');

    this.customerRepo.activate(id);

    this.auditService.log({
      businessId: existing.businessId,
      userId: userId || null,
      action: 'activate',
      entityType: 'customer',
      entityId: id,
    });
  }

  delete(id: string, userId?: string) {
    const existing = this.customerRepo.findById(id);
    if (!existing) throw new Error('গ্রাহক পাওয়া যায়নি');

    if (this.customerRepo.hasTransactions(id) || this.customerRepo.hasSales(id)) {
      throw new Error('এই গ্রাহকের লেনদেন রয়েছে, মুছে ফেলা যাবে না। নিষ্ক্রিয় করুন।');
    }

    this.customerRepo.softDelete(id);

    this.auditService.log({
      businessId: existing.businessId,
      userId: userId || null,
      action: 'delete',
      entityType: 'customer',
      entityId: id,
    });
  }

  findById(id: string) {
    return this.customerRepo.findById(id);
  }

  findByBusiness(businessId: string) {
    return this.customerRepo.findByBusiness(businessId);
  }

  search(businessId: string, query: string, includeInactive = false) {
    return this.customerRepo.search(businessId, query, includeInactive);
  }

  getStatement(customerId: string, fromDate?: number, toDate?: number) {
    const customer = this.customerRepo.findById(customerId);
    if (!customer) throw new Error('গ্রাহক পাওয়া যায়নি');

    const transactions = this.customerTxRepo.getStatementWithRunningBalance(customerId, fromDate, toDate);
    const currentDue = this.customerTxRepo.getCurrentDue(customerId);

    let openingBalance = 0;
    if (fromDate) {
      const beforeRow = (this.customerTxRepo as any).db.prepare('SELECT SUM(amount_paisa) as total FROM customer_transactions WHERE customer_id = ? AND created_at < ?').get(customerId, fromDate) as { total: number | null };
      openingBalance = beforeRow.total || 0;
    }

    return {
      customer,
      openingBalance,
      transactions,
      currentDue,
    };
  }

  getTransactionHistory(customerId: string, limit = 100) {
    return this.customerTxRepo.findByCustomer(customerId, limit);
  }

  /**
   * Customer due collection / payment
   * Amount must be <= current due unless advance allowed
   */
  collectDue(input: {
    businessId: string;
    customerId: string;
    amountPaisa: number;
    method: string;
    cashAccountId?: string;
    bankAccountId?: string;
    mfsAccountId?: string;
    chequeNumber?: string;
    transactionRef?: string;
    notes?: string;
    createdBy?: string;
    allowAdvance?: boolean;
  }) {
    if (input.amountPaisa <= 0) throw new Error('পরিমাণ ০ এর বেশি হতে হবে');

    const customer = this.customerRepo.findById(input.customerId);
    if (!customer) throw new Error('গ্রাহক পাওয়া যায়নি');

    const currentDue = this.customerTxRepo.getCurrentDue(input.customerId);

    if (!input.allowAdvance && input.amountPaisa > currentDue) {
      throw new Error(`পরিশোধের পরিমাণ বকেয়ার চেয়ে বেশি হতে পারে না। বর্তমান বকেয়া: ${currentDue / 100}`);
    }

    const db = (this.customerRepo as any).db;
    const transaction = db.transaction(() => {
      // For sales payments we use sale_payments table, but for general collection we create customer transaction + cash movement
      const cashMovementRepo = new CashMovementRepository(db);
      const bankTxRepo = new BankTransactionRepository(db);
      const mfsTxRepo = new MfsTransactionRepository(db);

      // Create customer ledger payment
      const tx = this.ledgerService.buildCustomerTransaction(
        input.businessId,
        input.customerId,
        'payment',
        input.amountPaisa,
        'customer_payment',
        input.customerId,
        input.notes || `গ্রাহক পরিশোধ: ${input.method}`,
        input.createdBy
      );
      this.customerTxRepo.create(tx);

      const newDue = this.customerTxRepo.getCurrentDue(input.customerId);
      this.customerRepo.update(input.customerId, { currentDuePaisa: newDue } as any);

      // Financial movements
      if (input.method === 'cash' || input.method === 'Cash') {
        // Need cash account
        const cashAccountId = input.cashAccountId || this.getDefaultCashAccountId(db, input.businessId);
        if (cashAccountId) {
          cashMovementRepo.create({
            businessId: input.businessId,
            cashAccountId,
            movementType: 'customer_payment',
            amountPaisa: input.amountPaisa,
            referenceType: 'customer_payment',
            referenceId: input.customerId,
            notes: input.notes || `গ্রাহক পরিশোধ: ${customer.name}`,
            createdBy: input.createdBy,
          });
        }
      } else if (['bank', 'card', 'cheque'].includes(input.method)) {
        if (input.bankAccountId) {
          bankTxRepo.create({
            businessId: input.businessId,
            bankAccountId: input.bankAccountId,
            transactionType: 'customer_payment',
            amountPaisa: input.amountPaisa,
            referenceType: 'customer_payment',
            referenceId: input.customerId,
            chequeNumber: input.chequeNumber || null,
            notes: input.notes || `গ্রাহক পরিশোধ: ${customer.name}`,
            createdBy: input.createdBy,
          });
        }
      } else if (['bkash', 'nagad', 'rocket', 'upay', 'mfs'].includes(input.method)) {
        if (input.mfsAccountId) {
          mfsTxRepo.create({
            businessId: input.businessId,
            mfsAccountId: input.mfsAccountId,
            transactionType: 'customer_payment',
            amountPaisa: input.amountPaisa,
            netAmountPaisa: input.amountPaisa,
            transactionRef: input.transactionRef || null,
            notes: input.notes || `গ্রাহক পরিশোধ: ${customer.name}`,
            createdBy: input.createdBy,
            customerId: input.customerId,
          } as any);
        }
      }

      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'payment',
        entityType: 'customer',
        entityId: input.customerId,
        newValues: JSON.stringify({ amount: input.amountPaisa, method: input.method, due: newDue }),
      });

      return { newDue, transaction: tx };
    });

    return transaction();
  }

  private getDefaultCashAccountId(db: any, businessId: string): string | null {
    try {
      const row = db.prepare('SELECT id FROM cash_accounts WHERE business_id = ? AND is_active = 1 ORDER BY is_default DESC LIMIT 1').get(businessId) as { id: string } | undefined;
      return row?.id || null;
    } catch {
      return null;
    }
  }
}
