# Database Architecture — MERQO RetailOS

## 0. Principles

- **Engine:** SQLite 3 with WAL mode, `foreign_keys=ON`, `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`
- **Driver:** better-sqlite3 (synchronous, transaction-safe)
- **ORM:** Drizzle ORM with type-safe schema, migrations via drizzle-kit
- **IDs:** `TEXT PRIMARY KEY` using `nanoid` (21 chars) — not integer autoincrement (prevents guessing, easier offline, merge-ready). Exception: audit logs may use integer for ordering but still nanoid.
- **Timestamps:** `INTEGER` Unix ms (JS Date.now()) + `TEXT` ISO for readability. All stored UTC, display local.
- **Money:** `INTEGER` paisa (BDT * 100). Example: ৳ 125.50 → 12550. `BIGINT` in SQLite (actually INTEGER). Never FLOAT.
- **Quantity:** `INTEGER` base unit quantity * 1000 (milli-units) to handle fractions like 0.5 kg. Or `REAL` with care? Decision: store `quantity_milli INTEGER` (e.g., 1.5 kg → 1500). For unit conversion, always convert to base unit milli.
- **Soft Delete:** Most entities have `deleted_at INTEGER NULL` + `is_active BOOLEAN`. Financial records never hard-deleted, only voided via reversal.
- **Audit:** All tables have `created_at`, `updated_at`, `created_by_user_id`, `updated_at_by_user_id`
- **Migrations:** Versioned, immutable, tested.

---

## 1. Entity List & Detailed Design

### 1.1 Business & System

#### `businesses`
- **Purpose:** Single business per installation (V1 single-tenant, but table allows future multi)
- **PK:** `id TEXT`
- **Fields:** `name TEXT NOT NULL`, `trade_name TEXT`, `address TEXT`, `phone TEXT`, `email TEXT`, `bin TEXT`, `logo_path TEXT`, `currency TEXT DEFAULT 'BDT'`, `fiscal_year_start_month INTEGER DEFAULT 7` (July for BD), `created_at`, `updated_at`
- **Indexes:** `id`
- **Relationships:** 1 business has many settings, users, etc.
- **Deletion:** Never delete; only update.
- **Audit:** Yes

#### `business_settings`
- **Purpose:** Key-value settings per business
- **PK:** `id TEXT`
- **FK:** `business_id → businesses.id`
- **Fields:** `key TEXT NOT NULL` (e.g., `receipt_footer`, `low_stock_threshold`, `default_printer_id`, `barcode_prefix`), `value TEXT` (JSON), `value_type TEXT` (string, number, boolean, json)
- **Indexes:** `UNIQUE(business_id, key)`
- **Constraints:** key not empty
- **Deletion:** Hard delete allowed for custom keys
- **Audit:** Yes (log changes)

#### `system_settings`
- **Purpose:** App-level settings (not business)
- **PK:** `key TEXT`
- **Fields:** `value TEXT`, `updated_at`
- **Examples:** `last_backup_at`, `auto_backup_enabled`, `theme` (light only but future), `language` (bn)
- **Audit:** Yes

### 1.2 Users, Roles, Permissions

#### `users`
- **Purpose:** Owner + staff accounts
- **PK:** `id TEXT`
- **Fields:** `business_id TEXT FK`, `name TEXT NOT NULL`, `phone TEXT UNIQUE`, `email TEXT UNIQUE NULL`, `password_hash TEXT NOT NULL` (argon2id), `pin_hash TEXT NULL` (for quick POS login, 4-6 digit hashed), `is_owner BOOLEAN DEFAULT 0`, `is_active BOOLEAN DEFAULT 1`, `last_login_at INTEGER`, `avatar_path TEXT`, `created_at`, `updated_at`, `deleted_at`
- **Indexes:** `business_id`, `phone`, `email`
- **Constraints:** At least one owner always exists (enforced in service)
- **Deletion:** Soft delete; owner cannot be deleted if last owner
- **Audit:** Yes (user changes critical)

#### `roles`
- **Purpose:** Role definitions
- **PK:** `id TEXT`
- **Fields:** `business_id FK`, `name TEXT NOT NULL` (e.g., Owner, Manager, Cashier, Stock Keeper, Accountant), `name_bn TEXT`, `description TEXT`, `is_system BOOLEAN` (cannot delete system roles), `created_at`, `updated_at`
- **Indexes:** `business_id, name UNIQUE`
- **Deletion:** Soft delete; system roles cannot be deleted
- **Audit:** Yes

#### `permissions`
- **Purpose:** Granular permissions
- **PK:** `id TEXT` (e.g., `product:view`, `product:create`, `sale:void`)
- **Fields:** `name TEXT NOT NULL`, `name_bn TEXT`, `description TEXT`, `module TEXT` (product, sale, etc.), `created_at`
- **Indexes:** `module`
- **Seed:** Predefined list (see security.md)
- **Deletion:** Never delete (seed only)
- **Audit:** No

#### `role_permissions`
- **Purpose:** Many-to-many role ↔ permission
- **PK:** `id TEXT`
- **FK:** `role_id → roles.id`, `permission_id → permissions.id`
- **Fields:** `created_at`
- **Indexes:** `UNIQUE(role_id, permission_id)`
- **Deletion:** Hard delete
- **Audit:** Yes (permission changes)

#### `user_roles`
- **Purpose:** Many-to-many user ↔ role
- **PK:** `id TEXT`
- **FK:** `user_id → users.id`, `role_id → roles.id`
- **Fields:** `assigned_by_user_id TEXT`, `created_at`
- **Indexes:** `UNIQUE(user_id, role_id)`
- **Deletion:** Hard delete
- **Audit:** Yes

