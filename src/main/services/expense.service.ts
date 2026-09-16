/**
 * Expense Service — production
 * Expense -> financial movement -> audit, atomic
 * No deletion, only void/reversal
 */

import { ExpenseRepository, ExpenseCategoryRepository, CashMovementRepository, BankTransactionRepository, MfsTransactionRepository } from '../db/repositories/finance.repository';
import { AuditService } from './audit.service';

export interface CreateExpenseInput {
  businessId: string;
  categoryId: string;
  amountPaisa: number;
  expenseDate?: number;
  paymentMethod: string;
  cashAccountId?: string;
  bankAccountId?: string;
  mfsAccountId?: string;
  reference?: string;
  notes?: string;
  attachmentPath?: string;
  createdBy?: string;
}

export class ExpenseService {
  private expenseRepo: ExpenseRepository;
  private categoryRepo: ExpenseCategoryRepository;
  private cashMovementRepo: CashMovementRepository;
  private bankTxRepo: BankTransactionRepository;
  private mfsTxRepo: MfsTransactionRepository;
  private auditService: AuditService;

  constructor(db?: any) {
    this.expenseRepo = new ExpenseRepository(db);
    this.categoryRepo = new ExpenseCategoryRepository(db);
    this.cashMovementRepo = new CashMovementRepository(db);
    this.bankTxRepo = new BankTransactionRepository(db);
    this.mfsTxRepo = new MfsTransactionRepository(db);
    this.auditService = new AuditService(db);
  }

