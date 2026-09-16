import { BaseRepository } from './base';

export interface Product {
  id: string;
  businessId: string;
  categoryId?: string | null;
  brandId?: string | null;
  baseUnitId: string;
  purchaseUnitId?: string | null;
  saleUnitId?: string | null;
  name: string;
  nameBn?: string | null;
  description?: string | null;
  sku: string;
  barcode?: string | null;
  costPricePaisa: number;
  sellingPricePaisa: number;
  mrpPaisa?: number | null;
  minStockMilli: number;
  reorderLevelMilli: number;
  openingStockMilli: number;
  isStockTrackable: boolean;
  isSellable: boolean;
  isPurchasable: boolean;
  isActive: boolean;
  imagePath?: string | null;
  taxRate: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface ProductBarcode {
  id: string;
  productId: string;
  unitId?: string | null;
  barcode: string;
  quantityMilli: number;
  isPrimary: boolean;
  createdAt: number;
}

export interface ProductCostHistory {
  id: string;
  productId: string;
  purchaseId?: string | null;
  oldCostPaisa: number;
  newCostPaisa: number;
  oldWacPaisa: number;
  newWacPaisa: number;
  reason: string;
  createdAt: number;
  createdBy?: string | null;
}

export class ProductRepository extends BaseRepository {
  create(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product {
    try {
      const id = this.generateId();
      const now = this.now();
      const product: Product = {
        id,
        businessId: data.businessId,
        categoryId: data.categoryId || null,
        brandId: data.brandId || null,
        baseUnitId: data.baseUnitId,
        purchaseUnitId: data.purchaseUnitId || null,
        saleUnitId: data.saleUnitId || null,
        name: data.name,
        nameBn: data.nameBn || null,
        description: data.description || null,
        sku: data.sku,
        barcode: data.barcode || null,
        costPricePaisa: data.costPricePaisa,
        sellingPricePaisa: data.sellingPricePaisa,
        mrpPaisa: data.mrpPaisa || null,
        minStockMilli: data.minStockMilli ?? 0,
        reorderLevelMilli: data.reorderLevelMilli ?? 0,
        openingStockMilli: data.openingStockMilli ?? 0,
        isStockTrackable: data.isStockTrackable ?? true,
        isSellable: data.isSellable ?? true,
        isPurchasable: data.isPurchasable ?? true,
        isActive: data.isActive ?? true,
        imagePath: data.imagePath || null,
        taxRate: data.taxRate ?? 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        createdBy: data.createdBy || null,
        updatedBy: data.updatedBy || null,
      };

      this.db.prepare(`
        INSERT INTO products (id, business_id, category_id, brand_id, base_unit_id, purchase_unit_id, sale_unit_id, name, name_bn, description, sku, barcode, cost_price_paisa, selling_price_paisa, mrp_paisa, min_stock_milli, reorder_level_milli, opening_stock_milli, is_stock_trackable, is_sellable, is_purchasable, is_active, image_path, tax_rate, created_at, updated_at, deleted_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        product.id,
        product.businessId,
        product.categoryId,
        product.brandId,
        product.baseUnitId,
        product.purchaseUnitId,
        product.saleUnitId,
        product.name,
        product.nameBn,
        product.description,
        product.sku,
        product.barcode,
        product.costPricePaisa,
        product.sellingPricePaisa,
        product.mrpPaisa,
        product.minStockMilli,
        product.reorderLevelMilli,
        product.openingStockMilli,
        product.isStockTrackable ? 1 : 0,
        product.isSellable ? 1 : 0,
        product.isPurchasable ? 1 : 0,
        product.isActive ? 1 : 0,
        product.imagePath,
        product.taxRate,
        product.createdAt,
        product.updatedAt,
        product.deletedAt,
        product.createdBy,
        product.updatedBy
      );

      return product;
    } catch (e) {
      this.handleError(e, 'Product');
    }
  }

  findById(id: string): Product | null {
    const row = this.db.prepare('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findBySku(sku: string): Product | null {
    const row = this.db.prepare('SELECT * FROM products WHERE sku = ? AND deleted_at IS NULL').get(sku) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBarcode(barcode: string): Product | null {
    // Check primary barcode
    let row = this.db.prepare('SELECT * FROM products WHERE barcode = ? AND deleted_at IS NULL').get(barcode) as any;
    if (row) return this.mapRow(row);

    // Check product_barcodes
    row = this.db.prepare(`
      SELECT p.* FROM products p
      JOIN product_barcodes pb ON pb.product_id = p.id
      WHERE pb.barcode = ? AND p.deleted_at IS NULL
    `).get(barcode) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBusiness(businessId: string, limit = 100, offset = 0): Product[] {
    const rows = this.db.prepare('SELECT * FROM products WHERE business_id = ? AND deleted_at IS NULL ORDER BY name LIMIT ? OFFSET ?').all(businessId, limit, offset) as any[];
    return rows.map(r => this.mapRow(r));
  }

  search(businessId: string, query: string, limit = 50): Product[] {
    // Use FTS if available, fallback to LIKE
    try {
      const ftsRows = this.db.prepare(`
        SELECT p.* FROM products p
        JOIN products_fts fts ON fts.rowid = p.rowid
        WHERE p.business_id = ? AND p.deleted_at IS NULL AND products_fts MATCH ?
        ORDER BY rank LIMIT ?
      `).all(businessId, query, limit) as any[];
      if (ftsRows.length > 0) return ftsRows.map(r => this.mapRow(r));
    } catch {}

    const likeQuery = `%${query}%`;
    const rows = this.db.prepare(`
      SELECT * FROM products WHERE business_id = ? AND deleted_at IS NULL
      AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)
      ORDER BY name LIMIT ?
    `).all(businessId, likeQuery, likeQuery, likeQuery, limit) as any[];
    return rows.map(r => this.mapRow(r));
  }

  update(id: string, data: Partial<Omit<Product, 'id' | 'businessId' | 'createdAt'>>): Product | null {
    try {
      const existing = this.findById(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: this.now() };

      this.db.prepare(`
        UPDATE products SET category_id = ?, brand_id = ?, base_unit_id = ?, purchase_unit_id = ?, sale_unit_id = ?, name = ?, name_bn = ?, description = ?, sku = ?, barcode = ?, cost_price_paisa = ?, selling_price_paisa = ?, mrp_paisa = ?, min_stock_milli = ?, reorder_level_milli = ?, is_stock_trackable = ?, is_sellable = ?, is_purchasable = ?, is_active = ?, image_path = ?, tax_rate = ?, updated_at = ?, updated_by = ?
        WHERE id = ?
      `).run(
        updated.categoryId,
        updated.brandId,
        updated.baseUnitId,
        updated.purchaseUnitId,
        updated.saleUnitId,
        updated.name,
        updated.nameBn,
        updated.description,
        updated.sku,
        updated.barcode,
        updated.costPricePaisa,
        updated.sellingPricePaisa,
        updated.mrpPaisa,
        updated.minStockMilli,
        updated.reorderLevelMilli,
        updated.isStockTrackable ? 1 : 0,
        updated.isSellable ? 1 : 0,
        updated.isPurchasable ? 1 : 0,
        updated.isActive ? 1 : 0,
        updated.imagePath,
        updated.taxRate,
        updated.updatedAt,
        updated.updatedBy,
        id
      );

      return updated;
    } catch (e) {
      this.handleError(e, 'Product');
    }
  }

  softDelete(id: string): void {
    this.db.prepare('UPDATE products SET deleted_at = ?, updated_at = ? WHERE id = ?').run(this.now(), this.now(), id);
  }

  hasStockMovements(productId: string): boolean {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM stock_movements WHERE product_id = ?').get(productId) as { count: number };
    return row.count > 0;
  }

  private mapRow(row: any): Product {
    return {
      id: row.id,
      businessId: row.business_id,
      categoryId: row.category_id,
      brandId: row.brand_id,
      baseUnitId: row.base_unit_id,
      purchaseUnitId: row.purchase_unit_id,
      saleUnitId: row.sale_unit_id,
      name: row.name,
      nameBn: row.name_bn,
      description: row.description,
      sku: row.sku,
      barcode: row.barcode,
      costPricePaisa: row.cost_price_paisa,
      sellingPricePaisa: row.selling_price_paisa,
      mrpPaisa: row.mrp_paisa,
      minStockMilli: row.min_stock_milli,
      reorderLevelMilli: row.reorder_level_milli,
      openingStockMilli: row.opening_stock_milli,
      isStockTrackable: !!row.is_stock_trackable,
      isSellable: !!row.is_sellable,
      isPurchasable: !!row.is_purchasable,
      isActive: !!row.is_active,
      imagePath: row.image_path,
      taxRate: row.tax_rate,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    };
  }
}

export class ProductBarcodeRepository extends BaseRepository {
  create(data: Omit<ProductBarcode, 'id' | 'createdAt'>): ProductBarcode {
    try {
      const id = this.generateId();
      const now = this.now();
      const barcode: ProductBarcode = {
        id,
        productId: data.productId,
        unitId: data.unitId || null,
        barcode: data.barcode,
        quantityMilli: data.quantityMilli ?? 1000,
        isPrimary: data.isPrimary ?? false,
        createdAt: now,
      };

      this.db.prepare(`
        INSERT INTO product_barcodes (id, product_id, unit_id, barcode, quantity_milli, is_primary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        barcode.id,
        barcode.productId,
        barcode.unitId,
        barcode.barcode,
        barcode.quantityMilli,
        barcode.isPrimary ? 1 : 0,
        barcode.createdAt
      );

      return barcode;
    } catch (e) {
      this.handleError(e, 'ProductBarcode');
    }
  }

  findByProduct(productId: string): ProductBarcode[] {
    const rows = this.db.prepare('SELECT * FROM product_barcodes WHERE product_id = ?').all(productId) as any[];
    return rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      unitId: r.unit_id,
      barcode: r.barcode,
      quantityMilli: r.quantity_milli,
      isPrimary: !!r.is_primary,
      createdAt: r.created_at,
    }));
  }

  findByBarcode(barcode: string): ProductBarcode | null {
    const row = this.db.prepare('SELECT * FROM product_barcodes WHERE barcode = ?').get(barcode) as any;
    if (!row) return null;
    return {
      id: row.id,
      productId: row.product_id,
      unitId: row.unit_id,
      barcode: row.barcode,
      quantityMilli: row.quantity_milli,
      isPrimary: !!row.is_primary,
      createdAt: row.created_at,
    };
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM product_barcodes WHERE id = ?').run(id);
  }
}

