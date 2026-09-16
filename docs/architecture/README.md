# MERQO RetailOS — Architecture Blueprint (Phase 0)

> **Status:** Phase 0 — Architecture Complete, Implementation Not Started
> **Target:** Windows Desktop Only (x64)
> **Language:** Bangla-first, Professional Polished
> **Brand:** MERQO — support: merqoonline@gmail.com
> **Theme:** Light Mode Only
> **Date:** 2026-09-16

---

## 1. Purpose of This Document Set

This directory contains the **production-grade architecture blueprint** for MERQO RetailOS. No UI code, fake data, or placeholder screens were created in this phase. The goal is to freeze decisions on:

- Application layers and module boundaries
- Technology stack with justification
- Complete relational data model and ledger integrity
- Domain engines (inventory, cost/profit, POS, MFS, accounting)
- Hardware abstraction (barcode, printers)
- Security, audit, backup/restore
- UI/UX design system
- Testing, quality gates, roadmap, risks

All future implementation (Phase 1+) **must conform** to these documents. Any deviation requires an ADR (Architecture Decision Record) update.

---

## 2. Product Vision (Condensed)

MERQO RetailOS is a **commercial-grade, offline-first, Windows desktop retail management system** for:

- Super Shops, Grocery Shops, Retail Shops, Mini Marts, General Stores

It must handle end-to-end retail: product catalog with units and conversions, inventory ledger, purchasing, sales via keyboard-first POS with barcode, customers/suppliers with due ledgers, cash/bank/MFS bookkeeping, expenses, profit engine, shift & cash drawer, roles/permissions, audit, reports, printing (A4/80mm/58mm/PDF), backup/restore, import/export.

**Non-Goals for V1:**

- Cloud sync / multi-device sync
- E-commerce integration
- Paid external APIs for MFS
- Mobile app
- Dark mode

---

## 3. Architecture Documents Index

| Document | Covers | Key Decisions |
|----------|--------|---------------|
| [system-architecture.md](./system-architecture.md) | §1 Product Architecture, §2 Tech Stack, §31 Module Dependency Map, layers communication | Electron + React + TS, layered architecture, dependency graph |
| [database-architecture.md](./database-architecture.md) | §3 DB Architecture, §3.1 Financial Integrity, §4 Inventory Engine, §5 Cost/Profit, §10 Accounting Flow, §11 Customer Ledger, §12 Supplier Ledger, §13 Expense, §14 Shift | 45+ entities, ledger principles, WAC strategy, money as integer paisa |
| [business-rules.md](./business-rules.md) | §6 POS, §9 MFS, §10 Cash/Bank/MFS Flow, §11-14 Ledgers, §18 Reports, §19 Dashboard, §26 Error Handling, §27 Import/Export, §28 First-Run | Keyboard-first POS, split payments, MFS bookkeeping without APIs, import pipeline |
| [security.md](./security.md) | §15 Roles/Permissions, §16 Audit Log, §25 Security | Granular RBAC, service-layer enforcement, argon2id, immutable audit |
| [hardware.md](./hardware.md) | §7 Barcode, §8 Printing | HID abstraction, ESC/POS, Windows spooler, Bengali rendering |
| [ui-ux-design-system.md](./ui-ux-design-system.md) | §20 Design System, §21 Responsive Desktop, §22 Accessibility, §23 Localization | Tokens, Bangla font (Noto/Hind Siliguri), 1280x720 minimum, light-only |
| [testing-strategy.md](./testing-strategy.md) | §24 Performance, §33 Test Strategy, §34 Quality Gates | Targets, unit/integration/E2E/printer/barcode/backup tests |
| [feature-gap-analysis.md](./feature-gap-analysis.md) | §29 Competitor Benchmark, §30 Feature Gap | Loyverse/Shopify/Lightspeed/Odoo analysis, V1 required vs future |
| [implementation-roadmap.md](./implementation-roadmap.md) | §32 Roadmap, §35 GitHub Structure, §36 Documentation Plan, §38 Risks, §39 Final Recommendation | 19 phases, structure, risks/mitigations |
| [technical-decisions.md](./technical-decisions.md) | §37 Final Technical Decisions | Concise ADR |

---

## 4. Core Architectural Principles

