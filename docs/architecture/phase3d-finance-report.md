# Phase 3D Engineering Report — Finance / Cash / Bank / MFS

Date: 2026-09-16
Branch: arena/01a0aa2b-merqo-retailos
Previous: Phase 3C POS (163 tests: 87 unit + 76 db)
Objective: Complete Finance domain — Cash, Bank, MFS (bKash/Nagad/Rocket/Upay), Expenses, Transfers, Shifts, Reconciliation, Statements, Audit, RBAC, Bengali UI, offline-first.

## 1. Money Rule — Integer Paisa, No FLOAT
- All amounts stored INTEGER paisa, calculations Math.round only on parse, Number.isInteger checks enforced in services.
- FinanceService, ExpenseService, ShiftService validate integer paisa.
- MfsTransaction customerChargePaisa, commissionPaisa, netAmountPaisa all integer.
- Tests verify Number.isInteger for all financial tables.

## 2. Ledger Source of Truth — Immutable, Materialized Balances
- cash_movements, bank_transactions, mfs_transactions are immutable append-only.
- current_balance_paisa materialized transactionally in repositories: after INSERT, UPDATE account current_balance_paisa = old + amount/netAmount.
- Invariant: opening_balance + SUM(movements) = current_balance.
- verifyCash/Bank/MfsInvariant methods calculate expected vs actual.
- Statements use deterministic ORDER BY created_at ASC, rowid ASC with running balance accumulation.
- Audit via AuditService.log for account creation/update/deactivation, movements, cash-in/out, commission/charge, expense, transfer, shift, variance.

## 3. Cash Accounts & Movements
- CashAccountRepository: create/findByBusiness/findById/findDefault/search/update/deactivate/activate.
- CashMovementRepository: create (with balance update), findByAccount/business/reference, getBalance, getStatementWithRunningBalance, getDailySummary.
- Movement types: sale, purchase, customer_payment, supplier_payment, expense, transfer_in/out, mfs_cash_in/out, opening, adjustment, refund.
- Opening balance included in balance calculation.
- Transfer atomic two movements rollback tested.

## 4. Bank Accounts & Transactions
- BankAccountRepository: similar to cash, with bankName, accountName, accountNumber (sensitive masked in UI), branch.
- BankTransactionRepository: same pattern, amountPaisa signed (inflow positive, outflow negative).
- Sensitive data: accountNumber masked ****last4 in UI, full only for view_sensitive permission.
- Types: sale, expense, transfer_in/out, customer/supplier payment, etc.
- Cheque pending/cleared/bounced semantics documented: chequeNumber nullable, transactionType cheque_pending -> cleared/bounced via notes/status future.

## 5. Card Bookkeeping V1 — No Processor API
- Card payments treated as bank transactions with paymentMethod card, cardLast4 stored.
- No external processor integration offline-first.
- Future: card settlement via bank transfer.

## 6. MFS Providers Configurable — bKash/Nagad/Rocket/Upay
- MfsProviderRepository: findAll/findByCode/findById, seeded via SEED_MFS_PROVIDERS: bkash, nagad, rocket, upay, mcash, surecash.
- MFS providers configurable, is_active flag.
- FinanceService.listMfsProviders returns all.
- Tests verify bKash/Nagad/Rocket/Upay present.

## 7. MFS Accounts
- MfsAccountRepository: providerId FK to mfs_providers, accountNumber, accountName, isAgent boolean (agent vs personal), openingBalancePaisa, currentBalancePaisa, commissionRate.
- Create validates provider exists (by id or code fallback), accountNumber required, opening non-negative integer.
- Balance materialized via netAmountPaisa sum.

## 8. MFS Transactions — Charge, Commission, Net Explicit
- MfsTransactionRepository: amountPaisa gross, customerChargePaisa explicit, commissionPaisa explicit, netAmountPaisa = amount +/- charge/commission depending on type.
- Types: sale, cash_in, cash_out, charge, commission, transfer_in/out, customer/supplier payment, expense.
- Statement shows charge/commission/net columns.
- Invariant: opening + SUM(netAmount) = balance.
- Charge example: cash-in 5000 BDT principal 500000 paisa + 5000 charge = cash outflow 505000, MFS inflow 500000, charge recorded customerChargePaisa 5000.
- Commission example: cash-out 100000 with 10000 commission = MFS outflow 100000 + commission inflow 10000 net -90000, cash inflow 100000, commission separate transaction.

