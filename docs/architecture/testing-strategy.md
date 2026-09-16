# Testing Strategy & Performance — MERQO RetailOS

## 1. Performance Targets

### 1.1 Targets (Windows 8GB RAM, i3 8th Gen, SSD)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Application Startup** (cold) | < 3.0s to interactive dashboard | From exe launch to dashboard rendered |
| **Warm Startup** | < 1.5s | Second launch |
| **Product Search** (10k products) | < 100ms | From keystroke to results |
| **Barcode Lookup** | < 50ms | From scan to cart add |
| **POS Interaction** (add to cart, qty change) | < 50ms | UI feedback |
| **Sale Completion** (transaction with 20 items) | < 500ms | From pay click to success + stock update |
| **Database Operations** (single insert) | < 20ms | better-sqlite3 transaction |
| **Report Generation** (30 days, 10k sales) | < 2s | Sales report |
| **Dashboard Load** | < 1s | Summary + charts |
| **Print Preview** | < 500ms | Generate HTML/PDF |
| **Backup** (100MB DB) | < 5s | Copy + checksum |
| **Import** (1000 products) | < 3s | Validation + insert |

### 1.2 Indexes & Caching for Performance

- **Indexes:** All FKs, `created_at DESC`, `barcode UNIQUE`, `sku UNIQUE`, FTS5 for product search.
- **FTS:** `products_fts` virtual table for fast search.
- **Caching:**
  - Dashboard aggregates cached 30s in main process.
  - Product list cached via TanStack Query 5 min.
  - Stock levels cached but invalidated on sale/purchase.
  - No Redis — in-memory LRU cache (simple Map with TTL) in main process for report queries.
- **Pagination:** All lists paginated 25/50/100.
- **Lazy Loading:** Reports, settings, hardware diagnostics lazy loaded via React.lazy.
- **DB:** WAL mode, `PRAGMA cache_size = -20000` (20MB), `mmap_size`.

---

## 2. Test Strategy

### 2.1 Unit Testing

- **Tool:** Vitest + @testing-library/react for components, pure Vitest for domain.
- **Coverage Target:** 80% for domain layer, 60% for services, 40% for UI (critical paths).
- **What to Test:**
  - Domain: Money, UnitConversion, WACCalculator, SaleCalculator, Ledger, Validators, Discount logic.
  - Example: `Money.add(10050, 20025) => 30075`, `UnitConversion.convert(2, carton, piece) => 48`.
  - Services: Mock repositories, test business rules, permission checks, transaction rollback.
  - Components: Render, interaction, error states, Bangla text via i18n mock.

- **Structure:** `src/core/domain/__tests__/`, `src/main/services/__tests__/`, `src/renderer/components/__tests__/`.

### 2.2 Integration Testing

- **Tool:** Vitest with real better-sqlite3 in-memory DB (`:memory:`) or temp file.
- **What:**
  - Repository + DB: CRUD, FK constraints, unique constraints, transaction rollback.
  - Service + Repository + DB: Full flow — create purchase → stock level updated → WAC recalculated → supplier ledger updated.
  - Example flows:
    - Sale with split payment → stock deducted, cash/bank/MFS movements, customer due, COGS calculated.
    - Purchase return → stock negative, supplier payable negative.
    - Expense → cash movement + expense.

- **Setup:** Each test creates fresh DB, runs migrations, seeds minimal data.

### 2.3 Database Testing

- **Migrations:** Test migrations up/down, idempotency, backup before migration.
- **Integrity:** `PRAGMA integrity_check` after operations.
- **Constraints:** Test unique, FK, check constraints.
- **Ledger Invariants:** After each financial operation, assert SUM(ledger) == cached balance (if cached).
- **Performance:** Test with 100k products, 100k sales — query times.

### 2.4 Business Logic Testing

- **Critical:** Inventory, COGS, profit, customer/supplier due, cash reconciliation.
- **Scenarios:**
  - Purchase 2 cartons (48 pcs) at 100 BDT/pc, then sell 10 pcs → stock 38, WAC 100, COGS 1000.
  - Purchase another 24 pcs at 120 BDT/pc → new WAC = (38*100 + 24*120)/62 = 107.74 → test rounding.
  - Sale return 5 pcs restock → stock 43, due reduced.
  - Void sale → stock restored, ledger reversed.
  - Unit conversion: 1 carton = 24 pcs, purchase in carton, sell in pcs, stock correct.
  - Negative stock prevention: try sell more than stock, expect error if setting disallow.

