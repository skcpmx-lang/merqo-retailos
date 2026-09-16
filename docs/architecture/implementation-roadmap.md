# Implementation Roadmap — MERQO RetailOS

## Overview

19 phases, dependency-ordered. Each phase has objectives, deliverables, dependencies, quality gates, estimated effort (for 2-3 devs team). No phase starts until previous quality gate passes.

**Total Estimated Timeline for V1 (2 devs full-time):** 6-8 months

---

### Phase 0 — Architecture (Current)

- **Objectives:** Produce complete architecture blueprint (this doc set), freeze decisions, no code.
- **Deliverables:**
  - docs/architecture/*.md (10 files)
  - Reviewed for contradictions, risks
- **Dependencies:** None
- **Quality Gate:** All docs created, reviewed, approved, no placeholder code.
- **Effort:** 2 weeks
- **Status:** DONE

---

### Phase 1 — Foundation

- **Objectives:** Electron + React + TS scaffold, build pipeline, logging, config, i18n, design tokens, empty window.
- **Deliverables:**
  - Electron main + preload + renderer (Vite)
  - electron-builder config for Windows NSIS
  - Logging (pino + electron-log) with file rotation
  - Config layer (system_settings JSON)
  - i18next with bn JSON, t() everywhere
  - Tailwind + Radix + design tokens (colors, fonts, spacing)
  - Basic layout: sidebar, topbar, empty dashboard
  - No DB yet
- **Dependencies:** Phase 0
- **Quality Gate:** App boots <3s, shows branded window, logs to file, Bangla text via keys, light mode tokens applied, no hard-coded strings.
- **Effort:** 2 weeks

---

### Phase 2 — Database and Domain Engine

- **Objectives:** SQLite connection, Drizzle schema, migrations, domain pure logic, Money, UnitConversion, WAC, ledger principles.
- **Deliverables:**
  - better-sqlite3 + Drizzle ORM setup, WAL mode, foreign_keys ON
  - Schema for all entities (45+ tables) + migrations
  - FTS5 for products
  - Domain layer: Money (paisa), UnitConversion graph, WACCalculator, SaleCalculator, Validators (Zod), Errors
  - Repository pattern with interfaces
  - BackupService basic (copy file + integrity_check)
  - Tests: domain unit tests, DB integration tests (in-memory)
- **Dependencies:** Phase 1
- **Quality Gate:** Migrations run, DB file created in AppData, domain tests pass (Money, UnitConversion, WAC), backup creates file and validates, no financial logic in UI.
- **Effort:** 3 weeks

---

### Phase 3 — Authentication and Permissions

- **Objectives:** Users, roles, permissions, auth, session, audit log foundation.
- **Deliverables:**
  - AuthService: argon2id hashing, password + PIN, login/logout, session in memory, brute force lock
  - UserService, RoleService, PermissionService with 60+ permissions seed
  - Roles seed: Owner, Manager, Cashier, Stock Keeper, Accountant
  - Authorization middleware wrapping IPC handlers
  - AuditService: immutable audit_logs with before/after
  - UI: Login screen, lock screen, user management (CRUD), role management, permission matrix
  - First-run onboarding wizard (business + owner + cash account + seed data)
- **Dependencies:** Phase 2
- **Quality Gate:** Owner can login, PIN login works, permission checks enforced in service layer (test with cashier trying void sale → AuthorizationError), audit logs immutable, onboarding creates data, no fake data.
- **Effort:** 2.5 weeks

---

### Phase 4 — Product and Inventory

- **Objectives:** Product catalog, categories, brands, units, conversions, barcodes, inventory ledger, stock levels, low stock.
- **Deliverables:**
  - CategoryService, BrandService, UnitService, UnitConversionService
  - ProductService: CRUD, SKU generation, barcode handling, multiple barcodes, images, FTS search, soft delete prevention if movements exist
  - InventoryService: stock_movements ledger, stock_levels materialized, opening stock, adjustment, damage, loss, stock count session
  - WAC recalculation on purchase (but purchase not yet — stub)
  - UI: Products list with FTS <100ms, product form with unit conversion UI, categories, brands, units, low stock badges, stock movement history per product, product import (CSV) with validation → preview → transactional import
  - Notifications: low stock
- **Dependencies:** Phase 3
- **Quality Gate:** Can create product with base unit Piece, purchase unit Carton (1 carton=24 pcs), opening stock 48 pcs, stock level shows 48, adjustment with reason creates movement + audit, FTS search <100ms for 10k products, import pipeline works, permission product:view_cost enforced.
- **Effort:** 3.5 weeks

---

### Phase 5 — Purchasing and Suppliers

- **Objectives:** Suppliers, purchases, purchase returns, supplier ledger, payments.
- **Deliverables:**
  - SupplierService: CRUD, opening payable, current payable cached, statements
  - SupplierLedgerService: ledger derivation, due aging
  - PurchaseService: create purchase with items (purchase unit), receive → stock movements + WAC recalc + supplier ledger + audit, status management
  - PurchaseReturnService: return with stock negative + payable negative
  - PurchasePaymentService: payments with cash/bank/MFS accounts, split? Actually purchase payments can be multiple
  - Cash/Bank/MFS account basics (for payments)
  - UI: Suppliers list, supplier detail with ledger & statement PDF, purchases list, purchase form, receive, returns, payments
- **Dependencies:** Phase 4
- **Quality Gate:** Create supplier with opening payable 1000 BDT, create purchase 2 cartons @ 100 BDT/pc, receive → stock 48, WAC 100, supplier payable 4800+opening, pay 2000 cash → cash movement + supplier ledger, purchase return 12 pcs → stock 36, payable reduced, all in transactions, no negative stock if setting disallow.
- **Effort:** 3 weeks

---

### Phase 6 — POS and Sales

- **Objectives:** POS workflow, sales, sale returns, held sales, keyboard-first, barcode.
- **Deliverables:**
  - SaleService: create sale with items (sale unit), split payments, stock deduction, customer ledger (if due), cash/bank/MFS movements, COGS snapshot, sale number generation, void/refund with reversals
  - SaleReturnService: return with restock toggle
  - HeldSaleService: park/retrieve
  - BarcodeScannerService: timing heuristic, global listener, product lookup
  - ShiftService basic (required for POS)
  - UI: POS screen (left products grid + search + categories, right cart + customer + payment), keyboard shortcuts (F2-F10, +/-), barcode test, held sales list, sale completion success with print preview, sales list, sale detail, void/return dialogs
- **Dependencies:** Phase 5 (needs inventory, suppliers done for stock, but sales independent)
- **Quality Gate:** POS can scan barcode (real scanner) → add to cart <50ms, add 20 items → complete sale with split cash+due <500ms, stock deducted, customer due increased, cash balance increased, void sale restores stock + reverses ledgers, held sales park/retrieve works, keyboard-only flow possible, E2E POS test passes.
- **Effort:** 4 weeks (most critical)

---

### Phase 7 — Customers and Due

- **Objectives:** Customers, customer ledger, payments, due aging, statements.
- **Deliverables:**
  - CustomerService: CRUD, opening due, current due cached, credit limit
  - CustomerLedgerService: ledger derivation, due aging buckets, statements
  - CustomerPaymentService: payments with cash/bank/MFS
  - UI: Customers list, customer detail with ledger, statement PDF, due aging report, quick add from POS, customer import
- **Dependencies:** Phase 6 (sales creates due)
- **Quality Gate:** Create customer with opening due 500 BDT, sale with due 1000 BDT → current due 1500, payment 700 cash → due 800, sale return 200 → due 600, aging buckets correct, statement PDF generates, credit limit enforcement (if limit 1000, try sale due 1500 → error).
- **Effort:** 2 weeks

---

### Phase 8 — Finance (Cash/Bank/Expenses/Profit)

- **Objectives:** Cash/bank accounts, movements, transfers, expenses, COGS/profit engine, shifts.
- **Deliverables:**
  - CashService, BankService: CRUD, opening/current balance cached, movements ledger, transfers (two movements in transaction)
  - ExpenseService: categories seed (9), CRUD, with account source, attachments, recurring flag
  - ProfitService: revenue, COGS, gross profit, operating expenses, net profit queries
  - ShiftService full: open with opening cash, close with expected/actual/variance, shift summary, accountability
  - DashboardService basic: sales today, purchases, profit, due totals, stock value, cash position
  - UI: Cash/bank accounts, movements list, transfer form, expenses list + form + categories, shifts list + open/close + summary print, financial dashboard KPIs
- **Dependencies:** Phase 7
- **Quality Gate:** Create expense rent 5000 BDT cash → cash movement -5000 + expense, transfer cash 2000 to bank → cash -2000, bank +2000, open shift with 1000 opening, do sales 5000 cash, expense 200 cash → expected 5800, actual 5800 → variance 0, close shift prints summary, profit dashboard shows correct gross/net, all ledgers sum to cached balances.
- **Effort:** 3 weeks

---

### Phase 9 — MFS Agent

- **Objectives:** MFS providers, accounts, transactions, bookkeeping without APIs, commission, integration with cash.
- **Deliverables:**
  - MFSService: providers seed (bKash, Nagad, Rocket, Upay), accounts CRUD, transactions: cash_in, cash_out, send_money, payment, commission, with customer phone, charge, commission, ref, operator
  - Integration: MFS cash_in creates cash movement + MFS movement in same transaction
  - MFS dashboard: balances per provider/account, today's in/out, commission
  - UI: MFS accounts, transactions list, form with auto commission calc, dashboard
- **Dependencies:** Phase 8 (needs cash)
- **Quality Gate:** Create bKash agent account opening 10000 BDT e-money, cash_in 1000 BDT with charge 10 BDT, commission 5 BDT → MFS balance -1000+5? Actually e-money decreases by 1000, commission adds to profit, cash increases 1010? Test both flows, balance derived correctly, commission report monthly, no external API calls.
- **Effort:** 2 weeks

---

### Phase 10 — Reports

- **Objectives:** Reusable reporting engine, all reports with date presets, export.
- **Deliverables:**
  - ReportService: defines reports as objects with queryBuilder, filters, columns, aggregates
  - Date preset resolver: Today, Yesterday, Last 7 Days, This Week, This Month, Last Month, 3 Months, 6 Months, This Year, Last Year, Custom Range
  - Reports: Sales, Purchases, Inventory, Stock Movement, Profit, Customer, Supplier, Expense, Cash, Bank, MFS, Staff, Audit, Returns, Payment Methods
  - Export: CSV, Excel (exceljs), PDF (pdf-lib)
  - UI: Reports screen with filters, date presets, table, charts, export buttons
- **Dependencies:** Phase 9 (needs all data)
- **Quality Gate:** Sales report for last 7 days shows correct totals, filters work, export CSV/Excel/PDF works, report generation <2s for 10k sales, no hard-coded analytics, all reports use engine.
- **Effort:** 2.5 weeks

---

### Phase 11 — Printing and Hardware

- **Objectives:** Printer abstraction, A4/80mm/58mm/PDF, templates, preview, Bengali rendering, barcode hardware, diagnostics.
- **Deliverables:**
  - PrinterService: IPrinter interface, WindowsSpoolerPrinter, EscPosPrinter (node-thermal-printer), PdfPrinter, factory, discovery via getPrintersAsync()
  - Print templates: InvoiceA4, Receipt80mm, Receipt58mm, Report, BarcodeLabel, ShiftSummary, CustomerStatement — React components
  - Preview modal with paper size, margins, scaling
  - Bengali rendering: HTML for spooler, image rendering for ESC/POS
  - Cash drawer kick
  - BarcodeScannerService full with test area, configurable suffix, min length, timeout
  - HardwareDiagnostics screen
  - UI: Printers list, add/edit printer profile, set default, test print, preview
- **Dependencies:** Phase 10
- **Quality Gate:** Print A4 invoice to PDF with Bengali, print 80mm receipt to PDF (simulated) with Bengali, print test page with barcode/QR/logo, drawer kick works with real printer, barcode scanner test area shows timing and lookup, manual QA with real printers (A4 laser, 80mm Xprinter, 58mm generic) passes, no overflow.
- **Effort:** 3 weeks

---

### Phase 12 — Backup/Import/Export

- **Objectives:** Manual/auto backup, restore with safety, validation, import/export pipeline.
- **Deliverables:**
  - BackupService full: manual backup, auto backup daily, keep 7, validation integrity_check, checksum, history, restore with safety backup, failure recovery
  - ImportService: CSV/Excel import for products, customers, suppliers with validation → preview → warning/error report → confirmation → transactional import, import_jobs history
  - ExportService: CSV, Excel, PDF for all lists + reports, JSON backup
  - UI: Backup screen with history, manual backup button, auto toggle, restore with password re-entry, import screens with preview
- **Dependencies:** Phase 11
- **Quality Gate:** Manual backup creates file <5s for 100MB DB, auto backup daily, restore validates and creates safety backup, corrupted backup fails gracefully with Bangla error, import 1000 products with some errors shows preview and only imports valid if user confirms, all in transaction, backup reminder notification if no backup 7 days.
- **Effort:** 2 weeks

---

### Phase 13 — Notifications

- **Objectives:** In-app notifications, low stock, due reminders, backup reminders, shift.
- **Deliverables:**
  - NotificationService: create notifications on events (low stock after sale, due reminder daily, backup reminder, shift open)
  - UI: Bell icon with unread count, drawer list, mark read, filters
- **Dependencies:** Phase 12
- **Quality Gate:** Sale that makes stock <= min triggers low_stock notification, due reminder daily for overdue, backup reminder, notifications in-app only, no push.
- **Effort:** 1 week

---

### Phase 14 — UI/UX Polish

- **Objectives:** Apply design system fully, responsive desktop, accessibility, Bangla polish, empty states.
- **Deliverables:**
  - All screens using design tokens, no hard-coded colors/spacing
  - Responsive at 1280x720 to 3840x2160, no overflow
  - Keyboard navigation, focus states, contrast, tab order
  - Empty states with illustrations + CTA (no fake data)
  - Loading, error, success states
  - Bangla text reviewed for natural polished phrasing
  - Animations max 150ms
- **Dependencies:** Phase 13
- **Quality Gate:** Visual regression tests pass at 1280 and 1920, no overflow, keyboard-only navigation possible for critical flows, Lighthouse accessibility 90+, Bangla reviewed by native speaker, no emoji, no Bootstrap look.
- **Effort:** 2.5 weeks

---

### Phase 15 — Testing

- **Objectives:** Full test coverage, E2E, performance, manual QA checklists.
- **Deliverables:**
  - Unit tests 80% domain, 60% services
  - Integration tests for all ledger flows
  - E2E Playwright for onboarding, product, purchase, POS, customer, expense, shift, backup, import, print preview
  - Performance tests: search, barcode, sale, report, startup
  - Manual QA: printer, barcode, backup/restore, crash recovery
- **Dependencies:** Phase 14
- **Quality Gate:** All tests pass, coverage targets met, performance targets met, no critical bugs.
- **Effort:** 3 weeks

---

### Phase 16 — Visual QA

- **Objectives:** Pixel-perfect check, design system compliance, Bangla, empty states, printing.
- **Deliverables:**
  - Visual QA checklist executed
  - Screenshots at all breakpoints
  - Printer test with real hardware documented
  - Barcode test with real scanners documented
- **Dependencies:** Phase 15
- **Quality Gate:** Visual QA passes, no design inconsistencies, printing works with real hardware, barcode works.
- **Effort:** 1.5 weeks

---

### Phase 17 — Windows Packaging

- **Objectives:** NSIS installer, code signing, auto-updater, user data handling.
- **Deliverables:**
  - electron-builder config: NSIS, per-machine/per-user, icon, license, custom installer steps
  - Code signing certificate (Windows)
  - Auto-updater via GitHub releases or S3
  - Single instance lock, AppData handling, first-run detection
  - Installer tested on Windows 10/11, 1280x720 to 4K
- **Dependencies:** Phase 16
- **Quality Gate:** Installer installs to Program Files, creates Start Menu shortcut, uninstall works, user data in AppData, app starts <3s, auto-updater checks and installs, single instance works, no admin needed for daily use.
- **Effort:** 1.5 weeks

---

### Phase 18 — Production Acceptance

- **Objectives:** Full day operation simulation, financial integrity check, audit, backup/restore, support docs.
- **Deliverables:**
  - Production acceptance checklist: open shift, add products, purchase, sale, expense, customer payment, supplier payment, MFS transaction, close shift, backup, reports, print
  - Financial balances verified: customer due, supplier payable, cash/bank/MFS balances, stock, COGS, profit
  - Audit logs complete
  - Documentation: installation, hardware setup, backup/restore, troubleshooting, user manual (Bangla)
  - Support email ready
- **Dependencies:** Phase 17
- **Quality Gate:** Owner can complete full day without bugs, financial balances correct, no data loss, audit complete, docs ready.
- **Effort:** 2 weeks

---

## GitHub Structure (Proposed)

```
merqo-retailos/
├── docs/
│   ├── architecture/ (this blueprint)
│   ├── qa/ (printer, barcode checklists)
│   ├── user-manual/ (Bangla)
│   └── developer/ (setup, contributing)
├── src/
│   ├── main/
│   │   ├── db/
│   │   │   ├── schema/ (Drizzle tables)
│   │   │   ├── migrations/
│   │   │   ├── repositories/
│   │   │   └── connection.ts
│   │   ├── services/
│   │   │   ├── AuthService.ts
│   │   │   ├── ProductService.ts
│   │   │   ├── InventoryService.ts
│   │   │   ├── SaleService.ts
│   │   │   ├── PurchaseService.ts
│   │   │   ├── CustomerService.ts
│   │   │   ├── SupplierService.ts
│   │   │   ├── CashService.ts
│   │   │   ├── BankService.ts
│   │   │   ├── MFSService.ts
│   │   │   ├── ExpenseService.ts
│   │   │   ├── ShiftService.ts
│   │   │   ├── ReportService.ts
│   │   │   ├── DashboardService.ts
│   │   │   ├── PrintService.ts
│   │   │   ├── HardwareService.ts
│   │   │   ├── BackupService.ts
│   │   │   ├── ImportExportService.ts
│   │   │   ├── NotificationService.ts
│   │   │   └── AuditService.ts
│   │   ├── hardware/
│   │   │   ├── BarcodeHAL.ts
│   │   │   └── PrinterHAL/
│   │   ├── ipc/
│   │   │   └── handlers.ts (all ipcMain.handle)
│   │   ├── config/
│   │   ├── logging/
│   │   └── index.ts (Electron main entry)
│   ├── preload/
│   │   └── index.ts (contextBridge)
│   ├── core/
│   │   ├── domain/
│   │   │   ├── Money.ts
│   │   │   ├── UnitConversion.ts
│   │   │   ├── WACCalculator.ts
│   │   │   ├── SaleCalculator.ts
│   │   │   ├── Ledger.ts
│   │   │   ├── validators/ (Zod schemas)
│   │   │   └── errors/ (custom errors)
│   │   └── types/
│   ├── renderer/
│   │   ├── components/
│   │   │   ├── ui/ (Button, Input, Table, Card, Modal, etc.)
│   │   │   ├── layout/ (Sidebar, Topbar)
│   │   │   └── features/ (POS, Products, etc.)
│   │   ├── screens/
│   │   │   ├── Dashboard/
│   │   │   ├── POS/
│   │   │   ├── Products/
│   │   │   ├── Sales/
│   │   │   ├── Purchases/
│   │   │   ├── Customers/
│   │   │   ├── Suppliers/
│   │   │   ├── Expenses/
│   │   │   ├── CashBankMFS/
│   │   │   ├── Reports/
│   │   │   ├── Settings/
│   │   │   └── Hardware/
│   │   ├── hooks/ (usePermission, useBarcode, etc.)
│   │   ├── stores/ (Zustand)
│   │   ├── lib/ (utils, i18n, queryClient)
│   │   ├── styles/ (tokens.css, tailwind)
│   │   ├── templates/ (print templates)
│   │   └── locales/ (bn, en)
│   └── test/
│       ├── factories/
│       └── setup.ts
├── e2e/
│   ├── onboarding.spec.ts
│   ├── pos.spec.ts
│   └── ...
├── resources/
│   ├── icons/
│   └── fonts/ (Noto Sans Bengali, Inter)
├── build/
│   ├── electron-builder.yml
│   ├── entitlements.mac.plist (if needed)
│   └── installer.nsh (NSIS custom)
├── scripts/
│   ├── generate-icons.js
│   └── check-translations.js (no hard-coded strings)
├── .github/
│   └── workflows/
│       ├── ci.yml (unit, integration)
│       └── e2e.yml (Windows runner)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## Documentation Plan

- **Developers:** `docs/developer/setup.md` (Node, pnpm, Electron, DB), architecture overview, contributing, testing.
- **Business Administrators / Store Owners:** `docs/user-manual/owner-bn.md` — business setup, users/roles, products, purchases, sales, customers, suppliers, expenses, cash/bank/MFS, reports, backup/restore, printing, hardware, troubleshooting — all in polished Bangla with screenshots.
- **Staff:** `docs/user-manual/staff-bn.md` — POS, shift, customer quick add, returns.
- **Installation:** `docs/installation.md` — Windows requirements, installer steps, first-run, printer setup, barcode scanner setup.
- **Hardware Setup:** `docs/hardware.md` — supported printers/scanners, how to pair Bluetooth, test.
- **Backup/Restore:** `docs/backup-restore.md` — manual/auto, restore safety, failure recovery.
- **Troubleshooting:** `docs/troubleshooting.md` — common issues, logs location, support email, correlation ID.

All docs in Bangla (professional) + English future.

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Electron bundle size large (120MB+)** | Medium — slower download, more disk | High | Prune deps, asar, code splitting, target 120MB installer, acceptable for Windows |
| **Thermal printer Bengali rendering fails on cheap printers** | High — receipts unreadable | Medium | Image rendering fallback, test with 5+ cheap models, manual QA checklist, provide Windows spooler alternative |
| **Barcode scanner timing heuristic fails for slow scanners** | Medium — scan not detected | Medium | Configurable timeout, min length, suffix, test area, allow manual barcode entry, fallback to search |
| **better-sqlite3 native build fails on Windows** | High — app won't start | Low | Use prebuilds, electron-builder includes, fallback to sqlite3 driver if needed, test on Windows 10/11 |
| **Financial ledger mismatch (cached vs derived)** | High — wrong balances | Medium | Always update cached in same transaction, nightly recalc job, integrity check on startup, tests for ledger invariants |
| **WAC rounding errors with paisa/milli** | Medium — small profit discrepancies | Medium | Use bigint, test edge cases, store milli qty, rounding half-up, audit cost history |
| **Permission bypass via IPC** | High — security breach | Low | Service layer enforcement, IPC allowlist, contextIsolation, tests for permission matrix |
| **Backup corruption due to power loss** | High — data loss | Medium | WAL mode, checkpoint before backup, integrity_check, safety backup before restore, auto backup daily |
| **Performance degradation with 100k+ sales** | Medium — reports slow | Medium | Indexes, pagination, FTS, caching, materialized aggregates, test with large dataset |
| **Bangla translation quality low** | Medium — unprofessional | Medium | Native speaker review, glossary, no machine translation, lint no hard-coded strings |
| **Hiring Rust devs if Tauri chosen** | High — delay | N/A | Chosen Electron to avoid, keep domain pure for future migration |
| **Windows SmartScreen blocks installer** | Medium — user trust | High | Code signing certificate, reputation building, instructions to allow |
| **Single instance DB locked** | Medium — app won't start second instance | Low | Single instance lock, busy_timeout, clear error message in Bangla |

---

## Final Recommendation (Summary)

- **Framework:** Electron + React + TS — best for Windows printer/barcode/Bluetooth, local DB, maintainability, offline, commercial support.
- **DB:** SQLite + better-sqlite3 + Drizzle ORM, integer paisa, WAL, ledger-based integrity.
- **Costing:** WAC for V1 — simple, accurate for retail, future-ready for FIFO.
- **POS:** Keyboard-first, barcode timing heuristic, split payments, held sales, shift.
- **MFS:** Local bookkeeping without APIs, cash in/out, charge, commission, agent balance.
- **Printing:** Windows spooler + ESC/POS via node-thermal-printer + PDF, image rendering for Bengali.
- **Security:** argon2id, RBAC 60+ permissions service-layer, immutable audit, session in RAM.
- **UI/UX:** Light-only premium enterprise, Noto Sans Bengali + Inter, design tokens, 1280x720 min, no overflow, Bangla-first i18n keys.
- **Testing:** Vitest + Playwright, unit/integration/E2E/printer/barcode/backup/crash/performance.
- **Packaging:** electron-builder NSIS, code signed, auto-updater.

**Do not start Phase 1 until architecture reviewed and approved.**

---

## Next Steps

1. Review all architecture docs for contradictions.
2. Approve tech stack and database model.
3. Create GitHub issues per phase.
4. Start Phase 1 — Foundation only after approval.
