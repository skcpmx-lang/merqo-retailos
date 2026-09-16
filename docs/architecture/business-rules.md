# Business Rules & Domain Engines — MERQO RetailOS

## 1. Inventory Engine — Complete

### 1.1 Stock Ledger

- **Immutable:** `stock_movements` never updated/deleted. Every change = new row.
- **Types:** `opening`, `purchase`, `sale`, `sale_return`, `purchase_return`, `adjustment`, `damage`, `loss`, `stock_count`, `transfer`
- **Quantity:** Stored as `quantity_milli` in base unit. Positive = stock in, Negative = out.
- **Cost Snapshot:** Each movement stores `cost_paisa` at time (WAC) for valuation.
- **Derivation:** Current stock = SUM(quantity_milli) per product.

### 1.2 Movement Scenarios

- **Opening Stock:** When product created with opening_stock, create movement type `opening`.
- **Purchase Receiving:** Purchase status `received` → for each item, movement `purchase` positive base_quantity, cost = base_cost_per_unit.
- **Sales Deduction:** Sale completed → movement `sale` negative base_quantity, cost = current WAC.
- **Customer Return (restock=true):** Movement `sale_return` positive.
- **Supplier Return:** Movement `purchase_return` negative.
- **Adjustment:** Manual adjustment with reason, movement `adjustment` positive/negative, requires permission `stock:adjustment`.
- **Damage/Loss:** Movement `damage`/`loss` negative, reason required.
- **Stock Count:** On count completion, for each variance, create `stock_count` movement.

### 1.3 Minimum Stock & Reorder

- `products.min_stock_milli` and `reorder_level_milli`.
- Background check every 15 min or after each sale/purchase.
- If `stock_levels.quantity_milli <= min_stock_milli`, create notification type `low_stock`.
- Dashboard query: `WHERE quantity_milli <= min_stock_milli AND is_active=1`

### 1.4 Product Deactivation & Historical

- Deactivation sets `is_active=0`, `deleted_at` null (soft disable).
- Historical sales still show product name via snapshot (sale_items stores product_name at time? Actually we store product_id but also denormalize name for history? Decision: sale_items stores `product_name_snapshot TEXT` to preserve if product later renamed/deactivated).
- Hard delete forbidden if any stock_movements exist.

### 1.5 Unit Conversion

- **Model:** Each product has base_unit (e.g., Piece). Units belong to groups (piece, weight, volume). Conversions only within same group (prevent piece ↔ kg unless explicitly defined).
- **Example:** 1 Carton = 24 Pieces. Store in `unit_conversions`: from=carton, to=piece, factor=24.
- **Conversion Function:** `convert(qty, fromUnit, toUnit)` — BFS through graph, multiply factors. If no path, throw error.
- **Purchasing:** User selects purchase_unit = carton, qty=2 → base_qty = 2*24=48 pieces. Store both.
- **Selling:** Similar.
- **Valuation:** Always in base unit cost. Purchase cost per carton 2400 BDT → base cost 100 BDT/piece. WAC recalculated in base unit.
- **Display:** Show both units in UI where relevant.

---

## 2. Cost & Profit Engine

### 2.1 Evaluation

| Method | Pros | Cons | Fit for Retail |
|--------|------|------|----------------|
| **Weighted Average Cost (WAC)** | Simple, stable, reflects average, good for high-volume retail, no need to track batches | Not precise for perishables with varying cost | ★★★★★ Best for general retail, mini mart |
| **FIFO** | More accurate for perishables, matches physical flow | Complex, needs batch tracking, heavier DB | ★★★★☆ Good but complexity high for V1 |
| **LIFO** | Tax benefit in inflation, but banned in IFRS, confusing | Not allowed in BD accounting standards | ★☆☆☆☆ |
| **Specific Identification** | Precise for high-value items | Impossible for grocery | ★☆☆☆☆ |

### 2.2 Decision: WAC for V1

- **Reason:** Bangladeshi super shops, grocery, general stores have high SKU count, frequent purchases at slightly different costs. WAC gives stable cost, simple to compute, matches Loyverse/Lightspeed default.
- **Future-ready:** Schema includes cost history, so FIFO can be added later as option per product.

### 2.3 WAC Calculation

