import { BaseRepository } from './base';

export interface ExpenseCategory {
  id: string;
  businessId: string;
  name: string;
  nameBn?: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MfsProvider {
  id: string;
  code: string;
  name: string;
  nameBn?: string | null;
  logoPath?: string | null;
  isActive: boolean;
  createdAt: number;
}

export interface MfsAccount {
  id: string;
  businessId: string;
  providerId: string;
  accountNumber: string;
  accountName?: string | null;
  isAgent: boolean;
  openingBalancePaisa: number;
  currentBalancePaisa: number;
  commissionRate: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CashAccount {
  id: string;
  businessId: string;
  name: string;
  openingBalancePaisa: number;
  currentBalancePaisa: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CashMovement {
  id: string;
  businessId: string;
  cashAccountId: string;
  movementType: string;
  amountPaisa: number;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: number;
  createdBy?: string | null;
}

export interface BankAccount {
  id: string;
  businessId: string;
  bankName: string;
  accountName?: string | null;
  accountNumber?: string | null;
  branch?: string | null;
  accountType?: string | null;
  openingBalancePaisa: number;
  currentBalancePaisa: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface BankTransaction {
  id: string;
  businessId: string;
  bankAccountId: string;
  transactionType: string;
  amountPaisa: number;
  referenceType?: string | null;
  referenceId?: string | null;
  chequeNumber?: string | null;
  notes?: string | null;
  createdAt: number;
  createdBy?: string | null;
}

export interface MfsTransaction {
  id: string;
  businessId: string;
  mfsAccountId: string;
  transactionType: string;
  amountPaisa: number;
  customerChargePaisa: number;
  commissionPaisa: number;
  netAmountPaisa: number;
  balanceAfterPaisa?: number | null;
  transactionRef?: string | null;
  customerPhone?: string | null;
  operator?: string | null;
  notes?: string | null;
  createdAt: number;
  createdBy?: string | null;
  customerId?: string | null;
}

export interface Expense {
  id: string;
  businessId: string;
  categoryId: string;
  expenseNumber: string;
  amountPaisa: number;
  expenseDate: number;
  paymentMethod: string;
  cashAccountId?: string | null;
  bankAccountId?: string | null;
  mfsAccountId?: string | null;
  reference?: string | null;
  notes?: string | null;
  attachmentPath?: string | null;
  status: string;
  voidedAt?: number | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  createdAt: number;
  createdBy?: string | null;
}

export interface FinanceTransfer {
  id: string;
  businessId: string;
  transferNumber: string;
  sourceType: string;
  sourceAccountId: string;
  destType: string;
  destAccountId: string;
  amountPaisa: number;
  chargePaisa: number;
  commissionPaisa: number;
  reference?: string | null;
  notes?: string | null;
  status: string;
  createdAt: number;
  createdBy?: string | null;
  voidedAt?: number | null;
  voidedBy?: string | null;
  voidReason?: string | null;
}

export interface Shift {
  id: string;
  businessId: string;
  shiftNumber: string;
  cashAccountId: string;
  openedByUserId: string;
  closedByUserId?: string | null;
  openedAt: number;
  closedAt?: number | null;
  openingCashPaisa: number;
  expectedCashPaisa?: number | null;
  actualCashPaisa?: number | null;
  variancePaisa?: number | null;
  totalSalesPaisa: number;
  totalCashSalesPaisa: number;
  totalExpensesPaisa: number;
  notes?: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export class ExpenseCategoryRepository extends BaseRepository {
  create(data: Omit<ExpenseCategory, 'id' | 'createdAt' | 'updatedAt'>): ExpenseCategory {
    try {
      const id = this.generateId();
      const now = this.now();
      const cat: ExpenseCategory = {
        id,
        businessId: data.businessId,
        name: data.name,
        nameBn: data.nameBn || null,
        isSystem: data.isSystem ?? false,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };

      this.db.prepare(`
        INSERT INTO expense_categories (id, business_id, name, name_bn, is_system, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(cat.id, cat.businessId, cat.name, cat.nameBn, cat.isSystem ? 1 : 0, cat.isActive ? 1 : 0, cat.createdAt, cat.updatedAt);

      return cat;
    } catch (e) {
      this.handleError(e, 'ExpenseCategory');
    }
  }

  findByBusiness(businessId: string): ExpenseCategory[] {
    const rows = this.db.prepare('SELECT * FROM expense_categories WHERE business_id = ? ORDER BY name').all(businessId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findById(id: string): ExpenseCategory | null {
    const row = this.db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  search(businessId: string, query: string): ExpenseCategory[] {
    const like = `%${query}%`;
    const rows = this.db.prepare('SELECT * FROM expense_categories WHERE business_id = ? AND (name LIKE ? OR name_bn LIKE ?) ORDER BY name').all(businessId, like, like) as any[];
    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: any): ExpenseCategory {
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      nameBn: row.name_bn,
      isSystem: !!row.is_system,
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class MfsProviderRepository extends BaseRepository {
  create(data: Omit<MfsProvider, 'id' | 'createdAt'>): MfsProvider {
    try {
      const id = this.generateId();
      const now = this.now();
      const provider: MfsProvider = {
        id,
        code: data.code,
        name: data.name,
        nameBn: data.nameBn || null,
        logoPath: data.logoPath || null,
        isActive: data.isActive ?? true,
        createdAt: now,
      };

      this.db.prepare(`
        INSERT INTO mfs_providers (id, code, name, name_bn, logo_path, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(provider.id, provider.code, provider.name, provider.nameBn, provider.logoPath, provider.isActive ? 1 : 0, provider.createdAt);

      return provider;
    } catch (e) {
      this.handleError(e, 'MfsProvider');
    }
  }

  findAll(): MfsProvider[] {
    const rows = this.db.prepare('SELECT * FROM mfs_providers ORDER BY name').all() as any[];
    return rows.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      nameBn: r.name_bn,
      logoPath: r.logo_path,
      isActive: !!r.is_active,
      createdAt: r.created_at,
    }));
  }

  findByCode(code: string): MfsProvider | null {
    const row = this.db.prepare('SELECT * FROM mfs_providers WHERE code = ?').get(code) as any;
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      nameBn: row.name_bn,
      logoPath: row.logo_path,
      isActive: !!row.is_active,
      createdAt: row.created_at,
    };
  }

  findById(id: string): MfsProvider | null {
    const row = this.db.prepare('SELECT * FROM mfs_providers WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      nameBn: row.name_bn,
      logoPath: row.logo_path,
      isActive: !!row.is_active,
      createdAt: row.created_at,
    };
  }
}

export class MfsAccountRepository extends BaseRepository {
  create(data: Omit<MfsAccount, 'id' | 'createdAt' | 'updatedAt'>): MfsAccount {
    try {
      const id = this.generateId();
      const now = this.now();
      const account: MfsAccount = {
        id,
        businessId: data.businessId,
        providerId: data.providerId,
        accountNumber: data.accountNumber,
        accountName: data.accountName || null,
        isAgent: data.isAgent ?? true,
        openingBalancePaisa: data.openingBalancePaisa ?? 0,
        currentBalancePaisa: data.currentBalancePaisa ?? data.openingBalancePaisa ?? 0,
        commissionRate: data.commissionRate ?? 0,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };

      this.db.prepare(`
        INSERT INTO mfs_accounts (id, business_id, provider_id, account_number, account_name, is_agent, opening_balance_paisa, current_balance_paisa, commission_rate, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        account.id,
        account.businessId,
        account.providerId,
        account.accountNumber,
        account.accountName,
        account.isAgent ? 1 : 0,
        account.openingBalancePaisa,
        account.currentBalancePaisa,
        account.commissionRate,
        account.isActive ? 1 : 0,
        account.createdAt,
        account.updatedAt
      );

      return account;
    } catch (e) {
      this.handleError(e, 'MfsAccount');
    }
  }

  findByBusiness(businessId: string, includeInactive = false): MfsAccount[] {
    let sql = 'SELECT * FROM mfs_accounts WHERE business_id = ?';
    const params: any[] = [businessId];
    if (!includeInactive) {
      sql += ' AND is_active = 1';
    }
    sql += ' ORDER BY account_number';
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findById(id: string): MfsAccount | null {
    const row = this.db.prepare('SELECT * FROM mfs_accounts WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  search(businessId: string, query: string): MfsAccount[] {
    const like = `%${query}%`;
    const rows = this.db.prepare('SELECT * FROM mfs_accounts WHERE business_id = ? AND (account_number LIKE ? OR account_name LIKE ?) ORDER BY account_number').all(businessId, like, like) as any[];
    return rows.map(r => this.mapRow(r));
  }

  update(id: string, data: Partial<Omit<MfsAccount, 'id' | 'businessId' | 'createdAt'>>): MfsAccount | null {
    const existing = this.findById(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: this.now() } as MfsAccount;
    this.db.prepare(`
      UPDATE mfs_accounts SET account_name = ?, account_number = ?, provider_id = ?, is_agent = ?, commission_rate = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.accountName, updated.accountNumber, updated.providerId, updated.isAgent ? 1 : 0, updated.commissionRate, updated.isActive ? 1 : 0, updated.updatedAt, id);
    return updated;
  }

  deactivate(id: string): void {
    this.db.prepare('UPDATE mfs_accounts SET is_active = 0, updated_at = ? WHERE id = ?').run(this.now(), id);
  }

  activate(id: string): void {
    this.db.prepare('UPDATE mfs_accounts SET is_active = 1, updated_at = ? WHERE id = ?').run(this.now(), id);
  }

  getBalance(mfsAccountId: string): number {
    const row = this.db.prepare('SELECT current_balance_paisa as bal FROM mfs_accounts WHERE id = ?').get(mfsAccountId) as { bal: number } | undefined;
    return row?.bal ?? 0;
  }

  private mapRow(row: any): MfsAccount {
    return {
      id: row.id,
      businessId: row.business_id,
      providerId: row.provider_id,
      accountNumber: row.account_number,
      accountName: row.account_name,
      isAgent: !!row.is_agent,
      openingBalancePaisa: row.opening_balance_paisa,
      currentBalancePaisa: row.current_balance_paisa,
      commissionRate: row.commission_rate,
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class CashAccountRepository extends BaseRepository {
  create(data: Omit<CashAccount, 'id' | 'createdAt' | 'updatedAt'>): CashAccount {
    try {
      const id = this.generateId();
      const now = this.now();
      const account: CashAccount = {
        id,
        businessId: data.businessId,
        name: data.name,
        openingBalancePaisa: data.openingBalancePaisa ?? 0,
        currentBalancePaisa: data.currentBalancePaisa ?? data.openingBalancePaisa ?? 0,
        isDefault: data.isDefault ?? false,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };

      this.db.prepare(`
        INSERT INTO cash_accounts (id, business_id, name, opening_balance_paisa, current_balance_paisa, is_default, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        account.id,
        account.businessId,
        account.name,
        account.openingBalancePaisa,
        account.currentBalancePaisa,
        account.isDefault ? 1 : 0,
        account.isActive ? 1 : 0,
        account.createdAt,
        account.updatedAt
      );

      return account;
    } catch (e) {
      this.handleError(e, 'CashAccount');
    }
  }

  findById(id: string): CashAccount | null {
    const row = this.db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBusiness(businessId: string, includeInactive = false): CashAccount[] {
    let sql = 'SELECT * FROM cash_accounts WHERE business_id = ?';
    const params: any[] = [businessId];
    if (!includeInactive) sql += ' AND is_active = 1';
    sql += ' ORDER BY is_default DESC, name';
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findDefault(businessId: string): CashAccount | null {
    const row = this.db.prepare('SELECT * FROM cash_accounts WHERE business_id = ? AND is_default = 1 LIMIT 1').get(businessId) as any;
    if (row) return this.mapRow(row);
    const fallback = this.db.prepare('SELECT * FROM cash_accounts WHERE business_id = ? AND is_active = 1 LIMIT 1').get(businessId) as any;
    return fallback ? this.mapRow(fallback) : null;
  }

  search(businessId: string, query: string): CashAccount[] {
    const like = `%${query}%`;
    const rows = this.db.prepare('SELECT * FROM cash_accounts WHERE business_id = ? AND name LIKE ? ORDER BY is_default DESC, name').all(businessId, like) as any[];
    return rows.map(r => this.mapRow(r));
  }

  update(id: string, data: Partial<Omit<CashAccount, 'id' | 'businessId' | 'createdAt'>>): CashAccount | null {
    const existing = this.findById(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: this.now() } as CashAccount;
    this.db.prepare(`
      UPDATE cash_accounts SET name = ?, is_default = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.name, updated.isDefault ? 1 : 0, updated.isActive ? 1 : 0, updated.updatedAt, id);
    return updated;
  }

  deactivate(id: string): void {
    this.db.prepare('UPDATE cash_accounts SET is_active = 0, updated_at = ? WHERE id = ?').run(this.now(), id);
  }

  activate(id: string): void {
    this.db.prepare('UPDATE cash_accounts SET is_active = 1, updated_at = ? WHERE id = ?').run(this.now(), id);
  }

  getNextAccountNumber(businessId: string): string {
    const row = this.db.prepare('SELECT name FROM cash_accounts WHERE business_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(businessId) as any;
    return row ? `CASH-${Date.now().toString().slice(-5)}` : 'CASH-00001';
  }

  private mapRow(row: any): CashAccount {
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      openingBalancePaisa: row.opening_balance_paisa,
      currentBalancePaisa: row.current_balance_paisa,
      isDefault: !!row.is_default,
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class CashMovementRepository extends BaseRepository {
  create(data: Omit<CashMovement, 'id' | 'createdAt'>): CashMovement {
    try {
      const id = this.generateId();
      const now = this.now();
      const movement: CashMovement = {
        id,
        businessId: data.businessId,
        cashAccountId: data.cashAccountId,
        movementType: data.movementType,
        amountPaisa: data.amountPaisa,
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        notes: data.notes || null,
        createdAt: now,
        createdBy: data.createdBy || null,
      };

      this.db.prepare(`
        INSERT INTO cash_movements (id, business_id, cash_account_id, movement_type, amount_paisa, reference_type, reference_id, notes, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        movement.id,
        movement.businessId,
        movement.cashAccountId,
        movement.movementType,
        movement.amountPaisa,
        movement.referenceType,
        movement.referenceId,
        movement.notes,
        movement.createdAt,
        movement.createdBy
      );

      try {
        const current = this.db.prepare('SELECT current_balance_paisa FROM cash_accounts WHERE id = ?').get(data.cashAccountId) as any;
        if (current) {
          const newBalance = (current.current_balance_paisa || 0) + data.amountPaisa;
          this.db.prepare('UPDATE cash_accounts SET current_balance_paisa = ?, updated_at = ? WHERE id = ?').run(newBalance, now, data.cashAccountId);
        }
      } catch {}

      return movement;
    } catch (e) {
      this.handleError(e, 'CashMovement');
    }
  }

  findByAccount(cashAccountId: string, limit = 50, offset = 0, filters?: { type?: string; fromDate?: number; toDate?: number }): CashMovement[] {
    let sql = 'SELECT * FROM cash_movements WHERE cash_account_id = ?';
    const params: any[] = [cashAccountId];
    if (filters?.type) {
      sql += ' AND movement_type = ?';
      params.push(filters.type);
    }
    if (filters?.fromDate) {
      sql += ' AND created_at >= ?';
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      sql += ' AND created_at <= ?';
      params.push(filters.toDate);
    }
    sql += ' ORDER BY created_at ASC, rowid ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByReference(referenceType: string, referenceId: string): CashMovement[] {
    const rows = this.db.prepare('SELECT * FROM cash_movements WHERE reference_type = ? AND reference_id = ?').all(referenceType, referenceId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByBusiness(businessId: string, limit = 100, offset = 0, filters?: { accountId?: string; type?: string; fromDate?: number; toDate?: number; search?: string }): CashMovement[] {
    let sql = 'SELECT * FROM cash_movements WHERE business_id = ?';
    const params: any[] = [businessId];
    if (filters?.accountId) {
      sql += ' AND cash_account_id = ?';
      params.push(filters.accountId);
    }
    if (filters?.type) {
      sql += ' AND movement_type = ?';
      params.push(filters.type);
    }
    if (filters?.fromDate) {
      sql += ' AND created_at >= ?';
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      sql += ' AND created_at <= ?';
      params.push(filters.toDate);
    }
    if (filters?.search) {
      sql += ' AND (notes LIKE ? OR reference_type LIKE ?)';
      const like = `%${filters.search}%`;
      params.push(like, like);
    }
    sql += ' ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getBalance(cashAccountId: string): number {
    const account = this.db.prepare('SELECT opening_balance_paisa FROM cash_accounts WHERE id = ?').get(cashAccountId) as { opening_balance_paisa: number } | undefined;
    const opening = account?.opening_balance_paisa ?? 0;
    const row = this.db.prepare('SELECT SUM(amount_paisa) as total FROM cash_movements WHERE cash_account_id = ?').get(cashAccountId) as { total: number | null };
    return opening + (row.total || 0);
  }

  getStatementWithRunningBalance(cashAccountId: string, fromDate?: number, toDate?: number): { movement: CashMovement; runningBalance: number }[] {
    const account = this.db.prepare('SELECT opening_balance_paisa FROM cash_accounts WHERE id = ?').get(cashAccountId) as { opening_balance_paisa: number } | undefined;
    const opening = account?.opening_balance_paisa ?? 0;

    let sql = 'SELECT * FROM cash_movements WHERE cash_account_id = ?';
    const params: any[] = [cashAccountId];
    if (fromDate) {
      sql += ' AND created_at >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      sql += ' AND created_at <= ?';
      params.push(toDate);
    }
    sql += ' ORDER BY created_at ASC, rowid ASC';
    const rows = this.db.prepare(sql).all(...params) as any[];

    let running = opening;
    // If fromDate filter, need sum before fromDate for opening
    if (fromDate) {
      const beforeRow = this.db.prepare('SELECT SUM(amount_paisa) as total FROM cash_movements WHERE cash_account_id = ? AND created_at < ?').get(cashAccountId, fromDate) as { total: number | null };
      running = opening + (beforeRow.total || 0);
    }

    return rows.map(r => {
      const mov = this.mapRow(r);
      running += mov.amountPaisa;
      return { movement: mov, runningBalance: running };
    });
  }

  getDailySummary(businessId: string, date: number): { inflow: number; outflow: number } {
    const start = new Date(date);
    start.setHours(0,0,0,0);
    const end = new Date(date);
    end.setHours(23,59,59,999);
    const startMs = start.getTime();
    const endMs = end.getTime();
    const rows = this.db.prepare('SELECT amount_paisa FROM cash_movements WHERE business_id = ? AND created_at >= ? AND created_at <= ?').all(businessId, startMs, endMs) as any[];
    let inflow = 0, outflow = 0;
    for (const r of rows) {
      if (r.amount_paisa > 0) inflow += r.amount_paisa;
      else outflow += Math.abs(r.amount_paisa);
    }
    return { inflow, outflow };
  }

  private mapRow(row: any): CashMovement {
    return {
      id: row.id,
      businessId: row.business_id,
      cashAccountId: row.cash_account_id,
      movementType: row.movement_type,
      amountPaisa: row.amount_paisa,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }
}

export class BankAccountRepository extends BaseRepository {
  create(data: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt'>): BankAccount {
    try {
      const id = this.generateId();
      const now = this.now();
      const account: BankAccount = {
        id,
        businessId: data.businessId,
        bankName: data.bankName,
        accountName: data.accountName || null,
        accountNumber: data.accountNumber || null,
        branch: data.branch || null,
        accountType: (data as any).accountType || null,
        openingBalancePaisa: data.openingBalancePaisa ?? 0,
        currentBalancePaisa: data.currentBalancePaisa ?? data.openingBalancePaisa ?? 0,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };

      this.db.prepare(`
        INSERT INTO bank_accounts (id, business_id, bank_name, account_name, account_number, branch, opening_balance_paisa, current_balance_paisa, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        account.id,
        account.businessId,
        account.bankName,
        account.accountName,
        account.accountNumber,
        account.branch,
        account.openingBalancePaisa,
        account.currentBalancePaisa,
        account.isActive ? 1 : 0,
        account.createdAt,
        account.updatedAt
      );

      return account;
    } catch (e) {
      this.handleError(e, 'BankAccount');
    }
  }

  findById(id: string): BankAccount | null {
    const row = this.db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBusiness(businessId: string, includeInactive = false): BankAccount[] {
    let sql = 'SELECT * FROM bank_accounts WHERE business_id = ?';
    const params: any[] = [businessId];
    if (!includeInactive) sql += ' AND is_active = 1';
    sql += ' ORDER BY bank_name';
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  search(businessId: string, query: string): BankAccount[] {
    const like = `%${query}%`;
    const rows = this.db.prepare('SELECT * FROM bank_accounts WHERE business_id = ? AND (bank_name LIKE ? OR account_name LIKE ? OR account_number LIKE ?) ORDER BY bank_name').all(businessId, like, like, like) as any[];
    return rows.map(r => this.mapRow(r));
  }

  update(id: string, data: Partial<Omit<BankAccount, 'id' | 'businessId' | 'createdAt'>>): BankAccount | null {
    const existing = this.findById(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: this.now() } as BankAccount;
    this.db.prepare(`
      UPDATE bank_accounts SET bank_name = ?, account_name = ?, account_number = ?, branch = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.bankName, updated.accountName, updated.accountNumber, updated.branch, updated.isActive ? 1 : 0, updated.updatedAt, id);
    return updated;
  }

  deactivate(id: string): void {
    this.db.prepare('UPDATE bank_accounts SET is_active = 0, updated_at = ? WHERE id = ?').run(this.now(), id);
  }

  activate(id: string): void {
    this.db.prepare('UPDATE bank_accounts SET is_active = 1, updated_at = ? WHERE id = ?').run(this.now(), id);
  }

  private mapRow(row: any): BankAccount {
    return {
      id: row.id,
      businessId: row.business_id,
      bankName: row.bank_name,
      accountName: row.account_name,
      accountNumber: row.account_number,
      branch: row.branch,
      accountType: row.account_type || null,
      openingBalancePaisa: row.opening_balance_paisa,
      currentBalancePaisa: row.current_balance_paisa,
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class BankTransactionRepository extends BaseRepository {
  create(data: Omit<BankTransaction, 'id' | 'createdAt'>): BankTransaction {
    try {
      const id = this.generateId();
      const now = this.now();
      const tx: BankTransaction = {
        id,
        businessId: data.businessId,
        bankAccountId: data.bankAccountId,
        transactionType: data.transactionType,
        amountPaisa: data.amountPaisa,
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        chequeNumber: data.chequeNumber || null,
        notes: data.notes || null,
        createdAt: now,
        createdBy: data.createdBy || null,
      };

      this.db.prepare(`
        INSERT INTO bank_transactions (id, business_id, bank_account_id, transaction_type, amount_paisa, reference_type, reference_id, cheque_number, notes, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tx.id,
        tx.businessId,
        tx.bankAccountId,
        tx.transactionType,
        tx.amountPaisa,
        tx.referenceType,
        tx.referenceId,
        tx.chequeNumber,
        tx.notes,
        tx.createdAt,
        tx.createdBy
      );

      try {
        const current = this.db.prepare('SELECT current_balance_paisa FROM bank_accounts WHERE id = ?').get(data.bankAccountId) as any;
        if (current) {
          const newBalance = (current.current_balance_paisa || 0) + data.amountPaisa;
          this.db.prepare('UPDATE bank_accounts SET current_balance_paisa = ?, updated_at = ? WHERE id = ?').run(newBalance, now, data.bankAccountId);
        }
      } catch {}

      return tx;
    } catch (e) {
      this.handleError(e, 'BankTransaction');
    }
  }

  findByAccount(bankAccountId: string, limit = 50, offset = 0, filters?: { type?: string; fromDate?: number; toDate?: number }): BankTransaction[] {
    let sql = 'SELECT * FROM bank_transactions WHERE bank_account_id = ?';
    const params: any[] = [bankAccountId];
    if (filters?.type) {
      sql += ' AND transaction_type = ?';
      params.push(filters.type);
    }
    if (filters?.fromDate) {
      sql += ' AND created_at >= ?';
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      sql += ' AND created_at <= ?';
      params.push(filters.toDate);
    }
    sql += ' ORDER BY created_at ASC, rowid ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByBusiness(businessId: string, limit = 100, offset = 0, filters?: { accountId?: string; type?: string; fromDate?: number; toDate?: number; search?: string }): BankTransaction[] {
    let sql = 'SELECT * FROM bank_transactions WHERE business_id = ?';
    const params: any[] = [businessId];
    if (filters?.accountId) {
      sql += ' AND bank_account_id = ?';
      params.push(filters.accountId);
    }
    if (filters?.type) {
      sql += ' AND transaction_type = ?';
      params.push(filters.type);
    }
    if (filters?.fromDate) {
      sql += ' AND created_at >= ?';
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      sql += ' AND created_at <= ?';
      params.push(filters.toDate);
    }
    if (filters?.search) {
      sql += ' AND (notes LIKE ? OR reference_type LIKE ?)';
      const like = `%${filters.search}%`;
      params.push(like, like);
    }
    sql += ' ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getBalance(bankAccountId: string): number {
    const account = this.db.prepare('SELECT opening_balance_paisa FROM bank_accounts WHERE id = ?').get(bankAccountId) as { opening_balance_paisa: number } | undefined;
    const opening = account?.opening_balance_paisa ?? 0;
    const row = this.db.prepare('SELECT SUM(amount_paisa) as total FROM bank_transactions WHERE bank_account_id = ?').get(bankAccountId) as { total: number | null };
    return opening + (row.total || 0);
  }

  getStatementWithRunningBalance(bankAccountId: string, fromDate?: number, toDate?: number): { transaction: BankTransaction; runningBalance: number }[] {
    const account = this.db.prepare('SELECT opening_balance_paisa FROM bank_accounts WHERE id = ?').get(bankAccountId) as { opening_balance_paisa: number } | undefined;
    const opening = account?.opening_balance_paisa ?? 0;
    let sql = 'SELECT * FROM bank_transactions WHERE bank_account_id = ?';
    const params: any[] = [bankAccountId];
    if (fromDate) {
      sql += ' AND created_at >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      sql += ' AND created_at <= ?';
      params.push(toDate);
    }
    sql += ' ORDER BY created_at ASC, rowid ASC';
    const rows = this.db.prepare(sql).all(...params) as any[];
    let running = opening;
    if (fromDate) {
      const beforeRow = this.db.prepare('SELECT SUM(amount_paisa) as total FROM bank_transactions WHERE bank_account_id = ? AND created_at < ?').get(bankAccountId, fromDate) as { total: number | null };
      running = opening + (beforeRow.total || 0);
    }
    return rows.map(r => {
      const tx = this.mapRow(r);
      running += tx.amountPaisa;
      return { transaction: tx, runningBalance: running };
    });
  }

  private mapRow(row: any): BankTransaction {
    return {
      id: row.id,
      businessId: row.business_id,
      bankAccountId: row.bank_account_id,
      transactionType: row.transaction_type,
      amountPaisa: row.amount_paisa,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      chequeNumber: row.cheque_number,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }
}

export class MfsTransactionRepository extends BaseRepository {
  create(data: Omit<MfsTransaction, 'id' | 'createdAt'>): MfsTransaction {
    try {
      const id = this.generateId();
      const now = this.now();
      const tx: MfsTransaction = {
        id,
        businessId: data.businessId,
        mfsAccountId: data.mfsAccountId,
        transactionType: data.transactionType,
        amountPaisa: data.amountPaisa,
        customerChargePaisa: data.customerChargePaisa ?? 0,
        commissionPaisa: data.commissionPaisa ?? 0,
        netAmountPaisa: data.netAmountPaisa ?? data.amountPaisa,
        balanceAfterPaisa: data.balanceAfterPaisa || null,
        transactionRef: data.transactionRef || null,
        customerPhone: data.customerPhone || null,
        operator: data.operator || null,
        notes: data.notes || null,
        createdAt: now,
        createdBy: data.createdBy || null,
        customerId: data.customerId || null,
      };

      this.db.prepare(`
        INSERT INTO mfs_transactions (id, business_id, mfs_account_id, transaction_type, amount_paisa, customer_charge_paisa, commission_paisa, net_amount_paisa, balance_after_paisa, transaction_ref, customer_phone, operator, notes, created_at, created_by, customer_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tx.id,
        tx.businessId,
        tx.mfsAccountId,
        tx.transactionType,
        tx.amountPaisa,
        tx.customerChargePaisa,
        tx.commissionPaisa,
        tx.netAmountPaisa,
        tx.balanceAfterPaisa,
        tx.transactionRef,
        tx.customerPhone,
        tx.operator,
        tx.notes,
        tx.createdAt,
        tx.createdBy,
        tx.customerId
      );

      try {
        const current = this.db.prepare('SELECT current_balance_paisa FROM mfs_accounts WHERE id = ?').get(data.mfsAccountId) as any;
        if (current) {
          const newBalance = (current.current_balance_paisa || 0) + tx.netAmountPaisa;
          this.db.prepare('UPDATE mfs_accounts SET current_balance_paisa = ?, updated_at = ? WHERE id = ?').run(newBalance, now, data.mfsAccountId);
        }
      } catch {}

      return tx;
    } catch (e) {
      this.handleError(e, 'MfsTransaction');
    }
  }

  findByAccount(mfsAccountId: string, limit = 50, offset = 0, filters?: { type?: string; fromDate?: number; toDate?: number }): MfsTransaction[] {
    let sql = 'SELECT * FROM mfs_transactions WHERE mfs_account_id = ?';
    const params: any[] = [mfsAccountId];
    if (filters?.type) {
      sql += ' AND transaction_type = ?';
      params.push(filters.type);
    }
    if (filters?.fromDate) {
      sql += ' AND created_at >= ?';
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      sql += ' AND created_at <= ?';
      params.push(filters.toDate);
    }
    sql += ' ORDER BY created_at ASC, rowid ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByBusiness(businessId: string, limit = 100, offset = 0, filters?: { accountId?: string; type?: string; fromDate?: number; toDate?: number; search?: string }): MfsTransaction[] {
    let sql = 'SELECT * FROM mfs_transactions WHERE business_id = ?';
    const params: any[] = [businessId];
    if (filters?.accountId) {
      sql += ' AND mfs_account_id = ?';
      params.push(filters.accountId);
    }
    if (filters?.type) {
      sql += ' AND transaction_type = ?';
      params.push(filters.type);
    }
    if (filters?.fromDate) {
      sql += ' AND created_at >= ?';
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      sql += ' AND created_at <= ?';
      params.push(filters.toDate);
    }
    if (filters?.search) {
      sql += ' AND (notes LIKE ? OR transaction_ref LIKE ?)';
      const like = `%${filters.search}%`;
      params.push(like, like);
    }
    sql += ' ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getBalance(mfsAccountId: string): number {
    const account = this.db.prepare('SELECT opening_balance_paisa FROM mfs_accounts WHERE id = ?').get(mfsAccountId) as { opening_balance_paisa: number } | undefined;
    const opening = account?.opening_balance_paisa ?? 0;
    const row = this.db.prepare('SELECT SUM(net_amount_paisa) as total FROM mfs_transactions WHERE mfs_account_id = ?').get(mfsAccountId) as { total: number | null };
    return opening + (row.total || 0);
  }

  getStatementWithRunningBalance(mfsAccountId: string, fromDate?: number, toDate?: number): { transaction: MfsTransaction; runningBalance: number }[] {
    const account = this.db.prepare('SELECT opening_balance_paisa FROM mfs_accounts WHERE id = ?').get(mfsAccountId) as { opening_balance_paisa: number } | undefined;
    const opening = account?.opening_balance_paisa ?? 0;
    let sql = 'SELECT * FROM mfs_transactions WHERE mfs_account_id = ?';
    const params: any[] = [mfsAccountId];
    if (fromDate) {
      sql += ' AND created_at >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      sql += ' AND created_at <= ?';
      params.push(toDate);
    }
    sql += ' ORDER BY created_at ASC, rowid ASC';
    const rows = this.db.prepare(sql).all(...params) as any[];
    let running = opening;
    if (fromDate) {
      const beforeRow = this.db.prepare('SELECT SUM(net_amount_paisa) as total FROM mfs_transactions WHERE mfs_account_id = ? AND created_at < ?').get(mfsAccountId, fromDate) as { total: number | null };
      running = opening + (beforeRow.total || 0);
    }
    return rows.map(r => {
      const tx = this.mapRow(r);
      running += tx.netAmountPaisa;
      return { transaction: tx, runningBalance: running };
    });
  }

  private mapRow(row: any): MfsTransaction {
    return {
      id: row.id,
      businessId: row.business_id,
      mfsAccountId: row.mfs_account_id,
      transactionType: row.transaction_type,
      amountPaisa: row.amount_paisa,
      customerChargePaisa: row.customer_charge_paisa,
      commissionPaisa: row.commission_paisa,
      netAmountPaisa: row.net_amount_paisa,
      balanceAfterPaisa: row.balance_after_paisa,
      transactionRef: row.transaction_ref,
      customerPhone: row.customer_phone,
      operator: row.operator,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
      customerId: row.customer_id,
    };
  }
}

export class ExpenseRepository extends BaseRepository {
  create(data: Omit<Expense, 'id' | 'createdAt' | 'status'> & Partial<Pick<Expense, 'status'>>): Expense {
    try {
      const id = this.generateId();
      const now = this.now();
      const expense: Expense = {
        id,
        businessId: data.businessId,
        categoryId: data.categoryId,
        expenseNumber: data.expenseNumber,
        amountPaisa: data.amountPaisa,
        expenseDate: data.expenseDate || now,
        paymentMethod: data.paymentMethod || 'cash',
        cashAccountId: data.cashAccountId || null,
        bankAccountId: data.bankAccountId || null,
        mfsAccountId: data.mfsAccountId || null,
        reference: data.reference || null,
        notes: data.notes || null,
        attachmentPath: data.attachmentPath || null,
        status: data.status || 'completed',
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
        createdAt: now,
        createdBy: data.createdBy || null,
      };

      this.db.prepare(`
        INSERT INTO expenses (id, business_id, category_id, expense_number, amount_paisa, expense_date, payment_method, cash_account_id, bank_account_id, mfs_account_id, reference, notes, attachment_path, status, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        expense.id,
        expense.businessId,
        expense.categoryId,
        expense.expenseNumber,
        expense.amountPaisa,
        expense.expenseDate,
        expense.paymentMethod,
        expense.cashAccountId,
        expense.bankAccountId,
        expense.mfsAccountId,
        expense.reference,
        expense.notes,
        expense.attachmentPath,
        expense.status,
        expense.createdAt,
        expense.createdBy
      );

      return expense;
    } catch (e) {
      this.handleError(e, 'Expense');
    }
  }

  findById(id: string): Expense | null {
    const row = this.db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBusiness(businessId: string, limit = 50, offset = 0, filters?: { categoryId?: string; status?: string; fromDate?: number; toDate?: number; search?: string }): Expense[] {
    let sql = 'SELECT * FROM expenses WHERE business_id = ?';
    const params: any[] = [businessId];
    if (filters?.categoryId) {
      sql += ' AND category_id = ?';
      params.push(filters.categoryId);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.fromDate) {
      sql += ' AND expense_date >= ?';
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      sql += ' AND expense_date <= ?';
      params.push(filters.toDate);
    }
    if (filters?.search) {
      sql += ' AND (notes LIKE ? OR reference LIKE ? OR expense_number LIKE ?)';
      const like = `%${filters.search}%`;
      params.push(like, like, like);
    }
    sql += ' ORDER BY expense_date DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  void(id: string, reason: string, voidedBy?: string): void {
    const now = this.now();
    this.db.prepare('UPDATE expenses SET status = ?, voided_at = ?, voided_by = ?, void_reason = ? WHERE id = ?').run('voided', now, voidedBy || null, reason, id);
  }

  getNextExpenseNumber(businessId: string): string {
    const row = this.db.prepare('SELECT expense_number FROM expenses WHERE business_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(businessId) as { expense_number: string } | undefined;
    if (!row) return 'EXP-00001';
    const match = row.expense_number.match(/EXP-(\d+)/);
    if (!match) return `EXP-${Date.now().toString().slice(-5)}`;
    const num = parseInt(match[1], 10) + 1;
    return `EXP-${num.toString().padStart(5, '0')}`;
  }

  private mapRow(row: any): Expense {
    return {
      id: row.id,
      businessId: row.business_id,
      categoryId: row.category_id,
      expenseNumber: row.expense_number,
      amountPaisa: row.amount_paisa,
      expenseDate: row.expense_date,
      paymentMethod: row.payment_method,
      cashAccountId: row.cash_account_id,
      bankAccountId: row.bank_account_id,
      mfsAccountId: row.mfs_account_id,
      reference: row.reference,
      notes: row.notes,
      attachmentPath: row.attachment_path,
      status: row.status || 'completed',
      voidedAt: row.voided_at,
      voidedBy: row.voided_by,
      voidReason: row.void_reason,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }
}

export class FinanceTransferRepository extends BaseRepository {
  create(data: Omit<FinanceTransfer, 'id' | 'createdAt' | 'status'> & Partial<Pick<FinanceTransfer, 'status'>>): FinanceTransfer {
    try {
      const id = this.generateId();
      const now = this.now();
      const transfer: FinanceTransfer = {
        id,
        businessId: data.businessId,
        transferNumber: data.transferNumber,
        sourceType: data.sourceType,
        sourceAccountId: data.sourceAccountId,
        destType: data.destType,
        destAccountId: data.destAccountId,
        amountPaisa: data.amountPaisa,
        chargePaisa: data.chargePaisa ?? 0,
        commissionPaisa: data.commissionPaisa ?? 0,
        reference: data.reference || null,
        notes: data.notes || null,
        status: data.status || 'completed',
        createdAt: now,
        createdBy: data.createdBy || null,
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
      };

      this.db.prepare(`
        INSERT INTO finance_transfers (id, business_id, transfer_number, source_type, source_account_id, dest_type, dest_account_id, amount_paisa, charge_paisa, commission_paisa, reference, notes, status, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        transfer.id,
        transfer.businessId,
        transfer.transferNumber,
        transfer.sourceType,
        transfer.sourceAccountId,
        transfer.destType,
        transfer.destAccountId,
        transfer.amountPaisa,
        transfer.chargePaisa,
        transfer.commissionPaisa,
        transfer.reference,
        transfer.notes,
        transfer.status,
        transfer.createdAt,
        transfer.createdBy
      );

      return transfer;
    } catch (e) {
      this.handleError(e, 'FinanceTransfer');
    }
  }

  findById(id: string): FinanceTransfer | null {
    const row = this.db.prepare('SELECT * FROM finance_transfers WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBusiness(businessId: string, limit = 50, offset = 0): FinanceTransfer[] {
    const rows = this.db.prepare('SELECT * FROM finance_transfers WHERE business_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?').all(businessId, limit, offset) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getNextTransferNumber(businessId: string): string {
    const row = this.db.prepare('SELECT transfer_number FROM finance_transfers WHERE business_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(businessId) as { transfer_number: string } | undefined;
    if (!row) return 'TRF-00001';
    const match = row.transfer_number.match(/TRF-(\d+)/);
    if (!match) return `TRF-${Date.now().toString().slice(-5)}`;
    const num = parseInt(match[1], 10) + 1;
    return `TRF-${num.toString().padStart(5, '0')}`;
  }

  private mapRow(row: any): FinanceTransfer {
    return {
      id: row.id,
      businessId: row.business_id,
      transferNumber: row.transfer_number,
      sourceType: row.source_type,
      sourceAccountId: row.source_account_id,
      destType: row.dest_type,
      destAccountId: row.dest_account_id,
      amountPaisa: row.amount_paisa,
      chargePaisa: row.charge_paisa,
      commissionPaisa: row.commission_paisa,
      reference: row.reference,
      notes: row.notes,
      status: row.status,
      createdAt: row.created_at,
      createdBy: row.created_by,
      voidedAt: row.voided_at,
      voidedBy: row.voided_by,
      voidReason: row.void_reason,
    };
  }
}

export class ShiftRepository extends BaseRepository {
  create(data: Omit<Shift, 'id' | 'createdAt' | 'updatedAt' | 'closedAt' | 'closedByUserId' | 'expectedCashPaisa' | 'actualCashPaisa' | 'variancePaisa' | 'totalSalesPaisa' | 'totalCashSalesPaisa' | 'totalExpensesPaisa' | 'notes' | 'status'> & Partial<Pick<Shift, 'closedAt' | 'closedByUserId' | 'expectedCashPaisa' | 'actualCashPaisa' | 'variancePaisa' | 'totalSalesPaisa' | 'totalCashSalesPaisa' | 'totalExpensesPaisa' | 'notes' | 'status'>>): Shift {
    try {
      const id = this.generateId();
      const now = this.now();
      const shift: Shift = {
        id,
        businessId: data.businessId,
        shiftNumber: data.shiftNumber,
        cashAccountId: data.cashAccountId,
        openedByUserId: data.openedByUserId,
        closedByUserId: null,
        openedAt: data.openedAt || now,
        closedAt: null,
        openingCashPaisa: data.openingCashPaisa,
        expectedCashPaisa: null,
        actualCashPaisa: null,
        variancePaisa: null,
        totalSalesPaisa: 0,
        totalCashSalesPaisa: 0,
        totalExpensesPaisa: 0,
        notes: data.notes || null,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      };

      this.db.prepare(`
        INSERT INTO shifts (id, business_id, shift_number, cash_account_id, opened_by_user_id, opened_at, opening_cash_paisa, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        shift.id,
        shift.businessId,
        shift.shiftNumber,
        shift.cashAccountId,
        shift.openedByUserId,
        shift.openedAt,
        shift.openingCashPaisa,
        shift.status,
        shift.createdAt,
        shift.updatedAt
      );

      return shift;
    } catch (e) {
      this.handleError(e, 'Shift');
    }
  }

  findById(id: string): Shift | null {
    const row = this.db.prepare('SELECT * FROM shifts WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findOpenByBusiness(businessId: string): Shift | null {
    const row = this.db.prepare('SELECT * FROM shifts WHERE business_id = ? AND status = ? ORDER BY opened_at DESC LIMIT 1').get(businessId, 'open') as any;
    return row ? this.mapRow(row) : null;
  }

  findByBusiness(businessId: string, limit = 50, offset = 0): Shift[] {
    const rows = this.db.prepare('SELECT * FROM shifts WHERE business_id = ? ORDER BY opened_at DESC, rowid DESC LIMIT ? OFFSET ?').all(businessId, limit, offset) as any[];
    return rows.map(r => this.mapRow(r));
  }

  close(id: string, expectedPaisa: number, actualPaisa: number, closedByUserId: string, notes?: string): Shift | null {
    const existing = this.findById(id);
    if (!existing) return null;
    if (existing.status === 'closed') throw new Error('শিফট ইতিমধ্যে বন্ধ করা হয়েছে');
    const variance = actualPaisa - expectedPaisa;
    const now = this.now();
    this.db.prepare(`
      UPDATE shifts SET status = ?, closed_at = ?, closed_by_user_id = ?, expected_cash_paisa = ?, actual_cash_paisa = ?, variance_paisa = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run('closed', now, closedByUserId, expectedPaisa, actualPaisa, variance, notes || existing.notes, now, id);
    return this.findById(id);
  }

  getNextShiftNumber(businessId: string): string {
    const row = this.db.prepare('SELECT shift_number FROM shifts WHERE business_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(businessId) as { shift_number: string } | undefined;
    if (!row) return 'SHIFT-00001';
    const match = row.shift_number.match(/SHIFT-(\d+)/);
    if (!match) return `SHIFT-${Date.now().toString().slice(-5)}`;
    const num = parseInt(match[1], 10) + 1;
    return `SHIFT-${num.toString().padStart(5, '0')}`;
  }

  private mapRow(row: any): Shift {
    return {
      id: row.id,
      businessId: row.business_id,
      shiftNumber: row.shift_number,
      cashAccountId: row.cash_account_id,
      openedByUserId: row.opened_by_user_id,
      closedByUserId: row.closed_by_user_id,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      openingCashPaisa: row.opening_cash_paisa,
      expectedCashPaisa: row.expected_cash_paisa,
      actualCashPaisa: row.actual_cash_paisa,
      variancePaisa: row.variance_paisa,
      totalSalesPaisa: row.total_sales_paisa ?? 0,
      totalCashSalesPaisa: row.total_cash_sales_paisa ?? 0,
      totalExpensesPaisa: row.total_expenses_paisa ?? 0,
      notes: row.notes,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
