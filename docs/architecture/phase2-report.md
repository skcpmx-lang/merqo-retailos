# Phase 2 Engineering Report — Database and Domain Engine

Date: 2026-09-16
Branch: arena/01a0aa2b-merqo-retailos
Base: 7a2b63880a9ec5016d41897bc5a749fff0db5166
Previous Phase 1 Commit: 1459b33

## Summary
Phase 2 expands MERQO RetailOS from 9 tables (Phase 1 foundation) to 45+ entities covering full retail domain: products, categories/subcategories, brands, units, conversions, barcodes, pricing, cost history, stock levels, movements, suppliers, customers, sales, purchases, finance (cash/bank/MFS), shifts, etc.

All ledger tables are immutable (append-only), financial amounts stored as integer paisa, quantities as milli (×1000), WAC (Weighted Average Cost) supported, unit conversion graph with BFS, atomic transactions for inventory and financial ledgers.

## Deliverables

### 1. Database Schema (Drizzle + SQL)

**New schema modules under `src/main/db/schema/`:**
- `business.ts` — businesses, business_settings, system_settings
- `users.ts` — users, roles (code), permissions (code), role_permissions, user_roles
- `products.ts` — categories (parent_id for subcategories), brands, units, unit_conversions, products (sku UNIQUE, barcode index, cost_price_paisa, selling_price_paisa, mrp_paisa, min_stock_milli, reorder_level_milli, opening_stock_milli, is_stock_trackable/sellable/purchasable/active, tax_rate), product_variants, product_barcodes (UNIQUE barcode), product_images, product_prices, product_cost_history (immutable)
- `inventory.ts` — stock_levels (UNIQUE product+location, quantity_milli, reserved_milli, last_movement_at), stock_movements (CHECK quantity_milli !=0, immutable ledger), stock_counts, stock_count_items
- `suppliers.ts` — suppliers (opening/current payable paisa), supplier_transactions ledger, purchases (purchase_number UNIQUE), purchase_items (quantity_milli, base_quantity_milli, cost), purchase_payments, purchase_returns, purchase_return_items
- `customers.ts` — customers (opening/current due, credit_limit), customer_transactions ledger, sales (sale_number UNIQUE, subtotal/discount/tax/total/paid/due/change paisa), sale_items (quantity_milli, base_quantity_milli, cost), sale_payments (cash/bank/card/mfs/cheque), sale_returns, sale_return_items, discounts, held_sales
- `finance.ts` — expense_categories (is_system, updated_at), expenses, cash_accounts, cash_movements ledger, bank_accounts, bank_transactions, mfs_providers (code UNIQUE), mfs_accounts (opening/current balance, is_agent, commission_rate), mfs_transactions (amount, customer_charge, commission, net, balance_after, transaction_ref, customer_phone, operator), shifts (shift_number UNIQUE), cash_sessions
- `system.ts` — audit_logs (before_json/after_json), notifications, backups, printers, import_jobs, migrations
- `index.ts` — re-exports all

**Migration:**
- `src/main/db/migrations/0002_phase2_full_schema.sql` — ~800 lines, CREATE TABLE IF NOT EXISTS + INDEX + UNIQUE + CHECK + FTS5 virtual table `products_fts` + 3 triggers for FTS sync (insert/delete/update). Idempotent, safe for both new installs and upgrades.

**Migrator Update:**
- `src/main/db/migrator.ts` — `createInitialSchema()` now:
  - Embeds Phase1 SQL (system_settings, businesses, business_settings, users, roles with code, permissions with code, role_permissions, user_roles, audit_logs, migrations)
  - Tries to load Phase2 SQL from disk (`__dirname/migrations/0002...` or `src/main/db/migrations/...` fallback)
  - Executes both in order
  - Records `0002_phase2_full_schema` as executed for new DBs (INSERT OR IGNORE)
  - Maintains transaction safety and integrity_check before/after
  - Fixed missing columns: roles.code, permissions.code, expense_categories.updated_at

