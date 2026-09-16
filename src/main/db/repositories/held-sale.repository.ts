import { BaseRepository } from './base';

export interface HeldSale {
  id: string;
  businessId: string;
  heldNumber: string;
  customerId?: string | null;
  cartJson: string; // JSON string of cart items + totals
  notes?: string | null;
  createdAt: number;
  expiresAt?: number | null;
  createdBy?: string | null;
}

export class HeldSaleRepository extends BaseRepository {
  create(data: Omit<HeldSale, 'id' | 'createdAt'>): HeldSale {
    try {
      const id = this.generateId();
      const now = this.now();
      const held: HeldSale = {
        id,
        businessId: data.businessId,
        heldNumber: data.heldNumber,
        customerId: data.customerId || null,
        cartJson: data.cartJson,
        notes: data.notes || null,
        createdAt: now,
        expiresAt: data.expiresAt || null,
        createdBy: data.createdBy || null,
      };

      this.db.prepare(`
        INSERT INTO held_sales (id, business_id, held_number, customer_id, cart_json, notes, created_at, expires_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        held.id,
        held.businessId,
        held.heldNumber,
        held.customerId,
        held.cartJson,
        held.notes,
        held.createdAt,
        held.expiresAt,
        held.createdBy
      );

      return held;
    } catch (e) {
      this.handleError(e, 'HeldSale');
    }
  }

  findById(id: string): HeldSale | null {
    const row = this.db.prepare('SELECT * FROM held_sales WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBusiness(businessId: string, limit = 50): HeldSale[] {
    const rows = this.db.prepare('SELECT * FROM held_sales WHERE business_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?').all(businessId, limit) as any[];
    return rows.map(r => this.mapRow(r));
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM held_sales WHERE id = ?').run(id);
  }

  getNextHeldNumber(businessId: string): string {
    const row = this.db.prepare('SELECT held_number FROM held_sales WHERE business_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(businessId) as { held_number: string } | undefined;
    if (!row) return 'HOLD-00001';
    const match = row.held_number.match(/HOLD-(\d+)/);
    if (!match) return `HOLD-${Date.now().toString().slice(-5)}`;
    const num = parseInt(match[1], 10) + 1;
    return `HOLD-${num.toString().padStart(5, '0')}`;
  }

  private mapRow(row: any): HeldSale {
    return {
      id: row.id,
      businessId: row.business_id,
      heldNumber: row.held_number,
      customerId: row.customer_id,
      cartJson: row.cart_json,
      notes: row.notes,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      createdBy: row.created_by,
    };
  }
}
