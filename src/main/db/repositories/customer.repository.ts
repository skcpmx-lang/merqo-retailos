import { BaseRepository } from './base';

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  companyName?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  email?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  notes?: string | null;
  openingDuePaisa: number;
  currentDuePaisa: number;
  creditLimitPaisa: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface CustomerTransaction {
  id: string;
  businessId: string;
  customerId: string;
  transactionType: string;
  amountPaisa: number;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: number;
  createdBy?: string | null;
}

export class CustomerRepository extends BaseRepository {
  create(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Customer {
    try {
      const id = this.generateId();
      const now = this.now();
      const customer: Customer = {
        id,
        businessId: data.businessId,
        name: data.name,
        companyName: (data as any).companyName || null,
        phone: data.phone || null,
        alternatePhone: (data as any).alternatePhone || null,
        email: data.email || null,
        address: data.address || null,
        contactPerson: (data as any).contactPerson || null,
        notes: (data as any).notes || null,
        openingDuePaisa: data.openingDuePaisa ?? 0,
        currentDuePaisa: data.currentDuePaisa ?? data.openingDuePaisa ?? 0,
        creditLimitPaisa: data.creditLimitPaisa ?? 0,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      this.db.prepare(`
        INSERT INTO customers (id, business_id, name, company_name, phone, alternate_phone, email, address, contact_person, notes, opening_due_paisa, current_due_paisa, credit_limit_paisa, is_active, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customer.id,
        customer.businessId,
        customer.name,
        customer.companyName,
        customer.phone,
        customer.alternatePhone,
        customer.email,
        customer.address,
        customer.contactPerson,
        customer.notes,
        customer.openingDuePaisa,
        customer.currentDuePaisa,
        customer.creditLimitPaisa,
        customer.isActive ? 1 : 0,
        customer.createdAt,
        customer.updatedAt,
        customer.deletedAt
      );

      return customer;
    } catch (e) {
      this.handleError(e, 'Customer');
    }
  }

  findById(id: string): Customer | null {
    const row = this.db.prepare('SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByPhone(businessId: string, phone: string): Customer | null {
    const row = this.db.prepare('SELECT * FROM customers WHERE business_id = ? AND phone = ? AND deleted_at IS NULL').get(businessId, phone) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBusiness(businessId: string): Customer[] {
    const rows = this.db.prepare('SELECT * FROM customers WHERE business_id = ? AND deleted_at IS NULL ORDER BY name').all(businessId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  search(businessId: string, query: string, includeInactive = false, limit = 50): Customer[] {
    const like = `%${query}%`;
    let sql = `SELECT * FROM customers WHERE business_id = ? AND deleted_at IS NULL`;
    const params: any[] = [businessId];
    if (!includeInactive) {
      sql += ` AND is_active = 1`;
    }
    if (query) {
      sql += ` AND (name LIKE ? OR company_name LIKE ? OR phone LIKE ? OR alternate_phone LIKE ? OR email LIKE ?)`;
      params.push(like, like, like, like, like);
    }
    sql += ` ORDER BY name LIMIT ?`;
    params.push(limit);
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findActive(businessId: string): Customer[] {
    const rows = this.db.prepare('SELECT * FROM customers WHERE business_id = ? AND is_active = 1 AND deleted_at IS NULL ORDER BY name').all(businessId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  update(id: string, data: Partial<Omit<Customer, 'id' | 'businessId' | 'createdAt'>>): Customer | null {
    try {
      const existing = this.findById(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: this.now() } as Customer;

      this.db.prepare(`
        UPDATE customers SET name = ?, company_name = ?, phone = ?, alternate_phone = ?, email = ?, address = ?, contact_person = ?, notes = ?, current_due_paisa = ?, credit_limit_paisa = ?, is_active = ?, updated_at = ?
        WHERE id = ?
      `).run(
        updated.name,
        updated.companyName,
        updated.phone,
        updated.alternatePhone,
        updated.email,
        updated.address,
        updated.contactPerson,
        updated.notes,
        updated.currentDuePaisa,
        updated.creditLimitPaisa,
        updated.isActive ? 1 : 0,
        updated.updatedAt,
        id
      );
      return updated;
    } catch (e) {
      this.handleError(e, 'Customer');
    }
  }

  deactivate(id: string): void {
    this.db.prepare('UPDATE customers SET is_active = 0, updated_at = ? WHERE id = ?').run(this.now(), id);
  }

  activate(id: string): void {
    this.db.prepare('UPDATE customers SET is_active = 1, updated_at = ? WHERE id = ?').run(this.now(), id);
  }

  softDelete(id: string): void {
    this.db.prepare('UPDATE customers SET deleted_at = ?, updated_at = ? WHERE id = ?').run(this.now(), this.now(), id);
  }

  hasTransactions(customerId: string): boolean {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM customer_transactions WHERE customer_id = ?').get(customerId) as { count: number };
    return row.count > 0;
  }

  hasSales(customerId: string): boolean {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM sales WHERE customer_id = ?').get(customerId) as { count: number };
    return row.count > 0;
  }

  getLastTransactionDate(customerId: string): number | null {
    const row = this.db.prepare('SELECT created_at FROM customer_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1').get(customerId) as { created_at: number } | undefined;
    return row?.created_at || null;
  }

  private mapRow(row: any): Customer {
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      companyName: row.company_name || null,
      phone: row.phone,
      alternatePhone: row.alternate_phone || null,
      email: row.email,
      address: row.address,
      contactPerson: row.contact_person || null,
      notes: row.notes || null,
      openingDuePaisa: row.opening_due_paisa,
      currentDuePaisa: row.current_due_paisa,
      creditLimitPaisa: row.credit_limit_paisa,
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}

export class CustomerTransactionRepository extends BaseRepository {
  create(data: Omit<CustomerTransaction, 'id' | 'createdAt'>): CustomerTransaction {
    try {
      const id = this.generateId();
      const now = this.now();
      const tx: CustomerTransaction = {
        id,
        businessId: data.businessId,
        customerId: data.customerId,
        transactionType: data.transactionType,
        amountPaisa: data.amountPaisa,
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        notes: data.notes || null,
        createdAt: now,
        createdBy: data.createdBy || null,
      };

      this.db.prepare(`
        INSERT INTO customer_transactions (id, business_id, customer_id, transaction_type, amount_paisa, reference_type, reference_id, notes, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tx.id,
        tx.businessId,
        tx.customerId,
        tx.transactionType,
        tx.amountPaisa,
        tx.referenceType,
        tx.referenceId,
        tx.notes,
        tx.createdAt,
        tx.createdBy
      );

      return tx;
    } catch (e) {
      this.handleError(e, 'CustomerTransaction');
    }
  }

  findByCustomer(customerId: string, limit = 100, offset = 0): CustomerTransaction[] {
    const rows = this.db.prepare('SELECT * FROM customer_transactions WHERE customer_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?').all(customerId, limit, offset) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByCustomerAndDateRange(customerId: string, fromDate?: number, toDate?: number): CustomerTransaction[] {
    let sql = 'SELECT * FROM customer_transactions WHERE customer_id = ?';
    const params: any[] = [customerId];
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
    return rows.map(r => this.mapRow(r));
  }

  getCurrentDue(customerId: string): number {
    const row = this.db.prepare('SELECT SUM(amount_paisa) as total FROM customer_transactions WHERE customer_id = ?').get(customerId) as { total: number | null };
    return row.total || 0;
  }

  getStatementWithRunningBalance(customerId: string, fromDate?: number, toDate?: number): Array<CustomerTransaction & { runningBalance: number }> {
    const transactions = this.findByCustomerAndDateRange(customerId, fromDate, toDate);
    let runningBalance = 0;
    if (fromDate) {
      const beforeRow = this.db.prepare('SELECT SUM(amount_paisa) as total FROM customer_transactions WHERE customer_id = ? AND created_at < ?').get(customerId, fromDate) as { total: number | null };
      runningBalance = beforeRow.total || 0;
    }

    return transactions.map(tx => {
      runningBalance += tx.amountPaisa;
      return { ...tx, runningBalance };
    });
  }

  private mapRow(row: any): CustomerTransaction {
    return {
      id: row.id,
      businessId: row.business_id,
      customerId: row.customer_id,
      transactionType: row.transaction_type,
      amountPaisa: row.amount_paisa,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }
}
