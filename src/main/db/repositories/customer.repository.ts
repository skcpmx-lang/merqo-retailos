import { BaseRepository } from './base';

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
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
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        openingDuePaisa: data.openingDuePaisa ?? 0,
        currentDuePaisa: data.currentDuePaisa ?? data.openingDuePaisa ?? 0,
        creditLimitPaisa: data.creditLimitPaisa ?? 0,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      this.db.prepare(`
        INSERT INTO customers (id, business_id, name, phone, email, address, opening_due_paisa, current_due_paisa, credit_limit_paisa, is_active, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customer.id,
        customer.businessId,
        customer.name,
        customer.phone,
        customer.email,
        customer.address,
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

  update(id: string, data: Partial<Omit<Customer, 'id' | 'businessId' | 'createdAt'>>): Customer | null {
    try {
      const existing = this.findById(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: this.now() };
      this.db.prepare(`
        UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, current_due_paisa = ?, credit_limit_paisa = ?, is_active = ?, updated_at = ?
        WHERE id = ?
      `).run(updated.name, updated.phone, updated.email, updated.address, updated.currentDuePaisa, updated.creditLimitPaisa, updated.isActive ? 1 : 0, updated.updatedAt, id);
      return updated;
    } catch (e) {
      this.handleError(e, 'Customer');
    }
  }

  softDelete(id: string): void {
    this.db.prepare('UPDATE customers SET deleted_at = ?, updated_at = ? WHERE id = ?').run(this.now(), this.now(), id);
  }

  private mapRow(row: any): Customer {
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      address: row.address,
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

  findByCustomer(customerId: string): CustomerTransaction[] {
    const rows = this.db.prepare('SELECT * FROM customer_transactions WHERE customer_id = ? ORDER BY created_at DESC').all(customerId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getCurrentDue(customerId: string): number {
    const row = this.db.prepare('SELECT SUM(amount_paisa) as total FROM customer_transactions WHERE customer_id = ?').get(customerId) as { total: number | null };
    return row.total || 0;
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