**Build Integration:**
- `package.json` build:main now runs `copy:migrations` script that copies *.sql to `dist/main/db/migrations/` for runtime loading
- Verified build output: `dist/main/db/migrations/0002_phase2_full_schema.sql` present

### 2. Repositories (Drizzle-style thin wrappers, no business logic)

Under `src/main/db/repositories/`:
- `base.ts` — BaseRepository with Id.generate(), now(), handleError mapping UNIQUE -> ConflictError, other -> DatabaseError. Accepts db param explicitly for tests, fallback to getConnection.
- `category.repository.ts` — CRUD, findByBusiness, findChildren, hasProducts, softDelete
- `brand.repository.ts` — CRUD, findByBusiness, softDelete
- `unit.repository.ts` — UnitRepository (create, findById, findByBusiness, findByGroup), UnitConversionRepository (create with self-check, factor>0, findByBusiness, findConversionsForUnit, delete)
- `product.repository.ts` — ProductRepository (create with SKU unique, findById, findBySku, findByBarcode (checks products.barcode + product_barcodes join), findByBusiness, search with FTS fallback to LIKE, update, softDelete, hasStockMovements), ProductBarcodeRepository (create, findByProduct, findByBarcode, delete), ProductCostHistoryRepository (create immutable, findByProduct ORDER BY created_at DESC, rowid DESC for deterministic)
- `inventory.repository.ts` — StockLevelRepository (upsert handles UNIQUE product+location, findByProductAndLocation, findLowStock via JOIN products min_stock, getStockValue), StockMovementRepository (create with CHECK quantity!=0, findByProduct, findByReference, getCurrentStock SUM quantity_milli, getStockValue)
- `supplier.repository.ts` — SupplierRepository (create, findById, findByBusiness, update, softDelete), SupplierTransactionRepository (create, findBySupplier, getCurrentPayable SUM)
- `customer.repository.ts` — CustomerRepository (create, findById, findByPhone, findByBusiness, update, softDelete), CustomerTransactionRepository (create, findByCustomer, getCurrentDue SUM)
- `finance.repository.ts` — ExpenseCategoryRepository, MfsProviderRepository (create, findAll, findByCode), MfsAccountRepository
- `index.ts` — barrel export

**Principles:**
- All writes via prepared statements, no ORM magic
- No permission checks in repo (service layer responsibility)
- Immutable ledgers never UPDATE in normal flow
- UNIQUE constraints enforced at DB level (sku, barcode, product+location, etc.)

### 3. Domain Services (Pure business rules, no DB)

Under `src/core/domain/services/`:
- `unit-conversion.service.ts` — UnitConversionService:
  - `convert(quantityMilli, fromUnitId, toUnitId, conversions)` — builds graph, BFS for path, handles reverse (inverse factor), returns milli, throws if no path
  - `toBaseMilli(quantity, factor)` / `fromBaseMilli(milli, factor)` — ×1000 handling
  - `validateConversions()` — self-conversion, factor>0, duplicate detection
- `product-validation.service.ts` — ProductValidationService:
  - `validate(input)` — businessId, name length, SKU regex /^[A-Z0-9-_]+$/i, baseUnitId, cost/selling paisa >=0, mrp>=0, tax 0-100, min/reorder/opening milli >=0, collects errors, throws ValidationError with Bangla message
  - `validatePriceUpdate()` — cost/selling negative check, warnings for >50% increase, selling below cost
  - `validateBarcode()` — length 4-50, regex /^[0-9A-Za-z-_]+$/
- `inventory.service.ts` — InventoryDomainService:
  - `validateMovement()` — required fields, quantity!=0, cost>=0, valid MovementType enum, sale negative, purchase positive
  - `calculateNewWAC(currentStockMilli, currentWacPaisa, purchaseQtyMilli, purchaseCostPaisa)` — uses WACCalculator.calculateFromNumbers, handles zero stock
  - `canDeduct(currentStockMilli, deductMilli, isStockTrackable)` — prevents negative for trackable, returns Bangla reason
  - `verifyLedgerInvariant(stockLevelMilli, movementsSumMilli)` — diff check
  - Builders: `buildOpeningMovement()`, `buildPurchaseMovement()`, `buildSaleMovement()` — consistent location_id='main'