- **Formula:** New WAC = (Old Stock Qty * Old WAC + New Purchase Qty * Purchase Cost) / (Old Stock Qty + New Purchase Qty)
- **Implementation:** In `InventoryService.receivePurchase()`, inside transaction:
  ```
  old_qty = stock_levels.quantity_milli
  old_wac = products.cost_price_paisa
  new_qty = purchase_item.base_quantity_milli
  new_cost = purchase_item.base_cost_per_unit_paisa
  new_wac = (old_qty * old_wac + new_qty * new_cost) / (old_qty + new_qty)
  Update products.cost_price_paisa = new_wac
  Insert product_cost_history
  ```
- **Edge:** If old_qty=0, new_wac = new_cost.
- **Precision:** Use integer paisa * milli qty = paisa-milli, divide with rounding. Use bigint to avoid float.

### 2.4 Financial Definitions

- **Revenue:** SUM(sale_items.line_total_paisa) for completed sales (gross sales)
- **Discounts:** SUM(sale discount_paisa)
- **Net Sales:** Revenue - Discounts - Returns
- **COGS:** SUM(sale_items.line_cost_total_paisa) where line_cost = base_quantity * WAC at time of sale
- **Gross Profit:** Net Sales - COGS
- **Operating Expenses:** SUM(expenses.amount_paisa) in period
- **Net Profit:** Gross Profit - Operating Expenses

All money handled as integer paisa. Use `Money` value object with `add`, `sub`, `mul` using bigint.

---

## 3. POS Architecture

### 3.1 Workflow

1. **Open Shift Check:** POS requires open shift for current user/cash account. If none, prompt open shift with opening cash.
2. **Barcode Scanning / Search:**
   - Global barcode listener captures scanner input → lookup product via `product_barcodes` or `products.barcode` → add to cart.
   - SKU search: type SKU + Enter.
   - Product search: type name, FTS search, arrow keys, Enter to add.
   - Category browsing: click category → filter products.
3. **Cart:**
   - Each line: product, unit, qty, unit price, discount, total.
   - Qty editable via keyboard (+/- or direct).
   - Discount per line or per bill (fixed/percent).
   - Cart persisted in Zustand, survives navigation, cleared on sale complete.
4. **Customer Selection:**
   - Optional. Search customer by phone/name. Quick-add: name + phone minimal, creates customer.
   - If due customer, show current due.
5. **Held Sales:**
   - Park current cart → `held_sales` table with cart_json. Retrieve later.
   - Limit: max 50 held per user.
6. **Payment:**
   - Show total, allow split: cash + card + MFS + due.
   - Cash: enter received, calculate change.
   - Card: enter last4, type.
   - MFS: select provider/account, enter trx ref.
   - Due: requires customer selected, check credit limit.
   - Split validation: sum(payments) == total (or total - change).
7. **Invoice/Receipt:**
   - On complete, generate sale_number, create sale + items + payments + stock movements + ledger entries + cash/bank/MFS movements all in one transaction.
   - Print receipt automatically if auto-print enabled.
   - Show success with print preview, option to print A4 invoice.
8. **Return/Refund/Void:**
   - Return: select original sale, choose items/qty to return, reason, refund method, restock option.
   - Void: void entire sale if within allowed time/permissions, requires reason, creates reversal.
   - Refund: similar to return but for payment.

### 3.2 Keyboard-First Operation

- **Global Shortcuts (configurable):**
  - `F2` → Focus barcode/search
  - `F3` → Customer search
  - `F4` → Discount dialog
  - `F5` → Hold sale
  - `F6` → Retrieve held
  - `F7` → Clear cart
  - `F8` → Payment dialog
  - `F9` → Quick add product
  - `F10` → Quick add customer
  - `Ctrl + P` → Print last receipt
  - `Ctrl + R` → Return
  - `Del` → Remove selected line
  - `+ / -` → Increase/decrease qty of selected line
  - `Alt + C` → Focus cash received
  - `Enter` → Confirm payment

- **POS Focus Management:** No mouse required. Tab order: search → cart lines → qty → customer → payment.

- **Configurable Shortcut System:**
  - Table `system_settings` key `pos_shortcuts` JSON map: `{ action: keyCombo }`
  - UI in Settings → POS → Shortcuts to customize.
  - Service validates no conflicts.

---

