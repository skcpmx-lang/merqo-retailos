import { BaseRepository } from './base';

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  openingPayablePaisa: number;
  currentPayablePaisa: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface SupplierTransaction {
  id: string;
  businessId: string;
  supplierId: string;
  transactionType: string;
  amountPaisa: number;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: number;
  createdBy?: string | null;
}

export class SupplierRepository extends BaseRepository {
  create(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Supplier {
    try {
      const id = this.generateId();
      const now = this.now();
      const supplier: Supplier = {
        id,
        businessId: data.businessId,
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        contactPerson: data.contactPerson || null,
        openingPayablePaisa: data.openingPayablePaisa ?? 0,
        currentPayablePaisa: data.currentPayablePaisa ?? data.openingPayablePaisa ?? 0,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      this.db.prepare(`
        INSERT INTO suppliers (id, business_id, name, phone, email, address, contact_person, opening_payable_paisa, current_payable_paisa, is_active, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        supplier.id,
        supplier.businessId,
        supplier.name,
        supplier.phone,
        supplier.email,
        supplier.address,
        supplier.contactPerson,
        supplier.openingPayablePaisa,
        supplier.currentPayablePaisa,
        supplier.isActive ? 1 : 0,
        supplier.createdAt,
        supplier.updatedAt,
        supplier.deletedAt
      );

      return supplier;
    } catch (e) {
      this.handleError(e, 'Supplier');
    }
  }

  findById(id: string): Supplier | null {
    const row = this.db.prepare('SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBusiness(businessId: string): Supplier[] {
    const rows = this.db.prepare('SELECT * FROM suppliers WHERE business_id = ? AND deleted_at IS NULL ORDER BY name').all(businessId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  update(id: string, data: Partial<Omit<Supplier, 'id' | 'businessId' | 'createdAt'>>): Supplier | null {
    try {
      const existing = this.findById(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: this.now() };
      this.db.prepare(`
        UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, contact_person = ?, current_payable_paisa = ?, is_active = ?, updated_at = ?
        WHERE id = ?
      `).run(updated.name, updated.phone, updated.email, updated.address, updated.contactPerson, updated.currentPayablePaisa, updated.isActive ? 1 : 0, updated.updatedAt, id);
      return updated;
    } catch (e) {
      this.handleError(e, 'Supplier');
    }
  }

  softDelete(id: string): void {
    this.db.prepare('UPDATE suppliers SET deleted_at = ?, updated_at = ? WHERE id = ?').run(this.now(), this.now(), id);
  }

  private mapRow(row: any): Supplier {
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      contactPerson: row.contact_person,
      openingPayablePaisa: row.opening_payable_paisa,
      currentPayablePaisa: row.current_payable_paisa,
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}

export class SupplierTransactionRepository extends BaseRepository {
  create(data: Omit<SupplierTransaction, 'id' | 'createdAt'>): SupplierTransaction {
    try {
      const id = this.generateId();
      const now = this.now();
      const tx: SupplierTransaction = {
        id,
        businessId: data.businessId,
        supplierId: data.supplierId,
        transactionType: data.transactionType,
        amountPaisa: data.amountPaisa,
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        notes: data.notes || null,
        createdAt: now,
        createdBy: data.createdBy || null,
      };

      this.db.prepare(`
        INSERT INTO supplier_transactions (id, business_id, supplier_id, transaction_type, amount_paisa, reference_type, reference_id, notes, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tx.id,
        tx.businessId,
        tx.supplierId,
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
      this.handleError(e, 'SupplierTransaction');
    }
  }

  findBySupplier(supplierId: string): SupplierTransaction[] {
    const rows = this.db.prepare('SELECT * FROM supplier_transactions WHERE supplier_id = ? ORDER BY created_at DESC').all(supplierId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getCurrentPayable(supplierId: string): number {
    const row = this.db.prepare('SELECT SUM(amount_paisa) as total FROM supplier_transactions WHERE supplier_id = ?').get(supplierId) as { total: number | null };
    return row.total || 0;
  }

  private mapRow(row: any): SupplierTransaction {
    return {
      id: row.id,
      businessId: row.business_id,
      supplierId: row.supplier_id,
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
