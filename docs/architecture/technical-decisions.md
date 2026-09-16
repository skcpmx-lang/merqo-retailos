# Technical Decisions — MERQO RetailOS (ADR)

## ADR-001: Framework — Electron + React + TypeScript

- **Decision:** Use Electron + React + TypeScript + Vite + Tailwind + Radix + Zustand + TanStack Query
- **Alternatives Considered:** Tauri + React + TS, .NET WPF/WinUI 3, Flutter Windows
- **Why:**
  - Windows reliability: Electron mature (VS Code, Slack), 10+ years.
  - Printer compatibility: Node `node-thermal-printer` supports 200+ thermal models, Windows spooler via `webContents.print()`. Tauri Rust crates immature for ESC/POS.
  - Barcode scanner: HID keyboard heuristic works in Electron without drivers, same for Bluetooth HID.
  - Bluetooth: `noble` / Web Bluetooth via Electron, Tauri plugins experimental.
  - Local DB: `better-sqlite3` fastest, synchronous, transaction-safe, mature. Tauri SQL plugin async, less mature.
  - Performance: Startup 2-3s acceptable, memory 200MB okay for 8GB machines. Tauri lighter but not critical.
  - Maintainability: Large React/Node talent pool in BD, hiring easy. Tauri needs Rust.
  - Packaging: electron-builder NSIS mature, autoUpdater, code signing.
  - Offline: 100% offline.
- **Trade-offs:** Bundle size 120MB+, memory higher than Tauri. Mitigated via pruning, asar, lazy loading.
- **Future-Proof:** Domain layer pure TS, no Electron deps, reusable if migrate to Tauri later.

---

## ADR-002: Database — SQLite + better-sqlite3 + Drizzle ORM

- **Decision:** SQLite 3 with WAL mode, `better-sqlite3` driver, Drizzle ORM, migrations via drizzle-kit, integer paisa for money, milli for quantity.
- **Alternatives:** Prisma, TypeORM, Kysely, raw SQL, SQLCipher, IndexedDB, Realm.
- **Why:**
  - SQLite: Best for offline Windows desktop, single file, zero config, ACID, WAL allows concurrent readers.
  - better-sqlite3: Synchronous, fastest, transaction support via `db.transaction()`, crucial for financial integrity. `sqlite3` async driver slower.
  - Drizzle: Type-safe, lightweight, SQL-close, migration support, no Rust engine (Prisma adds size). Kysely similar but Drizzle more mature for schema.
  - Money as INTEGER paisa: Avoid FLOAT rounding errors. Store BDT*100 as BIGINT. Use `Money` value object with bigint arithmetic.
  - Quantity as milli: Handle fractional (0.5 kg) via integer milli (1500 = 1.5). Avoid float.
- **Config:** `journal_mode=WAL`, `foreign_keys=ON`, `synchronous=NORMAL`, `busy_timeout=5000`, `cache_size=-20000` (20MB).
- **IDs:** nanoid TEXT (21 chars), not autoincrement, prevents guessing, offline-safe.

---

## ADR-003: ORM/Data Layer — Drizzle + Repository Pattern

- **Decision:** Drizzle ORM for schema + migrations, repository pattern thin wrappers, services use repositories.
- **Why:** Separation, testability, transaction control in services, not ORM magic.
- **Repositories:** `ProductRepository`, `StockMovementRepository`, etc., with methods like `findByBarcode`, `create`, `update`, but no business logic.

---

## ADR-004: State Management — Zustand + TanStack Query

- **Decision:** Zustand for UI state (POS cart, filters, modals), TanStack Query for server state (data fetching via IPC).
- **Alternatives:** Redux Toolkit, Jotai, Recoil.
- **Why:** Zustand simple, small, no boilerplate, good for POS cart. TanStack Query handles caching, invalidation, background refetch for dashboard/reports. Redux overkill for V1.

---

## ADR-005: UI Architecture — React + Tailwind + Radix + Lucide

- **Decision:** React 18, TailwindCSS 3.4 with custom tokens, Radix UI primitives, Lucide icons, Recharts.
- **Why:**
  - Tailwind: Utility-first, design tokens via CSS variables, no Bootstrap look, easy responsive.
  - Radix: Accessible primitives, headless, style with Tailwind, not opinionated.
  - Lucide: Consistent, MIT, clean, single icon library.
  - Recharts: Simple, good for dashboard.
- **Avoid:** Bootstrap, excessive gradients, glassmorphism, emoji icons.

---

## ADR-006: Testing Stack — Vitest + Playwright + Testing Library

- **Decision:** Vitest for unit/integration, @testing-library/react for components, Playwright for E2E (Electron support).
- **Why:** Vitest fast, Vite-native, compatible with Jest. Playwright best for Electron E2E, screenshot visual regression.
- **Coverage:** 80% domain, 60% services, 40% UI critical.
- **Other:** No Cypress (Playwright better for Electron).

---

## ADR-007: Packaging Strategy — electron-builder NSIS + Auto-Updater

- **Decision:** electron-builder with NSIS target, per-machine and per-user options, code signing, auto-updater via GitHub releases or S3.
- **Why:** Mature, widely used, supports Windows installer custom steps, auto-updater via electron-updater.
- **Installer:** Installs to `%ProgramFiles%/MERQO RetailOS`, user data to `%APPDATA%/MERQO RetailOS/`, Start Menu shortcut, uninstaller.
- **Single Instance:** `app.requestSingleInstanceLock()`.
- **Code Signing:** Windows certificate to avoid SmartScreen.

