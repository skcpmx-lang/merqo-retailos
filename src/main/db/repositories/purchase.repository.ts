import { BaseRepository } from './base';

export type PurchaseStatus = 'draft' | 'received' | 'partially_paid' | 'paid' | 'cancelled';

export interface Purchase {
  id: string;
  businessId: string;
  supplierId: string;
  purchaseNumber: string;
  purchaseDate: number;
  status: PurchaseStatus;
  subtotalPaisa: number;
  discountPaisa: number;
  taxPaisa: number;
  shippingPaisa: number;
  totalPaisa: number;
  paidPaisa: number;
  duePaisa: number;
  notes?: string | null;
  isPaid: boolean;
  voidedAt?: number | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  createdAt: number;
  updatedAt: number;
  createdBy?: string | null;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  unitId: string;
  quantityMilli: number;
  baseQuantityMilli: number;
  costPerUnitPaisa: number;
  baseCostPerUnitPaisa: number;
  discountPaisa: number;
  taxPaisa: number;
  lineTotalPaisa: number;
  createdAt: number;
}

export interface PurchasePayment {
  id: string;
  businessId: string;
  supplierId: string;
  purchaseId?: string | null;
  paymentNumber: string;
  paymentDate: number;
  amountPaisa: number;
  paymentMethod: string;
  cashAccountId?: string | null;
  bankAccountId?: string | null;
  mfsAccountId?: string | null;
  chequeNumber?: string | null;
  cardLast4?: string | null;
  notes?: string | null;
  createdAt: number;
  createdBy?: string | null;
}

export interface PurchaseReturn {
  id: string;
  businessId: string;
  purchaseId?: string | null;
  supplierId: string;
  returnNumber: string;
  returnDate: number;
  totalPaisa: number;
  refundPaisa: number;
  refundMethod?: string | null;
  reason?: string | null;
  notes?: string | null;
  status: string;
  createdAt: number;
  createdBy?: string | null;
}

export interface PurchaseReturnItem {
  id: string;
  returnId: string;
  productId: string;
  unitId?: string | null;
  quantityMilli: number;
  baseQuantityMilli: number;
  costPaisa: number;
  lineTotalPaisa: number;
}

