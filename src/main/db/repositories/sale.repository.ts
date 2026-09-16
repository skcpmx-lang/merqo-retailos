import { BaseRepository } from './base';

export type SaleStatus = 'draft' | 'completed' | 'partially_paid' | 'paid' | 'cancelled' | 'voided' | 'partially_returned' | 'refunded';

export interface Sale {
  id: string;
  businessId: string;
  customerId?: string | null;
  saleNumber: string;
  saleDate: number;
  status: SaleStatus;
  subtotalPaisa: number;
  discountType?: string | null;
  discountValue: number;
  discountPaisa: number;
  taxPaisa: number;
  shippingPaisa: number;
  totalPaisa: number;
  paidPaisa: number;
  duePaisa: number;
  changePaisa: number;
  refundPaisa: number;
  refundMethod?: string | null;
  notes?: string | null;
  isDue: boolean;
  voidedAt?: number | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  createdAt: number;
  updatedAt: number;
  createdBy?: string | null;
  shiftId?: string | null;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  unitId: string;
  quantityMilli: number;
  baseQuantityMilli: number;
  unitPricePaisa: number;
  baseUnitPricePaisa: number;
  costPerUnitPaisa: number;
  discountPaisa: number;
  taxPaisa: number;
  lineTotalPaisa: number;
  lineCostTotalPaisa: number;
  productNameSnapshot?: string | null;
  createdAt: number;
}

export interface SalePayment {
  id: string;
  businessId: string;
  saleId: string;
  paymentNumber?: string | null;
  paymentDate?: number | null;
  paymentMethod: string;
  amountPaisa: number;
  cashAccountId?: string | null;
  bankAccountId?: string | null;
  mfsAccountId?: string | null;
  mfsProviderId?: string | null;
  cardType?: string | null;
  cardLast4?: string | null;
  chequeNumber?: string | null;
  transactionRef?: string | null;
  notes?: string | null;
  createdAt: number;
  createdBy?: string | null;
}