### 1.3 Products Domain

#### `categories`
- **Purpose:** Product categories
- **PK:** `id TEXT`
- **FK:** `business_id`, `parent_id → categories.id NULL` (for subcategories, but we also have subcategories table; choose one pattern — use parent_id for hierarchy)
- **Fields:** `name TEXT NOT NULL`, `name_bn TEXT`, `description TEXT`, `image_path TEXT`, `is_active BOOLEAN`, `sort_order INTEGER`, `created_at`, `updated_at`, `deleted_at`
- **Indexes:** `business_id`, `parent_id`, `name`
- **Deletion:** Soft delete; prevent if has active products (service check)
- **Audit:** Yes

*Decision: Use single categories table with self-reference parent_id instead of separate subcategories table for simplicity. But keep `subcategories` as view or same table where parent_id NOT NULL.*

#### `brands`
- **Purpose:** Product brands
- **PK:** `id TEXT`
- **Fields:** `business_id FK`, `name TEXT NOT NULL`, `name_bn TEXT`, `logo_path TEXT`, `is_active BOOLEAN`, `created_at`, `updated_at`, `deleted_at`
- **Indexes:** `business_id, name UNIQUE`
- **Deletion:** Soft delete
- **Audit:** Yes

#### `units`
- **Purpose:** Units of measure
- **PK:** `id TEXT`
- **Fields:** `business_id FK`, `name TEXT NOT NULL` (e.g., Piece, Kg, Carton), `short_name TEXT` (pcs, kg), `name_bn TEXT`, `is_base_unit BOOLEAN` (whether base for conversion group), `unit_group TEXT` (e.g., weight, piece, volume), `is_active BOOLEAN`, `created_at`, `updated_at`
- **Indexes:** `business_id, name UNIQUE`
- **Seed:** Piece, Kg, Gram, Liter, Ml, Carton, Box, Dozen, Meter, etc.
- **Deletion:** Soft delete; prevent if used in products
- **Audit:** Yes

#### `unit_conversions`
- **Purpose:** Conversion definitions
- **PK:** `id TEXT`
- **FK:** `business_id`, `from_unit_id → units.id`, `to_unit_id → units.id`
- **Fields:** `from_unit_id`, `to_unit_id`, `conversion_factor REAL NOT NULL` (how many to_unit per 1 from_unit; e.g., 1 carton = 24 pieces → factor 24), `is_base_conversion BOOLEAN`, `created_at`
- **Indexes:** `UNIQUE(from_unit_id, to_unit_id)`, `business_id`
- **Constraints:** factor >0, from != to
- **Example:** 1 Carton → 24 Piece, 1 Kg → 1000 Gram
- **Deletion:** Hard delete if not used; otherwise soft
- **Audit:** Yes

#### `products`
- **Purpose:** Core product
- **PK:** `id TEXT`
- **FK:** `business_id`, `category_id → categories.id NULL`, `brand_id → brands.id NULL`, `base_unit_id → units.id NOT NULL` (stock kept in base unit), `purchase_unit_id → units.id` (default purchase unit), `sale_unit_id → units.id` (default sale unit)
- **Fields:**
  - `name TEXT NOT NULL`, `name_bn TEXT`, `description TEXT`
  - `sku TEXT UNIQUE` (auto-generated if empty)
  - `barcode TEXT NULL` (primary barcode, but also product_barcodes table)
  - `base_unit_id` — e.g., Piece
  - `purchase_unit_id` — e.g., Carton
  - `sale_unit_id` — e.g., Piece
  - `cost_price_paisa INTEGER NOT NULL` (last purchase cost in base unit)
  - `selling_price_paisa INTEGER NOT NULL` (default)
  - `mrp_paisa INTEGER NULL`
  - `min_stock_milli INTEGER DEFAULT 0` (in base unit milli)
  - `reorder_level_milli INTEGER DEFAULT 0`
  - `opening_stock_milli INTEGER DEFAULT 0`
  - `is_stock_trackable BOOLEAN DEFAULT 1`
  - `is_sellable BOOLEAN DEFAULT 1`
  - `is_purchasable BOOLEAN DEFAULT 1`
  - `is_active BOOLEAN DEFAULT 1`
  - `image_path TEXT NULL`
  - `tax_rate REAL DEFAULT 0`
  - `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`
- **Indexes:** `business_id`, `category_id`, `brand_id`, `sku UNIQUE`, `barcode`, `name` (FTS), `is_active`
- **Constraints:** cost >=0, selling >=0
- **Deletion:** Soft delete; never hard delete if has stock movements
- **Audit:** Yes, especially price changes → product_cost_history

#### `product_variants` (Future-ready, but include now)
- **Purpose:** Variants like size/color for same product
- **PK:** `id TEXT`
- **FK:** `product_id → products.id`, `business_id`
- **Fields:** `name TEXT` (e.g., Red, XL), `sku TEXT UNIQUE`, `barcode TEXT`, `cost_price_paisa`, `selling_price_paisa`, `stock_milli` (derived but cached), `is_active`
- **Indexes:** `product_id`, `sku`, `barcode`
- **Deletion:** Soft delete
- **Audit:** Yes

