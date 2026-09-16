# Competitor Benchmark & Feature Gap Analysis — MERQO RetailOS

## 1. Competitor Benchmark

### 1.1 Loyverse POS (Free Core, Paid Add-ons)

**Public Capabilities (2024-2026):**

- **Core:** POS billing via touch, barcode scanning, discounts, returns, cash management, open tickets (held sales), item modifiers.
- **Inventory:** Basic stock tracking free, low stock alerts, bulk import/export CSV, inventory history. Advanced inventory add-on ($25/mo/store): purchase orders, suppliers, inventory valuation, counts, transfers.
- **CRM/Loyalty:** Customer database, purchase history, loyalty points, notes, delivery addresses.
- **Employee:** Free limited, add-on $25/mo/store: roles/permissions, timecards, sales by employee, cash discrepancies.
- **Multi-Store:** Manage multiple stores under one account, transfer orders.
- **Offline:** POS works offline, syncs later.
- **Hardware:** Works with common receipt printers, cash drawers, barcode scanners (BYOD iOS/Android tablets).
- **Reports:** Sales by item/category/employee, trend analysis, tax reporting, export CSV.
- **Payments:** No built-in, integrates with Worldpay, SumUp, PayPal Zettle, etc.
- **Pricing:** Core free, add-ons per store.

**Strengths:**
- Free core lowers barrier, good for small shops/cafes.
- Simple UI, easy onboarding.
- Offline mode.
- Multi-store under one account.

**Weaknesses / Opportunities for MERQO:**
- Inventory valuation only in paid add-on; MERQO should include WAC in free V1.
- No proper supplier payable ledger (only purchase orders) — MERQO can have full supplier ledger with due aging.
- No MFS agent workflows (critical for BD) — MERQO opportunity.
- No shift variance with cash reconciliation detail — MERQO can do better.
- No 58mm thermal explicit support, no Bengali rendering focus.
- No granular permissions like view_cost, view_profit — MERQO will have 60+ permissions.
- No cash/bank/MFS separate accounting with transfers — MERQO will.
- Cloud-only dashboard, requires internet — MERQO offline-first is advantage for BD.
- No expense management — MERQO includes.
- No audit log immutability — MERQO will.

**Industry-Standard Features to Include:**
- Barcode scanning, held sales, discounts, returns, low stock alerts, purchase orders, customer loyalty, employee roles, multi-store (future), offline.

---

### 1.2 Shopify POS (E-commerce + Retail)

**Public Capabilities:**

- **POS:** Fast checkout, barcode scanning via camera or scanner, discounts, returns, exchanges, gift cards, store credit.
- **Inventory:** Real-time sync online/offline, low stock alerts, purchase orders, transfers, counts (Pro), product variants (size/color), barcode label printing.
- **Hardware:** Proprietary hardware (Tap & Chip Reader $49, POS Terminal $349, receipt printer $289, scanner $209, cash drawer $139), plus third-party Epson, Star, DYMO, Zebra. Works on iPad/iPhone/Android.
- **Customer:** Profiles, purchase history, loyalty via apps, email marketing.
- **Employee:** Roles/permissions, time tracking (Pro).
- **Payments:** Shopify Payments integrated, Tap to Pay, split payments.
- **Reports:** Sales, inventory, staff performance, 50+ reports, custom reports.
- **Omnichannel:** Best-in-class e-commerce sync, BOPIS, social selling.
- **Pricing:** POS Lite free with Shopify plan ($29-$299/mo), POS Pro $89/mo/location.

**Strengths:**
- Best omnichannel sync.
- Polished hardware ecosystem.
- Strong inventory with variants.
- Detailed reporting.

**Weaknesses / Opportunities:**
- Requires Shopify subscription, expensive for BD small shops.
- No offline-first (needs internet for full features, though POS works offline limited).
- No MFS workflows.
- No supplier payable ledger deep.
- No expense management native.
- No Bangla-first.
- Hardware expensive for BD market.
- No cash/bank/MFS separate bookkeeping with commission.
- Locked into Shopify ecosystem.

