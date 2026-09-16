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
        isAgent: data.isAgent ?? false,
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

  findByBusiness(businessId: string): MfsAccount[] {
    const rows = this.db.prepare('SELECT * FROM mfs_accounts WHERE business_id = ? ORDER BY account_number').all(businessId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findById(id: string): MfsAccount | null {
    const row = this.db.prepare('SELECT * FROM mfs_accounts WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
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

  findByBusiness(businessId: string): CashAccount[] {
    const rows = this.db.prepare('SELECT * FROM cash_accounts WHERE business_id = ? ORDER BY is_default DESC, name').all(businessId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findDefault(businessId: string): CashAccount | null {
    const row = this.db.prepare('SELECT * FROM cash_accounts WHERE business_id = ? AND is_default = 1 LIMIT 1').get(businessId) as any;
    if (row) return this.mapRow(row);
    // fallback first active
    const fallback = this.db.prepare('SELECT * FROM cash_accounts WHERE business_id = ? AND is_active = 1 LIMIT 1').get(businessId) as any;
    return fallback ? this.mapRow(fallback) : null;
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

      // Update cached balance
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

  findByReference(referenceType: string, referenceId: string): CashMovement[] {
    const rows = this.db.prepare('SELECT * FROM cash_movements WHERE reference_type = ? AND reference_id = ?').all(referenceType, referenceId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getBalance(cashAccountId: string): number {
    const row = this.db.prepare('SELECT SUM(amount_paisa) as total FROM cash_movements WHERE cash_account_id = ?').get(cashAccountId) as { total: number | null };
    return row.total || 0;
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

  findByBusiness(businessId: string): BankAccount[] {
    const rows = this.db.prepare('SELECT * FROM bank_accounts WHERE business_id = ? ORDER BY bank_name').all(businessId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: any): BankAccount {
    return {
      id: row.id,
      businessId: row.business_id,
      bankName: row.bank_name,
      accountName: row.account_name,
      accountNumber: row.account_number,
      branch: row.branch,
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

  findByReference(referenceType: string, referenceId: string): MfsTransaction[] {
    // mfs_transactions doesn't have reference_type column in Phase2, but we can search by transaction_ref or notes?
    // For sales, we store reference via customerId + notes
    const rows = this.db.prepare('SELECT * FROM mfs_transactions WHERE notes LIKE ?').all(`%${referenceId}%`) as any[];
    return rows.map(r => this.mapRow(r));
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