export class PurchaseRepository extends BaseRepository {
  create(data: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>): Purchase {
    try {
      const id = this.generateId();
      const now = this.now();
      const purchase: Purchase = {
        id,
        businessId: data.businessId,
        supplierId: data.supplierId,
        purchaseNumber: data.purchaseNumber,
        purchaseDate: data.purchaseDate || now,
        status: data.status || 'received',
        subtotalPaisa: data.subtotalPaisa ?? 0,
        discountPaisa: data.discountPaisa ?? 0,
        taxPaisa: data.taxPaisa ?? 0,
        shippingPaisa: data.shippingPaisa ?? 0,
        totalPaisa: data.totalPaisa ?? 0,
        paidPaisa: data.paidPaisa ?? 0,
        duePaisa: data.duePaisa ?? 0,
        notes: data.notes || null,
        isPaid: data.isPaid ?? false,
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
        createdAt: now,
        updatedAt: now,
        createdBy: data.createdBy || null,
      };

      this.db.prepare(`
        INSERT INTO purchases (id, business_id, supplier_id, purchase_number, purchase_date, status, subtotal_paisa, discount_paisa, tax_paisa, shipping_paisa, total_paisa, paid_paisa, due_paisa, notes, is_paid, created_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        purchase.id,
        purchase.businessId,
        purchase.supplierId,
        purchase.purchaseNumber,
        purchase.purchaseDate,
        purchase.status,
        purchase.subtotalPaisa,
        purchase.discountPaisa,
        purchase.taxPaisa,
        purchase.shippingPaisa,
        purchase.totalPaisa,
        purchase.paidPaisa,
        purchase.duePaisa,
        purchase.notes,
        purchase.isPaid ? 1 : 0,
        purchase.createdAt,
        purchase.updatedAt,
        purchase.createdBy
      );

      return purchase;
    } catch (e) {
      this.handleError(e, 'Purchase');
    }
  }

  findById(id: string): Purchase | null {
    const row = this.db.prepare('SELECT * FROM purchases WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByNumber(purchaseNumber: string): Purchase | null {
    const row = this.db.prepare('SELECT * FROM purchases WHERE purchase_number = ?').get(purchaseNumber) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBusiness(businessId: string, filters?: { supplierId?: string; status?: string; fromDate?: number; toDate?: number; search?: string }, limit = 50, offset = 0): Purchase[] {
    let sql = 'SELECT * FROM purchases WHERE business_id = ?';
    const params: any[] = [businessId];

    if (filters?.supplierId) {
      sql += ' AND supplier_id = ?';
      params.push(filters.supplierId);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.fromDate) {
      sql += ' AND purchase_date >= ?';
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      sql += ' AND purchase_date <= ?';
      params.push(filters.toDate);
    }
    if (filters?.search) {
      sql += ' AND (purchase_number LIKE ? OR notes LIKE ?)';
      const like = `%${filters.search}%`;
      params.push(like, like);
    }

    sql += ' ORDER BY purchase_date DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findBySupplier(supplierId: string): Purchase[] {
    const rows = this.db.prepare('SELECT * FROM purchases WHERE supplier_id = ? ORDER BY purchase_date DESC').all(supplierId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  update(id: string, data: Partial<Omit<Purchase, 'id' | 'businessId' | 'createdAt'>>): Purchase | null {
    try {
      const existing = this.findById(id);
      if (!existing) return null;

      const updated = { ...existing, ...data, updatedAt: this.now() } as Purchase;

      this.db.prepare(`
        UPDATE purchases SET supplier_id = ?, purchase_date = ?, status = ?, subtotal_paisa = ?, discount_paisa = ?, tax_paisa = ?, shipping_paisa = ?, total_paisa = ?, paid_paisa = ?, due_paisa = ?, notes = ?, is_paid = ?, updated_at = ?
        WHERE id = ?
      `).run(
        updated.supplierId,
        updated.purchaseDate,
        updated.status,
        updated.subtotalPaisa,
        updated.discountPaisa,
        updated.taxPaisa,
        updated.shippingPaisa,
        updated.totalPaisa,
        updated.paidPaisa,
        updated.duePaisa,
        updated.notes,
        updated.isPaid ? 1 : 0,
        updated.updatedAt,
        id
      );

      return updated;
    } catch (e) {
      this.handleError(e, 'Purchase');
    }
  }

  void(id: string, reason: string, voidedBy?: string): void {
    const now = this.now();
    this.db.prepare('UPDATE purchases SET status = ?, voided_at = ?, voided_by = ?, void_reason = ?, updated_at = ? WHERE id = ?').run('cancelled', now, voidedBy || null, reason, now, id);
  }

  getNextPurchaseNumber(businessId: string): string {
    // Find max number with pattern PUR-XXXXX
    const row = this.db.prepare(`SELECT purchase_number FROM purchases WHERE business_id = ? ORDER BY created_at DESC LIMIT 1`).get(businessId) as { purchase_number: string } | undefined;
    if (!row) return 'PUR-00001';

    const match = row.purchase_number.match(/PUR-(\d+)/);
    if (!match) return `PUR-${Date.now().toString().slice(-5)}`;

    const num = parseInt(match[1], 10) + 1;
    return `PUR-${num.toString().padStart(5, '0')}`;
  }

  private mapRow(row: any): Purchase {
    return {
      id: row.id,
      businessId: row.business_id,
      supplierId: row.supplier_id,
      purchaseNumber: row.purchase_number,
      purchaseDate: row.purchase_date,
      status: row.status as PurchaseStatus,
      subtotalPaisa: row.subtotal_paisa,
      discountPaisa: row.discount_paisa,
      taxPaisa: row.tax_paisa,
      shippingPaisa: row.shipping_paisa,
      totalPaisa: row.total_paisa,
      paidPaisa: row.paid_paisa,
      duePaisa: row.due_paisa,
      notes: row.notes,
      isPaid: !!row.is_paid,
      voidedAt: row.voided_at,
      voidedBy: row.voided_by,
      voidReason: row.void_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
    };
  }
}

export class PurchaseItemRepository extends BaseRepository {
  create(data: Omit<PurchaseItem, 'id' | 'createdAt'>): PurchaseItem {
    try {
      const id = this.generateId();
      const now = this.now();
      const item: PurchaseItem = {
        id,
        purchaseId: data.purchaseId,
        productId: data.productId,
        unitId: data.unitId,
        quantityMilli: data.quantityMilli,
        baseQuantityMilli: data.baseQuantityMilli,
        costPerUnitPaisa: data.costPerUnitPaisa,
        baseCostPerUnitPaisa: data.baseCostPerUnitPaisa,
        discountPaisa: data.discountPaisa ?? 0,
        taxPaisa: data.taxPaisa ?? 0,
        lineTotalPaisa: data.lineTotalPaisa,
        createdAt: now,
      };

      this.db.prepare(`
        INSERT INTO purchase_items (id, purchase_id, product_id, unit_id, quantity_milli, base_quantity_milli, cost_per_unit_paisa, base_cost_per_unit_paisa, discount_paisa, tax_paisa, line_total_paisa, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.purchaseId,
        item.productId,
        item.unitId,
        item.quantityMilli,
        item.baseQuantityMilli,
        item.costPerUnitPaisa,
        item.baseCostPerUnitPaisa,
        item.discountPaisa,
        item.taxPaisa,
        item.lineTotalPaisa,
        item.createdAt
      );

      return item;
    } catch (e) {
      this.handleError(e, 'PurchaseItem');
    }
  }

  findByPurchase(purchaseId: string): PurchaseItem[] {
    const rows = this.db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchaseId) as any[];
    return rows.map(r => ({
      id: r.id,
      purchaseId: r.purchase_id,
      productId: r.product_id,
      unitId: r.unit_id,
      quantityMilli: r.quantity_milli,
      baseQuantityMilli: r.base_quantity_milli,
      costPerUnitPaisa: r.cost_per_unit_paisa,
      baseCostPerUnitPaisa: r.base_cost_per_unit_paisa,
      discountPaisa: r.discount_paisa,
      taxPaisa: r.tax_paisa,
      lineTotalPaisa: r.line_total_paisa,
      createdAt: r.created_at,
    }));
  }