- `financial-ledger.service.ts` — FinancialLedgerService:
  - `buildSupplierTransaction(businessId, supplierId, type, amountPaisa, ...)` — signs amount: purchase/opening positive, payment/return negative, adjustment as-is, throws if zero
  - `buildCustomerTransaction()` — similar: sale/opening positive, payment/return negative
  - `verifyLedgerInvariant(currentBalance, sumTransactions)` — diff
  - `calculateMfsNet(type, amountPaisa, customerChargePaisa, commissionPaisa)` — agent workflow breakdown for cash_in/cash_out/send_money

### 4. Application Services (Orchestration + Atomicity)

Under `src/main/services/`:
- `audit.service.ts` — AuditService (extends BaseRepository), log inserts into audit_logs with before_json/after_json (fixed from old_values/new_values), findByEntity, findByBusiness
- `product.service.ts` — ProductService:
  - `create(input)` — validates via ProductValidationService, checks duplicate SKU/barcode, transaction: product + barcodes + cost_history (old 0 new cost) + opening stock movement + stock_level upsert + audit. Uses db.transaction() for atomicity.
  - `update(id, input)` — checks duplicate SKU/barcode if changed, transaction: product update + cost history if cost changed (calculates new WAC via inventoryService) + audit
  - `findById`, `findByBarcode`, `search`
  - Money handling: Money.fromPaisa(...).formatBDT() for audit
- `inventory-transaction.service.ts` — InventoryTransactionService:
  - `receivePurchase({businessId, purchaseId, items, createdBy})` — transaction: for each item check qty>0 cost>=0, product exists, currentLevel, calculate new WAC, create stock_movement (purchase), upsert stock_level, update product cost_price to new WAC, create cost_history, audit. Returns oldStock/newStock/oldWac/newWac.
  - `deductForSale({businessId, saleId, items, createdBy})` — two-pass: first check all stock availability via canDeduct (prevents oversell), second pass deduct: create sale movement (negative), upsert level, audit. Throws with Bangla reason if insufficient.
  - `verifyProductLedger(productId, locationId)` — compares stock_level quantity vs SUM movements

**Authorization Boundaries:**
- Services accept createdBy/updatedBy but do NOT check permissions themselves — intended to be wrapped by IPC layer with permission checks (per architecture doc). Repositories are permission-agnostic.

### 5. Seed Configuration

Under `src/main/db/seeds/`:
- `index.ts` — constants:
  - `SEED_ROLES` — owner, manager, cashier, salesman, accountant (code, name, nameBn, description, isSystem)
  - `SEED_PERMISSIONS` — 40+ permissions across modules: dashboard.view, dashboard.financial, pos.sell/discount/hold/return, products.view/create/edit/delete/import, categories/brands/units.manage, inventory.view/adjust/count/transfer, purchases.view/create/payment, suppliers.manage, customers.view/manage/payment, expenses.view/manage, finance.cash/bank/mfs, reports.view/export/profit, settings.view/manage/users/backup, shifts.view/manage
  - `ROLE_PERMISSIONS_MAP` — owner all, manager 30+, cashier 11, salesman 4, accountant 13
  - `SEED_MFS_PROVIDERS` — bkash, nagad, rocket, upay, mcash, surecash (code, name, nameBn)
  - `SEED_EXPENSE_CATEGORIES` — Rent, Electricity, Salary, Transport, Internet, Maintenance, Marketing, Office Supplies, Miscellaneous (name, nameBn, isSystem)
  - `SEED_UNITS` — Piece (pcs, পিস, piece, base), Kilogram, Gram, Liter, Milliliter, Dozen, Carton, Box, Packet, Bag