1. **Offline-First, Local-First:** No internet required. SQLite file in user data. All operations transactional.
2. **Ledger, Not Mutable Totals:** Financial and stock balances are **derived** from immutable movement tables. Never `UPDATE balance = balance + X`. Always insert movement + recalc or maintain via transaction.
3. **Money = Integer Paisa:** Store `amount_paisa BIGINT` (BDT * 100). No FLOAT. Use `Decimal` or integer arithmetic in domain layer. Display formatting separate.
4. **Service Layer Enforcement:** Authorization, validation, business rules live in services, not UI. UI calls IPC → Service → Repository → DB.
5. **Keyboard-First POS:** Every POS action has shortcut. Scanner input never requires focus hack.
6. **Bangla-First i18n:** All strings via `t('key')`. No hard-coded Bangla/English in components.
7. **No Fake Data:** First-run is empty. Onboarding creates Business + Owner + Cash account.
8. **Professional Errors:** User sees polished Bangla message. Technical details go to `logs/app.log` with correlation ID.
9. **Immutable Audit:** Every state-changing operation writes audit log in same transaction.
10. **Hardware Abstraction:** Barcode and printer behind interfaces. UI never talks directly to hardware.

---

## 5. High-Level Layer Diagram (Text)

```
┌─────────────────────────────────────────────────┐
│ UI Layer (React + TS + Tailwind + Radix)        │
│  - Screens: POS, Products, Sales, Dashboard...  │
│  - Components: Design System                    │
│  - i18n: Bangla keys                            │
│  - State: Zustand (UI), TanStack Query (server) │
└──────────────────┬──────────────────────────────┘
                   │ IPC (Electron ipcMain.handle)
┌──────────────────▼──────────────────────────────┐
│ Application Layer (Services)                    │
│  - ProductService, InventoryService             │
│  - SaleService, PurchaseService                 │
│  - CustomerLedgerService, SupplierLedgerService │
│  - Cash/Bank/MFS Services                       │
│  - AuthService, PermissionService               │
│  - ReportService, PrintService                  │
│  - BackupService, ImportService                 │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│ Domain / Business Rules Layer (Pure TS)         │
│  - Money, UnitConversion, StockLedger           │
│  - COGS calculators, Validators                 │
│  - No DB, No Electron deps                      │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│ Data Access Layer                               │
│  - Drizzle ORM + better-sqlite3                 │
│  - Repositories, Migrations, Transactions       │
│  - Ledger queries, Aggregates                   │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│ Infrastructure Layer                            │
│  - Hardware: Barcode HAL, Printer HAL           │
│  - Config, Logging (pino), Backup, Security     │
│  - File system, PDF (pdf-lib), Excel (exceljs)  │
└─────────────────────────────────────────────────┘
```

Cross-cutting: **AuthZ Layer** intercepts all service calls; **Audit Layer** wraps transactions; **Logging Layer** structured logs.

---

## 6. Glossary

- **HAL:** Hardware Abstraction Layer
- **WAC:** Weighted Average Cost
- **COGS:** Cost of Goods Sold
- **MFS:** Mobile Financial Service (bKash, Nagad, Rocket, Upay)
- **Paisa:** Smallest BDT unit (1 BDT = 100 paisa) — canonical storage
- **Stock Ledger:** Immutable stock movement table
- **Due:** Customer receivable (বকেয়া)
- **Payable:** Supplier payable (পাওনা)
- **Shift:** Cashier work period with opening/closing cash

---

## 7. How to Read & Implement

1. Read `system-architecture.md` → understand layers and tech stack.
2. Read `database-architecture.md` → understand entities and ledger invariants.
3. Read `business-rules.md` → understand POS, MFS, accounting flows.
4. Read `security.md` + `hardware.md` → authZ and hardware.
5. Read `ui-ux-design-system.md` → tokens before building any component.
6. Read `testing-strategy.md` → know quality gates.
7. Follow `implementation-roadmap.md` phase by phase. Do not skip.

**Do NOT start Phase 1 until this blueprint is reviewed and approved.**

---

## 8. Final Recommendation Summary (for executives)

- **Framework:** Electron + React + TypeScript + Tailwind + Radix + Zustand
- **DB:** SQLite via better-sqlite3 + Drizzle ORM, integer paisa, WAL mode
- **Costing:** Weighted Average Cost (WAC) for V1 — simple, accurate for retail
- **Printing:** Windows spooler + ESC/POS direct for thermal + PDF via pdf-lib
- **Barcode:** Global HID listener with timing heuristic, no paid APIs
- **MFS:** Local bookkeeping ledger, no external APIs
- **Packaging:** electron-builder NSIS, auto-updater, code-signed
- **Security:** argon2id + PIN, RBAC in service layer, immutable audit
- **i18n:** Bangla-first with i18next, keys everywhere
- **Testing:** Vitest + Playwright + visual regression

This architecture is optimized for **Windows reliability, printer/Bluetooth compatibility, offline capability, maintainability, and long-term commercial support** in Bangladesh retail context.

---

## 9. Next Step

Review all documents for contradictions. Once approved, proceed to **Phase 1 — Foundation** as per roadmap.
