-- Phase 2 Full Schema — MERQO RetailOS
-- Adds products, inventory, suppliers, customers, finance, system tables
-- Integer paisa for money, milli for quantity, no FLOAT for financial

-- Categories (with parent_id for subcategories)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  parent_id TEXT,
  name TEXT NOT NULL,
  name_bn TEXT,
  description TEXT,
  image_path TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_categories_business_id ON categories(business_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- Brands
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  name_bn TEXT,
  logo_path TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_business_name ON brands(business_id, name);

-- Units
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  short_name TEXT,
  name_bn TEXT,
  is_base_unit INTEGER NOT NULL DEFAULT 0,
  unit_group TEXT NOT NULL DEFAULT 'piece',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_units_business_name ON units(business_id, name);

-- Unit Conversions
CREATE TABLE IF NOT EXISTS unit_conversions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  from_unit_id TEXT NOT NULL REFERENCES units(id),
  to_unit_id TEXT NOT NULL REFERENCES units(id),
  conversion_factor REAL NOT NULL,
  is_base_conversion INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(from_unit_id, to_unit_id)
);
CREATE INDEX IF NOT EXISTS idx_unit_conversions_business ON unit_conversions(business_id);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  category_id TEXT REFERENCES categories(id),
  brand_id TEXT REFERENCES brands(id),
  base_unit_id TEXT NOT NULL REFERENCES units(id),
  purchase_unit_id TEXT REFERENCES units(id),
  sale_unit_id TEXT REFERENCES units(id),
  name TEXT NOT NULL,
  name_bn TEXT,
  description TEXT,
  sku TEXT NOT NULL,
  barcode TEXT,
  cost_price_paisa INTEGER NOT NULL DEFAULT 0,
  selling_price_paisa INTEGER NOT NULL DEFAULT 0,
  mrp_paisa INTEGER,
  min_stock_milli INTEGER NOT NULL DEFAULT 0,
  reorder_level_milli INTEGER NOT NULL DEFAULT 0,
  opening_stock_milli INTEGER NOT NULL DEFAULT 0,
  is_stock_trackable INTEGER NOT NULL DEFAULT 1,
  is_sellable INTEGER NOT NULL DEFAULT 1,
  is_purchasable INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  image_path TEXT,
  tax_rate REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  created_by TEXT,
  updated_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  cost_price_paisa INTEGER NOT NULL DEFAULT 0,
  selling_price_paisa INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

-- Product Barcodes
CREATE TABLE IF NOT EXISTS product_barcodes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  unit_id TEXT REFERENCES units(id),
  barcode TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL DEFAULT 1000,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_barcodes_barcode ON product_barcodes(barcode);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product_id ON product_barcodes(product_id);

-- Product Images
CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  image_path TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