## 4. MFS Agent Architecture (Bookkeeping without Paid APIs)

### 4.1 Concept

MERQO MFS module is **local bookkeeping**, not API integration. Agent manually does transaction on phone/USSD, then records in MERQO for balance tracking, commission, reporting.

### 4.2 Providers

- bKash, Nagad, Rocket, Upay — seeded in `mfs_providers`.

### 4.3 Accounts

- Each provider can have multiple agent accounts (different numbers). `mfs_accounts` holds opening and current balance (cached from ledger).

### 4.4 Workflows

#### Cash In (Customer gives cash, agent adds to customer's MFS)
- Agent receives cash from customer.
- Agent does cash-in via phone.
- In MERQO: Create `mfs_transactions` type `cash_in`:
  - `amount_paisa` = cash-in amount
  - `customer_charge_paisa` = charge taken from customer (e.g., 5 BDT per 1000)
  - `commission_paisa` = commission earned from provider (e.g., 4 BDT)
  - `customer_phone` = customer's MFS number
  - `transaction_ref` = provider trxID (manual entry)
  - `operator` = optional
  - Net effect on agent balance: balance decreases? Actually cash_in: agent's e-money decreases? Let's define:
    - Cash In to customer: Agent's MFS balance decreases (e-money out), cash increases.
    - Cash Out from customer: Agent's MFS balance increases, cash decreases.
  - So need clear accounting:
    - Cash In (agent gives e-money to customer): `mfs_transactions.amount` negative for agent balance, `cash_movements` positive for cash account.
    - Cash Out (agent gives cash to customer, takes e-money): MFS balance positive, cash negative.
- UI shows balance after.

#### Cash Out (Customer withdraws cash, agent receives e-money)
- Opposite of cash in.
- MFS balance increases, cash decreases.
- Charge and commission.

#### Send Money / Payment (Agent to agent, or payment)
- For completeness, support `send_money` and `payment` types.

#### Commission
- Tracked per transaction, aggregated for profit.

#### Transaction Reference
- Manual input field, validated non-empty if required setting.

#### Agent Balance
- Derived from SUM(net_amount) + opening. Net_amount = amount +/- commission? Define:
  - For cash_in: net = -amount + commission (since commission adds to profit but balance decreases by amount)
  - Actually need two balances: e-money balance and cash balance. MFS account tracks e-money. Cash account tracks physical cash.
  - So MFS ledger only tracks e-money movement. Cash movement tracked separately via cash_movements linked via reference_id.
  - Commission tracked as separate income? For simplicity, commission is part of profit, not balance. But we store commission_paisa for reporting.

#### Date/Time, Account
- All transactions timestamped, linked to mfs_account_id and created_by user.

### 4.5 UI

- MFS Dashboard: balances per provider/account, today's cash in/out, commission.
- Transaction list with filters.
- Form: select account, type, amount, customer phone, charge, commission auto-calculated based on account's commission_rate but editable, ref, notes.
- On submit, create both MFS transaction and corresponding cash movement in same transaction.

### 4.6 No Paid APIs

- Explicitly no external API calls. All manual entry. Future can add optional API if provider offers free.

---

## 5. Cash / Bank / MFS Accounting Flow

### 5.1 Money Movement Map

```
Customer Payment (cash) → Cash Account ↑
Customer Payment (bank/card) → Bank Account ↑
Customer Payment (MFS) → MFS Account ↑

Supplier Payment (cash) → Cash Account ↓
Supplier Payment (bank/cheque) → Bank Account ↓
Supplier Payment (MFS) → MFS Account ↓

Sale (cash) → Cash Account ↑ + Revenue ↑
Sale (bank) → Bank Account ↑ + Revenue ↑
Sale (MFS) → MFS Account ↑ + Revenue ↑

Purchase (cash) → Cash Account ↓ + Inventory ↑ + Payable? (if due)
Purchase (bank) → Bank Account ↓
Purchase (MFS) → MFS Account ↓

Expense (cash) → Cash Account ↓ + Expense ↑
Expense (bank) → Bank Account ↓ + Expense ↑
Expense (MFS) → MFS Account ↓ + Expense ↑

Transfer Cash → Bank: Cash ↓ + Bank ↑
Transfer Bank → MFS: Bank ↓ + MFS ↑
etc. (all via transfer movements)

MFS Cash In: Cash ↑ + MFS ↓ + Commission Income ↑
MFS Cash Out: Cash ↓ + MFS ↑ + Commission Income ↑
```