#### `product_barcodes`
- **Purpose:** Multiple barcodes per product (different units, supplier barcodes)
- **PK:** `id TEXT`
- **FK:** `product_id → products.id`, `unit_id → units.id NULL` (which unit this barcode represents)
- **Fields:** `barcode TEXT NOT NULL`, `unit_id`, `quantity_milli INTEGER DEFAULT 1000` (how much base unit this barcode means; e.g., carton barcode = 24 pieces), `is_primary BOOLEAN DEFAULT 0`, `created_at`
- **Indexes:** `UNIQUE(barcode)`, `product_id`, `business_id` (via join)
- **Deletion:** Hard delete
- **Audit:** Yes

#### `product_images`
- **Purpose:** Multiple images per product
- **PK:** `id TEXT`
- **FK:** `product_id`
- **Fields:** `image_path TEXT NOT NULL`, `is_primary BOOLEAN`, `sort_order INTEGER`, `created_at`
- **Indexes:** `product_id`
- **Deletion:** Hard delete (file also deleted)
- **Audit:** No

#### `product_prices` (Price history per customer group future)
- **Purpose:** Different price tiers
- **PK:** `id TEXT`
- **FK:** `product_id`, `business_id`
- **Fields:** `price_type TEXT` (retail, wholesale, special), `unit_id`, `price_paisa INTEGER`, `min_qty_milli INTEGER`, `valid_from INTEGER`, `valid_to INTEGER`, `is_active`
- **Indexes:** `product_id, price_type`
- **Deletion:** Soft delete
- **Audit:** Yes

#### `product_cost_history`
- **Purpose:** Track cost changes for WAC and audit
- **PK:** `id TEXT`
- **FK:** `product_id`, `purchase_id NULL`, `created_by`
- **Fields:** `old_cost_paisa INTEGER`, `new_cost_paisa INTEGER`, `old_wac_paisa INTEGER`, `new_wac_paisa INTEGER`, `reason TEXT` (purchase, adjustment), `created_at`
- **Indexes:** `product_id, created_at DESC`
- **Deletion:** Never delete (immutable)
- **Audit:** Yes (itself is audit)

### 1.4 Inventory

#### `stock_levels` (Materialized view/cache, but also table for fast lookup)
- **Purpose:** Current stock per product (per location — V1 single location but schema ready)
- **PK:** `id TEXT`
- **FK:** `product_id → products.id`, `business_id`, `location_id TEXT DEFAULT 'main'`
- **Fields:** `product_id`, `quantity_milli INTEGER NOT NULL DEFAULT 0` (in base unit), `reserved_milli INTEGER DEFAULT 0`, `available_milli INTEGER GENERATED (quantity - reserved)`, `last_movement_at INTEGER`, `updated_at`
- **Indexes:** `UNIQUE(product_id, location_id)`, `quantity_milli` (for low stock)
- **Constraints:** quantity can be negative? Decision: Allow negative only if setting `allow_negative_stock` true, but log warning. Default disallow negative for sales.
- **Deletion:** Never delete; quantity 0 remains
- **Audit:** No (derived from movements, but log when adjusted)

#### `stock_movements` (Immutable ledger — core)
- **Purpose:** Every stock change
- **PK:** `id TEXT`
- **FK:** `product_id`, `business_id`, `reference_id TEXT` (sale_id, purchase_id, etc.), `created_by`
- **Fields:**
  - `product_id`
  - `movement_type TEXT` ENUM: `opening`, `purchase`, `sale`, `sale_return`, `purchase_return`, `adjustment`, `damage`, `loss`, `stock_count`, `transfer`, `production`
  - `quantity_milli INTEGER NOT NULL` (positive = in, negative = out, in base unit)
  - `unit_id` (unit of transaction, for reference)
  - `unit_quantity REAL` (original qty in transaction unit)
  - `cost_paisa INTEGER` (cost at time of movement, for valuation)
  - `reference_type TEXT` (sale, purchase, adjustment, etc.)
  - `reference_id TEXT`
  - `notes TEXT`
  - `location_id TEXT DEFAULT 'main'`
  - `created_at INTEGER NOT NULL`
  - `created_by_user_id`
- **Indexes:** `product_id, created_at DESC`, `reference_type, reference_id`, `movement_type`, `business_id, created_at`, `created_at`
- **Constraints:** quantity_milli !=0
- **Deletion:** Never delete — reversal via opposite movement
- **Audit:** Yes (immutable)

### 1.5 Suppliers & Purchasing

#### `suppliers`
- **Purpose:** Supplier master
- **PK:** `id TEXT`
- **FK:** `business_id`
- **Fields:** `name TEXT NOT NULL`, `phone TEXT`, `email TEXT`, `address TEXT`, `contact_person TEXT`, `opening_payable_paisa INTEGER DEFAULT 0`, `current_payable_paisa INTEGER DEFAULT 0` (cached, but derived from ledger), `is_active BOOLEAN`, `created_at`, `updated_at`, `deleted_at`
- **Indexes:** `business_id`, `name`, `phone`
- **Deletion:** Soft delete; prevent if has transactions unless zero balance
- **Audit:** Yes

#### `supplier_transactions` (Ledger)
- **Purpose:** Immutable supplier ledger entries
- **PK:** `id TEXT`
- **FK:** `supplier_id → suppliers.id`, `business_id`, `reference_id`, `created_by`
- **Fields:**
  - `supplier_id`
  - `transaction_type TEXT` ENUM: `opening`, `purchase`, `payment`, `purchase_return`, `adjustment`, `discount`
  - `amount_paisa INTEGER NOT NULL` (positive = increase payable, negative = decrease)
  - `reference_type TEXT` (purchase, payment, etc.)
  - `reference_id TEXT`
  - `notes TEXT`
  - `created_at`
- **Indexes:** `supplier_id, created_at DESC`, `reference_type, reference_id`, `business_id, created_at`
- **Deletion:** Never
- **Audit:** Yes