---

## ADR-008: Printer Strategy — Windows Spooler + ESC/POS + PDF

- **Decision:** Abstraction `IPrinter` with implementations: `WindowsSpoolerPrinter` (via `webContents.print()`), `EscPosPrinter` (via `node-thermal-printer`), `PdfPrinter` (via `pdf-lib`/`printToPDF`).
- **Why:** Need A4, 80mm, 58mm, USB, Bluetooth, Network, PDF. No single library covers all.
- **Bengali Rendering:** For spooler, HTML with Noto Sans Bengali works. For ESC/POS direct, render receipt as image via hidden BrowserWindow + `capturePage()` then `printImage` — ensures Bengali correct on cheap printers.
- **Templates:** React components for each paper size, preview modal.
- **Cash Drawer:** ESC/POS kick command via printer.

---

## ADR-009: Scanner Strategy — HID Timing Heuristic

- **Decision:** Global keydown listener with timing heuristic (fast burst <50ms interval, length >=6, ends with Enter or timeout 100ms) to distinguish scanner from human typing. No paid APIs, no `node-hid` for V1.
- **Why:** 95% of BD scanners are HID keyboard emulation, works for USB/Bluetooth/Wireless dongle. Simple, no drivers.
- **Routing:** Emit `barcode:scanned` event, POS subscribes, lookup local DB.
- **Configurable:** Min length, suffix, timeout, test area in settings.

---

## ADR-010: Backup Strategy — File Copy + Integrity Check + Retention

- **Decision:** Manual backup (copy DB after checkpoint), auto backup daily, keep 7, validation via `PRAGMA integrity_check`, checksum, history table, restore with safety backup, failure recovery.
- **Why:** SQLite file copy is safe after checkpoint. Need validation and safety.
- **Location:** `%APPDATA%/MERQO/backups/` + user-chosen.
- **Restore:** Requires owner permission + password re-entry, creates safety backup before restore, validates backup file.
- **No Cloud for V1:** Local only, future optional cloud.

---

## ADR-011: Security Strategy — argon2id + RBAC Service-Layer + Immutable Audit

- **Decision:** Password hashing argon2id (fallback bcrypt), PIN hashing same, session in RAM, RBAC 60+ granular permissions enforced in service layer, immutable audit_logs with before/after, no plaintext secrets, Electron security best practices (contextIsolation, sandbox, CSP, allowlisted IPC).
- **Why:** Security critical for financial data. Service-layer enforcement prevents UI bypass. Immutable audit for accountability.
- **Session:** Single user at a time, timeout 30 min, auto-lock.

---

## ADR-012: Localization Strategy — Bangla-First i18next Keys

- **Decision:** i18next + react-i18next, translation files `locales/bn/*.json` default, `en/*.json` future, all UI text via `t('key')`, no hard-coded strings, lint rule to enforce, professional natural Bangla, numbers English digits, font Noto Sans Bengali + Inter.
- **Why:** Bangla-first for BD market, but architecture ready for English. Keys prevent hard-coded text.
- **Font:** Bundle woff2 offline, no CDN.

---

## ADR-013: Money Handling — Integer Paisa

- **Decision:** Store all money as INTEGER paisa (BDT*100) in BIGINT, never FLOAT. Domain `Money` value object with bigint arithmetic, formatting separate.
- **Why:** Avoid floating-point errors for financial calculations. Common practice for retail.

---

## ADR-014: Inventory Costing — WAC for V1

- **Decision:** Weighted Average Cost for V1, formula (old_qty*old_wac + new_qty*new_cost)/(old_qty+new_qty), stored in `products.cost_price_paisa`, history in `product_cost_history`.
- **Why:** Simple, stable, accurate for high-volume retail, matches Loyverse/Lightspeed default. FIFO more complex, needs batch tracking, future-ready via schema.

---

## ADR-015: Ledger Principles — Never Mutate Totals

- **Decision:** All balances derived from immutable ledger tables (stock_movements, customer_transactions, supplier_transactions, cash_movements, bank_transactions, mfs_transactions). Cached columns updated only inside same transaction that inserts ledger row. Reversals via new opposite rows, never UPDATE/DELETE historical.
- **Why:** Prevent financial inconsistencies, audit trail, correct profit.

---

## ADR-016: POS Keyboard-First

- **Decision:** POS fully operable via keyboard, shortcuts F2-F10, configurable, focus management, no mouse required.
- **Why:** Speed for cashiers, industry standard.

---

## ADR-017: MFS as Local Bookkeeping

- **Decision:** MFS module local bookkeeping without paid APIs, manual entry of cash in/out, charge, commission, ref, operator, agent balance derived from ledger, integration with cash movements.
- **Why:** No free APIs available, Bangladeshi shops need bookkeeping for agent business.

---

## ADR-018: Light Mode Only

- **Decision:** Light mode only for V1, no dark mode, design tokens for light.
- **Why:** Simpler, professional, retail POS typically light, focus on premium light design.

---

## ADR-019: No Fake Data

- **Decision:** First-run empty, onboarding wizard creates business + owner + cash account + seed data (units, categories, expense categories, MFS providers, roles/permissions). No demo products, no placeholder analytics.
- **Why:** Professional, clean, avoids confusion.

---

## ADR-020: Error Handling — Polished Bangla + Correlation ID

- **Decision:** User never sees raw technical errors, shows professional Bangla message + support code (correlation ID), technical details logged to file with pino.
- **Why:** UX, security, supportability.