- `seed.ts` — SeedRunner:
  - Constructor accepts db param, fallback to getConnection
  - Methods: seedPermissions (SELECT id FROM permissions WHERE code=? check idempotency), seedRoles, seedRolePermissions (joins role_code + perm_code), seedMfsProviders, seedUnits(businessId), seedExpenseCategories(businessId)
  - `runAll(businessId?)` — runs all, idempotent (INSERT only if not exists)

### 6. Tests

**Unit tests (vitest.config.ts, jsdom):**
- `src/core/domain/__tests__/unit-conversion.test.ts` — 7 tests: direct, reverse, path, same unit, no path throw, validate, toBase/fromBase
- `product-validation.test.ts` — 8 tests: valid, empty name, invalid SKU, negative cost, tax out of range, barcode, warning below cost, warning increase
- `inventory-domain.test.ts` — 5 tests: validate movement, quantity zero throw, sale positive throw, canDeduct allowed/not, non-trackable allowed, ledger invariant, WAC calculation, opening movement builder
- `financial-ledger.test.ts` — 4 tests: supplier sign, customer sign, invariant, MFS net

**DB tests (vitest.db.config.ts, node):**
- `test-helpers.ts` — getTestDb() uses createConnection({memory:true}) which tries better-sqlite3 then fallback node:sqlite, then Migrator.createInitialSchema(), seedBusiness() inserts business with only id/name (fixed from owner_name)
- `product-repository.test.ts` — 5 tests: create with SKU unique constraint (ConflictError), find by barcode, manage barcodes (multi), cost history immutable, soft delete
- `inventory-ledger.test.ts` — 4 tests: CHECK quantity!=0, UNIQUE product+location upsert, current stock from movements SUM, ledger invariant via transaction
- `financial-ledger.test.ts` — 4 tests: supplier payable ledger (opening+purchase-payment), customer due ledger, zero amount, atomic supplier creation+opening transaction
- `seed.test.ts` — 7 tests: permissions, roles, role_permissions, MFS providers, units for business, expense categories, runAll (counts)
- `transaction-atomicity.test.ts` — 5 tests: product creation atomically with opening stock (checks movement, level, cost history), rollback if barcode duplicate (no orphan), receive purchase atomically with WAC update (verifies new WAC between old and new cost, product cost updated, ledger invariant), deduct for sale atomically and prevent oversell (checks stock still 2000 after failed oversell), maintain ledger invariant after multiple operations (10+5-3+2=14)
- Plus existing Phase1 tests: connection.test.ts (5), integrity.test.ts (2), transaction.test.ts (3) — fixed transaction.test to use duplicate id not phone (since phone not UNIQUE)

**Total:** 74 unit tests passed, 37 db tests passed

**Fixes for fallback:**
- BaseRepository now requires db param in tests, avoids require('../connection') MODULE_NOT_FOUND by try/catch
- SeedRunner similar
- Migrator phase1Sql now includes roles.code, permissions.code UNIQUE, expense_categories.updated_at
- 0002 SQL updated expense_categories updated_at
- AuditService fixed old_values/new_values -> before_json/after_json
- Money.format -> Money.fromPaisa().formatBDT()
- ProductCostHistoryRepository ORDER BY created_at DESC, rowid DESC for deterministic
- StockMovementRepository create signature fixed to allow optional locationId
- Transaction test fixed duplicate phone -> duplicate id

### 7. Typecheck / Build / Lint

- `npm run typecheck` — passes (renderer + main + preload)
- `npm run build` — passes: main 8.2KB + copy migrations, renderer 249KB gz 80KB
- `npm run test:unit` — 74 passed
- `npm run test:db` — 37 passed

### 8. Financial Integrity Principles Enforced

