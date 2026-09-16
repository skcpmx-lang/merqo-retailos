import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { businesses } from './business';

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  parentId: text('parent_id'),
  name: text('name').notNull(),
  nameBn: text('name_bn'),
  description: text('description'),
  imagePath: text('image_path'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
  deletedAt: integer('deleted_at'),
});

export const brands = sqliteTable('brands', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  name: text('name').notNull(),
  nameBn: text('name_bn'),
  logoPath: text('logo_path'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
  deletedAt: integer('deleted_at'),
});

export const units = sqliteTable('units', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  name: text('name').notNull(),
  shortName: text('short_name'),
  nameBn: text('name_bn'),
  isBaseUnit: integer('is_base_unit', { mode: 'boolean' }).notNull().default(false),
  unitGroup: text('unit_group').notNull().default('piece'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const unitConversions = sqliteTable('unit_conversions', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  fromUnitId: text('from_unit_id').notNull().references(() => units.id),
  toUnitId: text('to_unit_id').notNull().references(() => units.id),
  conversionFactor: real('conversion_factor').notNull(),
  isBaseConversion: integer('is_base_conversion', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  categoryId: text('category_id').references(() => categories.id),
  brandId: text('brand_id').references(() => brands.id),
  baseUnitId: text('base_unit_id').notNull().references(() => units.id),
  purchaseUnitId: text('purchase_unit_id').references(() => units.id),
  saleUnitId: text('sale_unit_id').references(() => units.id),
  name: text('name').notNull(),
  nameBn: text('name_bn'),
  description: text('description'),
  sku: text('sku').notNull(),
  barcode: text('barcode'),
  costPricePaisa: integer('cost_price_paisa').notNull().default(0),
  sellingPricePaisa: integer('selling_price_paisa').notNull().default(0),
  mrpPaisa: integer('mrp_paisa'),
  minStockMilli: integer('min_stock_milli').notNull().default(0),
  reorderLevelMilli: integer('reorder_level_milli').notNull().default(0),
  openingStockMilli: integer('opening_stock_milli').notNull().default(0),
  isStockTrackable: integer('is_stock_trackable', { mode: 'boolean' }).notNull().default(true),
  isSellable: integer('is_sellable', { mode: 'boolean' }).notNull().default(true),
  isPurchasable: integer('is_purchasable', { mode: 'boolean' }).notNull().default(true),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  imagePath: text('image_path'),
  taxRate: real('tax_rate').notNull().default(0),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
  deletedAt: integer('deleted_at'),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
});

export const productVariants = sqliteTable('product_variants', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  productId: text('product_id').notNull().references(() => products.id),
  name: text('name').notNull(),
  sku: text('sku').notNull(),
  barcode: text('barcode'),
  costPricePaisa: integer('cost_price_paisa').notNull().default(0),
  sellingPricePaisa: integer('selling_price_paisa').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
  deletedAt: integer('deleted_at'),
});

export const productBarcodes = sqliteTable('product_barcodes', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  unitId: text('unit_id').references(() => units.id),
  barcode: text('barcode').notNull(),
  quantityMilli: integer('quantity_milli').notNull().default(1000),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const productImages = sqliteTable('product_images', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  imagePath: text('image_path').notNull(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const productPrices = sqliteTable('product_prices', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  productId: text('product_id').notNull().references(() => products.id),
  priceType: text('price_type').notNull().default('retail'),
  unitId: text('unit_id').references(() => units.id),
  pricePaisa: integer('price_paisa').notNull(),
  minQtyMilli: integer('min_qty_milli').notNull().default(1000),
  validFrom: integer('valid_from'),
  validTo: integer('valid_to'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const productCostHistory = sqliteTable('product_cost_history', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  purchaseId: text('purchase_id'),
  oldCostPaisa: integer('old_cost_paisa').notNull(),
  newCostPaisa: integer('new_cost_paisa').notNull(),
  oldWacPaisa: integer('old_wac_paisa').notNull(),
  newWacPaisa: integer('new_wac_paisa').notNull(),
  reason: text('reason').notNull().default('purchase'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  createdBy: text('created_by'),
});
