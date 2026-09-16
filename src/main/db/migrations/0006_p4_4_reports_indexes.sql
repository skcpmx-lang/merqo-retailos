-- P4.4 Reports & Analytics — indexes for report workloads
-- Justified indexes for date-range filtering and grouping

-- Sales
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_business_created ON sales(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_business_sale_date ON sales(business_id, sale_date DESC);

-- Sale items
CREATE INDEX IF NOT EXISTS idx_sale_items_product_sale ON sale_items(product_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_business ON sale_items(sale_id, product_id);

-- Sale payments
CREATE INDEX IF NOT EXISTS idx_sale_payments_created_at ON sale_payments(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_payments_business_created ON sale_payments(business_id, created_at DESC);

-- Sale returns
CREATE INDEX IF NOT EXISTS idx_sale_returns_created_at ON sale_returns(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_returns_business_date ON sale_returns(business_id, return_date DESC);

-- Purchases
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);
CREATE INDEX IF NOT EXISTS idx_purchases_business_created ON purchases(business_id, created_at DESC);

-- Purchase items
CREATE INDEX IF NOT EXISTS idx_purchase_items_business ON purchase_items(purchase_id, product_id);

-- Purchase returns
CREATE INDEX IF NOT EXISTS idx_purchase_returns_business_date ON purchase_returns(business_id, return_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_created_at ON purchase_returns(created_at);

-- Stock movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_business_product_date ON stock_movements(business_id, product_id, created_at DESC);

-- Customer ledger
CREATE INDEX IF NOT EXISTS idx_customer_transactions_created_at ON customer_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_business_created ON customer_transactions(business_id, created_at DESC);

-- Supplier ledger
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_created_at ON supplier_transactions(created_at);

-- Financial movements
CREATE INDEX IF NOT EXISTS idx_cash_movements_created_at ON cash_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_created_at ON bank_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_mfs_transactions_created_at ON mfs_transactions(created_at);

-- Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_category_date ON expenses(category_id, expense_date DESC);

-- Shifts
CREATE INDEX IF NOT EXISTS idx_shifts_created_at ON shifts(created_at);
CREATE INDEX IF NOT EXISTS idx_shifts_opened_at ON shifts(opened_at);

-- Products for low stock queries
CREATE INDEX IF NOT EXISTS idx_products_min_stock ON products(min_stock_milli);
CREATE INDEX IF NOT EXISTS idx_products_reorder_level ON products(reorder_level_milli);
CREATE INDEX IF NOT EXISTS idx_products_business_active_stock ON products(business_id, is_active, min_stock_milli);

-- Customers due index already exists idx_customers_due, but add business
CREATE INDEX IF NOT EXISTS idx_customers_business_due ON customers(business_id, current_due_paisa DESC);

-- Suppliers payable
CREATE INDEX IF NOT EXISTS idx_suppliers_business_payable ON suppliers(business_id, current_payable_paisa DESC);
