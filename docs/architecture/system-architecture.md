# System Architecture — MERQO RetailOS

## 1. Product Architecture — Layers

### 1.1 Layer Definitions

#### A. Presentation / UI Layer
- **Tech:** React 18 + TypeScript 5, Vite, TailwindCSS, Radix UI primitives, Lucide icons, Recharts.
- **Responsibility:** Render screens, handle user input, keyboard shortcuts, i18n keys, optimistic UI.
- **State:** 
  - Local UI state: Zustand stores (POS cart, filters, modals).
  - Server state: TanStack Query v5 caching service calls via IPC.
- **Rules:**
  - No direct DB access.
  - No business rule calculations.
  - No hardcoded strings — `useTranslation()` everywhere.
  - Components pure, props typed.

#### B. Application / Service Layer (Main Process)
- **Location:** Electron main process (`src/main/services/*`)
- **Responsibility:** Orchestrate domain logic, enforce permissions, wrap transactions, write audit logs.
- **Pattern:** Each service exposes methods via `ipcMain.handle('service:method', ...)`. Renderer calls via typed IPC bridge (`window.merqo.service.method()`).
- **Services List:**
  - `AuthService`, `UserService`, `RoleService`, `PermissionService`
  - `BusinessService`, `SettingsService`
  - `ProductService`, `CategoryService`, `BrandService`, `UnitService`
  - `InventoryService` (stock ledger)
  - `PurchaseService`, `SupplierService`, `SupplierLedgerService`
  - `SaleService`, `ReturnService`, `CustomerService`, `CustomerLedgerService`
  - `ExpenseService`, `CashService`, `BankService`, `MFSService`
  - `ShiftService`, `DashboardService`, `ReportService`
  - `PrintService`, `HardwareService`, `BackupService`, `ImportExportService`, `NotificationService`, `AuditService`

#### C. Domain / Business Rules Layer (Pure)
- **Location:** `src/core/domain/*` — zero Electron/DB dependencies.
- **Responsibility:** Pure functions & value objects.
- **Examples:**
  - `Money` value object: `paisa: bigint`, add/sub/mul, formatting.
  - `UnitConversion` — `convert(qty, fromUnit, toUnit)` using graph.
  - `StockLedger` — `applyMovement(current, movement)` returns new level.
  - `WACCalculator` — weighted average cost recalculation.
  - `SaleCalculator` — line totals, discounts, tax, due.
  - `Ledger` — customer/supplier balance derivation.
  - `Validators` — Zod schemas.
- **Testable without DB.**

#### D. Data Access Layer
- **Tech:** `better-sqlite3` (sync, fast) + `Drizzle ORM` (type-safe, migrations).
- **Location:** `src/main/db/*`
  - `schema/` — Drizzle tables
  - `migrations/` — SQL migrations
  - `repositories/` — thin wrappers
  - `connection.ts` — singleton, WAL mode, foreign_keys ON, busy_timeout 5s
- **Rules:**
  - All writes inside `db.transaction()` (better-sqlite3 transaction).
  - Repositories don't enforce permissions — services do.
  - Queries for reports use raw SQL views for performance.

#### E. Hardware Abstraction Layer (HAL)
- **Barcode HAL:** `BarcodeScannerService`
  - Listens global keydown, distinguishes scanner (fast burst 30-80ms, suffix Enter) vs human typing.
  - Supports USB HID, Bluetooth HID, wireless dongle (all HID keyboard emulation).
  - Emits `barcode:scanned` event with code.
- **Printer HAL:** `PrinterService`
  - `IPrinter` interface: `print(job)`, `getStatus()`, `test()`
  - Implementations: `WindowsSpoolerPrinter` (A4 via Electron print), `EscPosPrinter` (thermal via `node-thermal-printer` or direct USB), `PdfPrinter` (pdf-lib).
  - Templates: Handlebars-like but typed React components rendered to HTML/PDF.