#### `purchases`
- **Purpose:** Purchase header
- **PK:** `id TEXT`
- **FK:** `supplier_id → suppliers.id`, `business_id`, `created_by`, `cash_session_id NULL`
- **Fields:**
  - `purchase_number TEXT UNIQUE` (e.g., PUR-00001)
  - `supplier_id`
  - `purchase_date INTEGER NOT NULL`
  - `status TEXT` ENUM: `draft`, `received`, `partial`, `cancelled`
  - `subtotal_paisa INTEGER NOT NULL`
  - `discount_paisa INTEGER DEFAULT 0`
  - `tax_paisa INTEGER DEFAULT 0`
  - `shipping_paisa INTEGER DEFAULT 0`
  - `total_paisa INTEGER NOT NULL`
  - `paid_paisa INTEGER DEFAULT 0`
  - `due_paisa INTEGER DEFAULT 0` (total - paid)
  - `notes TEXT`
  - `is_paid BOOLEAN DEFAULT 0`
  - `created_at`, `updated_at`
- **Indexes:** `business_id, purchase_date DESC`, `supplier_id`, `purchase_number`
- **Deletion:** Soft delete? Actually void via reversal. Never hard delete if received.
- **Audit:** Yes

#### `purchase_items`
- **Purpose:** Purchase line items
- **PK:** `id TEXT`
- **FK:** `purchase_id → purchases.id`, `product_id → products.id`, `unit_id → units.id`
- **Fields:**
  - `product_id`
  - `unit_id` (purchase unit)
  - `quantity_milli INTEGER NOT NULL` (in purchase unit milli)
  - `base_quantity_milli INTEGER NOT NULL` (converted to base unit milli)
  - `cost_per_unit_paisa INTEGER NOT NULL` (in purchase unit)
  - `base_cost_per_unit_paisa INTEGER NOT NULL` (per base unit)
  - `discount_paisa INTEGER DEFAULT 0`
  - `tax_paisa INTEGER DEFAULT 0`
  - `line_total_paisa INTEGER NOT NULL`
  - `created_at`
- **Indexes:** `purchase_id`, `product_id`
- **Deletion:** Hard delete only if purchase draft; otherwise reversal
- **Audit:** Yes

#### `purchase_payments`
- **Purpose:** Payments against purchases (can be multiple, split)
- **PK:** `id TEXT`
- **FK:** `purchase_id → purchases.id NULL` (null if advance payment), `supplier_id → suppliers.id`, `business_id`, `cash_account_id`, `bank_account_id`, `mfs_account_id`
- **Fields:**
  - `supplier_id`
  - `purchase_id NULL`
  - `payment_number TEXT UNIQUE`
  - `payment_date INTEGER`
  - `amount_paisa INTEGER NOT NULL`
  - `payment_method TEXT` ENUM: `cash`, `bank`, `mfs`, `cheque`, `card`
  - `cash_account_id NULL`
  - `bank_account_id NULL`
  - `mfs_account_id NULL`
  - `cheque_number TEXT NULL`
  - `card_last4 TEXT NULL`
  - `notes TEXT`
  - `created_by`
  - `created_at`
- **Indexes:** `supplier_id, payment_date DESC`, `purchase_id`, `business_id`
- **Deletion:** Never; void via reversal entry
- **Audit:** Yes

#### `purchase_returns` & `purchase_return_items`
- Similar to purchases but negative. Separate tables for clarity.
- **PK:** `id TEXT`
- **Fields:** `return_number`, `purchase_id FK`, `supplier_id FK`, `return_date`, `total_paisa`, `reason`, `status`, `created_at`
- **Items:** `product_id`, `quantity_milli`, `cost_paisa`, `line_total`
- **Indexes:** `purchase_id`, `supplier_id`
- **Deletion:** Never hard delete after processed
- **Audit:** Yes

### 1.6 Customers & Sales

#### `customers`
- **Purpose:** Customer master
- **PK:** `id TEXT`
- **FK:** `business_id`
- **Fields:** `name TEXT NOT NULL`, `phone TEXT`, `email TEXT`, `address TEXT`, `opening_due_paisa INTEGER DEFAULT 0`, `current_due_paisa INTEGER DEFAULT 0` (cached), `credit_limit_paisa INTEGER DEFAULT 0` (0 = no limit), `is_active BOOLEAN`, `created_at`, `updated_at`, `deleted_at`
- **Indexes:** `business_id`, `phone`, `name`, `current_due_paisa DESC`
- **Deletion:** Soft delete
- **Audit:** Yes

#### `customer_transactions` (Ledger)
- Same pattern as supplier_transactions
- **Fields:** `customer_id`, `transaction_type` ENUM: `opening`, `sale`, `payment`, `sale_return`, `adjustment`, `discount`, `amount_paisa` (positive = increase due, negative = decrease), `reference_type`, `reference_id`, `created_at`
- **Indexes:** `customer_id, created_at DESC`
- **Deletion:** Never
- **Audit:** Yes