**Features MERQO Should Include (from Shopify):**
- Product variants (future-ready), barcode label printing, split payments, purchase orders, inventory counts, customer profiles, staff permissions, detailed reporting.

---

### 1.3 Lightspeed Retail (Advanced Retail)

**Public Capabilities:**

- **POS:** Credit card, barcode scanning, hardware integration, price adjustments, receipts, quotes, invoicing.
- **Inventory:** Industry-leading: variants, bundles, serialized items, purchase orders, vendor catalogs, reorder points, bulk edit, real-time tracking, multi-location inventory sync, transfers, automated reordering, low stock alerts.
- **Customer:** Profiles, sales history, VIP status, loyalty, CRM metrics.
- **Employee:** Performance tracking, sales targets, commissions, hours, roles.
- **E-commerce:** Built-in eCommerce or integration with Shopify/WooCommerce, real-time sync.
- **Payments:** Lightspeed Payments, multi-device acceptance.
- **Reports:** 50+ reports, sales trends, profit, inventory costs/margins/transfers/negative inventory, employee performance, custom reports, analytics add-on.
- **Multi-Store:** Centralized catalog, inventory, reporting.
- **Hardware:** Barcode scanners, receipt printers, cash drawers, iPad POS.
- **Pricing:** $89-$339/mo.

**Strengths:**
- Best inventory depth for high-SKU retailers.
- Multi-location with centralized control.
- Strong analytics.
- Vendor management.

**Weaknesses / Opportunities:**
- Expensive, complex for small BD shops.
- Cloud-based, needs internet.
- No MFS agent.
- No Bangla.
- No cash/bank/MFS split bookkeeping with agent commission.
- No shift cash variance detailed? Has but basic.
- Overkill for mini mart.

**Features MERQO Should Include:**
- Reorder level, variants, bundles (future), purchase orders, vendor catalog, inventory valuation, multi-location ready schema (location_id), advanced reporting.

---

### 1.4 Odoo POS (ERP-Integrated)

**Public Capabilities:**

- **POS:** Barcode scanning, discounts, pricelists, loyalty, gift cards, returns, multi-store, offline mode, kitchen display, table management (restaurant), self-checkout, weighing scale integration.
- **Inventory:** Real-time integration with Odoo Inventory, multi-warehouse, variants, serial numbers, lots, automated reordering.
- **Accounting:** Auto-generates invoices, syncs revenue, accounting entries, financial records.
- **CRM:** Customer records, purchase history, loyalty.
- **Payments:** Multiple methods, cash, card, digital wallets, invoicing.
- **E-commerce:** Sync with Odoo eCommerce, Shopify, WooCommerce.
- **Customization:** Highly customizable via modules, custom pricing, promotions, KOT.
- **Multi-Store:** Centralized management, branch performance.
- **Pricing:** Open source community, enterprise pricing per user.

**Strengths:**
- Full ERP integration (sales, inventory, accounting, CRM, eCommerce).
- Highly customizable.
- Offline mode.
- Multi-store/warehouse.
- Affordable vs Lightspeed.

**Weaknesses / Opportunities:**
- Requires technical knowledge, complex setup.
- UI not as polished as Shopify/Lightspeed for retail-only.
- No MFS agent workflows.
- No Bangla-first.
- No 58mm thermal focus.
- Customization needs developer.
- No shift cash reconciliation detailed.

**Features MERQO Should Include:**
- Real-time inventory update on sale, accounting integration (cash/bank/MFS ledger), pricelists (future), loyalty, multi-store ready, offline, weighing scale future.

---

## 2. Industry-Standard Features (Across Competitors)

- **POS:** Barcode scanning, SKU search, product search, category browsing, cart, qty +/- , discounts (line & bill), customer selection, held sales, split payments, due, receipt printing, returns/refunds/voids, cash drawer kick, offline selling.
- **Inventory:** Stock tracking, low stock alerts, purchase orders, suppliers, inventory counts, transfers, valuation, variants, barcode labels, bulk import/export.
- **Customers:** Database, purchase history, due ledger, statements, loyalty.
- **Suppliers:** Database, payable ledger, purchase history, payments.
- **Employees:** Roles, permissions, time tracking, sales by employee.
- **Reports:** Sales, purchases, inventory, profit, expenses, staff, audit, payment methods, date presets.
- **Hardware:** Receipt printers (80mm), barcode scanners, cash drawers, label printers.
- **Financial:** Cash management, expense tracking, profit calculation.