### 5.2 Split Payments

- `sale_payments` allows multiple rows per sale. Each row has method and account.
- Total of sale_payments must equal total_paisa (except change).
- Each payment creates corresponding ledger movement in respective account.

### 5.3 Reconciliation Rules

- Cash expected = opening + SUM(cash_movements in shift)
- Cash actual = counted at close
- Variance = actual - expected → if non-zero, create adjustment movement with reason, requires manager approval.
- Bank reconciliation: Manual, compare MERQO balance vs bank statement, create adjustment if needed with audit.
- MFS reconciliation: Similar, compare e-money balance vs provider app.

---

## 6. Customer Ledger

### 6.1 Formula

```
Opening Due
+ Sales (total - paid, i.e., due portion)
- Payments
- Sale Returns (if due sale)
+/- Adjustments
= Current Due
```

Implementation: SUM(customer_transactions.amount_paisa) where amount positive = due increase, negative = decrease.

### 6.2 Due Aging

- Buckets: 0-30 days, 31-60, 61-90, 90+ based on sale_date where due >0.
- Query: For each customer, group sales with due, calculate days overdue.

### 6.3 Statements

- Customer statement: list of all transactions (sales, payments, returns, adjustments) chronologically with running balance.
- Export PDF.

---

## 7. Supplier Ledger

### 7.1 Formula

```
Opening Payable
+ Purchases (total - paid)
- Payments
- Purchase Returns
+/- Adjustments
= Current Payable
```

Same ledger pattern.

### 7.2 Aging & Statements

Same as customer but for payables.

---

## 8. Expense System

### 8.1 Categories

Seeded:
- Rent (ভাড়া)
- Electricity (বিদ্যুৎ)
- Internet (ইন্টারনেট)
- Salary (বেতন)
- Transport (পরিবহন)
- Maintenance (রক্ষণাবেক্ষণ)
- Marketing (মার্কেটিং)
- Stationery (স্টেশনারি)
- Miscellaneous (বিবিধ)

Configurable: user can add custom categories.

### 8.2 Workflow

- Create expense: select category, amount, date, payment method, source account (cash/bank/MFS), reference, notes, attachment.
- On create, insert expense + corresponding account movement (cash/bank/MFS) in same transaction.
- Expense report grouped by category, date range.
- Permission: `expense:view`, `expense:create`, etc. Some roles cannot view expenses.

---

## 9. Shift & Cash Drawer

### 9.1 Flow

1. **Open Shift:**
   - User selects cash account, enters opening cash (counted).
   - System checks no other open shift for same cash account (or same user).
   - Creates `shifts` row status open, creates `cash_movements` type `shift_open`? Actually opening cash is snapshot, not movement.
   - Sets current shift in session.

2. **Transactions During Shift:**
   - All sales, expenses, cash in/out linked to shift_id (or cash_session).
   - Dashboard shows expected cash: opening + cash sales + cash customer payments - cash supplier payments - cash expenses + cash_in - cash_out.

3. **Close Shift:**
   - User enters actual cash counted.
   - System calculates expected cash via query.
   - Variance = actual - expected.
   - If variance !=0, requires reason, maybe manager approval if large.
   - Creates adjustment movement if needed.
   - Updates shift row with expected, actual, variance, closed_at, status closed.
   - Prints shift summary.

### 9.2 Staff Accountability

- Each shift tied to opened_by and closed_by user.
- All transactions during shift have created_by.
- Shift summary shows sales by staff, voids, etc.

---

## 10. Reporting Architecture

### 10.1 Engine

- `ReportService` defines reports as objects:
  ```ts
  {
    id: 'sales',
    nameKey: 'reports.sales',
    filters: ['dateRange', 'customer', 'paymentMethod'],
    query: (filters) => SQL,
    columns: [...],
    aggregates: ['total', 'profit']
  }
  ```
- Filters: date presets (Today, Yesterday, Last 7 Days, This Week, This Month, Last Month, 3 Months, 6 Months, This Year, Last Year, Custom Range) + entity filters.
- Date preset resolver converts to start/end timestamps.

### 10.2 Reports List