#### `sales`
- **Purpose:** Sale header
- **PK:** `id TEXT`
- **FK:** `customer_id → customers.id NULL` (walk-in), `business_id`, `created_by`, `shift_id`, `cash_session_id`
- **Fields:**
  - `sale_number TEXT UNIQUE` (e.g., INV-00001)
  - `customer_id NULL`
  - `sale_date INTEGER NOT NULL`
  - `status TEXT` ENUM: `completed`, `held`, `voided`, `refunded`, `partial_return`
  - `subtotal_paisa INTEGER`
  - `discount_type TEXT` (fixed, percent)
  - `discount_value INTEGER` (paisa or percent *100)
  - `discount_paisa INTEGER`
  - `tax_paisa INTEGER DEFAULT 0`
  - `total_paisa INTEGER NOT NULL`
  - `paid_paisa INTEGER`
  - `due_paisa INTEGER`
  - `change_paisa INTEGER DEFAULT 0`
  - `notes TEXT`
  - `is_due BOOLEAN`
  - `created_at`, `updated_at`
- **Indexes:** `business_id, sale_date DESC`, `customer_id`, `sale_number`, `shift_id`, `status`
- **Deletion:** Never hard delete; void creates reversal stock + ledger entries
- **Audit:** Yes

#### `sale_items`
- **Purpose:** Sale lines
- **PK:** `id TEXT`
- **FK:** `sale_id → sales.id`, `product_id → products.id`, `unit_id → units.id`
- **Fields:**
  - `product_id`
  - `unit_id` (sale unit)
  - `quantity_milli INTEGER`
  - `base_quantity_milli INTEGER`
  - `unit_price_paisa INTEGER` (selling price per sale unit)
  - `base_unit_price_paisa INTEGER`
  - `cost_per_unit_paisa INTEGER` (WAC at time of sale, for COGS)
  - `discount_paisa INTEGER`
  - `line_total_paisa INTEGER`
  - `line_cost_total_paisa INTEGER` (for profit)
  - `created_at`
- **Indexes:** `sale_id`, `product_id`
- **Deletion:** Hard delete only if sale held/draft
- **Audit:** Yes

#### `sale_payments`
- **Purpose:** Split payments
- **PK:** `id TEXT`
- **FK:** `sale_id → sales.id`, `business_id`
- **Fields:**
  - `sale_id`
  - `payment_method TEXT` ENUM: `cash`, `bank`, `card`, `mfs`, `due`
  - `amount_paisa INTEGER NOT NULL`
  - `cash_account_id NULL`
  - `bank_account_id NULL`
  - `mfs_account_id NULL`
  - `mfs_provider_id NULL`
  - `card_type TEXT NULL`, `card_last4 TEXT NULL`
  - `cheque_number TEXT NULL`
  - `transaction_ref TEXT NULL`
  - `created_at`
- **Indexes:** `sale_id`, `payment_method`, `business_id, created_at`
- **Deletion:** Never after completed
- **Audit:** Yes

#### `sale_returns` & `sale_return_items`
- **Purpose:** Customer returns
- **PK:** `id TEXT`
- **FK:** `sale_id → sales.id`, `customer_id`, `business_id`
- **Fields:** `return_number UNIQUE`, `sale_id`, `return_date`, `total_paisa`, `refund_paisa`, `refund_method TEXT`, `reason TEXT`, `status TEXT`, `created_at`, `created_by`
- **Items:** `product_id`, `quantity_milli`, `unit_price_paisa`, `line_total_paisa`, `restock BOOLEAN DEFAULT 1`
- **Indexes:** `sale_id`, `customer_id`
- **Deletion:** Never hard delete after processed
- **Audit:** Yes

#### `discounts`
- **Purpose:** Discount definitions
- **PK:** `id TEXT`
- **FK:** `business_id`
- **Fields:** `name TEXT`, `type TEXT` (fixed, percent), `value INTEGER`, `is_active BOOLEAN`, `valid_from`, `valid_to`, `applicable_to TEXT` (all, category, product)
- **Indexes:** `business_id`
- **Deletion:** Soft delete
- **Audit:** Yes

### 1.7 Expenses

#### `expense_categories`
- **Purpose:** Expense categories
- **PK:** `id TEXT`
- **FK:** `business_id`
- **Fields:** `name TEXT NOT NULL` (Rent, Electricity, Internet, Salary, Transport, Maintenance, Marketing, Stationery, Miscellaneous), `name_bn TEXT`, `description TEXT`, `is_system BOOLEAN`, `is_active BOOLEAN`, `created_at`
- **Indexes:** `business_id, name UNIQUE`
- **Seed:** 9 default categories
- **Deletion:** Soft delete; prevent if has expenses
- **Audit:** Yes

#### `expenses`
- **Purpose:** Expense entries
- **PK:** `id TEXT`
- **FK:** `category_id → expense_categories.id`, `business_id`, `cash_account_id`, `bank_account_id`, `mfs_account_id`, `created_by`
- **Fields:**
  - `expense_number TEXT UNIQUE`
  - `category_id`
  - `amount_paisa INTEGER NOT NULL`
  - `expense_date INTEGER NOT NULL`
  - `payment_method TEXT` ENUM: `cash`, `bank`, `mfs`, `card`, `cheque`
  - `cash_account_id NULL`, `bank_account_id NULL`, `mfs_account_id NULL`
  - `reference TEXT NULL` (e.g., bill number)
  - `notes TEXT`
  - `attachment_path TEXT NULL`
  - `created_at`
- **Indexes:** `business_id, expense_date DESC`, `category_id`, `payment_method`
- **Deletion:** Soft delete? But financial — better void via reversal. Allow soft delete with audit.
- **Audit:** Yes

### 1.8 Cash, Bank, MFS, Shifts

#### `cash_accounts`
- **Purpose:** Cash drawers / accounts (main, counter1, etc.)
- **PK:** `id TEXT`
- **FK:** `business_id`
- **Fields:** `name TEXT NOT NULL` (Main Cash), `opening_balance_paisa INTEGER DEFAULT 0`, `current_balance_paisa INTEGER DEFAULT 0` (cached), `is_default BOOLEAN`, `is_active BOOLEAN`, `created_at`, `updated_at`
- **Indexes:** `business_id`
- **Deletion:** Soft delete; prevent if balance !=0
- **Audit:** Yes