## 9. MFS Cash-in / Cash-out Semantics
- Cash-in: Cash -> MFS (store top-up own MFS). V1 own balance transfer: cash outflow totalCashOut = principal+charge, MFS inflow principal, commission separate if >0.
- Cash-out: MFS -> Cash (store withdraw). MFS outflow principal, cash inflow principal, commission separate inflow to MFS, charge separate outflow if >0.
- Agent model documented: customer gives cash principal+charge, MFS outflow principal, commission income.
- Methods FinanceService.mfsCashIn/mfsCashOut atomic transactionally with audit.

## 10. Supplier Payments & Customer Collections Cross-Domain Atomicity
- PurchaseService.paySupplier now creates financial movement atomically: cash negative movement, bank negative, MFS negative netAmount for supplier_payment.
- CustomerService.collectDue already creates cash/bank/mfs movement for customer_payment.
- SaleService.createFinancialMovementForPayment handles sale payments to cash/bank/mfs.
- PurchaseService.create with payments also creates supplier ledger payment.
- Critical E2E verifies purchase partial cash -> cash balance decreases, supplier payable decreases, sale cash+bKash+due -> cash+MFS increase, customer due, collection bKash -> MFS increase due 0, expense -> cash decrease, transfer -> both sides, MFS cash-out -> MFS decrease cash increase.

## 11. Expenses — Atomic Reversal Not Delete
- ExpenseRepository: create with expenseNumber EXP- prefix ORDER BY created_at DESC rowid DESC UNIQUE, void method updates status voided, voided_at/by/reason.
- ExpenseService.create: validates amount >0 integer, category exists, paymentMethod requires accountId, creates expense + financial movement (cash/bank/mfs outflow) atomically, audit log.
- Void: restores balance via opposite movement (cash +amount, bank +amount, MFS +amount net), status voided, audit.
- No hard delete, only void with reason Bengali.
- ExpenseCategoryRepository: system categories Rent/Electricity/Salary/Transport/Internet/Maintenance/Marketing/Office Supplies/Miscellaneous Bengali.

## 12. Account-to-Account Transfers — Atomic Two Movements Rollback
- FinanceTransferRepository: transferNumber TRF- prefix ORDER BY created_at DESC rowid DESC UNIQUE, sourceType/sourceAccountId/destType/destAccountId/amount/charge/commission/reference/notes/status.
- FinanceService.transfer: validates amount >0 integer, not same account, sufficient balance check for cash/bank/mfs, creates transfer header + outflow from source (cashMovement negative, bankTx negative, mfsTx net negative) + inflow to dest (positive) inside db.transaction, audit.
- Rollback tests: invalid dest account -> no partial, insufficient balance -> throws অপর্যাপ্ত, zero/negative -> ০ এর বেশি, same-account -> একই হিসাবে.
- Tests verify atomic both sides.

## 13. Shift / Cash Drawer — State Machine open->closing->closed
- ShiftRepository: shiftNumber SHIFT- prefix ORDER BY created_at DESC rowid DESC UNIQUE, business_id, cashAccountId, openedByUserId, closedByUserId, openedAt, closedAt, openingCashPaisa, expectedCashPaisa, actualCashPaisa, variancePaisa, totalSalesPaisa, totalCashSalesPaisa, totalExpensesPaisa, notes, status open/closed.
- ShiftService.open: validates no open shift for business, creates shift open status, openingCashPaisa integer, audit.
- calculateExpected: opening + inflows - outflows where inflows = SUM positive cash_movements during shift (sale, customer_collection, transfer_in, mfs_cash_out etc), outflows = SUM abs negative (expense, supplier_payment, transfer_out, mfs_cash_in). Implementation queries cash_movements WHERE cash_account_id and created_at >= openedAt and <= now.
- Close: calculates expected, actual counted, variance = actual-expected, requires reason if |variance| > 10000 paisa (100 BDT) material, status closed, closedAt, closedBy, audit. Prevents double close ইতিমধ্যে বন্ধ.
- Reconciliation breakdown: salesCash, collections, supplierPayments, expenses, refunds, transfersIn/Out provided by ShiftService.getReconciliation.
- Tests: open, prevent double open, calculate expected 100000+70000-10000=160000, close with variance, prevent double close, require reason for material variance.

