# Security Architecture — MERQO RetailOS

## 1. Authentication

### 1.1 Owner & Staff Accounts

- **Storage:** `users` table with `password_hash` (argon2id) and `pin_hash` (for quick POS login).
- **Password Policy:**
  - Minimum 8 characters
  - Must contain at least one letter and one number (configurable)
  - No common passwords (check against small list)
  - Bangla error messages polished.
- **PIN Strategy:**
  - Optional 4-6 digit PIN for fast POS login (cashier).
  - PIN hashed with argon2id as well (or bcrypt if argon2 build issues on Windows).
  - PIN only allowed for login to POS/shift, not for sensitive actions (price change, void, expense view require password re-auth).
  - Configurable: allow PIN login toggle per role.

### 1.2 Local Credential Storage

- **No plaintext:** Never store password/PIN plaintext.
- **Hashing:** Use `argon2id` with:
  - memoryCost: 19456 (19 MB)
  - timeCost: 2
  - parallelism: 1
  - Fallback to `bcrypt` with cost 12 if argon2 native build fails on Windows (electron-builder includes prebuild).
- **DB file:** SQLite file in `%APPDATA%` — permissions restricted to current user (Windows ACL). No encryption at rest for V1 (future: SQLCipher optional).
- **Session:** After login, main process holds `currentSession` in memory:
  ```ts
  {
    userId, businessId, roleIds, permissions[], loginAt, lastActivityAt, shiftId?
  }
  ```
  - Session stored only in RAM, not on disk.
  - Renderer gets session info via IPC but not password hash.
  - Session timeout: 30 minutes inactivity → auto logout (configurable). POS may have longer timeout if shift open but require PIN re-entry.

### 1.3 Login Flows

1. **Password Login:** User enters phone/email + password → AuthService verifies hash → creates session → audit log `login`.
2. **PIN Login:** For quick POS, user selects account (or enters phone) + PIN → verifies pin_hash → creates session with limited scope (if role is cashier, still full permissions but some actions require password).
3. **First Run:** No login, onboarding creates owner.
4. **Logout:** Clear session, audit log `logout`.

### 1.4 Brute Force Protection

- After 5 failed attempts, lock account for 5 minutes (in-memory + DB field `locked_until`).
- Log failed attempts in audit.
- No CAPTCHA (offline).

---

## 2. Authorization — Roles & Permissions

### 2.1 Granular Permissions

Define ~60 permissions grouped by module:

**Product:**
- `product:view`, `product:create`, `product:edit`, `product:delete`, `product:view_cost`, `product:price_change`, `product:export`, `product:import`

**Category/Brand/Unit:**
- `category:view`, `category:manage`, `brand:manage`, `unit:manage`

**Inventory:**
- `inventory:view`, `stock:adjustment`, `stock:count`, `stock:view_value`

**Purchase:**
- `purchase:view`, `purchase:create`, `purchase:edit`, `purchase:delete`, `purchase:approve`, `purchase:return`, `purchase:view_cost`

**Sale/POS:**
- `sale:view`, `sale:create`, `sale:edit`, `sale:void`, `sale:refund`, `sale:return`, `sale:discount`, `pos:access`, `sale:export`, `sale:print`

**Customer:**
- `customer:view`, `customer:create`, `customer:edit`, `customer:delete`, `customer:view_due`, `customer:payment`, `customer:export`

**Supplier:**
- `supplier:view`, `supplier:create`, `supplier:edit`, `supplier:delete`, `supplier:view_payable`, `supplier:payment`, `supplier:export`

**Expense:**
- `expense:view`, `expense:create`, `expense:edit`, `expense:delete`, `expense:view_all`, `expense:export`

**Cash/Bank/MFS:**
- `cash:view`, `cash:manage`, `bank:view`, `bank:manage`, `mfs:view`, `mfs:manage`, `mfs:transaction`

**Reports/Dashboard:**
- `report:view_sales`, `report:view_purchases`, `report:view_profit`, `report:view_inventory`, `report:view_expense`, `report:view_financial`, `dashboard:view`, `dashboard:view_financial`

**Users/Roles:**
- `user:view`, `user:create`, `user:edit`, `user:delete`, `role:manage`, `permission:manage`

**Settings/Backup:**
- `settings:view`, `settings:edit`, `backup:create`, `backup:restore`, `import:execute`, `export:execute`

**Shift:**
- `shift:open`, `shift:close`, `shift:view`, `shift:view_all`

**Audit:**
- `audit:view`

**Hardware/Printing:**
- `printer:manage`, `hardware:diagnostics`

**System:**
- `system:view_logs`

### 2.2 Roles (Seed)

- **Owner:** All permissions, cannot be restricted, at least one owner must exist.
- **Manager:** Almost all except user/role management, backup restore, settings edit? Actually manager can manage most operational.
- **Cashier:** POS access, sale create/view, customer view/create, cash view, shift open/close, product view, low stock view. Cannot view cost, profit, expense, supplier payable, edit product price, void without approval, stock adjustment.
- **Stock Keeper:** Product view/create/edit, inventory view, stock adjustment, purchase view/create, stock count, category/brand/unit manage. Cannot view financial dashboard, expenses, customer due.
- **Accountant:** All financial reports, expenses, customer/supplier ledgers, cash/bank/MFS view, sales/purchases view, but cannot void sales, adjust stock, manage users.