### 2.5 Permission Testing

- **Matrix Test:** For each permission, test user with and without permission.
- **Service Layer:** Mock user with specific permissions, call service method, expect success or AuthorizationError.
- **UI:** Test that buttons hidden when no permission, but also service still blocks.
- **Edge:** Owner always has all permissions, even if role removed.

### 2.6 E2E Testing

- **Tool:** Playwright with Electron support (`@playwright/test` + `electron`).
- **Scenarios:**
  - Onboarding → create business, owner, cash account → dashboard empty.
  - Add category, brand, unit, product with barcode → search product → add to cart → select customer → split payment cash+due → complete sale → verify stock deducted, customer due increased, cash balance increased.
  - Add supplier, create purchase, receive → stock increased, WAC updated.
  - Customer payment → due reduced.
  - Expense → cash reduced.
  - Shift open → sales → close shift with variance.
  - Backup → restore.
  - Import products CSV → validation → preview → import.
  - Print preview → PDF generation.

- **Structure:** `e2e/` folder, each spec file per flow.
- **CI:** Run on Windows runner (GitHub Actions windows-latest) with Electron.

### 2.7 Visual Regression Testing

- **Tool:** Playwright screenshot comparison or Chromatic (if Storybook).
- **What:** Critical screens at 1280x720, 1920x1080:
  - Dashboard, POS, Product list, Sale detail, Print preview.
- **Tolerance:** Small diff allowed for anti-aliasing, but major layout shift fails.
- **No emoji, no random data — screenshots deterministic.**

### 2.8 Printer Testing

- **Mock:** Mock `PrinterService` in unit tests.
- **Manual QA:** Test with real printers:
  - A4 laser (HP, Canon)
  - 80mm thermal (Xprinter XP-80, Epson TM-T20)
  - 58mm thermal (generic)
  - Windows spooler + ESC/POS direct + PDF.
  - Test Bengali rendering, barcode, QR, logo, paper cut, drawer kick.
  - Checklist in `docs/qa/printer-test-checklist.md`.

### 2.9 Barcode Testing

- **Mock:** Simulate fast keystrokes.
- **Manual QA:** Test with real scanners:
  - USB HID (Netum)
  - Bluetooth HID
  - Wireless dongle
  - Test timing heuristic, suffix Enter/Tab/None, min length, product lookup, not found case.
  - Checklist in `docs/qa/barcode-test-checklist.md`.

### 2.10 Backup/Restore Testing

- **Unit:** BackupService creates file, checksum, integrity_check.
- **Integration:**
  - Create DB with data, backup, delete original, restore, verify data.
  - Test interrupted backup (kill process mid-copy) → should not corrupt original, backup file invalid.
  - Test corrupted backup file → restore should fail gracefully, show Bangla error, not crash.
  - Test auto backup daily, keep 7.
  - Test restore with open DB connections → close connections, checkpoint, restore.

### 2.11 Crash Recovery Testing

- **Scenarios:**
  - App crash during sale transaction → DB transaction rollback, no partial sale.
  - Power loss during purchase receiving → WAL file recovery on next startup (SQLite handles).
  - App crash during backup → backup file incomplete, next startup detects and deletes incomplete backup.
  - Test via killing Electron process mid-transaction (Playwright).

### 2.12 Performance Testing

- **Tool:** Custom script with `console.time`, or Vitest bench.
- **Load:** Generate 10k products, 100k sales, measure search, report, dashboard.
- **Memory:** Check for leaks — open/close POS 100 times, heap snapshot.
- **Startup:** Measure from app ready to dashboard.

---

## 3. Test Data Management

- **No Fake Data in App:** First-run empty.
- **Test Data:** Only in tests, generated via factories (`src/test/factories/`).
- **Factories:** Product factory, Sale factory, etc., with realistic Bangla names.

---

## 4. Quality Gates (Phase Transition Criteria)