- **Diagnostics:** `HardwareDiagnosticsService` — list printers, test barcode, test drawer kick.

#### F. Reporting Layer
- **Engine:** `ReportService` builds queries with filters (date range presets) → returns typed rows + aggregates.
- **No hard-coded SQL in UI.** Reports defined as objects: `{ id, nameKey, queryBuilder, columns, exportable }`.
- **Caching:** Dashboard queries cached 30s in main process.

#### G. Authorization Layer
- **Location:** Middleware wrapping service methods.
- **Pattern:** `requirePermission(user, 'product:create')` throws `AuthorizationError`.
- **Roles:** Owner (all), Manager, Cashier, Stock Keeper, Accountant — plus custom.
- **Permissions:** ~60 granular permissions (see security.md).
- **Enforcement:** Service layer, not UI. UI hides but service still checks.

#### H. Backup Layer
- **Service:** `BackupService`
- **Methods:** manual backup (copy SQLite file after checkpoint), auto backup (daily, keep 7), validation (sqlite integrity_check), restore with safe copy.
- **Location:** `%APPDATA%/MERQO/backups/` + user-chosen location.

#### I. Configuration Layer
- **Files:** `system_settings` table + `config.json` in userData for window size, printer defaults.
- **Business settings:** `business_settings` table (receipt footer, low stock threshold, etc.)

#### J. Logging Layer
- **Tech:** `pino` + `pino-roll` file transport, `electron-log` for main/renderer bridge.
- **Levels:** debug (dev), info, warn, error.
- **Files:** `logs/app-YYYY-MM-DD.log`, max 10MB * 7 files.
- **Sensitive:** No passwords, no full card numbers. Correlation ID per IPC call.

### 1.2 Layer Communication

```
Renderer (React)
  │  window.merqo.invoke('sale:create', payload) — typed, via contextBridge
  ▼
Preload (contextBridge) — validates channel allowlist
  │  ipcRenderer.invoke
  ▼
Main IPC Handler
  │  1. AuthZ check (get current user from session)
  │  2. Zod validation
  │  3. Call Service method inside db.transaction
  │  4. Service → Domain pure logic → Repository → DB
  │  5. Write AuditLog in same transaction
  │  6. Log structured
  ▼
Response → Renderer → TanStack Query cache update → UI re-render
```

- **Hardware events:** Main process listens barcode → emits `barcode:scanned` via `webContents.send()` → Renderer POS subscribes.
- **Printing:** Renderer requests print preview HTML → Main renders PDF or sends to printer.

**Avoid Tight Coupling:**
- Domain layer has zero imports from DB/Electron.
- Services depend on repository interfaces, not concrete better-sqlite3.
- UI depends on IPC contract, not services directly.
- Hardware behind interfaces.

---

## 2. Technology Stack — Evaluation & Selection

### 2.1 Candidates

