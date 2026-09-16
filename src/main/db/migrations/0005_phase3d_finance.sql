-- Phase 3D Finance — MERQO RetailOS
-- Adds status/void fields to expenses, finance_transfers table, additional indexes

-- Expenses: add status and void tracking (idempotent)
-- SQLite ALTER ADD COLUMN IF NOT EXISTS not supported, so we use try-catch in migrator
-- But we create table with IF NOT EXISTS handling via statements that will be attempted

-- Add columns if not exists via separate statements (migrator will try/catch)
ALTER TABLE expenses ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE expenses ADD COLUMN voided_at INTEGER;
ALTER TABLE expenses ADD COLUMN voided_by TEXT;
ALTER TABLE expenses ADD COLUMN void_reason TEXT;

-- Finance Transfers (account-to-account)
CREATE TABLE IF NOT EXISTS finance_transfers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  transfer_number TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_account_id TEXT NOT NULL,
  dest_type TEXT NOT NULL,
  dest_account_id TEXT NOT NULL,
  amount_paisa INTEGER NOT NULL,
  charge_paisa INTEGER NOT NULL DEFAULT 0,
  commission_paisa INTEGER NOT NULL DEFAULT 0,
  reference TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at INTEGER NOT NULL,
  created_by TEXT,
  voided_at INTEGER,
  voided_by TEXT,
  void_reason TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_transfers_number ON finance_transfers(transfer_number);
CREATE INDEX IF NOT EXISTS idx_finance_transfers_business_created ON finance_transfers(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_transfers_source ON finance_transfers(source_account_id);
CREATE INDEX IF NOT EXISTS idx_finance_transfers_dest ON finance_transfers(dest_account_id);

-- Additional indexes for finance reconciliation and performance
CREATE INDEX IF NOT EXISTS idx_cash_movements_business_created ON cash_movements(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_business_created ON bank_transactions(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_business_status ON expenses(business_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_movements_type ON cash_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_type ON bank_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_mfs_transactions_type ON mfs_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_shifts_business_status ON shifts(business_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_accounts_business_active ON cash_accounts(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_business_active ON bank_accounts(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfs_accounts_business_active ON mfs_accounts(business_id, is_active);

-- Ensure expense_categories has updated_at default (already exists, but safe)
-- No changes needed for existing tables otherwise
