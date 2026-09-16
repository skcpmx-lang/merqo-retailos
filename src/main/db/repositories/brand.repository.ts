import { BaseRepository } from './base';

export interface Brand {
  id: string;
  businessId: string;
  name: string;
  nameBn?: string | null;
  logoPath?: string | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export class BrandRepository extends BaseRepository {
  create(data: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>): Brand {
    try {
      const id = this.generateId();
      const now = this.now();
      const brand: Brand = {
        id,
        businessId: data.businessId,
        name: data.name,
        nameBn: data.nameBn || null,
        logoPath: data.logoPath || null,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      this.db.prepare(`
        INSERT INTO brands (id, business_id, name, name_bn, logo_path, is_active, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        brand.id,
        brand.businessId,
        brand.name,
        brand.nameBn,
        brand.logoPath,
        brand.isActive ? 1 : 0,
        brand.createdAt,
        brand.updatedAt,
        brand.deletedAt
      );

      return brand;
    } catch (e) {
      this.handleError(e, 'Brand');
    }
  }

  findById(id: string): Brand | null {
    const row = this.db.prepare('SELECT * FROM brands WHERE id = ? AND deleted_at IS NULL').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBusiness(businessId: string): Brand[] {
    const rows = this.db.prepare('SELECT * FROM brands WHERE business_id = ? AND deleted_at IS NULL ORDER BY name').all(businessId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  update(id: string, data: Partial<Omit<Brand, 'id' | 'businessId' | 'createdAt'>>): Brand | null {
    try {
      const existing = this.findById(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: this.now() };
      this.db.prepare(`
        UPDATE brands SET name = ?, name_bn = ?, logo_path = ?, is_active = ?, updated_at = ?
        WHERE id = ?
      `).run(updated.name, updated.nameBn, updated.logoPath, updated.isActive ? 1 : 0, updated.updatedAt, id);
      return updated;
    } catch (e) {
      this.handleError(e, 'Brand');
    }
  }

  softDelete(id: string): void {
    this.db.prepare('UPDATE brands SET deleted_at = ?, updated_at = ? WHERE id = ?').run(this.now(), this.now(), id);
  }

  private mapRow(row: any): Brand {
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      nameBn: row.name_bn,
      logoPath: row.logo_path,
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}