### Phase 0 → Phase 1 (Architecture → Foundation)

- All architecture docs created and reviewed for contradictions.
- Tech stack decision approved.
- No placeholder code.

### Phase 1 → Phase 2 (Foundation → DB & Domain)

- Electron app boots, shows empty window with MERQO branding.
- Logging works, config works, i18n works (Bangla).
- No DB yet, but foundation tests pass.

### Phase 2 → Phase 3 (DB & Domain → Auth & Permissions)

- DB migrations run, schema created.
- All entities created, indexes.
- Domain unit tests pass (Money, UnitConversion, WAC).
- Backup creates file, integrity_check passes.

### Phase 3 → Phase 4 (Auth → Product & Inventory)

- Owner can login with password/PIN, session works, auto-lock.
- Roles/permissions CRUD, permission checks in services, audit logs for user changes.
- Permission tests pass.

### Phase 4 → Phase 5 (Product → Purchasing)

- Products CRUD with units, conversions, barcodes, FTS search <100ms.
- Stock ledger works, WAC recalc, low stock notification.
- Product import validation → preview → transactional import works.

### Phase 5 → Phase 6 (Purchasing → POS & Sales)

- Suppliers, purchases, purchase returns, supplier ledger, supplier payments.
- Purchase receiving updates stock and WAC.
- Tests for purchase flow pass.

### Phase 6 → Phase 7 (POS → Customers & Due)

- POS keyboard-first, barcode scanning heuristic works with real scanner, cart, split payment, held sales, sale completion <500ms.
- Sale voids/returns with reversals.
- Stock deducted, cash/bank/MFS movements, customer due if applicable.
- E2E POS flow passes.

### Phase 7 → Phase 8 (Customers → Finance)

- Customers, customer ledger, payments, due aging, statements.
- Supplier ledger similar.

### Phase 8 → Phase 9 (Finance → MFS)

- Cash/bank accounts, movements, transfers, expenses, shifts with variance, dashboard financials.
- Expense categories, reports.

### Phase 9 → Phase 10 (MFS → Reports)

- MFS accounts, transactions, cash in/out, commission, balance, integration with cash movements.
- MFS dashboard.

### Phase 10 → Phase 11 (Reports → Printing & Hardware)

- All reports with date presets, export CSV/Excel/PDF.
- Dashboard queries cached, no hard-coded analytics.

### Phase 11 → Phase 12 (Printing → Backup/Import/Export)

- Printing abstraction, A4/80mm/58mm/PDF, Bengali rendering, test print, drawer kick.
- Hardware diagnostics screen.
- Manual QA with real printers and scanners passes.

### Phase 12 → Phase 13 (Backup → Notifications)

- Manual/auto backup, restore with safety, validation, failure recovery.
- Import/export pipeline.

### Phase 13 → Phase 14 (Notifications → UI Polish)

- Notifications in-app, low stock, due reminders.

### Phase 14 → Phase 15 (Polish → Testing)

- UI/UX polish: design tokens applied, responsive at 1280x720 to 3840x2160, no overflow, accessibility keyboard nav, Bangla polished.
- Visual regression tests pass.

### Phase 15 → Phase 16 (Testing → Visual QA)

- All unit/integration/E2E tests pass, coverage targets met.
- Performance targets met.

### Phase 16 → Phase 17 (Visual QA → Packaging)

- Visual QA checklist passes (design system, Bangla, empty states, error states).
- Printer/barcode manual QA passes.

### Phase 17 → Phase 18 (Packaging → Production Acceptance)

- NSIS installer works, installs to Program Files, user data in AppData, auto-updater works, code signed.
- App starts <3s on target machine.

### Phase 18 → Production

- Production acceptance checklist: owner can do full day operation (open shift, add products, purchase, sale, expense, close shift, backup, report) without bugs, financial balances correct, audit logs complete.

---

## 5. CI/CD for Tests (Future)

- GitHub Actions: Windows runner, Node 20, run `npm run test:unit`, `test:integration`, `test:e2e` (Playwright).
- No cloud deployment for V1, but CI for tests.

---

## 6. Logging for Test Failures

- On test failure, capture logs, DB file, screenshot (for E2E).
- Correlation ID for debugging.