  findByProduct(productId: string): PurchaseItem[] {
    const rows = this.db.prepare('SELECT * FROM purchase_items WHERE product_id = ? ORDER BY created_at DESC').all(productId) as any[];
    return rows.map(r => ({
      id: r.id,
      purchaseId: r.purchase_id,
      productId: r.product_id,
      unitId: r.unit_id,
      quantityMilli: r.quantity_milli,
      baseQuantityMilli: r.base_quantity_milli,
      costPerUnitPaisa: r.cost_per_unit_paisa,
      baseCostPerUnitPaisa: r.base_cost_per_unit_paisa,
      discountPaisa: r.discount_paisa,
      taxPaisa: r.tax_paisa,
      lineTotalPaisa: r.line_total_paisa,
      createdAt: r.created_at,
    }));
  }
}

export class PurchasePaymentRepository extends BaseRepository {
  create(data: Omit<PurchasePayment, 'id' | 'createdAt'>): PurchasePayment {
    try {
      const id = this.generateId();
      const now = this.now();
      const payment: PurchasePayment = {
        id,
        businessId: data.businessId,
        supplierId: data.supplierId,
        purchaseId: data.purchaseId || null,
        paymentNumber: data.paymentNumber,
        paymentDate: data.paymentDate || now,
        amountPaisa: data.amountPaisa,
        paymentMethod: data.paymentMethod || 'cash',
        cashAccountId: data.cashAccountId || null,
        bankAccountId: data.bankAccountId || null,
        mfsAccountId: data.mfsAccountId || null,
        chequeNumber: data.chequeNumber || null,
        cardLast4: data.cardLast4 || null,
        notes: data.notes || null,
        createdAt: now,
        createdBy: data.createdBy || null,
      };

      this.db.prepare(`
        INSERT INTO purchase_payments (id, business_id, supplier_id, purchase_id, payment_number, payment_date, amount_paisa, payment_method, cash_account_id, bank_account_id, mfs_account_id, cheque_number, card_last4, notes, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        payment.id,
        payment.businessId,
        payment.supplierId,
        payment.purchaseId,
        payment.paymentNumber,
        payment.paymentDate,
        payment.amountPaisa,
        payment.paymentMethod,
        payment.cashAccountId,
        payment.bankAccountId,
        payment.mfsAccountId,
        payment.chequeNumber,
        payment.cardLast4,
        payment.notes,
        payment.createdAt,
        payment.createdBy
      );

      return payment;
    } catch (e) {
      this.handleError(e, 'PurchasePayment');
    }
  }

  findByPurchase(purchaseId: string): PurchasePayment[] {
    const rows = this.db.prepare('SELECT * FROM purchase_payments WHERE purchase_id = ? ORDER BY payment_date DESC').all(purchaseId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findBySupplier(supplierId: string): PurchasePayment[] {
    const rows = this.db.prepare('SELECT * FROM purchase_payments WHERE supplier_id = ? ORDER BY payment_date DESC').all(supplierId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getTotalPaidForPurchase(purchaseId: string): number {
    const row = this.db.prepare('SELECT SUM(amount_paisa) as total FROM purchase_payments WHERE purchase_id = ?').get(purchaseId) as { total: number | null };
    return row.total || 0;
  }

  getNextPaymentNumber(businessId: string): string {
    const row = this.db.prepare('SELECT payment_number FROM purchase_payments WHERE business_id = ? ORDER BY created_at DESC LIMIT 1').get(businessId) as { payment_number: string } | undefined;
    if (!row) return 'PPAY-00001';
    const match = row.payment_number.match(/PPAY-(\d+)/);
    if (!match) return `PPAY-${Date.now().toString().slice(-5)}`;
    const num = parseInt(match[1], 10) + 1;
    return `PPAY-${num.toString().padStart(5, '0')}`;
  }

  private mapRow(row: any): PurchasePayment {
    return {
      id: row.id,
      businessId: row.business_id,
      supplierId: row.supplier_id,
      purchaseId: row.purchase_id,
      paymentNumber: row.payment_number,
      paymentDate: row.payment_date,
      amountPaisa: row.amount_paisa,
      paymentMethod: row.payment_method,
      cashAccountId: row.cash_account_id,
      bankAccountId: row.bank_account_id,
      mfsAccountId: row.mfs_account_id,
      chequeNumber: row.cheque_number,
      cardLast4: row.card_last4,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }
}

export class PurchaseReturnRepository extends BaseRepository {
  create(data: Omit<PurchaseReturn, 'id' | 'createdAt'>): PurchaseReturn {
    try {
      const id = this.generateId();
      const now = this.now();
      const ret: PurchaseReturn = {
        id,
        businessId: data.businessId,
        purchaseId: data.purchaseId || null,
        supplierId: data.supplierId,
        returnNumber: data.returnNumber,
        returnDate: data.returnDate || now,
        totalPaisa: data.totalPaisa ?? 0,
        refundPaisa: data.refundPaisa ?? 0,
        refundMethod: data.refundMethod || null,
        reason: data.reason || null,
        notes: data.notes || null,
        status: data.status || 'completed',
        createdAt: now,
        createdBy: data.createdBy || null,
      };

      this.db.prepare(`
        INSERT INTO purchase_returns (id, business_id, purchase_id, supplier_id, return_number, return_date, total_paisa, refund_paisa, refund_method, reason, notes, status, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ret.id,
        ret.businessId,
        ret.purchaseId,
        ret.supplierId,
        ret.returnNumber,
        ret.returnDate,
        ret.totalPaisa,
        ret.refundPaisa,
        ret.refundMethod,
        ret.reason,
        ret.notes,
        ret.status,
        ret.createdAt,
        ret.createdBy
      );

      return ret;
    } catch (e) {
      this.handleError(e, 'PurchaseReturn');
    }
  }

  findById(id: string): PurchaseReturn | null {
    const row = this.db.prepare('SELECT * FROM purchase_returns WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByPurchase(purchaseId: string): PurchaseReturn[] {
    const rows = this.db.prepare('SELECT * FROM purchase_returns WHERE purchase_id = ? ORDER BY return_date DESC').all(purchaseId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getNextReturnNumber(businessId: string): string {
    const row = this.db.prepare('SELECT return_number FROM purchase_returns WHERE business_id = ? ORDER BY created_at DESC LIMIT 1').get(businessId) as { return_number: string } | undefined;
    if (!row) return 'PRET-00001';
    const match = row.return_number.match(/PRET-(\d+)/);
    if (!match) return `PRET-${Date.now().toString().slice(-5)}`;
    const num = parseInt(match[1], 10) + 1;
    return `PRET-${num.toString().padStart(5, '0')}`;
  }

  private mapRow(row: any): PurchaseReturn {
    return {
      id: row.id,
      businessId: row.business_id,
      purchaseId: row.purchase_id,
      supplierId: row.supplier_id,
      returnNumber: row.return_number,
      returnDate: row.return_date,
      totalPaisa: row.total_paisa,
      refundPaisa: row.refund_paisa,
      refundMethod: row.refund_method,
      reason: row.reason,
      notes: row.notes,
      status: row.status,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }
}

export class PurchaseReturnItemRepository extends BaseRepository {
  create(data: Omit<PurchaseReturnItem, 'id'>): PurchaseReturnItem {
    try {
      const id = this.generateId();
      const item: PurchaseReturnItem = {
        id,
        returnId: data.returnId,
        productId: data.productId,
        unitId: data.unitId || null,
        quantityMilli: data.quantityMilli,
        baseQuantityMilli: data.baseQuantityMilli ?? data.quantityMilli,
        costPaisa: data.costPaisa,
        lineTotalPaisa: data.lineTotalPaisa,
      };

      this.db.prepare(`
        INSERT INTO purchase_return_items (id, return_id, product_id, unit_id, quantity_milli, base_quantity_milli, cost_paisa, line_total_paisa)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.returnId,
        item.productId,
        item.unitId,
        item.quantityMilli,
        item.baseQuantityMilli,
        item.costPaisa,
        item.lineTotalPaisa
      );

      return item;
    } catch (e) {
      this.handleError(e, 'PurchaseReturnItem');
    }
  }

  findByReturn(returnId: string): PurchaseReturnItem[] {
    const rows = this.db.prepare('SELECT * FROM purchase_return_items WHERE return_id = ?').all(returnId) as any[];
    return rows.map(r => ({
      id: r.id,
      returnId: r.return_id,
      productId: r.product_id,
      unitId: r.unit_id,
      quantityMilli: r.quantity_milli,
      baseQuantityMilli: r.base_quantity_milli,
      costPaisa: r.cost_paisa,
      lineTotalPaisa: r.line_total_paisa,
    }));
  }

  getReturnedQuantityForPurchase(productId: string, purchaseId: string): number {
    const row = this.db.prepare(`
      SELECT SUM(pri.base_quantity_milli) as total
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pr.id = pri.return_id
      WHERE pri.product_id = ? AND pr.purchase_id = ?
    `).get(productId, purchaseId) as { total: number | null };
    return row.total || 0;
  }
}