-- Product Prices
CREATE TABLE IF NOT EXISTS product_prices (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  price_type TEXT NOT NULL DEFAULT 'retail',
  unit_id TEXT REFERENCES units(id),
  price_paisa INTEGER NOT NULL,
  min_qty_milli INTEGER NOT NULL DEFAULT 1000,
  valid_from INTEGER,
  valid_to INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_prices_product_type ON product_prices(product_id, price_type);

-- Product Cost History (immutable)
CREATE TABLE IF NOT EXISTS product_cost_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  purchase_id TEXT,
  old_cost_paisa INTEGER NOT NULL,
  new_cost_paisa INTEGER NOT NULL,
  old_wac_paisa INTEGER NOT NULL,
  new_wac_paisa INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT 'purchase',
  created_at INTEGER NOT NULL,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_product_cost_history_product_created ON product_cost_history(product_id, created_at DESC);

-- Stock Levels (materialized cache)
CREATE TABLE IF NOT EXISTS stock_levels (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  location_id TEXT NOT NULL DEFAULT 'main',
  quantity_milli INTEGER NOT NULL DEFAULT 0,
  reserved_milli INTEGER NOT NULL DEFAULT 0,
  last_movement_at INTEGER,
  updated_at INTEGER NOT NULL,
  UNIQUE(product_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_levels_quantity ON stock_levels(quantity_milli);

-- Stock Movements (immutable ledger)
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL,
  unit_id TEXT REFERENCES units(id),
  unit_quantity INTEGER,
  cost_paisa INTEGER NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  location_id TEXT NOT NULL DEFAULT 'main',
  created_at INTEGER NOT NULL,
  created_by TEXT,
  CHECK(quantity_milli != 0)
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created ON stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_business_created ON stock_movements(business_id, created_at);

-- Stock Counts
CREATE TABLE IF NOT EXISTS stock_counts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  count_number TEXT NOT NULL,
  count_date INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  created_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_counts_number ON stock_counts(count_number);
CREATE INDEX IF NOT EXISTS idx_stock_counts_business_date ON stock_counts(business_id, count_date DESC);

-- Stock Count Items
CREATE TABLE IF NOT EXISTS stock_count_items (
  id TEXT PRIMARY KEY,
  stock_count_id TEXT NOT NULL REFERENCES stock_counts(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  expected_milli INTEGER NOT NULL DEFAULT 0,
  counted_milli INTEGER NOT NULL DEFAULT 0,
  variance_milli INTEGER NOT NULL DEFAULT 0,
  cost_paisa INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_count_id ON stock_count_items(stock_count_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_product_id ON stock_count_items(product_id);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  contact_person TEXT,
  opening_payable_paisa INTEGER NOT NULL DEFAULT 0,
  current_payable_paisa INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON suppliers(business_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- Supplier Transactions (ledger)
CREATE TABLE IF NOT EXISTS supplier_transactions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  transaction_type TEXT NOT NULL,
  amount_paisa INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier_created ON supplier_transactions(supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_reference ON supplier_transactions(reference_type, reference_id);

-- Purchases
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  purchase_number TEXT NOT NULL,
  purchase_date INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  subtotal_paisa INTEGER NOT NULL DEFAULT 0,
  discount_paisa INTEGER NOT NULL DEFAULT 0,
  tax_paisa INTEGER NOT NULL DEFAULT 0,
  shipping_paisa INTEGER NOT NULL DEFAULT 0,
  total_paisa INTEGER NOT NULL DEFAULT 0,
  paid_paisa INTEGER NOT NULL DEFAULT 0,
  due_paisa INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_paid INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_number ON purchases(purchase_number);
CREATE INDEX IF NOT EXISTS idx_purchases_business_date ON purchases(business_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);

-- Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  quantity_milli INTEGER NOT NULL,
  base_quantity_milli INTEGER NOT NULL,
  cost_per_unit_paisa INTEGER NOT NULL,
  base_cost_per_unit_paisa INTEGER NOT NULL,
  discount_paisa INTEGER NOT NULL DEFAULT 0,
  tax_paisa INTEGER NOT NULL DEFAULT 0,
  line_total_paisa INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON purchase_items(product_id);

-- Purchase Payments
CREATE TABLE IF NOT EXISTS purchase_payments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  purchase_id TEXT REFERENCES purchases(id),
  payment_number TEXT NOT NULL,
  payment_date INTEGER NOT NULL,
  amount_paisa INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  cash_account_id TEXT,
  bank_account_id TEXT,
  mfs_account_id TEXT,
  cheque_number TEXT,
  card_last4 TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_payments_number ON purchase_payments(payment_number);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_supplier_date ON purchase_payments(supplier_id, payment_date DESC);

-- Purchase Returns
CREATE TABLE IF NOT EXISTS purchase_returns (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  purchase_id TEXT REFERENCES purchases(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  return_number TEXT NOT NULL,
  return_date INTEGER NOT NULL,
  total_paisa INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at INTEGER NOT NULL,
  created_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_returns_number ON purchase_returns(return_number);

-- Purchase Return Items
CREATE TABLE IF NOT EXISTS purchase_return_items (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL REFERENCES purchase_returns(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity_milli INTEGER NOT NULL,
  cost_paisa INTEGER NOT NULL,
  line_total_paisa INTEGER NOT NULL
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  opening_due_paisa INTEGER NOT NULL DEFAULT 0,
  current_due_paisa INTEGER NOT NULL DEFAULT 0,
  credit_limit_paisa INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_due ON customers(current_due_paisa DESC);

-- Customer Transactions (ledger)
CREATE TABLE IF NOT EXISTS customer_transactions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  transaction_type TEXT NOT NULL,
  amount_paisa INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_customer_created ON customer_transactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_reference ON customer_transactions(reference_type, reference_id);

-- Sales (header) - minimal for Phase 2 ledger foundation
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  customer_id TEXT REFERENCES customers(id),
  sale_number TEXT NOT NULL,
  sale_date INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  subtotal_paisa INTEGER NOT NULL DEFAULT 0,
  discount_type TEXT,
  discount_value INTEGER NOT NULL DEFAULT 0,
  discount_paisa INTEGER NOT NULL DEFAULT 0,
  tax_paisa INTEGER NOT NULL DEFAULT 0,
  total_paisa INTEGER NOT NULL DEFAULT 0,
  paid_paisa INTEGER NOT NULL DEFAULT 0,
  due_paisa INTEGER NOT NULL DEFAULT 0,
  change_paisa INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_due INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  shift_id TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_number ON sales(sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_business_date ON sales(business_id, sale_date DESC);

-- Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  quantity_milli INTEGER NOT NULL,
  base_quantity_milli INTEGER NOT NULL,
  unit_price_paisa INTEGER NOT NULL,
  base_unit_price_paisa INTEGER NOT NULL,
  cost_per_unit_paisa INTEGER NOT NULL DEFAULT 0,
  discount_paisa INTEGER NOT NULL DEFAULT 0,
  line_total_paisa INTEGER NOT NULL,
  line_cost_total_paisa INTEGER NOT NULL DEFAULT 0,
  product_name_snapshot TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

-- Sale Payments
CREATE TABLE IF NOT EXISTS sale_payments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  sale_id TEXT NOT NULL REFERENCES sales(id),
  payment_method TEXT NOT NULL,
  amount_paisa INTEGER NOT NULL,
  cash_account_id TEXT,
  bank_account_id TEXT,
  mfs_account_id TEXT,
  mfs_provider_id TEXT,
  card_type TEXT,
  card_last4 TEXT,
  cheque_number TEXT,
  transaction_ref TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id);

-- Sale Returns
CREATE TABLE IF NOT EXISTS sale_returns (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  sale_id TEXT NOT NULL REFERENCES sales(id),
  customer_id TEXT REFERENCES customers(id),
  return_number TEXT NOT NULL,
  return_date INTEGER NOT NULL,
  total_paisa INTEGER NOT NULL DEFAULT 0,
  refund_paisa INTEGER NOT NULL DEFAULT 0,
  refund_method TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at INTEGER NOT NULL,
  created_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_returns_number ON sale_returns(return_number);

-- Sale Return Items
CREATE TABLE IF NOT EXISTS sale_return_items (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL REFERENCES sale_returns(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity_milli INTEGER NOT NULL,
  unit_price_paisa INTEGER NOT NULL,
  line_total_paisa INTEGER NOT NULL,
  restock INTEGER NOT NULL DEFAULT 1
);

-- Discounts
CREATE TABLE IF NOT EXISTS discounts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'fixed',
  value INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  valid_from INTEGER,
  valid_to INTEGER,
  applicable_to TEXT NOT NULL DEFAULT 'all',
  created_at INTEGER NOT NULL
);

-- Held Sales
CREATE TABLE IF NOT EXISTS held_sales (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  held_number TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  cart_json TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  created_by TEXT
);

-- Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  name_bn TEXT,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_categories_business_name ON expense_categories(business_id, name);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  category_id TEXT NOT NULL REFERENCES expense_categories(id),
  expense_number TEXT NOT NULL,
  amount_paisa INTEGER NOT NULL,
  expense_date INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  cash_account_id TEXT,
  bank_account_id TEXT,
  mfs_account_id TEXT,
  reference TEXT,
  notes TEXT,
  attachment_path TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_number ON expenses(expense_number);
CREATE INDEX IF NOT EXISTS idx_expenses_business_date ON expenses(business_id, expense_date DESC);

-- Cash Accounts
CREATE TABLE IF NOT EXISTS cash_accounts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  opening_balance_paisa INTEGER NOT NULL DEFAULT 0,
  current_balance_paisa INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cash_accounts_business_id ON cash_accounts(business_id);

-- Cash Movements (ledger)
CREATE TABLE IF NOT EXISTS cash_movements (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  cash_account_id TEXT NOT NULL REFERENCES cash_accounts(id),
  movement_type TEXT NOT NULL,
  amount_paisa INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_cash_movements_account_created ON cash_movements(cash_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_movements_reference ON cash_movements(reference_type, reference_id);

-- Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  bank_name TEXT NOT NULL,
  account_name TEXT,
  account_number TEXT,
  branch TEXT,
  opening_balance_paisa INTEGER NOT NULL DEFAULT 0,
  current_balance_paisa INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Bank Transactions (ledger)
CREATE TABLE IF NOT EXISTS bank_transactions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
  transaction_type TEXT NOT NULL,
  amount_paisa INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  cheque_number TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account_created ON bank_transactions(bank_account_id, created_at DESC);

-- MFS Providers
CREATE TABLE IF NOT EXISTS mfs_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_bn TEXT,
  code TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mfs_providers_code ON mfs_providers(code);

-- MFS Accounts
CREATE TABLE IF NOT EXISTS mfs_accounts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  provider_id TEXT NOT NULL REFERENCES mfs_providers(id),
  account_number TEXT NOT NULL,
  account_name TEXT,
  opening_balance_paisa INTEGER NOT NULL DEFAULT 0,
  current_balance_paisa INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_agent INTEGER NOT NULL DEFAULT 1,
  commission_rate REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mfs_accounts_business_id ON mfs_accounts(business_id);

-- MFS Transactions (ledger + agent workflow)
CREATE TABLE IF NOT EXISTS mfs_transactions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  mfs_account_id TEXT NOT NULL REFERENCES mfs_accounts(id),
  transaction_type TEXT NOT NULL,
  amount_paisa INTEGER NOT NULL,
  customer_charge_paisa INTEGER NOT NULL DEFAULT 0,
  commission_paisa INTEGER NOT NULL DEFAULT 0,
  net_amount_paisa INTEGER NOT NULL DEFAULT 0,
  balance_after_paisa INTEGER,
  transaction_ref TEXT,
  customer_phone TEXT,
  operator TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT,
  customer_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_mfs_transactions_account_created ON mfs_transactions(mfs_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mfs_transactions_business_created ON mfs_transactions(business_id, created_at);

-- Shifts
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  shift_number TEXT NOT NULL,
  cash_account_id TEXT NOT NULL REFERENCES cash_accounts(id),
  opened_by_user_id TEXT NOT NULL,
  closed_by_user_id TEXT,
  opened_at INTEGER NOT NULL,
  closed_at INTEGER,
  opening_cash_paisa INTEGER NOT NULL,
  expected_cash_paisa INTEGER,
  actual_cash_paisa INTEGER,
  variance_paisa INTEGER,
  total_sales_paisa INTEGER NOT NULL DEFAULT 0,
  total_cash_sales_paisa INTEGER NOT NULL DEFAULT 0,
  total_expenses_paisa INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_number ON shifts(shift_number);
CREATE INDEX IF NOT EXISTS idx_shifts_business_opened ON shifts(business_id, opened_at DESC);

-- Cash Sessions
CREATE TABLE IF NOT EXISTS cash_sessions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  shift_id TEXT REFERENCES shifts(id),
  cash_account_id TEXT NOT NULL REFERENCES cash_accounts(id),
  opened_at INTEGER NOT NULL,
  closed_at INTEGER,
  opening_paisa INTEGER NOT NULL,
  closing_paisa INTEGER,
  status TEXT NOT NULL DEFAULT 'open'
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  user_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  title_bn TEXT,
  message TEXT,
  message_bn TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_business_read_created ON notifications(business_id, is_read, created_at DESC);

-- Backups
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  business_id TEXT REFERENCES businesses(id),
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'success',
  checksum TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_backups_business_created ON backups(business_id, created_at DESC);

-- Printers
CREATE TABLE IF NOT EXISTS printers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  connection TEXT NOT NULL,
  system_name TEXT,
  paper_width_mm INTEGER,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  settings_json TEXT,
  created_at INTEGER NOT NULL
);

-- Import Jobs
CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_json TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT
);

-- Products FTS5 for fast search
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  name,
  name_bn,
  sku,
  barcode,
  content='products',
  content_rowid='rowid'
);

-- Triggers for FTS sync
CREATE TRIGGER IF NOT EXISTS products_fts_insert AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, name, name_bn, sku, barcode) VALUES (new.rowid, new.name, new.name_bn, new.sku, new.barcode);
END;

CREATE TRIGGER IF NOT EXISTS products_fts_delete AFTER DELETE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, name_bn, sku, barcode) VALUES('delete', old.rowid, old.name, old.name_bn, old.sku, old.barcode);
END;

CREATE TRIGGER IF NOT EXISTS products_fts_update AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, name_bn, sku, barcode) VALUES('delete', old.rowid, old.name, old.name_bn, old.sku, old.barcode);
  INSERT INTO products_fts(rowid, name, name_bn, sku, barcode) VALUES (new.rowid, new.name, new.name_bn, new.sku, new.barcode);
END;