---

## 3. Common UX Patterns

- **POS Layout:** Left products, right cart — industry standard.
- **Keyboard Shortcuts:** F-keys for actions, visible in UI.
- **Search First:** Barcode/search focused by default.
- **Cart Summary:** Subtotal, discount, tax, total, paid, due, change always visible.
- **Customer Quick Add:** Minimal fields, add from POS.
- **Held Sales:** Park and retrieve with list.
- **Dashboard KPIs:** Sales today, low stock, top products, recent sales.
- **Low Stock Warning:** Red badge, notification.
- **Due Highlight:** Red for overdue, yellow for warning.
- **Print Preview:** Before print, with template selection.

---

## 4. Weaknesses / Opportunities for MERQO (Bangladesh Context)

1. **MFS Agent Workflows:** None of competitors have bKash/Nagad/Rocket/Upay bookkeeping with cash in/out, charge, commission, agent balance. Critical for BD general stores who act as MFS agents.
2. **Offline-First Windows Desktop:** Competitors are cloud or tablet-based, need internet. BD shops have unreliable internet — offline-first Windows desktop is opportunity.
3. **Bangla-First Professional:** Competitors English-first. MERQO Bangla-first with polished natural Bangla.
4. **Cash/Bank/MFS Separate Accounting:** Competitors have cash management but not detailed cash/bank/MFS transfer and reconciliation with commission.
5. **Expense Categories for BD:** Rent, electricity, internet, salary, etc. with local context.
6. **58mm Thermal Support:** Many BD shops use cheap 58mm printers — competitors focus 80mm.
7. **Bengali Receipt Rendering:** Competitors don't handle Bengali well on thermal — MERQO will via image rendering.
8. **Granular Permissions for Small Shops:** View cost, view profit, stock adjustment, price change — important for owner vs cashier.
9. **Shift Variance with Accountability:** Detailed shift with expected vs actual, variance reason, staff accountability.
10. **No Subscription for V1:** One-time license vs monthly — attractive for BD.
11. **Light Mode Premium Design:** Competitors often generic — MERQO premium enterprise feel.

---

## 5. Feature Gap Analysis — MERQO Requirements vs Industry

### 5.1 Required for V1 (Must Have — Commercial Viable)

These are not explicitly mentioned but necessary for serious retail product:

- **Product Variants (basic):** At least SKU/barcode per variant, even if full variant matrix future. Without variants, clothing/shoe shops can't use.
- **Barcode Label Printing:** Generate barcode labels for products (A4 sheet with multiple labels) — standard.
- **Stock Count / Stock Taking:** Full workflow with variance and adjustment — mentioned as stock counting but need detailed session.
- **Held Sales / Parked Sales:** Essential for POS when customer forgets wallet.
- **Quick Add Product/Customer from POS:** Without leaving POS.
- **Customer Credit Limit:** Prevent over-due beyond limit.
- **Supplier Opening Payable:** Already in schema but ensure UI.
- **Cash Drawer Kick:** Auto on cash sale.
- **Receipt Customization:** Footer, logo, show/hide fields, Bengali/English toggle.
- **Daily Closing Report (Z Report):** Shift close prints summary — standard.
- **Low Stock Notification Center:** In-app notifications.
- **Search with FTS:** Fast product search across name, SKU, barcode.
- **Keyboard Shortcuts Configurable:** For POS.
- **Backup Reminder:** Notify if no backup in 7 days.
- **Audit Log Viewer:** For owner.
- **Import Validation Preview:** For products.
- **Unit Conversion UI:** Easy to define 1 carton = 24 pieces.
- **WAC Display:** Show current WAC in product view.
- **Due Aging Report:** Customer due aging buckets.
- **Expense Attachment:** Upload bill image.
- **Shift Management:** Open/close with cash count.
- **Printer Test:** Test page with Bengali.
- **Hardware Diagnostics:** For support.
- **Onboarding Wizard:** Clean first-run.

