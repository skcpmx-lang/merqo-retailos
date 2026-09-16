-- Phase 3A Purchasing & Supplier Operations
-- Adds supplier extended fields, purchase status improvements, indexes

-- Supplier extended fields
ALTER TABLE suppliers ADD COLUMN company_name TEXT;
ALTER TABLE suppliers ADD COLUMN alternate_phone TEXT;
ALTER TABLE suppliers ADD COLUMN notes TEXT;

-- Ensure suppliers indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_company_name ON suppliers(company_name);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);

-- Purchases: add columns for better tracking if not exists
-- status already exists, but ensure indexes and add cancelled/void support
-- Add voided fields for cancellation
ALTER TABLE purchases ADD COLUMN voided_at INTEGER;
ALTER TABLE purchases ADD COLUMN voided_by TEXT;
ALTER TABLE purchases ADD COLUMN void_reason TEXT;

-- Purchase payments: ensure split payment support via purchase_id nullable (already)
-- Add indexes
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_is_paid ON purchases(is_paid);
CREATE INDEX IF NOT EXISTS idx_purchases_due ON purchases(due_paisa);

-- Purchase returns: add fields for inventory impact tracking
ALTER TABLE purchase_returns ADD COLUMN refund_paisa INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchase_returns ADD COLUMN refund_method TEXT;
ALTER TABLE purchase_returns ADD COLUMN notes TEXT;

-- Purchase return items: add base quantity for conversion tracking
ALTER TABLE purchase_return_items ADD COLUMN base_quantity_milli INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchase_return_items ADD COLUMN unit_id TEXT REFERENCES units(id);

-- Supplier transactions: add index for date range filtering
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_business_date ON supplier_transactions(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_type ON supplier_transactions(transaction_type);

-- Purchases: add product search optimization via purchase_items product_id already indexed
-- Add composite index for supplier + date filtering
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_date ON purchases(supplier_id, purchase_date DESC);