  create(input: CreateExpenseInput) {
    if (!input.categoryId) throw new Error('খরচের ক্যাটাগরি প্রয়োজন');
    if (input.amountPaisa <= 0) throw new Error('খরচের পরিমাণ ০ এর বেশি হতে হবে');
    if (!Number.isInteger(input.amountPaisa)) throw new Error('টাকার পরিমাণ পয়সায় পূর্ণসংখ্যা হতে হবে');

    const category = this.categoryRepo.findById(input.categoryId);
    if (!category) throw new Error('খরচের ক্যাটাগরি পাওয়া যায়নি');

    const method = input.paymentMethod.toLowerCase();
    if (method === 'cash' && !input.cashAccountId) throw new Error('নগদ হিসাব নির্বাচন করুন');
    if (method === 'bank' && !input.bankAccountId) throw new Error('ব্যাংক হিসাব নির্বাচন করুন');
    if (['bkash', 'nagad', 'rocket', 'upay', 'mfs'].includes(method) && !input.mfsAccountId) throw new Error('MFS হিসাব নির্বাচন করুন');

    const db = (this.expenseRepo as any).db;
    const tx = db.transaction(() => {
      const expenseNumber = this.expenseRepo.getNextExpenseNumber(input.businessId);

      const expense = this.expenseRepo.create({
        businessId: input.businessId,
        categoryId: input.categoryId,
        expenseNumber,
        amountPaisa: input.amountPaisa,
        expenseDate: input.expenseDate || Date.now(),
        paymentMethod: method,
        cashAccountId: input.cashAccountId || null,
        bankAccountId: input.bankAccountId || null,
        mfsAccountId: input.mfsAccountId || null,
        reference: input.reference || null,
        notes: input.notes || null,
        attachmentPath: input.attachmentPath || null,
        createdBy: input.createdBy || null,
      });

      // Financial movement — outflow
      if (method === 'cash' && input.cashAccountId) {
        this.cashMovementRepo.create({
          businessId: input.businessId,
          cashAccountId: input.cashAccountId,
          movementType: 'expense',
          amountPaisa: -input.amountPaisa,
          referenceType: 'expense',
          referenceId: expense.id,
          notes: `খরচ: ${category.name} - ${expenseNumber}`,
          createdBy: input.createdBy || null,
        });
      } else if (['bank', 'card', 'cheque'].includes(method) && input.bankAccountId) {
        this.bankTxRepo.create({
          businessId: input.businessId,
          bankAccountId: input.bankAccountId,
          transactionType: 'expense',
          amountPaisa: -input.amountPaisa,
          referenceType: 'expense',
          referenceId: expense.id,
          chequeNumber: method === 'cheque' ? input.reference || null : null,
          notes: `খরচ: ${category.name} - ${expenseNumber}`,
          createdBy: input.createdBy || null,
        });
      } else if (['bkash', 'nagad', 'rocket', 'upay', 'mfs'].includes(method) && input.mfsAccountId) {
        this.mfsTxRepo.create({
          businessId: input.businessId,
          mfsAccountId: input.mfsAccountId,
          transactionType: 'expense',
          amountPaisa: input.amountPaisa,
          customerChargePaisa: 0,
          commissionPaisa: 0,
          netAmountPaisa: -input.amountPaisa,
          notes: `খরচ: ${category.name} - ${expenseNumber}`,
          createdBy: input.createdBy || null,
        } as any);
      }

      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'create',
        entityType: 'expense',
        entityId: expense.id,
        newValues: JSON.stringify({ expenseNumber, amount: input.amountPaisa, category: category.name, method }),
      });

      return expense;
    });

    return tx();
  }

  list(businessId: string, limit = 50, offset = 0, filters?: any) {
    return this.expenseRepo.findByBusiness(businessId, limit, offset, filters);
  }

  get(id: string) {
    const exp = this.expenseRepo.findById(id);
    if (!exp) throw new Error('খরচ পাওয়া যায়নি');
    return exp;
  }

  void(id: string, reason: string, businessId: string, userId?: string) {
    if (!reason || reason.trim().length === 0) throw new Error('বাতিলের কারণ প্রয়োজন');
    const existing = this.expenseRepo.findById(id);
    if (!existing) throw new Error('খরচ পাওয়া যায়নি');
    if (existing.status === 'voided') throw new Error('খরচ ইতিমধ্যে বাতিল করা হয়েছে');

    const db = (this.expenseRepo as any).db;
    const tx = db.transaction(() => {
      // Reversal financial movement — inflow
      if (existing.paymentMethod === 'cash' && existing.cashAccountId) {
        this.cashMovementRepo.create({
          businessId: existing.businessId,
          cashAccountId: existing.cashAccountId,
          movementType: 'expense_void',
          amountPaisa: existing.amountPaisa, // positive reversal
          referenceType: 'expense_void',
          referenceId: existing.id,
          notes: `খরচ বাতিল: ${existing.expenseNumber} - ${reason}`,
          createdBy: userId || null,
        });
      } else if (['bank', 'card', 'cheque'].includes(existing.paymentMethod) && existing.bankAccountId) {
        this.bankTxRepo.create({
          businessId: existing.businessId,
          bankAccountId: existing.bankAccountId,
          transactionType: 'expense_void',
          amountPaisa: existing.amountPaisa,
          referenceType: 'expense_void',
          referenceId: existing.id,
          notes: `খরচ বাতিল: ${existing.expenseNumber} - ${reason}`,
          createdBy: userId || null,
        });
      } else if (['bkash', 'nagad', 'rocket', 'upay', 'mfs'].includes(existing.paymentMethod) && existing.mfsAccountId) {
        this.mfsTxRepo.create({
          businessId: existing.businessId,
          mfsAccountId: existing.mfsAccountId,
          transactionType: 'expense_void',
          amountPaisa: existing.amountPaisa,
          customerChargePaisa: 0,
          commissionPaisa: 0,
          netAmountPaisa: existing.amountPaisa,
          notes: `খরচ বাতিল: ${existing.expenseNumber} - ${reason}`,
          createdBy: userId || null,
        } as any);
      }

      this.expenseRepo.void(id, reason, userId);

      this.auditService.log({
        businessId,
        userId: userId || null,
        action: 'void',
        entityType: 'expense',
        entityId: id,
        newValues: JSON.stringify({ reason, expenseNumber: existing.expenseNumber }),
      });
    });

    return tx();
  }

  listCategories(businessId: string) {
    return this.categoryRepo.findByBusiness(businessId);
  }
}