| Criteria | Electron + React + TS | Tauri + React + TS | .NET WPF / WinUI 3 | Flutter Windows |
|----------|----------------------|--------------------|--------------------|-----------------|
| **Windows Reliability** | ★★★★★ Mature, 10+ years, used by VS Code, Slack | ★★★☆☆ Young, Tauri v2 stable but fewer large POS apps | ★★★★★ Native, best Windows integration | ★★★☆☆ Windows support beta-ish, larger apps rare |
| **Printer Compatibility** | ★★★★★ Node `node-thermal-printer`, `escpos`, Windows spooler via Electron print API | ★★☆☆☆ Need Rust crates, ESC/POS immature, spooler via webview print | ★★★★★ Direct Win32 printing, POS for .NET | ★★★☆☆ Plugin ecosystem small |
| **Barcode Scanner** | ★★★★★ HID keyboard just works, Node hid, global shortcut | ★★★★☆ HID works, but global listener needs Rust | ★★★★★ Raw Input API | ★★★☆☆ |
| **Bluetooth** | ★★★★☆ `noble` / Web Bluetooth via Electron | ★★☆☆☆ Rust bluetooth plugins experimental | ★★★★★ Windows.Devices.Bluetooth | ★★☆☆☆ |
| **Local DB Support** | ★★★★★ better-sqlite3 fastest, mature | ★★★☆☆ Tauri SQL plugin, but sync API, less mature | ★★★★★ SQLite via Microsoft.Data.Sqlite | ★★★☆☆ sqflite |
| **Performance** | ★★★☆☆ Memory 150-300MB, startup 1-3s | ★★★★★ 10MB binary, low memory | ★★★★☆ Fast, but cold start | ★★★★☆ |
| **Maintainability** | ★★★★★ Huge TS/React talent pool in BD, easy hiring | ★★★☆☆ Need Rust + TS, hiring hard | ★★★☆☆ C# talent okay, but UI modernization slower | ★★☆☆☆ Dart talent limited |
| **Packaging** | ★★★★★ electron-builder NSIS, autoUpdater, code sign mature | ★★★★☆ Tauri bundler good, autoUpdater exists | ★★★★★ MSIX, ClickOnce | ★★★☆☆ |
| **Long-term Support** | ★★★★★ Electron backed by OpenJS, large community | ★★★☆☆ Community-driven, promising but risk | ★★★★★ Microsoft | ★★★☆☆ Google, but desktop not priority |
| **Offline** | ★★★★★ Fully offline | ★★★★★ Fully offline | ★★★★★ Fully offline | ★★★★★ |

### 2.2 Decision

**Selected: Electron + React + TypeScript**

**Justification:**

1. **Windows reliability & printer:** Bangladeshi retail needs 58mm/80mm thermal printers (often cheap Chinese ESC/POS) + A4 laser. Electron's Node access allows direct ESC/POS commands (`node-thermal-printer` supports 200+ models) and also Windows spooler printing via `webContents.print()`. Tauri's Rust ESC/POS crates are incomplete and would require custom Rust development — risk for V1.

2. **Barcode scanner compatibility:** 95% of scanners in BD market are USB HID keyboard emulation. Electron can listen globally with timing heuristic without extra drivers. Works for Bluetooth HID too. Tauri would need Rust global keyboard hook.

3. **Bluetooth device compatibility:** For Bluetooth printers, Electron can use `node-bluetooth` or Web Bluetooth. Tauri Bluetooth plugins are still experimental (as of 2024).

4. **Local DB support:** `better-sqlite3` is synchronous, fastest SQLite driver, with transaction support crucial for financial integrity. Drizzle ORM gives type safety. Tauri's SQL plugin is async and less battle-tested for complex ledger transactions.

5. **Performance:** Acceptable. POS needs <100ms barcode lookup — achievable with SQLite index + better-sqlite3. Startup target 2.5s (see testing-strategy). Memory 200MB okay for Windows 8GB+ machines common in shops. Tauri lighter but not critical.

6. **Maintainability:** Bangladesh has large React/Node talent pool. Finding Electron devs easier than Rust. Long-term commercial support easier.

7. **Packaging:** electron-builder NSIS with custom installer, auto-updater via GitHub releases or S3, code signing for SmartScreen.

8. **Offline capability:** 100% offline. No cloud dependency.

**Mitigation for Electron downsides:**
- Bundle size: Use `electron-builder` with `asar`, prune deps, target ~120MB installer.
- Memory: Disable unused Electron features, single window, lazy load reports.
- Security: `contextIsolation: true`, `nodeIntegration: false`, preload only allowlisted channels, CSP.

**Future-proofing:** Keep domain layer pure TS, no Electron imports. If later Tauri becomes more mature for hardware, domain can be reused.

### 2.3 Full Stack Details