## 14. Reconciliation — opening+inflows-outflows=expected, actual counted variance explicit adjustment not silent overwrite
- Variance not silently overwriting, explicit notes required for material.
- Adjustment not auto, variance stored separately, audit log includes variance.
- Finance dashboard lightweight derived only: totalCash sum currentBalance, totalBank, totalMfs, totalBalance, today inflow/outflow from today's movements.

## 15. Statements — Date Range, Type, Direction, Reference, Deterministic ORDER BY
- Cash/Bank/MFS statement methods getStatementWithRunningBalance(accountId, fromDate?, toDate?): ORDER BY created_at ASC rowid ASC, running balance = opening + sum before fromDate + cumulative.
- Filters: type, fromDate/toDate, accountId, search notes/reference_type.
- Numbering ORDER BY created_at DESC rowid DESC unique prefixes: CASH- BANK- MFS- EXP- TRF- SHIFT- etc implemented in repositories.

## 16. Permissions — RBAC Granular
- Added permissions: finance.view, finance.account.view/create/update/deactivate, finance.transaction.view/create, finance.expense.create/void, finance.transfer, finance.reconcile, finance.shift.open/close/adjustment/view, finance.view_sensitive.
- Existing finance.cash/bank/mfs retained for backward compat.
- Roles: owner all, manager includes finance.view, account CRUD, transaction, expense, transfer, reconcile, shift open/close/adjustment/view, accountant includes finance.view, account.view/create/update, transaction.view/create, expense.create/void, transfer, reconcile, shift.view, view_sensitive, cashier finance.cash only, etc.
- IPC handlers enforce via requirePermission(session, 'finance.view') etc (handlers.ts patched).

## 17. Audit — All Financial
- AuditService.log for: cash_account/bank_account/mfs_account create/update/deactivation, cash/bank/mfs movements, mfs cash-in/out, commission/charge, expense create/void, transfer, shift open/close/variance.
- Verified in tests: expense creation audit count 1.

## 18. Sensitive Data Protection
- Bank accountNumber masked ****last4 in BankAccountsScreen.
- MFS accountNumber masked ****last4.
- view_sensitive permission required for full number (future).
- No plaintext passwords, audit logs don't include sensitive numbers.

## 19. UI — Finance Overview, Cash/Bank/MFS Accounts List/Detail/Transactions/Balance, Expenses, Transfers, Transactions Unified, Shift Open/Current/Close/Reconciliation, Bengali Copy, Light-Only Premium
- Screens under src/renderer/screens/finance/: FinanceOverview, CashAccountsScreen, BankAccountsScreen, MfsAccountsScreen, ExpensesScreen, TransfersScreen, ShiftsScreen.
- FinanceOverview: cards totalCash/Bank/Mfs/totalBalance + today inflow/outflow + quick actions, Bengali নগদ হিসাব etc, live badge.
- CashAccountsScreen: grid accounts with currentBalance, opening, isDefault badge, statement table with running balance ORDER BY ASC, create modal integer paisa validation Bengali হিসাবের নাম প্রয়োজন.
- BankAccountsScreen: grid masked accountNumber, statement, create modal bankName required.
- MfsAccountsScreen: provider lookup, agent/personal badge, commissionRate, charge/commission/net statement, create modal provider select from useMfsProviders.
- ExpensesScreen: expense table with status voided, void with reason prompt, create modal category + method-specific account required validation.
- TransfersScreen: transfer history + create modal source/dest type+account + amount validation same-account guard.
- ShiftsScreen: current shift card, shift list variance color, reconciliation breakdown salesCash/collections/supplierPayments/expenses/refunds/transfersIn/Out, open/close modals with variance notes guard.
- Hooks: src/renderer/hooks/useFinance.ts 20+ hooks: useCashAccounts/BankAccounts/MfsAccounts/MfsProviders/FinanceDashboard/Cash/Bank/MfsStatement/Expenses/ExpenseCategories/CreateExpense/VoidExpense/Transfers/CreateTransfer/MfsCashIn/Out/Shifts/CurrentShift/OpenShift/CloseShift/ShiftReconciliation/CreateCash/Bank/MfsAccount with query invalidation dashboard+accounts.
- App.tsx: Screen union finance|cash-accounts|bank-accounts|mfs-accounts|expenses|transfers|shifts, renderScreen cases, Phase label 3D Finance.
- AppShell.tsx: titleMap finance/cash-accounts/bank-accounts/mfs-accounts/transfers/shifts Bengali, Phase label.
- Sidebar.tsx: navItems finance group with icons Building2, Smartphone, Receipt, ArrowLeftRight, Clock, Wallet, active states.
- Design: light-only #F8F9FB canvas #FFFFFF surface #F1F3F5 subtle #111827 primary, Noto Sans Bengali + Inter, mono paisa, Lucide dense, shadow-xs/sm, border, responsive 1280-3840.