- Sales, Purchases, Inventory, Stock Movement, Profit, Customer, Supplier, Expense, Cash, Bank, MFS, Staff, Audit, Returns, Payment Methods
- Each report supports export CSV/Excel/PDF.

### 10.3 Performance

- Use materialized aggregates for dashboard, but reports query raw tables with indexes.
- For large date ranges, paginate.

---

## 11. Dashboard Architecture

### 11.1 Data Model

- Dashboard queries aggregate from ledger tables, not hard-coded.
- Queries:
  - Sales today: SUM(sales.total_paisa WHERE sale_date today AND status completed)
  - Purchases today: SUM(purchases.total_paisa)
  - Gross profit today: sales total - COGS today
  - Net profit: gross - expenses today
  - Customer due total: SUM(customers.current_due_paisa)
  - Supplier due total: SUM(suppliers.current_payable_paisa)
  - Stock value: SUM(stock_levels.quantity * products.cost_price)
  - Sales trend: group by day/week/month
  - Revenue vs cost: line chart
  - Payment mix: group by payment_method
  - Top products: top 10 by qty or revenue in period
  - Low stock: WHERE qty <= min_stock
  - Due aging: buckets
  - Expense breakdown: group by category
  - Cash position: cash_accounts current_balance
  - Bank, MFS: similar
  - Activity center: recent audit_logs

### 11.2 Query Architecture

- DashboardService has methods like `getSummary(businessId, dateRange)` that runs multiple queries in parallel via `Promise.all` but each query is separate SQL for clarity.
- Cache: 30 seconds in main process, invalidated on sale/purchase/expense.

---

## 12. Error Handling

### 12.1 User-Facing

- Never show `SQLITE_CONSTRAINT`, stack trace, etc.
- Map errors to Bangla polished messages:
  - `UNIQUE constraint failed: products.sku` → "এই SKU ইতিমধ্যে ব্যবহৃত হচ্ছে। অন্য SKU ব্যবহার করুন।"
  - `FOREIGN KEY constraint failed` → "সম্পর্কিত তথ্য খুঁজে পাওয়া যায়নি।"
  - `ValidationError` → show field errors in Bangla.
  - `AuthorizationError` → "এই কাজটি করার অনুমতি আপনার নেই।"
  - `InsufficientStockError` → "স্টকে পর্যাপ্ত পণ্য নেই। বর্তমান স্টক: X"

### 12.2 Technical Logs

- Log full error with stack, correlationId, userId, payload (sanitized) to file.
- Include correlationId in user message: "একটি সমস্যা হয়েছে। সাপোর্ট কোড: ABC123"

---

## 13. Import / Export

### 13.1 Export

- CSV, Excel-compatible (exceljs), PDF reports, JSON backup.
- Export respects permissions and filters.

### 13.2 Import Pipeline

1. **Validation:** Upload CSV, parse, Zod validate each row, check duplicates, check FK existence.
2. **Preview:** Show first 10 rows + summary: valid, invalid, warnings.
3. **Warning/Error Report:** List errors per row in Bangla.
4. **Confirmation:** User confirms.
5. **Transactional Import:** Insert all valid rows in single transaction. If any fails, rollback entire import. Create import_jobs record + audit log.

Supported imports: Products, Customers, Suppliers, Opening Stock.

---

## 14. Empty / First-Run Experience

- No fake data, no demo analytics, no placeholder products.
- On first launch (no DB file), show onboarding wizard:
  1. Welcome to MERQO — logo, tagline.
  2. Business Setup: name, address, phone, logo.
  3. Owner Account: name, phone, password, PIN.
  4. Cash Account: default cash account name, opening balance.
  5. Printer Setup (optional): detect printers, set default.
  6. Finish → create business + owner + cash account + default roles/permissions + default units/categories/expense categories/MFS providers.
- After onboarding, dashboard shows empty states with helpful CTAs: "প্রথম পণ্য যোগ করুন", "সাপ্লায়ার যোগ করুন", etc.
- No charts until data exists — show empty state illustrations (not emoji).

---

## 15. Notifications

- In-app only for V1 (no push).
- Types: low_stock, due_reminder, backup_reminder, shift_open, etc.
- Service creates notifications on events (e.g., after sale if low stock).
- UI: bell icon with unread count, drawer list.
