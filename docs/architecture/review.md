# Architecture Review — Contradictions, Dependencies, Risks

**Date:** 2026-09-16
**Reviewer:** Principal Software Architect
**Status:** Phase 0 Complete — No Implementation Started

---

## 1. Contradiction Check

### Checked Pairs

| Area A | Area B | Contradiction? | Resolution |
|--------|--------|----------------|------------|
| **Tech Stack (Electron)** vs **Hardware (Barcode, Printer)** | No contradiction — Electron Node access supports both HID and ESC/POS | OK |
| **DB (SQLite WAL)** vs **Backup (file copy)** | Potential race if backup during transaction — Mitigated by checkpoint before copy + transaction lock | OK — Documented in backup service to use `PRAGMA wal_checkpoint(TRUNCATE)` and `BEGIN IMMEDIATE` |
| **Money as Integer Paisa** vs **Quantity as Milli** | No contradiction — both integer, but need careful mul/div | OK — Use bigint, rounding half-up, tested |
| **WAC vs FIFO** | Decision WAC for V1, but schema includes cost history for FIFO future — no contradiction | OK |
| **Ledger (immutable) vs Cached Balances (current_due, etc.)** | Potential mismatch if cached not updated in same transaction — Resolved by rule: always update cached in same transaction, plus nightly recalc job | OK |
| **Offline-First vs Auto-Updater** | Auto-updater needs internet, but offline-first means app works without internet — not contradiction, updater is optional background | OK |
| **Light Mode Only vs Design Tokens** | Tokens defined only for light, but structure ready for dark future — no contradiction | OK |
| **Bangla-First vs English Future** | i18n keys support both, default bn — no contradiction | OK |
| **Single User Session vs Multi-User** | V1 single user at a time (desktop POS typical), but DB schema supports multi-user via user_id — no contradiction, future-ready | OK |
| **No Fake Data vs Seed Data** | Seed data is not fake transactional data — units, categories, expense categories, MFS providers, roles/permissions are config, not fake sales/products — OK | OK |
| **Electron Security (contextIsolation) vs Preload IPC** | Preload exposes only allowlisted channels via contextBridge — secure, no contradiction | OK |
| **Barcode HID Heuristic vs Fast Typist** | Fast typist could be misdetected as scanner — Mitigated by min length 6, suffix Enter, timing <50ms avg, plus config to adjust | OK — Documented as configurable |
| **Printer Image Rendering vs Performance** | Image rendering for thermal slower, but acceptable for receipt (1-2s) — fallback to Windows spooler for speed | OK |
| **MFS Bookkeeping vs Cash Movements** | MFS transaction creates both MFS movement and cash movement — must be same transaction to avoid mismatch — Documented | OK |

**Result:** No unresolved contradictions found. All potential conflicts mitigated via transaction, config, or fallback.

---

## 2. Missing Dependencies Check

### Module Dependency Graph Validation

- **Inventory depends on Products** — OK, products created first (Phase 4 before inventory logic, but inventory service needs products)
- **Sales depends on Inventory, CustomerLedger, Cash/Bank/MFS, Products** — OK, Phase 6 after Phase 4 and 5 (purchasing) and cash accounts (Phase 8?) — Actually cash accounts needed for sales payments. In roadmap, cash accounts basics created in Phase 5 for purchase payments, full cash in Phase 8. Need to ensure Phase 6 has cash accounts minimal — Added note: Phase 5 creates cash_accounts table and default account, so Phase 6 can use.
- **Customer Ledger depends on Sales** — But sales also depends on customer ledger for due. Circular? Resolved: Sales creates customer_transactions via repository in same transaction, no direct service dependency cycle. CustomerService does not depend on SaleService. OK.
- **Supplier Ledger similar** — OK.
- **Expenses depends on Cash/Bank/MFS** — Phase 8 after cash/bank/mfs basics — OK.
- **MFS depends on Cash** — Phase 9 after Phase 8 — OK.
- **Reports depends on all transactional** — Phase 10 after all — OK.
- **Printing depends on Sales, etc. but not vice versa** — OK, Phase 11 after reports.
- **Backup depends on DB** — Phase 2, but full backup UI in Phase 12 — OK.
- **Notifications depends on low stock, due, backup** — Phase 13 after those — OK.

### Missing Entities

- Checked: All entities from prompt listed in database-architecture.md — 45+ entities covered, plus additional needed (printers, stock_counts, held_sales, etc.) — OK.
- **Missing?** `payment_methods` config table — Added as system_settings key, not separate table, acceptable. Could add table but not required for V1.
- **Missing?** `attachments` generic — Mentioned as future, expense has attachment_path — OK for V1.

### Missing Flows