Custom roles can be created by owner/manager with any permission combo.

### 2.3 Enforcement

- **Service Layer Enforcement:** Every service method starts with `this.requirePermission(user, 'permission:id')`. If fails, throw `AuthorizationError`.
- **UI Hiding:** UI checks permissions via `usePermission()` hook to hide buttons, but service still enforces — never rely on UI alone.
- **Field-Level:** Some fields restricted: e.g., `cost_price` only visible if `product:view_cost`. Service strips field if not permitted.
- **Middleware:** IPC handler wrapper automatically checks session exists, then service checks permission.

### 2.4 Permission Checks Examples

```ts
// In SaleService
async voidSale(user, saleId, reason) {
  requirePermission(user, 'sale:void');
  // additionally, if sale is older than 24h, require 'sale:approve' or manager approval
  // ...
}
```

---

## 3. Audit Log — Immutable

### 3.1 Purpose

- Track who did what, when, before/after for critical entities.
- For compliance, troubleshooting, staff accountability.

### 3.2 Logged Actions

- **Auth:** login, logout, failed_login, password_change, pin_change
- **Product:** product_create, product_update, price_change, product_deactivate, barcode_add
- **Inventory:** stock_adjustment, stock_count, damage, loss
- **Purchasing:** purchase_create, purchase_update, purchase_receive, purchase_return, supplier_payment
- **Sales:** sale_create, sale_void, sale_return, sale_refund, discount_apply
- **Customers/Suppliers:** customer_create, customer_update, customer_payment, supplier_payment
- **Expenses:** expense_create, expense_update, expense_delete
- **Users/Roles:** user_create, user_update, user_deactivate, role_create, permission_change
- **System:** backup_create, backup_restore, import, export, settings_change, shift_open, shift_close, printer_test, cash_adjustment

### 3.3 Structure

- Table `audit_logs` (see database-architecture.md)
- `before_json` and `after_json` store diff for updates (sanitized, no password hashes).
- Immutable: No UPDATE/DELETE allowed. Enforced via:
  - Service never updates audit_logs.
  - DB trigger `BEFORE UPDATE OR DELETE ON audit_logs` raises error.
  - Only INSERT allowed.

### 3.4 Actor & Timestamp

- `user_id` from session, `created_at` UTC ms, `business_id`.
- If system action (auto backup), user_id null, description indicates system.

### 3.5 Retention

- Keep 2 years by default. After 2 years, archive to file (JSON) and delete? For V1, keep forever (SQLite can handle). Future: archival job.

### 3.6 Viewing

- Audit screen with filters: date range, user, entity type, action.
- Export allowed only with permission `audit:view`.
- No editing.

---

## 4. Sensitive Data Protection

### 4.1 What Is Sensitive

- Password hashes, PIN hashes
- Bank account numbers (mask display: show last 4)
- MFS account numbers (mask)
- Customer phone (not highly sensitive but PII)
- Backup files (contain entire DB)

### 4.2 Protection

- **Masking:** UI masks bank account: `****1234`. Full number only visible on click with permission.
- **Logs:** Never log password, PIN, full card number, full bank account.
- **Backups:** Backup file checksum stored, file permissions restricted. User can set backup password (future: encrypt backup with AES).
- **DB File:** Stored in user-specific AppData, not shared folder.

### 4.3 Database Security

- SQLite file permissions: Windows ACL only current user + admins.
- No network access to DB.
- WAL mode, but no remote.
- PRAGMA foreign_keys ON prevents orphaned records.
- All queries via Drizzle ORM (parameterized) — no SQL injection.

---

## 5. Backup & Restore Security

- **Backup:** Creates copy of DB after checkpoint. Validates via `PRAGMA integrity_check`. Stores checksum.
- **Restore:** Requires owner permission + password re-entry. Creates safety backup of current DB before restore. Validates backup file integrity before restore. If restore fails, rollback to safety backup.
- **Audit:** Both backup and restore logged.

---

## 6. Session Management

- Single session per user? Allow multiple? For V1, single session per app instance (one user logged in at a time — typical for desktop POS). If another user logs in, previous session logged out.
- Session stored in main process memory, cleared on app quit.
- Auto-lock after inactivity: show lock screen, require PIN/password to unlock, keep shift open.
- Shift tied to session — if session expires, shift remains open but requires login to close.

---

## 7. Security Best Practices

- **Electron Security:**
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true` for renderer (except where preload needed)
  - `webSecurity: true`
  - CSP header: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` (Tailwind needs unsafe-inline or use nonce)
  - Allowlist IPC channels — preload only exposes `window.merqo.*`
  - No `remote` module.
- **Dependency Security:** `npm audit` in CI, update Electron promptly.
- **Code Signing:** Windows code signing certificate for installer to avoid SmartScreen warnings.
- **No Secrets in Code:** No API keys (since offline). If future cloud sync, use secure storage.

---

## 8. Error Handling & Security

- User never sees stack trace, SQL errors, file paths.
- Generic message + correlation ID.
- Technical details logged to file with level error, including stack, userId, action.
- Log file not accessible via UI unless permission `system:view_logs`.

---

## 9. Future Considerations

- **SQLCipher:** Optional DB encryption with user password.
- **2FA:** For owner, optional TOTP.
- **Biometric:** Windows Hello for quick login (future).