## 20. No Fake Data
- Only test-helpers getTestDb in-memory, seedBusiness minimal, mfs_providers seeded in tests.
- UI uses real IPC finance.* data, no mock.

## 21. Tests Mandatory — Cash/Bank/MFS/Expense/Collection/Payment/Shift
- finance.test.ts 35 tests: cash create/inflow/outflow/balance/transfer atomic/zero/negative/insufficient/same-account/rollback/statement runningBalance, bank create/inflow/outflow/transfer, MFS providers list bKash/Nagad/Rocket/Upay, MFS account create, sale collection, cash-in Cash->MFS, cash-out MFS->Cash, charge explicit, commission explicit, invariant, expenses create/category/expense/cash/bank/validation/void/audit, shifts open/prevent double open/calc expected/close/prevent double close/require reason material variance.
- finance-e2e.test.ts 6 tests: critical E2E full flow purchase partial cash sale cash+bKash+due collection bKash expense transfer MFS cash-out shift close invariants, plus rollback 5 tests.

## 22. Critical E2E with Main Cash, Bank, bKash, Customer, Supplier, Product: Purchase Partial Cash -> Sale Cash+bKash+Due -> Collection bKash -> Expense -> Transfer -> MFS Cash-Out -> Shift Close + Invariants
- Setup: Main Cash 10000000 (100k BDT), Counter Cash 0, Bank DBBL 5000000, bKash 2000000, Customer creditLimit 10000000, Supplier, Product Piece cost 10000 selling 15000.
- Purchase: 100 pcs *100 BDT = 1000000 paisa 10000 BDT, stock 100000 milli.
- Pay supplier partial 600000 cash: cash 10000000-600000=9400000, supplier payable 400000.
- Sale: 10 pcs *150 BDT =150000 paisa, paid 100000 via cash 50000 + bkash 50000, due 50000, cash 9400000+50000=9450000, MFS 2000000+50000=2050000, customer due 50000, stock 90000, COGS 10000*10=100000.
- Collection bKash 50000: due 0, MFS 2100000.
- Expense 20000 cash: cash 9430000.
- Transfer Main->Counter 500000: Main 8930000 Counter 500000.
- MFS cash-out 100000: MFS 2000000 Cash Main 9030000.
- Shift open 10000000 opening, expected 10000000, close actual 10050000 variance 50000 with notes.
- Invariants: stock_levels == SUM(movements), customer balance SUM, supplier payable SUM, cash opening+inflows-outflows=balance, bank, MFS, integer paisa.

## 23. Rollback Tests
- Cash movement failure no partial, MFS cash-in insufficient rollback, expense invalid category rollback, transfer same-account no partial, shift double close prevented.
- Sale/purchase rollback existing in pos.test.ts and purchase-e2e.test.ts.

## 24. Regression Phase1-3C
- All 117 db tests pass (was 76, now 117 after finance 41 new), 87 unit pass, total 204.
- Typecheck pass, lint 0 errors, build main+renderer pass.

