import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const businesses = sqliteTable('businesses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tradeName: text('trade_name'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  bin: text('bin'),
  logoPath: text('logo_path'),
  currency: text('currency').notNull().default('BDT'),
  fiscalYearStartMonth: integer('fiscal_year_start_month').notNull().default(7),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const businessSettings = sqliteTable('business_settings', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  key: text('key').notNull(),
  value: text('value'),
  valueType: text('value_type').notNull().default('string'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const systemSettings = sqliteTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});