### 5.2 Recommended for V1 (Should Have — Competitive Advantage)

- **Product Images:** Multiple images per product, primary image.
- **Product Variants Full:** Size/color matrix (can be Phase 2 but schema ready).
- **Customer Statements PDF:** Generate PDF statement.
- **Supplier Statements PDF:** Similar.
- **Sales Return with Restock Toggle:** Choose restock or not.
- **Purchase Return Workflow:** Full.
- **Expense Recurring:** Mark expense as recurring, reminder.
- **Cash Transfer:** Transfer between cash/bank/MFS accounts.
- **MFS Commission Report:** Monthly commission earned.
- **Dashboard Sales Trend Chart:** Last 7/30 days.
- **Top Products Report:** By qty and revenue.
- **Payment Mix Chart:** Cash vs bank vs MFS vs due.
- **User Activity Log:** Staff activity timeline.
- **Stock Movement History per Product:** Timeline.
- **Product Cost History Chart:** WAC over time.
- **Barcode Scanner Sound:** Beep on success/failure.
- **Quick Cash In/Out Buttons:** For cash drawer.
- **Due Reminder Notifications:** For overdue customers.
- **Backup Auto Daily:** With retention.
- **Export to Excel for All Reports:** ExcelJS.

### 5.3 Future-Ready Architecture (Not V1, but Schema Ready)

- **Multi-Location / Multi-Store:** Schema has location_id, but V1 single location. Keep ready.
- **Multi-User Concurrent (same DB):** Single user at a time for V1, but DB supports.
- **Loyalty Points:** Table ready, not UI.
- **Pricelists / Customer Groups:** Wholesale vs retail pricing.
- **Promotions / Coupons:** Buy X get Y, etc.
- **Weighing Scale Integration:** For grocery.
- **Customer Display:** Second screen.
- **E-commerce Sync:** Future.
- **Cloud Sync / Backup to Cloud:** Future optional.
- **Mobile App:** Future.
- **Advanced FIFO / Batch Tracking:** For perishables, expiry.
- **Serial Number Tracking:** For electronics.
- **Accounting Integration (QuickBooks, etc.):** Future.
- **SMS Integration:** Due reminders via SMS (needs API).
- **Biometric Login:** Windows Hello.
- **Dark Mode:** Light only for V1, but tokens ready.

### 5.4 Not Necessary Initially (Avoid Complexity)

- **E-commerce Integration:** Not for V1.
- **Online Ordering:** Not.
- **Kitchen Display System:** Restaurant-specific, not retail.
- **Table Management:** Not.
- **Delivery Management:** Not.
- **Email Marketing:** Not.
- **Accounting Full Double-Entry:** MERQO uses ledger but not full double-entry accounting (debit/credit) — simple cash/bank/MFS bookkeeping sufficient for retail. Avoid full accounting complexity.
- **Manufacturing / BOM:** Not for retail.
- **Multi-Currency:** BDT only for V1.
- **Tax Complex (VAT/GST):** Simple tax_rate per product, not complex tax engine.
- **Subscription Billing:** Not.
- **API for Third-Party:** Not V1.

---

## 6. MERQO Differentiation Summary

- **Bangladesh-First:** MFS agent, Bangla polished, 58mm support, offline Windows, one-time license.
- **Financial Integrity:** Ledger-based, not mutable totals, WAC, audit immutable.
- **Premium Design:** Not Bootstrap, enterprise feel, light only, dense but clean.
- **Keyboard-First POS:** For fast checkout, configurable shortcuts.
- **Hardware Abstraction:** Works with cheap generic hardware available in BD market.
- **No Fake Data:** Professional empty states, onboarding.

---

## 7. Risks if Gaps Not Addressed

- Without barcode label printing, shops can't label products.
- Without held sales, POS flow breaks for real-world scenarios.
- Without credit limit, due can grow uncontrolled.
- Without shift variance, cash theft not detectable.
- Without MFS commission report, agent can't track profit.
- Without backup reminder, data loss risk.
