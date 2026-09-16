import { BaseRepository } from './base';

export interface Category {
  id: string;
  businessId: string;
  parentId?: string | null;
  name: string;
  nameBn?: string | null;
  description?: string | null;
  imagePath?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export class CategoryRepository extends BaseRepository {
  create(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Category {
    try {
      const id = this.generateId();
      const now = this.now();
      const category: Category = {
        id,
        businessId: data.businessId,
        parentId: data.parentId || null,
        name: data.name,
        nameBn: data.nameBn || null,
        description: data.description || null,
        imagePath: data.imagePath || null,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      this.db.prepare(`
        INSERT INTO categories (id, business_id, parent_id, name, name_bn, description, image_path, is_active, sort_order, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        category.id,
        category.businessId,
        category.parentId,
        category.name,
        category.nameBn,
        category.description,
        category.imagePath,
        category.isActive ? 1 : 0,
        category.sortOrder,
        category.createdAt,
        category.updatedAt,
        category.deletedAt
      );

      return category;
    } catch (e) {
      this.handleError(e, 'Category');
    }
  }

  findById(id: string): Category | null {
    const row = this.db.prepare('SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBusiness(businessId: string): Category[] {
    const rows = this.db.prepare('SELECT * FROM categories WHERE business_id = ? AND deleted_at IS NULL ORDER BY sort_order, name').all(businessId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findChildren(parentId: string): Category[] {
    const rows = this.db.prepare('SELECT * FROM categories WHERE parent_id = ? AND deleted_at IS NULL ORDER BY sort_order, name').all(parentId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  update(id: string, data: Partial<Omit<Category, 'id' | 'businessId' | 'createdAt'>>): Category | null {
    try {
      const existing = this.findById(id);
      if (!existing) return null;

      const updated = {
        ...existing,
        ...data,
        updatedAt: this.now(),
      };

      this.db.prepare(`
        UPDATE categories SET parent_id = ?, name = ?, name_bn = ?, description = ?, image_path = ?, is_active = ?, sort_order = ?, updated_at = ?
        WHERE id = ?
      `).run(
        updated.parentId,
        updated.name,
        updated.nameBn,
        updated.description,
        updated.imagePath,
        updated.isActive ? 1 : 0,
        updated.sortOrder,
        updated.updatedAt,
        id
      );

      return updated;
    } catch (e) {
      this.handleError(e, 'Category');
    }
  }

  softDelete(id: string): void {
    this.db.prepare('UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?').run(this.now(), this.now(), id);
  }

  hasProducts(categoryId: string): boolean {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ? AND deleted_at IS NULL').get(categoryId) as { count: number };
    return row.count > 0;
  }

  private mapRow(row: any): Category {
    return {
      id: row.id,
      businessId: row.business_id,
      parentId: row.parent_id,
      name: row.name,
      nameBn: row.name_bn,
      description: row.description,
      imagePath: row.image_path,
      isActive: !!row.is_active,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}