export interface SaleReturn {
  id: string;
  businessId: string;
  saleId: string;
  customerId?: string | null;
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

export interface SaleReturnItem {
  id: string;
  returnId: string;
  productId: string;
  unitId?: string | null;
  quantityMilli: number;
  baseQuantityMilli: number;
  unitPricePaisa: number;
  costPaisa: number;
  lineTotalPaisa: number;
  restock: boolean;
}

export class SaleRepository extends BaseRepository {
  create(data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt' | 'voidedAt' | 'voidedBy' | 'voidReason' | 'refundPaisa' | 'refundMethod' | 'changePaisa' | 'discountType' | 'discountValue' | 'discountPaisa' | 'taxPaisa' | 'shippingPaisa' | 'notes' | 'createdBy' | 'shiftId'> & Partial<Pick<Sale, 'voidedAt' | 'voidedBy' | 'voidReason' | 'refundPaisa' | 'refundMethod' | 'changePaisa' | 'discountType' | 'discountValue' | 'discountPaisa' | 'taxPaisa' | 'shippingPaisa' | 'notes' | 'createdBy' | 'shiftId'>>): Sale {
    try {
      const id = this.generateId();
      const now = this.now();
      const sale: Sale = {
        id,
        businessId: data.businessId,
        customerId: data.customerId || null,
        saleNumber: data.saleNumber,
        saleDate: data.saleDate || now,
        status: data.status || 'completed',
        subtotalPaisa: data.subtotalPaisa ?? 0,
        discountType: data.discountType || null,
        discountValue: data.discountValue ?? 0,
        discountPaisa: data.discountPaisa ?? 0,
        taxPaisa: data.taxPaisa ?? 0,
        shippingPaisa: data.shippingPaisa ?? 0,
        totalPaisa: data.totalPaisa ?? 0,
        paidPaisa: data.paidPaisa ?? 0,
        duePaisa: data.duePaisa ?? 0,
        changePaisa: data.changePaisa ?? 0,
        refundPaisa: data.refundPaisa ?? 0,
        refundMethod: data.refundMethod || null,
        notes: data.notes || null,
        isDue: data.isDue ?? false,
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
        createdAt: now,
        updatedAt: now,
        createdBy: data.createdBy || null,
        shiftId: data.shiftId || null,
      };

      this.db.prepare(`
        INSERT INTO sales (id, business_id, customer_id, sale_number, sale_date, status, subtotal_paisa, discount_type, discount_value, discount_paisa, tax_paisa, shipping_paisa, total_paisa, paid_paisa, due_paisa, change_paisa, refund_paisa, refund_method, notes, is_due, created_at, updated_at, created_by, shift_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sale.id,
        sale.businessId,
        sale.customerId,
        sale.saleNumber,
        sale.saleDate,
        sale.status,
        sale.subtotalPaisa,
        sale.discountType,
        sale.discountValue,
        sale.discountPaisa,
        sale.taxPaisa,
        sale.shippingPaisa,
        sale.totalPaisa,
        sale.paidPaisa,
        sale.duePaisa,
        sale.changePaisa,
        sale.refundPaisa,
        sale.refundMethod,
        sale.notes,
        sale.isDue ? 1 : 0,
        sale.createdAt,
        sale.updatedAt,
        sale.createdBy,
        sale.shiftId
      );

      return sale;
    } catch (e) {
      this.handleError(e, 'Sale');
    }
  }

  findById(id: string): Sale | null {
    const row = this.db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByNumber(saleNumber: string): Sale | null {
    const row = this.db.prepare('SELECT * FROM sales WHERE sale_number = ?').get(saleNumber) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBusiness(
    businessId: string,
    filters?: { customerId?: string; status?: string; fromDate?: number; toDate?: number; search?: string; paymentMethod?: string; isDue?: boolean },
    limit = 50,
    offset = 0
  ): Sale[] {
    let sql = 'SELECT * FROM sales WHERE business_id = ?';
    const params: any[] = [businessId];

    if (filters?.customerId) {
      sql += ' AND customer_id = ?';
      params.push(filters.customerId);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.fromDate) {
      sql += ' AND sale_date >= ?';
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      sql += ' AND sale_date <= ?';
      params.push(filters.toDate);
    }
    if (filters?.search) {
      sql += ' AND (sale_number LIKE ? OR notes LIKE ?)';
      const like = `%${filters.search}%`;
      params.push(like, like);
    }
    if (filters?.isDue !== undefined) {
      sql += ' AND is_due = ?';
      params.push(filters.isDue ? 1 : 0);
    }

    sql += ' ORDER BY sale_date DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByCustomer(customerId: string): Sale[] {
    const rows = this.db.prepare('SELECT * FROM sales WHERE customer_id = ? ORDER BY sale_date DESC').all(customerId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  update(id: string, data: Partial<Omit<Sale, 'id' | 'businessId' | 'createdAt'>>): Sale | null {
    try {
      const existing = this.findById(id);
      if (!existing) return null;

      const updated = { ...existing, ...data, updatedAt: this.now() } as Sale;

      this.db.prepare(`
        UPDATE sales SET customer_id = ?, status = ?, subtotal_paisa = ?, discount_type = ?, discount_value = ?, discount_paisa = ?, tax_paisa = ?, shipping_paisa = ?, total_paisa = ?, paid_paisa = ?, due_paisa = ?, change_paisa = ?, refund_paisa = ?, refund_method = ?, notes = ?, is_due = ?, updated_at = ?
        WHERE id = ?
      `).run(
        updated.customerId,
        updated.status,
        updated.subtotalPaisa,
        updated.discountType,
        updated.discountValue,
        updated.discountPaisa,
        updated.taxPaisa,
        updated.shippingPaisa,
        updated.totalPaisa,
        updated.paidPaisa,
        updated.duePaisa,
        updated.changePaisa,
        updated.refundPaisa,
        updated.refundMethod,
        updated.notes,
        updated.isDue ? 1 : 0,
        updated.updatedAt,
        id
      );

      return updated;
    } catch (e) {
      this.handleError(e, 'Sale');
    }
  }

  void(id: string, reason: string, voidedBy?: string): void {
    const now = this.now();
    this.db.prepare('UPDATE sales SET status = ?, voided_at = ?, voided_by = ?, void_reason = ?, updated_at = ? WHERE id = ?').run('cancelled', now, voidedBy || null, reason, now, id);
  }

  getNextSaleNumber(businessId: string): string {
    const row = this.db.prepare(`SELECT sale_number FROM sales WHERE business_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`).get(businessId) as { sale_number: string } | undefined;
    if (!row) return 'SAL-00001';

    const match = row.sale_number.match(/SAL-(\d+)/);
    if (!match) return `SAL-${Date.now().toString().slice(-5)}`;

    const num = parseInt(match[1], 10) + 1;
    return `SAL-${num.toString().padStart(5, '0')}`;
  }

  private mapRow(row: any): Sale {
    return {
      id: row.id,
      businessId: row.business_id,
      customerId: row.customer_id,
      saleNumber: row.sale_number,
      saleDate: row.sale_date,
      status: row.status as SaleStatus,
      subtotalPaisa: row.subtotal_paisa,
      discountType: row.discount_type,
      discountValue: row.discount_value,
      discountPaisa: row.discount_paisa,
      taxPaisa: row.tax_paisa,
      shippingPaisa: row.shipping_paisa ?? 0,
      totalPaisa: row.total_paisa,
      paidPaisa: row.paid_paisa,
      duePaisa: row.due_paisa,
      changePaisa: row.change_paisa,
      refundPaisa: row.refund_paisa ?? 0,
      refundMethod: row.refund_method,
      notes: row.notes,
      isDue: !!row.is_due,
      voidedAt: row.voided_at,
      voidedBy: row.voided_by,
      voidReason: row.void_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      shiftId: row.shift_id,
    };
  }
}

export class SaleItemRepository extends BaseRepository {
  create(data: Omit<SaleItem, 'id' | 'createdAt'>): SaleItem {
    try {
      const id = this.generateId();
      const now = this.now();
      const item: SaleItem = {
        id,
        saleId: data.saleId,
        productId: data.productId,
        unitId: data.unitId,
        quantityMilli: data.quantityMilli,
        baseQuantityMilli: data.baseQuantityMilli,
        unitPricePaisa: data.unitPricePaisa,
        baseUnitPricePaisa: data.baseUnitPricePaisa,
        costPerUnitPaisa: data.costPerUnitPaisa ?? 0,
        discountPaisa: data.discountPaisa ?? 0,
        taxPaisa: data.taxPaisa ?? 0,
        lineTotalPaisa: data.lineTotalPaisa,
        lineCostTotalPaisa: data.lineCostTotalPaisa ?? 0,
        productNameSnapshot: (data as any).productNameSnapshot || null,
        createdAt: now,
      };

      this.db.prepare(`
        INSERT INTO sale_items (id, sale_id, product_id, unit_id, quantity_milli, base_quantity_milli, unit_price_paisa, base_unit_price_paisa, cost_per_unit_paisa, discount_paisa, tax_paisa, line_total_paisa, line_cost_total_paisa, product_name_snapshot, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.saleId,
        item.productId,
        item.unitId,
        item.quantityMilli,
        item.baseQuantityMilli,
        item.unitPricePaisa,
        item.baseUnitPricePaisa,
        item.costPerUnitPaisa,
        item.discountPaisa,
        item.taxPaisa,
        item.lineTotalPaisa,
        item.lineCostTotalPaisa,
        item.productNameSnapshot,
        item.createdAt
      );

      return item;
    } catch (e) {
      this.handleError(e, 'SaleItem');
    }
  }

  findBySale(saleId: string): SaleItem[] {
    const rows = this.db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId) as any[];
    return rows.map(r => ({
      id: r.id,
      saleId: r.sale_id,
      productId: r.product_id,
      unitId: r.unit_id,
      quantityMilli: r.quantity_milli,
      baseQuantityMilli: r.base_quantity_milli,
      unitPricePaisa: r.unit_price_paisa,
      baseUnitPricePaisa: r.base_unit_price_paisa,
      costPerUnitPaisa: r.cost_per_unit_paisa,
      discountPaisa: r.discount_paisa,
      taxPaisa: r.tax_paisa ?? 0,
      lineTotalPaisa: r.line_total_paisa,
      lineCostTotalPaisa: r.line_cost_total_paisa,
      productNameSnapshot: r.product_name_snapshot,
      createdAt: r.created_at,
    }));
  }

