import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { businesses } from './business';

export const expenseCategories = sqliteTable('expense_categories', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  name: text('name').notNull(),
  nameBn: text('name_bn'),
  description: text('description'),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  categoryId: text('category_id').notNull().references(() => expenseCategories.id),
  expenseNumber: text('expense_number').notNull(),
  amountPaisa: integer('amount_paisa').notNull(),
  expenseDate: integer('expense_date').notNull().$defaultFn(() => Date.now()),
  paymentMethod: text('payment_method').notNull().default('cash'),
  cashAccountId: text('cash_account_id'),
  bankAccountId: text('bank_account_id'),
  mfsAccountId: text('mfs_account_id'),
  reference: text('reference'),
  notes: text('notes'),
  attachmentPath: text('attachment_path'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  createdBy: text('created_by'),
});

export const cashAccounts = sqliteTable('cash_accounts', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  name: text('name').notNull(),
  openingBalancePaisa: integer('opening_balance_paisa').notNull().default(0),
  currentBalancePaisa: integer('current_balance_paisa').notNull().default(0),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const cashMovements = sqliteTable('cash_movements', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  cashAccountId: text('cash_account_id').notNull().references(() => cashAccounts.id),
  movementType: text('movement_type').notNull(),
  amountPaisa: integer('amount_paisa').notNull(),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  createdBy: text('created_by'),
});

export const bankAccounts = sqliteTable('bank_accounts', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  bankName: text('bank_name').notNull(),
  accountName: text('account_name'),
  accountNumber: text('account_number'),
  branch: text('branch'),
  openingBalancePaisa: integer('opening_balance_paisa').notNull().default(0),
  currentBalancePaisa: integer('current_balance_paisa').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const bankTransactions = sqliteTable('bank_transactions', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  bankAccountId: text('bank_account_id').notNull().references(() => bankAccounts.id),
  transactionType: text('transaction_type').notNull(),
  amountPaisa: integer('amount_paisa').notNull(),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  chequeNumber: text('cheque_number'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  createdBy: text('created_by'),
});

export const mfsProviders = sqliteTable('mfs_providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameBn: text('name_bn'),
  code: text('code').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const mfsAccounts = sqliteTable('mfs_accounts', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  providerId: text('provider_id').notNull().references(() => mfsProviders.id),
  accountNumber: text('account_number').notNull(),
  accountName: text('account_name'),
  openingBalancePaisa: integer('opening_balance_paisa').notNull().default(0),
  currentBalancePaisa: integer('current_balance_paisa').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isAgent: integer('is_agent', { mode: 'boolean' }).notNull().default(true),
  commissionRate: real('commission_rate').notNull().default(0),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const mfsTransactions = sqliteTable('mfs_transactions', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  mfsAccountId: text('mfs_account_id').notNull().references(() => mfsAccounts.id),
  transactionType: text('transaction_type').notNull(),
  amountPaisa: integer('amount_paisa').notNull(),
  customerChargePaisa: integer('customer_charge_paisa').notNull().default(0),
  commissionPaisa: integer('commission_paisa').notNull().default(0),
  netAmountPaisa: integer('net_amount_paisa').notNull().default(0),
  balanceAfterPaisa: integer('balance_after_paisa'),
  transactionRef: text('transaction_ref'),
  customerPhone: text('customer_phone'),
  operator: text('operator'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  createdBy: text('created_by'),
  customerId: text('customer_id'),
});

export const shifts = sqliteTable('shifts', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  shiftNumber: text('shift_number').notNull(),
  cashAccountId: text('cash_account_id').notNull().references(() => cashAccounts.id),
  openedByUserId: text('opened_by_user_id').notNull(),
  closedByUserId: text('closed_by_user_id'),
  openedAt: integer('opened_at').notNull().$defaultFn(() => Date.now()),
  closedAt: integer('closed_at'),
  openingCashPaisa: integer('opening_cash_paisa').notNull(),
  expectedCashPaisa: integer('expected_cash_paisa'),
  actualCashPaisa: integer('actual_cash_paisa'),
  variancePaisa: integer('variance_paisa'),
  totalSalesPaisa: integer('total_sales_paisa').notNull().default(0),
  totalCashSalesPaisa: integer('total_cash_sales_paisa').notNull().default(0),
  totalExpensesPaisa: integer('total_expenses_paisa').notNull().default(0),
  notes: text('notes'),
  status: text('status').notNull().default('open'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const cashSessions = sqliteTable('cash_sessions', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  shiftId: text('shift_id').references(() => shifts.id),
  cashAccountId: text('cash_account_id').notNull().references(() => cashAccounts.id),
  openedAt: integer('opened_at').notNull().$defaultFn(() => Date.now()),
  closedAt: integer('closed_at'),
  openingPaisa: integer('opening_paisa').notNull(),
  closingPaisa: integer('closing_paisa'),
  status: text('status').notNull().default('open'),
});