#### `cash_movements` (Ledger)
- **Purpose:** Every cash in/out
- **PK:** `id TEXT`
- **FK:** `cash_account_id → cash_accounts.id`, `business_id`, `reference_id`, `created_by`
- **Fields:**
  - `cash_account_id`
  - `movement_type TEXT` ENUM: `opening`, `sale`, `purchase_payment`, `expense`, `customer_payment`, `supplier_payment`, `cash_in`, `cash_out`, `transfer`, `shift_open`, `shift_close`, `adjustment`
  - `amount_paisa INTEGER NOT NULL` (positive in, negative out)
  - `reference_type TEXT`
  - `reference_id TEXT`
  - `notes TEXT`
  - `created_at`
- **Indexes:** `cash_account_id, created_at DESC`, `reference_type, reference_id`
- **Deletion:** Never
- **Audit:** Yes

#### `bank_accounts`
- **Purpose:** Bank accounts
- **PK:** `id TEXT`
- **FK:** `business_id`
- **Fields:** `bank_name TEXT NOT NULL`, `account_name TEXT`, `account_number TEXT`, `branch TEXT`, `opening_balance_paisa INTEGER`, `current_balance_paisa INTEGER`, `is_active BOOLEAN`, `created_at`, `updated_at`
- **Indexes:** `business_id`
- **Deletion:** Soft delete
- **Audit:** Yes

#### `bank_transactions` (Ledger)
- Same pattern as cash_movements but for bank
- **Fields:** `bank_account_id`, `transaction_type` ENUM: `opening`, `deposit`, `withdraw`, `sale`, `purchase`, `expense`, `transfer`, `cheque`, `card_settlement`, `amount_paisa`, `reference_type`, `reference_id`, `cheque_number`, `created_at`
- **Indexes:** `bank_account_id, created_at DESC`
- **Deletion:** Never
- **Audit:** Yes

#### `mfs_providers`
- **Purpose:** bKash, Nagad, Rocket, Upay
- **PK:** `id TEXT`
- **Fields:** `name TEXT NOT NULL` (bKash), `name_bn TEXT`, `code TEXT UNIQUE` (bkash, nagad, rocket, upay), `is_active BOOLEAN`, `created_at`
- **Seed:** 4 providers
- **Deletion:** Never
- **Audit:** No

#### `mfs_accounts`
- **Purpose:** Agent accounts per provider
- **PK:** `id TEXT`
- **FK:** `business_id`, `provider_id → mfs_providers.id`
- **Fields:** `provider_id`, `account_number TEXT NOT NULL` (agent number), `account_name TEXT`, `opening_balance_paisa INTEGER`, `current_balance_paisa INTEGER`, `is_active BOOLEAN`, `is_agent BOOLEAN DEFAULT 1`, `commission_rate REAL DEFAULT 0`, `created_at`, `updated_at`
- **Indexes:** `business_id`, `provider_id`, `account_number`
- **Deletion:** Soft delete
- **Audit:** Yes

#### `mfs_transactions` (Ledger + Agent workflow)
- **Purpose:** MFS cash in/out, commission, etc.
- **PK:** `id TEXT`
- **FK:** `mfs_account_id → mfs_accounts.id`, `business_id`, `customer_id NULL`, `created_by`
- **Fields:**
  - `mfs_account_id`
  - `transaction_type TEXT` ENUM: `cash_in`, `cash_out`, `send_money`, `payment`, `commission`, `adjustment`, `opening`
  - `amount_paisa INTEGER NOT NULL` (transaction amount)
  - `customer_charge_paisa INTEGER DEFAULT 0` (extra charge to customer)
  - `commission_paisa INTEGER DEFAULT 0` (agent commission earned)
  - `net_amount_paisa INTEGER` (amount + charge - commission logic)
  - `balance_after_paisa INTEGER` (snapshot)
  - `transaction_ref TEXT NULL` (operator trxID)
  - `customer_phone TEXT NULL`
  - `operator TEXT NULL`
  - `notes TEXT`
  - `created_at`
- **Indexes:** `mfs_account_id, created_at DESC`, `transaction_type`, `business_id, created_at`
- **Deletion:** Never
- **Audit:** Yes

#### `shifts`
- **Purpose:** Cashier shifts
- **PK:** `id TEXT`
- **FK:** `business_id`, `opened_by_user_id → users.id`, `closed_by_user_id → users.id NULL`, `cash_account_id → cash_accounts.id`
- **Fields:**
  - `shift_number TEXT UNIQUE`
  - `cash_account_id`
  - `opened_by_user_id`
  - `closed_by_user_id NULL`
  - `opened_at INTEGER NOT NULL`
  - `closed_at INTEGER NULL`
  - `opening_cash_paisa INTEGER NOT NULL`
  - `expected_cash_paisa INTEGER NULL` (calculated at close)
  - `actual_cash_paisa INTEGER NULL` (counted)
  - `variance_paisa INTEGER NULL` (actual - expected)
  - `total_sales_paisa INTEGER DEFAULT 0`
  - `total_cash_sales_paisa INTEGER DEFAULT 0`
  - `total_expenses_paisa INTEGER DEFAULT 0`
  - `notes TEXT`
  - `status TEXT` ENUM: `open`, `closed`
  - `created_at`, `updated_at`