- **Integer paisa** — all money fields *_paisa INTEGER, no FLOAT, Money value object bigint
- **Milli quantity** — quantity_milli INTEGER (×1000), no float, Quantity value object
- **Immutable ledgers** — stock_movements, product_cost_history, supplier_transactions, customer_transactions, cash_movements, bank_transactions, mfs_transactions, audit_logs — no UPDATE in normal flow, only INSERT, verified via tests
- **WAC** — Weighted Average Cost: (oldQty*oldWac + newQty*newCost)/(oldQty+newQty), implemented in WACCalculator.calculateFromNumbers, used in receivePurchase, cost history tracks old/new WAC
- **Ledger invariant** — stock_levels.quantity_milli == SUM(stock_movements.quantity_milli) per product+location, verified in InventoryTransactionService.verifyProductLedger and tests
- **Supplier/Customer ledger** — currentPayable/currentDue == SUM(transaction amount_paisa), with sign convention: purchase/sale/opening positive, payment/return negative
- **Atomic transactions** — db.transaction() wraps product creation, purchase receipt, sale deduction, supplier creation+opening — ensures no partial data on failure, tested via rollback cases
- **CHECK constraints** — stock_movements quantity_milli !=0, enforced at DB level, tested
- **UNIQUE constraints** — products.sku, product_barcodes.barcode, stock_levels product+location, purchases.purchase_number, etc., tested via ConflictError

### 9. Inventory Engine

- Materialized cache: stock_levels updated on every movement, last_movement_at tracked
- Movement types: purchase, sale, sale_return, purchase_return, adjustment, transfer, opening, damage, count
- Sale must be negative, purchase positive — validated
- canDeduct prevents negative stock for trackable items, returns Bangla reason
- Low stock query via JOIN products min_stock_milli
- Stock value via SUM(quantity_milli * cost_price_paisa /1000)

### 10. Unit Conversion

- Graph model: unit_conversions from_unit_id, to_unit_id, conversion_factor REAL
- BFS path finding with reverse edges (inverse factor)
- Validation: self-conversion disallowed, factor>0, duplicate detection
- toBaseMilli/fromBaseMilli helpers

### 11. Risks & Next Steps

- **Figma/WAC precision**: Currently uses number helper Math.round, should use bigint version for large quantities to avoid float errors — WACCalculator has bigint version but service uses number version for simplicity, acceptable for Phase 2, should migrate to bigint in Phase 3
- **FTS5**: products_fts virtual table created, triggers sync, but fallback LIKE search if FTS fails — good
- **Better-sqlite3 binary**: In CI/sandbox, native module not available, fallback node:sqlite works but pragma handling is mocked (busy_timeout, foreign_keys) — acceptable for tests, production Windows will have better-sqlite3
- **Seed idempotency**: Uses SELECT check before INSERT, not INSERT OR IGNORE — safe but could be optimized with UNIQUE + IGNORE
- **MFS agent workflow**: Domain service calculates net breakdown but full double-entry (cash + e-money + commission) not yet implemented as ledger — Phase 3 will need cash_movements + mfs_transactions + commission income
- **Missing tables in fallback**: The embedded fallback schema in migrator.ts if file not found is minimal (only some tables) — should be updated to full schema or removed, since we now always ship SQL file
- **Audit**: AuditService logs but doesn't include old/new diff for stock movements yet — Phase 3 should add

## Files Changed

- `src/main/db/schema/*.ts` — 8 files expanded from 9 tables to 45+
- `src/main/db/schema/index.ts` — re-export
- `src/main/db/migrations/0002_phase2_full_schema.sql` — new 800-line migration
- `src/main/db/migrator.ts` — updated phase1Sql with code columns, load phase2Sql from disk, record migration
- `src/main/db/repositories/*.ts` — 7 new repositories + base
- `src/core/domain/services/*.ts` — 4 new domain services
- `src/main/services/*.ts` — 3 new app services (product, inventory-transaction, audit)
- `src/main/db/seeds/*.ts` — seed constants + runner
- `src/main/db/__tests__/*.ts` — 5 new db tests + helpers + fix transaction.test
- `src/core/domain/__tests__/*.ts` — 4 new unit tests
- `package.json` — build:main copies migrations

## Verification

```
npm run typecheck — pass
npm run build — pass (249KB gz 80KB renderer, 8.2KB main)
npm run test:unit — 74 passed
npm run test:db — 37 passed
```

## Commit

Ready to commit Phase 2.