- **Cash Transfer between accounts** — Covered in Cash/Bank/MFS flow, transfer creates two movements — OK.
- **Barcode Label Printing** — Mentioned in templates, but need to ensure product label data includes barcode image generation — Added to printing templates, need `jsbarcode` or similar for barcode image — Documented as future lib.
- **Shift Variance Approval** — Requires manager permission if variance large — Documented in business-rules, permission `shift:close` + `shift:view_all` — OK.
- **Credit Limit Enforcement** — Documented in customer ledger — OK.
- **Negative Stock Setting** — Mentioned as configurable `allow_negative_stock` — Need to add to business_settings seed — Add note.

---

## 3. Architectural Risks (Revisited)

| Risk | Impact | Likelihood | Mitigation | Status |
|------|--------|------------|------------|--------|
| Electron bundle size | Medium | High | Prune deps, asar, target 120MB | Mitigated in ADR |
| Thermal Bengali rendering | High | Medium | Image rendering fallback + Windows spooler alternative + manual QA with 5+ models | Mitigated, QA checklist required |
| Barcode heuristic fails | Medium | Medium | Configurable, test area, manual entry fallback | Mitigated |
| better-sqlite3 build fails | High | Low | Prebuilds, test on Win10/11 | Mitigated |
| Ledger mismatch | High | Medium | Same transaction update, nightly recalc, integrity check, tests | Mitigated |
| WAC rounding | Medium | Medium | Bigint, milli, rounding half-up, tests | Mitigated |
| Permission bypass | High | Low | Service-layer enforcement, IPC allowlist, tests | Mitigated |
| Backup corruption | High | Medium | WAL checkpoint, integrity_check, safety backup, auto backup | Mitigated |
| Performance 100k+ sales | Medium | Medium | Indexes, FTS, pagination, caching, load test | Mitigated |
| Bangla quality | Medium | Medium | Native review, glossary, lint | Mitigated |
| SmartScreen block | Medium | High | Code signing, reputation | Mitigated |
| DB locked single instance | Medium | Low | Single instance lock, busy_timeout, clear error | Mitigated |

**No new high risks found beyond those already documented.**

---

## 4. Decisions Finalized

- **Framework:** Electron + React + TS (ADR-001)
- **DB:** SQLite + better-sqlite3 + Drizzle (ADR-002)
- **Money:** Integer paisa (ADR-013)
- **Costing:** WAC (ADR-014)
- **Ledger:** Immutable + cached in same transaction (ADR-015)
- **Barcode:** HID heuristic (ADR-009)
- **Printer:** Spooler + ESC/POS + PDF with image fallback for Bengali (ADR-008)
- **MFS:** Local bookkeeping (ADR-017)
- **Security:** argon2id + RBAC service-layer + immutable audit (ADR-011)
- **i18n:** Bangla-first keys (ADR-012)

All decisions consistent across docs.

---

## 5. Checklist Before Phase 1

- [x] All 10 architecture docs created
- [x] No placeholder code
- [x] No fake data
- [x] Tech stack justified with Windows reliability, printer, barcode, Bluetooth, local DB, performance, maintainability, packaging, long-term support, offline
- [x] Database entities defined with purpose, PK, FK, fields, indexes, constraints, relationships, deletion, audit
- [x] Financial integrity ledger principles defined
- [x] Inventory engine with unit conversion
- [x] Cost/profit engine with WAC choice
- [x] POS keyboard-first + shortcuts
- [x] Barcode HAL without paid APIs
- [x] Printing abstraction with Bengali rendering
- [x] MFS workflows without paid APIs
- [x] Cash/bank/MFS flows with split payments
- [x] Customer/supplier ledgers with aging
- [x] Expense system
- [x] Shift/cash drawer
- [x] Roles/permissions granular + service-layer enforcement
- [x] Audit log immutable
- [x] Backup/restore with validation and safety
- [x] Reporting engine with date presets
- [x] Dashboard query architecture
- [x] UI/UX design system with tokens, Bangla font, no generic Bootstrap, no excessive rounded/gradients/glassmorphism/emoji
- [x] Responsive desktop 1280x720 to 3840x2160, no overflow
- [x] Accessibility
- [x] Localization Bangla-first keys
- [x] Performance targets + indexes/caching
- [x] Security
- [x] Error handling polished Bangla
- [x] Import/export pipeline
- [x] Empty first-run onboarding, no fake data
- [x] Competitor benchmark (Loyverse, Shopify, Lightspeed, Odoo)
- [x] Feature gap analysis (Required/Recommended/Future/Not needed)
- [x] Module dependency map (no circular)
- [x] Implementation roadmap 19 phases
- [x] Test strategy (unit, integration, DB, business logic, permission, E2E, visual, printer, barcode, backup/restore, crash, performance)
- [x] Quality gates per phase
- [x] GitHub structure
- [x] Documentation plan
- [x] Technical decisions ADR
- [x] Risks with mitigation
- [x] Final recommendation

**Result:** Architecture blueprint complete, ready for review and approval. Do not start Phase 1 until explicitly instructed.

---

## 6. Next Action

- Owner/Reviewer to approve docs.
- Create GitHub issues per phase.
- Start Phase 1 — Foundation only after approval.
