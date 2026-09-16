-- Phase 3B Sales & Customer Operations
-- Extends customers, sales, sale_returns for production sales domain

-- Customers: extended fields like suppliers
ALTER TABLE customers ADD COLUMN company_name TEXT;
ALTER TABLE customers ADD COLUMN alternate_phone TEXT;
ALTER TABLE customers ADD COLUMN contact_person TEXT;
ALTER TABLE customers ADD COLUMN notes TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_alternate_phone ON customers(alternate_phone);

-- Sales: add void/cancellation tracking + shipping + refund fields
ALTER TABLE sales ADD COLUMN voided_at INTEGER;
ALTER TABLE sales ADD COLUMN voided_by TEXT;
ALTER TABLE sales ADD COLUMN void_reason TEXT;
ALTER TABLE sales ADD COLUMN shipping_paisa INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN refund_paisa INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN refund_method TEXT;

-- Sales indexes
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_is_due ON sales(is_due);
CREATE INDEX IF NOT EXISTS idx_sales_customer_date ON sales(customer_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_due ON sales(due_paisa);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);

-- Sale items: add cost snapshot history safety + product snapshot already exists
-- Add base quantity for conversion tracking if not exists (check via IF NOT EXISTS workaround via pragma)
-- SQLite ALTER ADD COLUMN IF NOT EXISTS not supported, so use try-catch in migrator
-- We attempt to add base_quantity_milli column already exists in Phase2 schema, but ensure
-- Add tax_paisa for line tax if missing
ALTER TABLE sale_items ADD COLUMN tax_paisa INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sale_items ADD COLUMN shipping_paisa INTEGER NOT NULL DEFAULT 0;

-- Sale returns: extended fields
ALTER TABLE sale_returns ADD COLUMN base_quantity_milli INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sale_returns ADD COLUMN notes TEXT;

-- Sale return items: add base quantity and unit tracking
ALTER TABLE sale_return_items ADD COLUMN base_quantity_milli INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sale_return_items ADD COLUMN unit_id TEXT REFERENCES units(id);
ALTER TABLE sale_return_items ADD COLUMN cost_paisa INTEGER NOT NULL DEFAULT 0;

-- Customer transactions: indexes for statement
CREATE INDEX IF NOT EXISTS idx_customer_transactions_business_date ON customer_transactions(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_type ON customer_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_customer_type ON customer_transactions(customer_id, transaction_type);

-- Sale payments: add payment_number for uniqueness and reference
ALTER TABLE sale_payments ADD COLUMN payment_number TEXT;
ALTER TABLE sale_payments ADD COLUMN payment_date INTEGER;
ALTER TABLE sale_payments ADD COLUMN notes TEXT;
ALTER TABLE sale_payments ADD COLUMN created_by TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_payments_number ON sale_payments(payment_number);
CREATE INDEX IF NOT EXISTS idx_sale_payments_business_date ON sale_payments(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_payments_method ON sale_payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_sale_payments_customer ON sale_payments(business_id, sale_id);

-- Cash movements: ensure indexes for sales
CREATE INDEX IF NOT EXISTS idx_cash_movements_business_date ON cash_movements(business_id, created_at DESC);

-- Bank transactions indexes
CREATE INDEX IF NOT EXISTS idx_bank_transactions_business_date ON bank_transactions(business_id, created_at DESC);

-- MFS transactions indexes already exist

-- Sales: ensure unique constraint for sale_number already exists
-- Add composite index for date range + customer
CREATE INDEX IF NOT EXISTS idx_sales_business_customer_date ON sales(business_id, customer_id, sale_date DESC);
