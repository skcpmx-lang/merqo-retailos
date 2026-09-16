import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { businesses } from './business';
import { products } from './products';
import { units } from './products';

export const stockLevels = sqliteTable('stock_levels', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  productId: text('product_id').notNull().references(() => products.id),
  locationId: text('location_id').notNull().default('main'),
  quantityMilli: integer('quantity_milli').notNull().default(0),
  reservedMilli: integer('reserved_milli').notNull().default(0),
  lastMovementAt: integer('last_movement_at'),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const stockMovements = sqliteTable('stock_movements', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  productId: text('product_id').notNull().references(() => products.id),
  movementType: text('movement_type').notNull(),
  quantityMilli: integer('quantity_milli').notNull(),
  unitId: text('unit_id').references(() => units.id),
  unitQuantity: integer('unit_quantity'),
  costPaisa: integer('cost_paisa').notNull().default(0),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  notes: text('notes'),
  locationId: text('location_id').notNull().default('main'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  createdBy: text('created_by'),
});

export const stockCounts = sqliteTable('stock_counts', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  countNumber: text('count_number').notNull(),
  countDate: integer('count_date').notNull().$defaultFn(() => Date.now()),
  status: text('status').notNull().default('draft'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  completedAt: integer('completed_at'),
  createdBy: text('created_by'),
});

export const stockCountItems = sqliteTable('stock_count_items', {
  id: text('id').primaryKey(),
  stockCountId: text('stock_count_id').notNull().references(() => stockCounts.id),
  productId: text('product_id').notNull().references(() => products.id),
  expectedMilli: integer('expected_milli').notNull().default(0),
  countedMilli: integer('counted_milli').notNull().default(0),
  varianceMilli: integer('variance_milli').notNull().default(0),
  costPaisa: integer('cost_paisa').notNull().default(0),
  notes: text('notes'),
});