  findByProduct(productId: string): SaleItem[] {
    const rows = this.db.prepare('SELECT * FROM sale_items WHERE product_id = ? ORDER BY created_at DESC').all(productId) as any[];
    return rows.map(r => ({
      id: r.id,
      saleId: r.sale_id,
      productId: r.product_id,
      unitId: r.unit_id,
      quantityMilli: r.quantity_milli,
      baseQuantityMilli: r.base_quantity_milli,
      unitPricePaisa: r.unit_price_paisa,
      baseUnitPricePaisa: r.base_unit_price_paisa,
      costPerUnitPaisa: r.cost_per_unit_paisa,
      discountPaisa: r.discount_paisa,
      taxPaisa: r.tax_paisa ?? 0,
      lineTotalPaisa: r.line_total_paisa,
      lineCostTotalPaisa: r.line_cost_total_paisa,
      productNameSnapshot: r.product_name_snapshot,
      createdAt: r.created_at,
    }));
  }
}

export class SalePaymentRepository extends BaseRepository {
  create(data: Omit<SalePayment, 'id' | 'createdAt'>): SalePayment {
    try {
      const id = this.generateId();
      const now = this.now();
      const payment: SalePayment = {
        id,
        businessId: data.businessId,
        saleId: data.saleId,
        paymentNumber: data.paymentNumber || null,
        paymentDate: data.paymentDate || now,
        paymentMethod: data.paymentMethod || 'cash',
        amountPaisa: data.amountPaisa,
        cashAccountId: data.cashAccountId || null,
        bankAccountId: data.bankAccountId || null,
        mfsAccountId: data.mfsAccountId || null,
        mfsProviderId: data.mfsProviderId || null,
        cardType: data.cardType || null,
        cardLast4: data.cardLast4 || null,
        chequeNumber: data.chequeNumber || null,
        transactionRef: data.transactionRef || null,
        notes: data.notes || null,
        createdAt: now,
        createdBy: data.createdBy || null,
      };

      this.db.prepare(`
        INSERT INTO sale_payments (id, business_id, sale_id, payment_number, payment_date, payment_method, amount_paisa, cash_account_id, bank_account_id, mfs_account_id, mfs_provider_id, card_type, card_last4, cheque_number, transaction_ref, notes, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        payment.id,
        payment.businessId,
        payment.saleId,
        payment.paymentNumber,
        payment.paymentDate,
        payment.paymentMethod,
        payment.amountPaisa,
        payment.cashAccountId,
        payment.bankAccountId,
        payment.mfsAccountId,
        payment.mfsProviderId,
        payment.cardType,
        payment.cardLast4,
        payment.chequeNumber,
        payment.transactionRef,
        payment.notes,
        payment.createdAt,
        payment.createdBy
      );

      return payment;
    } catch (e) {
      this.handleError(e, 'SalePayment');
    }
  }

  findBySale(saleId: string): SalePayment[] {
    const rows = this.db.prepare('SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY created_at ASC').all(saleId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByCustomer(customerId: string): SalePayment[] {
    const rows = this.db.prepare(`
      SELECT sp.* FROM sale_payments sp
      JOIN sales s ON s.id = sp.sale_id
      WHERE s.customer_id = ? ORDER BY sp.created_at DESC
    `).all(customerId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getTotalPaidForSale(saleId: string): number {
    const row = this.db.prepare('SELECT SUM(amount_paisa) as total FROM sale_payments WHERE sale_id = ?').get(saleId) as { total: number | null };
    return row.total || 0;
  }

  getNextPaymentNumber(businessId: string): string {
    const row = this.db.prepare('SELECT payment_number FROM sale_payments WHERE business_id = ? AND payment_number IS NOT NULL ORDER BY created_at DESC, rowid DESC LIMIT 1').get(businessId) as { payment_number: string } | undefined;
    if (!row) return 'SPAY-00001';
    const match = row.payment_number.match(/SPAY-(\d+)/);
    if (!match) return `SPAY-${Date.now().toString().slice(-5)}`;
    const num = parseInt(match[1], 10) + 1;
    return `SPAY-${num.toString().padStart(5, '0')}`;
  }

  private mapRow(row: any): SalePayment {
    return {
      id: row.id,
      businessId: row.business_id,
      saleId: row.sale_id,
      paymentNumber: row.payment_number,
      paymentDate: row.payment_date,
      paymentMethod: row.payment_method,
      amountPaisa: row.amount_paisa,
      cashAccountId: row.cash_account_id,
      bankAccountId: row.bank_account_id,
      mfsAccountId: row.mfs_account_id,
      mfsProviderId: row.mfs_provider_id,
      cardType: row.card_type,
      cardLast4: row.card_last4,
      chequeNumber: row.cheque_number,
      transactionRef: row.transaction_ref,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }
}

export class SaleReturnRepository extends BaseRepository {
  create(data: Omit<SaleReturn, 'id' | 'createdAt'>): SaleReturn {
    try {
      const id = this.generateId();
      const now = this.now();
      const ret: SaleReturn = {
        id,
        businessId: data.businessId,
        saleId: data.saleId,
        customerId: data.customerId || null,
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
        INSERT INTO sale_returns (id, business_id, sale_id, customer_id, return_number, return_date, total_paisa, refund_paisa, refund_method, reason, notes, status, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ret.id,
        ret.businessId,
        ret.saleId,
        ret.customerId,
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
      this.handleError(e, 'SaleReturn');
    }
  }

  findById(id: string): SaleReturn | null {
    const row = this.db.prepare('SELECT * FROM sale_returns WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findBySale(saleId: string): SaleReturn[] {
    const rows = this.db.prepare('SELECT * FROM sale_returns WHERE sale_id = ? ORDER BY return_date DESC').all(saleId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByCustomer(customerId: string): SaleReturn[] {
    const rows = this.db.prepare('SELECT * FROM sale_returns WHERE customer_id = ? ORDER BY return_date DESC').all(customerId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getNextReturnNumber(businessId: string): string {
    const row = this.db.prepare('SELECT return_number FROM sale_returns WHERE business_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(businessId) as { return_number: string } | undefined;
    if (!row) return 'SRET-00001';
    const match = row.return_number.match(/SRET-(\d+)/);
    if (!match) return `SRET-${Date.now().toString().slice(-5)}`;
    const num = parseInt(match[1], 10) + 1;
    return `SRET-${num.toString().padStart(5, '0')}`;
  }

  private mapRow(row: any): SaleReturn {
    return {
      id: row.id,
      businessId: row.business_id,
      saleId: row.sale_id,
      customerId: row.customer_id,
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

export class SaleReturnItemRepository extends BaseRepository {
  create(data: Omit<SaleReturnItem, 'id'>): SaleReturnItem {
    try {
      const id = this.generateId();
      const item: SaleReturnItem = {
        id,
        returnId: data.returnId,
        productId: data.productId,
        unitId: data.unitId || null,
        quantityMilli: data.quantityMilli,
        baseQuantityMilli: data.baseQuantityMilli ?? data.quantityMilli,
        unitPricePaisa: data.unitPricePaisa,
        costPaisa: data.costPaisa ?? 0,
        lineTotalPaisa: data.lineTotalPaisa,
        restock: data.restock ?? true,
      };

      this.db.prepare(`
        INSERT INTO sale_return_items (id, return_id, product_id, unit_id, quantity_milli, base_quantity_milli, unit_price_paisa, cost_paisa, line_total_paisa, restock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.returnId,
        item.productId,
        item.unitId,
        item.quantityMilli,
        item.baseQuantityMilli,
        item.unitPricePaisa,
        item.costPaisa,
        item.lineTotalPaisa,
        item.restock ? 1 : 0
      );

      return item;
    } catch (e) {
      this.handleError(e, 'SaleReturnItem');
    }
  }

  findByReturn(returnId: string): SaleReturnItem[] {
    const rows = this.db.prepare('SELECT * FROM sale_return_items WHERE return_id = ?').all(returnId) as any[];
    return rows.map(r => ({
      id: r.id,
      returnId: r.return_id,
      productId: r.product_id,
      unitId: r.unit_id,
      quantityMilli: r.quantity_milli,
      baseQuantityMilli: r.base_quantity_milli,
      unitPricePaisa: r.unit_price_paisa,
      costPaisa: r.cost_paisa,
      lineTotalPaisa: r.line_total_paisa,
      restock: !!r.restock,
    }));
  }

  getReturnedQuantityForSale(productId: string, saleId: string): number {
    const row = this.db.prepare(`
      SELECT SUM(sri.base_quantity_milli) as total
      FROM sale_return_items sri
      JOIN sale_returns sr ON sr.id = sri.return_id
      WHERE sri.product_id = ? AND sr.sale_id = ?
    `).get(productId, saleId) as { total: number | null };
    return row.total || 0;
  }
}