export class ProductCostHistoryRepository extends BaseRepository {
  create(data: Omit<ProductCostHistory, 'id' | 'createdAt'>): ProductCostHistory {
    try {
      const id = this.generateId();
      const now = this.now();
      const history: ProductCostHistory = {
        id,
        productId: data.productId,
        purchaseId: data.purchaseId || null,
        oldCostPaisa: data.oldCostPaisa,
        newCostPaisa: data.newCostPaisa,
        oldWacPaisa: data.oldWacPaisa,
        newWacPaisa: data.newWacPaisa,
        reason: data.reason || 'purchase',
        createdAt: now,
        createdBy: data.createdBy || null,
      };

      this.db.prepare(`
        INSERT INTO product_cost_history (id, product_id, purchase_id, old_cost_paisa, new_cost_paisa, old_wac_paisa, new_wac_paisa, reason, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        history.id,
        history.productId,
        history.purchaseId,
        history.oldCostPaisa,
        history.newCostPaisa,
        history.oldWacPaisa,
        history.newWacPaisa,
        history.reason,
        history.createdAt,
        history.createdBy
      );

      return history;
    } catch (e) {
      this.handleError(e, 'ProductCostHistory');
    }
  }

  findByProduct(productId: string): ProductCostHistory[] {
    const rows = this.db.prepare('SELECT * FROM product_cost_history WHERE product_id = ? ORDER BY created_at DESC, rowid DESC').all(productId) as any[];
    return rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      purchaseId: r.purchase_id,
      oldCostPaisa: r.old_cost_paisa,
      newCostPaisa: r.new_cost_paisa,
      oldWacPaisa: r.old_wac_paisa,
      newWacPaisa: r.new_wac_paisa,
      reason: r.reason,
      createdAt: r.created_at,
      createdBy: r.created_by,
    }));
  }
}
