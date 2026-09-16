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
