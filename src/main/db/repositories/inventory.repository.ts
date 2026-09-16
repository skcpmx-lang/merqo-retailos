import { BaseRepository } from './base';

export interface StockLevel {
  id: string;
  businessId: string;
  productId: string;
  locationId: string;
  quantityMilli: number;
  reservedMilli: number;
  lastMovementAt?: number | null;
  updatedAt: number;
}

export interface StockMovement {
  id: string;
  businessId: string;
  productId: string;
  movementType: string;
  quantityMilli: number;
  unitId?: string | null;
  unitQuantity?: number | null;
  costPaisa: number;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  locationId: string;
  createdAt: number;
  createdBy?: string | null;
}

export class StockLevelRepository extends BaseRepository {
  upsert(data: Omit<StockLevel, 'id' | 'updatedAt'> & { id?: string }): StockLevel {
    try {
      const existing = this.findByProductAndLocation(data.productId, data.locationId || 'main');
      const now = this.now();

      if (existing) {
        const updated: StockLevel = {
          ...existing,
          quantityMilli: data.quantityMilli,
          reservedMilli: data.reservedMilli ?? existing.reservedMilli,
          lastMovementAt: data.lastMovementAt ?? now,
          updatedAt: now,
        };

        this.db.prepare(`
          UPDATE stock_levels SET quantity_milli = ?, reserved_milli = ?, last_movement_at = ?, updated_at = ?
          WHERE id = ?
        `).run(updated.quantityMilli, updated.reservedMilli, updated.lastMovementAt, updated.updatedAt, existing.id);

        return updated;
      } else {
        const id = data.id || this.generateId();
        const level: StockLevel = {
          id,
          businessId: data.businessId,
          productId: data.productId,
          locationId: data.locationId || 'main',
          quantityMilli: data.quantityMilli,
          reservedMilli: data.reservedMilli ?? 0,
          lastMovementAt: data.lastMovementAt ?? now,
          updatedAt: now,
        };

        this.db.prepare(`
          INSERT INTO stock_levels (id, business_id, product_id, location_id, quantity_milli, reserved_milli, last_movement_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          level.id,
          level.businessId,
          level.productId,
          level.locationId,
          level.quantityMilli,
          level.reservedMilli,
          level.lastMovementAt,
          level.updatedAt
        );

        return level;
      }
    } catch (e) {
      this.handleError(e, 'StockLevel');
    }
  }

  findByProductAndLocation(productId: string, locationId = 'main'): StockLevel | null {
    const row = this.db.prepare('SELECT * FROM stock_levels WHERE product_id = ? AND location_id = ?').get(productId, locationId) as any;
    return row ? this.mapRow(row) : null;
  }

  findByProduct(productId: string): StockLevel | null {
    return this.findByProductAndLocation(productId, 'main');
  }

  findLowStock(businessId: string): StockLevel[] {
    const rows = this.db.prepare(`
      SELECT sl.* FROM stock_levels sl
      JOIN products p ON p.id = sl.product_id
      WHERE sl.business_id = ? AND p.deleted_at IS NULL AND p.is_active = 1
      AND sl.quantity_milli <= p.min_stock_milli
    `).all(businessId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getStockValue(businessId: string): number {
    const row = this.db.prepare(`
      SELECT SUM(sl.quantity_milli * p.cost_price_paisa / 1000) as total_value
      FROM stock_levels sl
      JOIN products p ON p.id = sl.product_id
      WHERE sl.business_id = ? AND p.deleted_at IS NULL
    `).get(businessId) as { total_value: number | null };
    return row.total_value || 0;
  }

  private mapRow(row: any): StockLevel {
    return {
      id: row.id,
      businessId: row.business_id,
      productId: row.product_id,
      locationId: row.location_id,
      quantityMilli: row.quantity_milli,
      reservedMilli: row.reserved_milli,
      lastMovementAt: row.last_movement_at,
      updatedAt: row.updated_at,
    };
  }
}

export class StockMovementRepository extends BaseRepository {
  create(data: Omit<StockMovement, 'id' | 'createdAt' | 'locationId'> & { locationId?: string }): StockMovement {
    try {
      if (data.quantityMilli === 0) {
        throw new Error('Stock movement quantity cannot be zero');
      }

      const id = this.generateId();
      const now = this.now();
      const movement: StockMovement = {
        id,
        businessId: data.businessId,
        productId: data.productId,
        movementType: data.movementType,
        quantityMilli: data.quantityMilli,
        unitId: data.unitId || null,
        unitQuantity: data.unitQuantity || null,
        costPaisa: data.costPaisa ?? 0,
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        notes: data.notes || null,
        locationId: data.locationId || 'main',
        createdAt: now,
        createdBy: data.createdBy || null,
      };

      this.db.prepare(`
        INSERT INTO stock_movements (id, business_id, product_id, movement_type, quantity_milli, unit_id, unit_quantity, cost_paisa, reference_type, reference_id, notes, location_id, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        movement.id,
        movement.businessId,
        movement.productId,
        movement.movementType,
        movement.quantityMilli,
        movement.unitId,
        movement.unitQuantity,
        movement.costPaisa,
        movement.referenceType,
        movement.referenceId,
        movement.notes,
        movement.locationId,
        movement.createdAt,
        movement.createdBy
      );

      return movement;
    } catch (e) {
      this.handleError(e, 'StockMovement');
    }
  }

  findByProduct(productId: string, limit = 100): StockMovement[] {
    const rows = this.db.prepare('SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC LIMIT ?').all(productId, limit) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByReference(referenceType: string, referenceId: string): StockMovement[] {
    const rows = this.db.prepare('SELECT * FROM stock_movements WHERE reference_type = ? AND reference_id = ?').all(referenceType, referenceId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getCurrentStock(productId: string, locationId = 'main'): number {
    const row = this.db.prepare('SELECT SUM(quantity_milli) as total FROM stock_movements WHERE product_id = ? AND location_id = ?').get(productId, locationId) as { total: number | null };
    return row.total || 0;
  }

  getStockValue(productId: string): number {
    // Weighted value based on cost history — for simplicity, use last cost * qty
    // Full WAC valuation done in service layer
    const row = this.db.prepare('SELECT SUM(quantity_milli * cost_paisa / 1000) as value FROM stock_movements WHERE product_id = ?').get(productId) as { value: number | null };
    return row.value || 0;
  }

  private mapRow(row: any): StockMovement {
    return {
      id: row.id,
      businessId: row.business_id,
      productId: row.product_id,
      movementType: row.movement_type,
      quantityMilli: row.quantity_milli,
      unitId: row.unit_id,
      unitQuantity: row.unit_quantity,
      costPaisa: row.cost_paisa,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      notes: row.notes,
      locationId: row.location_id,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }
}