- **Indexes:** `business_id, opened_at DESC`, `cash_account_id`, `status`
- **Deletion:** Never hard delete
- **Audit:** Yes

#### `cash_sessions` (Optional, linked to shifts)
- **Purpose:** Detailed cash drawer sessions if multiple per shift
- **PK:** `id TEXT`
- **FK:** `shift_id → shifts.id`, `cash_account_id`, `business_id`
- **Fields:** `opened_at`, `closed_at`, `opening_paisa`, `closing_paisa`, `status`
- **Indexes:** `shift_id`
- **Deletion:** Never
- **Audit:** Yes

### 1.9 Other

#### `notifications`
- **Purpose:** In-app notifications
- **PK:** `id TEXT`
- **FK:** `business_id`, `user_id NULL` (null = all), `reference_id`
- **Fields:** `type TEXT` (low_stock, due_reminder, backup_reminder, shift_open), `title TEXT`, `title_bn TEXT`, `message TEXT`, `message_bn TEXT`, `is_read BOOLEAN DEFAULT 0`, `reference_type TEXT`, `reference_id TEXT`, `created_at`
- **Indexes:** `business_id, is_read, created_at DESC`, `user_id`
- **Deletion:** Hard delete after 90 days (configurable)
- **Audit:** No

#### `backups`
- **Purpose:** Backup history
- **PK:** `id TEXT`
- **FK:** `business_id`, `created_by`
- **Fields:** `file_path TEXT NOT NULL`, `file_size_bytes INTEGER`, `type TEXT` (manual, auto), `status TEXT` (success, failed), `checksum TEXT`, `created_at`, `notes TEXT`
- **Indexes:** `business_id, created_at DESC`
- **Deletion:** Hard delete (file also)
- **Audit:** Yes (backup/restore actions)

#### `audit_logs` (Immutable)
- **Purpose:** All critical actions
- **PK:** `id TEXT`
- **FK:** `business_id`, `user_id → users.id NULL` (system actions)
- **Fields:**
  - `user_id NULL`
  - `action TEXT` ENUM: `login`, `logout`, `create`, `update`, `delete`, `void`, `refund`, `adjustment`, `price_change`, `stock_adjustment`, `backup`, `restore`, `import`, `export`, `permission_change`
  - `entity_type TEXT` (product, sale, user, etc.)
  - `entity_id TEXT NULL`
  - `before_json TEXT NULL` (JSON snapshot)
  - `after_json TEXT NULL`
  - `description TEXT`
  - `description_bn TEXT`
  - `ip_address TEXT NULL`
  - `user_agent TEXT NULL`
  - `created_at INTEGER NOT NULL`
- **Indexes:** `business_id, created_at DESC`, `user_id`, `entity_type, entity_id`, `action`, `created_at`
- **Constraints:** No update/delete allowed (enforced via trigger or service)
- **Deletion:** Never (except retention policy >2 years maybe archive)
- **Audit:** Self

#### `held_sales` (Optional, for POS)
- **Purpose:** Parked sales
- **PK:** `id TEXT`
- **FK:** `business_id`, `created_by`, `customer_id NULL`
- **Fields:** `held_number TEXT`, `cart_json TEXT NOT NULL` (JSON of items, customer, discount), `notes TEXT`, `created_at`, `expires_at NULL`
- **Indexes:** `business_id, created_at DESC`, `created_by`
- **Deletion:** Hard delete after restore or expiry
- **Audit:** No

---

## 2. Additional Entities Needed (Beyond Minimum List)

- `payment_methods` (config table for enabled methods)
- `printers` (printer profiles)
- `import_jobs` (import history)
- `stock_counts` (stock counting sessions) + `stock_count_items`
- `price_rules` (future)
- `loyalty_points` (future-ready)
- `attachments` (generic file attachments)

### `printers`
- **PK:** `id TEXT`
- **FK:** `business_id`
- **Fields:** `name TEXT`, `type TEXT` (a4, 80mm, 58mm, pdf), `connection TEXT` (windows_spooler, usb, bluetooth, network), `system_name TEXT` (Windows printer name), `paper_width_mm INTEGER`, `is_default BOOLEAN`, `is_active BOOLEAN`, `settings_json TEXT` (margins, etc.), `created_at`
- **Indexes:** `business_id`
- **Deletion:** Soft delete
- **Audit:** Yes

### `stock_counts`
- **PK:** `id TEXT`
- **FK:** `business_id`, `created_by`
- **Fields:** `count_number UNIQUE`, `count_date INTEGER`, `status TEXT` (draft, in_progress, completed, cancelled), `notes TEXT`, `created_at`, `completed_at`
- **Indexes:** `business_id, count_date DESC`
- **Deletion:** Soft delete if draft
- **Audit:** Yes

### `stock_count_items`
- **PK:** `id TEXT`
- **FK:** `stock_count_id → stock_counts.id`, `product_id → products.id`
- **Fields:** `product_id`, `expected_milli INTEGER`, `counted_milli INTEGER`, `variance_milli INTEGER`, `cost_paisa INTEGER`, `notes TEXT`
- **Indexes:** `stock_count_id`, `product_id`
- **Deletion:** Hard delete if count draft
- **Audit:** Yes

---

## 3. Financial Data Integrity — Ledger Principles

### 3.1 Core Rule: Never Mutate Totals Directly

All balances are **derived** from ledger tables:

- Customer Due = SUM(customer_transactions.amount_paisa WHERE customer_id = X)
- Supplier Payable = SUM(supplier_transactions.amount_paisa)
- Cash Balance = SUM(cash_movements.amount_paisa WHERE cash_account_id = X) + opening
- Bank Balance = SUM(bank_transactions.amount_paisa)
- MFS Balance = SUM(mfs_transactions.net_amount_paisa) + opening
- Stock = SUM(stock_movements.quantity_milli WHERE product_id = X)

Cached columns (`current_due_paisa`, `current_balance_paisa`, `quantity_milli` in stock_levels) are **materialized for performance** but updated **only inside same transaction** that inserts ledger entry. If mismatch detected, recalc job can rebuild from ledger.

### 3.2 Transaction / Ledger for Each Domain

#### Customer Balance
- Opening due → `customer_transactions` type `opening` amount = opening_due (positive)
- Sale with due → type `sale` amount = due portion positive
- Payment → type `payment` amount = -payment (negative)
- Sale return → type `sale_return` amount = -return total (reduces due)
- Adjustment → type `adjustment` positive/negative

Current Due = SUM(amount)

#### Supplier Balance
- Same pattern, payable positive.

#### Cash/Bank/MFS
- Every movement inserts ledger row. Transfer between accounts = two rows (out from source, in to dest) in same transaction.
- Example: Cash sale 1000 BDT → `cash_movements` +100000 paisa reference sale_id + `sale_payments` row.
- Expense 200 BDT cash → `cash_movements` -20000 + `expenses` row.

#### Inventory
- Opening stock → `stock_movements` type `opening` quantity positive.
- Purchase → type `purchase` quantity positive, cost snapshot.
- Sale → type `sale` quantity negative.
- Sale return (restock) → type `sale_return` positive.
- Purchase return → type `purchase_return` negative.
- Adjustment/damage/loss → type `adjustment`/`damage`/`loss` negative or positive.

Stock level = SUM(quantity_milli)

#### COGS, Revenue, Expenses, Profit
- Revenue = SUM(sale_items.line_total_paisa WHERE sale.status=completed AND NOT voided)
- COGS = SUM(sale_items.line_cost_total_paisa) where cost_per_unit = WAC at time of sale
- Gross Profit = Revenue - COGS
- Operating Expenses = SUM(expenses.amount_paisa)
- Net Profit = Gross Profit - Operating Expenses

All calculated via queries, not stored totals (except cached for dashboard performance, refreshed nightly or on demand).

### 3.3 Reversal, Void, Refund, Adjustment Mechanisms

**Void Sale:**
1. Create new `stock_movements` opposite quantity (restock)
2. Create `customer_transactions` reversal if due was involved
3. Create `cash_movements` reversal if cash paid (negative)
4. Update original sale status to `voided`, set `voided_at`, `voided_by`, `void_reason`
5. Insert audit log
6. All in one transaction.

**Refund (Sale Return):**
- Similar but partial. Return items specify qty. If restock=true, stock movement positive. If refund cash, cash movement negative + sale return record. Customer due reduced if due sale.

**Purchase Return:**
- Stock movement negative (remove), supplier payable negative (reduce).

**Adjustment:**
- Stock adjustment requires reason, creates movement + audit. If cost changes, also product_cost_history.
- Financial adjustment (customer/supplier) → ledger entry type `adjustment` with notes + approval if permission requires.

**No direct UPDATE of historical totals.** Every reversal is new row.

### 3.4 Concurrency & SQLite

- Use `BEGIN IMMEDIATE` transactions (better-sqlite3 `db.transaction()` does).
- WAL mode allows concurrent readers, one writer.
- Busy timeout 5s.
- All financial operations wrapped in transaction function.

---

## 4. Inventory Engine Details (Supplement)

- **Base Unit:** Every product has base_unit_id. All stock in base unit milli.
- **Conversion Graph:** unit_conversions defines edges. Service builds graph and finds path. Example: 1 carton = 24 pieces, 1 piece = 1000 gram? No, different groups — prevent cross-group conversion.
- **Purchase Receiving:** User selects purchase unit (e.g., carton), enters qty 2 cartons, system converts to base 48 pieces via conversion factor, stores both.
- **Selling:** Similar.
- **Stock Valuation:** WAC * quantity_milli / 1000.
- **Min Stock / Reorder:** Check `stock_levels.quantity_milli <= products.min_stock_milli` triggers low_stock notification.
- **Product Deactivation:** `is_active=false` prevents new sales/purchases but keeps historical records.
- **Historical Records:** Products never hard-deleted if movements exist. Soft delete only.
- **Stock Count:** Create stock_counts session, enter counted qty per product, system calculates variance, creates adjustment movements for variance on completion.

---

## 5. Indexes & Performance

- All FKs indexed.
- All `created_at DESC` queries indexed.
- FTS: Use SQLite FTS5 virtual table `products_fts` for product search (name, sku, barcode) — triggers keep in sync.
- Covering indexes for dashboard: `sales(business_id, sale_date, status, total_paisa)` etc.
- Report queries use date range index.

---

## 6. Migration Strategy

- Drizzle-kit generates SQL migrations.
- Each migration file numbered `0001_initial.sql`, etc.
- On app startup, check `PRAGMA user_version`, run pending migrations inside transaction.
- Backup before migration automatically.
- If migration fails, restore backup, show error.

---

## 7. Data Retention & Archival (Future)

- Audit logs >2 years can be archived to file.
- Backups keep 7 auto + unlimited manual.
- Stock movements never archived (needed for valuation).

---

## 8. Security Notes (DB)

- DB file encrypted at rest? V1: not encrypted, but file permissions restricted. Future: SQLCipher optional.
- Password hashes argon2id.
- No secrets in DB plain text.
