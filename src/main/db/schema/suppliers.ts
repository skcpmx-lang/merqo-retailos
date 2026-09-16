import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { businesses } from './business';
import { products, units } from './products';

export const suppliers = sqliteTable('suppliers', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  contactPerson: text('contact_person'),
  openingPayablePaisa: integer('opening_payable_paisa').notNull().default(0),
  currentPayablePaisa: integer('current_payable_paisa').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
  deletedAt: integer('deleted_at'),
});

export const supplierTransactions = sqliteTable('supplier_transactions', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id),
  transactionType: text('transaction_type').notNull(),
  amountPaisa: integer('amount_paisa').notNull(),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  createdBy: text('created_by'),
});

export const purchases = sqliteTable('purchases', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id),
  purchaseNumber: text('purchase_number').notNull(),
  purchaseDate: integer('purchase_date').notNull().$defaultFn(() => Date.now()),
  status: text('status').notNull().default('received'),
  subtotalPaisa: integer('subtotal_paisa').notNull().default(0),
  discountPaisa: integer('discount_paisa').notNull().default(0),
  taxPaisa: integer('tax_paisa').notNull().default(0),
  shippingPaisa: integer('shipping_paisa').notNull().default(0),
  totalPaisa: integer('total_paisa').notNull().default(0),
  paidPaisa: integer('paid_paisa').notNull().default(0),
  duePaisa: integer('due_paisa').notNull().default(0),
  notes: text('notes'),
  isPaid: integer('is_paid', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
  createdBy: text('created_by'),
});

export const purchaseItems = sqliteTable('purchase_items', {
  id: text('id').primaryKey(),
  purchaseId: text('purchase_id').notNull().references(() => purchases.id),
  productId: text('product_id').notNull().references(() => products.id),
  unitId: text('unit_id').notNull().references(() => units.id),
  quantityMilli: integer('quantity_milli').notNull(),
  baseQuantityMilli: integer('base_quantity_milli').notNull(),
  costPerUnitPaisa: integer('cost_per_unit_paisa').notNull(),
  baseCostPerUnitPaisa: integer('base_cost_per_unit_paisa').notNull(),
  discountPaisa: integer('discount_paisa').notNull().default(0),
  taxPaisa: integer('tax_paisa').notNull().default(0),
  lineTotalPaisa: integer('line_total_paisa').notNull(),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const purchasePayments = sqliteTable('purchase_payments', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id),
  purchaseId: text('purchase_id').references(() => purchases.id),
  paymentNumber: text('payment_number').notNull(),
  paymentDate: integer('payment_date').notNull().$defaultFn(() => Date.now()),
  amountPaisa: integer('amount_paisa').notNull(),
  paymentMethod: text('payment_method').notNull().default('cash'),
  cashAccountId: text('cash_account_id'),
  bankAccountId: text('bank_account_id'),
  mfsAccountId: text('mfs_account_id'),
  chequeNumber: text('cheque_number'),
  cardLast4: text('card_last4'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  createdBy: text('created_by'),
});

export const purchaseReturns = sqliteTable('purchase_returns', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  purchaseId: text('purchase_id').references(() => purchases.id),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id),
  returnNumber: text('return_number').notNull(),
  returnDate: integer('return_date').notNull().$defaultFn(() => Date.now()),
  totalPaisa: integer('total_paisa').notNull().default(0),
  reason: text('reason'),
  status: text('status').notNull().default('completed'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  createdBy: text('created_by'),
});

export const purchaseReturnItems = sqliteTable('purchase_return_items', {
  id: text('id').primaryKey(),
  returnId: text('return_id').notNull().references(() => purchaseReturns.id),
  productId: text('product_id').notNull().references(() => products.id),
  quantityMilli: integer('quantity_milli').notNull(),
  costPaisa: integer('cost_paisa').notNull(),
  lineTotalPaisa: integer('line_total_paisa').notNull(),
});