- **Framework:** Electron 30+, React 18, TypeScript 5.5, Vite 5
- **UI:** TailwindCSS 3.4, Radix UI, Lucide React, shadcn patterns (but custom tokens), Recharts for dashboard
- **State:** Zustand 4 for UI, TanStack Query 5 for server state
- **DB:** SQLite 3 + better-sqlite3 9 + Drizzle ORM 0.33 + drizzle-kit migrations
- **Validation:** Zod 3
- **i18n:** i18next + react-i18next, Bangla-first JSON
- **Logging:** pino + electron-log
- **Printing:** `node-thermal-printer` 4.x + Electron `webContents.print()` + `pdf-lib` for PDF
- **Barcode:** Custom HID listener (no external lib) + optional `node-hid` for advanced
- **Export:** `exceljs` for Excel, `pdf-lib` for PDF, `csv-stringify`
- **Security:** `argon2` (or `bcrypt` fallback for Windows build issues), `nanoid` for IDs
- **Testing:** Vitest, Playwright, @testing-library/react
- **Packaging:** electron-builder, NSIS, Windows code signing
- **Lint/Format:** ESLint + Prettier + TypeScript strict

---

## 3. Module Dependency Map

```
Level 0 (No dependencies):
- Domain: Money, UnitConversion, Validators, Errors
- Infrastructure: Config, Logging

Level 1 (Depends on Level 0):
- DB Connection, Schema
- Hardware HAL interfaces
- i18n

Level 2:
- Repositories (depends DB + Domain)
- Auth (depends DB + Security)

Level 3 (Core business):
- Business, Settings
- Users, Roles, Permissions
- Products, Categories, Brands, Units
- InventoryService (depends Products + StockMovements)

Level 4 (Transactional):
- Suppliers, SupplierLedger
- Customers, CustomerLedger
- Purchases, PurchaseReturns
- Cash, Bank, MFS

Level 5 (Sales):
- Sales, SaleReturns (depends Inventory + CustomerLedger + Cash/Bank/MFS + Products)

Level 6 (Finance):
- Expenses (depends Cash/Bank/MFS)
- COGS/Profit Engine (depends Sales + Purchases + Expenses + Inventory)
- Shifts (depends Cash + Sales + Auth)

Level 7 (Reporting & Presentation):
- Dashboard (depends all transactional)
- Reports (depends all)
- Printing (depends Sales, Purchases, etc.)
- Backup, Import/Export

Level 8 (UI):
- All screens depend on Services via IPC, but never directly on DB.

Circular dependencies FORBIDDEN. Enforced via ESLint import rules.
```

**Key Dependency Rules:**
- Inventory never depends on Sales directly — Sales calls InventoryService.
- CustomerLedger never depends on SaleService — SaleService writes to ledger via repository transaction.
- Reports depend on repositories read-only, never services write.
- Hardware never depends on domain — only emits events.

---

## 4. Deployment Architecture (Windows)

- **Installer:** NSIS, per-machine or per-user, installs to `%ProgramFiles%/MERQO RetailOS`
- **User Data:** `%APPDATA%/MERQO RetailOS/` → `merqo.db`, `backups/`, `logs/`, `config.json`, `printer-profiles.json`
- **First Run:** If no DB, run onboarding wizard → create business + owner + default cash account + default roles.
- **Updates:** electron-updater checks GitHub releases (or S3) on startup, download in background, install on quit.
- **No Admin required for daily use**, only for install.
- **Single instance lock:** `app.requestSingleInstanceLock()`

---

## 5. Error & Observability

- All IPC handlers wrapped with `withErrorHandling` → catches domain errors → returns `{ ok: false, code, message_bn, correlationId }`
- Renderer shows `message_bn` via toast, logs correlationId for support.
- Logs include: timestamp, level, correlationId, userId, action, duration.

---

## 6. Open Questions Resolved

- **Why not Tauri?** Hardware maturity + hiring risk for V1. Re-evaluate in 18 months.
- **Why not WPF?** Want modern React design system, faster iteration, Bangla web font rendering better.
- **Why Drizzle not Prisma?** Prisma's Rust engine adds size, better-sqlite3 driver not as mature, Drizzle is lighter and SQL-close.