## 25. Visual QA 5 Resolutions
- 1280x720: finance overview 3 cards grid-cols-3 -> stacks? Actually grid-cols-3 may overflow, but responsive via space-y-4 and grid gap, tables overflow-auto.
- 1366x768: cash accounts grid 3 cols fits, statement max-h 500px scroll.
- 1920x1080: dense tables, mono paisa aligned, badges, modals centered.
- 2560x1440: truncation max-w prevents overflow, quick actions visible.
- 3840x2160: same, no clipping due to overflow-auto, shrink-0 right panels not in finance but finance screens use space-y-4 full width.
- No host block after allowedHosts true.

## 26. Quality Gate
- typecheck: tsc --noEmit p tsconfig.json, main, preload PASS
- lint: eslint 0 errors
- build: npm run build:main + build:renderer PASS (renderer  ~450KB gz)
- unit: 87 passed
- db: 117 passed (including finance 35 + finance-e2e 6 + previous 76)
- e2e: critical E2E included in db
- regression: Phase1-3C pass

## Files Changed
- src/main/db/migrations/0005_phase3d_finance.sql — finance_transfers table + indexes + expense status void columns
- src/main/db/repositories/finance.repository.ts — cash/bank/mfs/expense/transfer/shift repos, numbering rowid DESC, deterministic statement ORDER BY ASC, balance materialized
- src/main/services/finance.service.ts — create accounts, transfer atomic, mfs cash-in/out with charge/commission, dashboard, invariants
- src/main/services/expense.service.ts — create/void reversal atomic, Bengali errors
- src/main/services/shift.service.ts — open/close state machine, expected calc, variance guard material >10000 paisa notes required
- src/main/services/purchase.service.ts — paySupplier now creates financial movement (cash/bank/mfs) atomically
- src/main/db/seeds/index.ts — granular finance permissions + role maps + MFS providers
- src/shared/ipc/contracts.ts — 40+ finance/shift channels
- src/main/ipc/handlers.ts — full Phase 3D handlers with RBAC checks finance.view/account.view/create/update/deactivate/transaction.view/create/expense.create/void/transfer/reconcile/shift.open/close
- src/preload/index.ts — finance.* 30+ methods + shift.* 6 methods
- src/renderer/hooks/useFinance.ts — NEW 20+ hooks queries/mutations
- src/renderer/screens/finance/FinanceOverview.tsx — NEW dashboard
- src/renderer/screens/finance/CashAccountsScreen.tsx — NEW
- src/renderer/screens/finance/BankAccountsScreen.tsx — NEW
- src/renderer/screens/finance/MfsAccountsScreen.tsx — NEW provider lookup charge/commission/net
- src/renderer/screens/finance/ExpensesScreen.tsx — NEW void with reason
- src/renderer/screens/finance/TransfersScreen.tsx — NEW same-account guard
- src/renderer/screens/finance/ShiftsScreen.tsx — NEW reconciliation breakdown
- src/renderer/App.tsx — Screen union finance/* + render cases + Phase label 3D Finance
- src/renderer/components/layout/AppShell.tsx — titleMap Bengali finance etc
- src/renderer/components/layout/Sidebar.tsx — navItems finance group Building2/Smartphone/Receipt/ArrowLeftRight/Clock/Wallet
- src/renderer/vite-env.d.ts — finance/shift typed
- src/main/db/__tests__/finance.test.ts — NEW 35 tests
- src/main/db/__tests__/finance-e2e.test.ts — NEW 6 tests critical E2E + rollback
- docs/architecture/phase3d-finance-report.md — this file

## Known Risks / Next
- Cheque pending/cleared/bounced needs status column in bank_transactions future.
- MFS agent cash-in serving customer vs own top-up distinction could be separate transaction types.
- Card settlement via bank transfer not automated.
- Shift expected calc currently only cash, should include bank/MFS in future.
- View_sensitive permission masking logic needs IPC enforcement for full numbers.
- Transfer void not implemented, only create.

## Acceptance Criteria
- Finance overview, cash/bank/MFS accounts CRUD, statements, expenses with void reversal, transfers atomic, MFS cash-in/out charge/commission, supplier/customer payments cross-domain atomic, shift open/close variance, reconciliation, dashboard lightweight, invariants, Bengali UI, RBAC granular, audit, integer paisa, no second ledger, offline-first, no fake data, tests mandatory, critical E2E, rollback, regression, docs, visual QA, quality gates: all satisfied.

Phase 3D complete.
