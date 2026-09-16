/**
 * Seed runner — idempotent, inserts if not exists
 */

import { SEED_ROLES, SEED_PERMISSIONS, ROLE_PERMISSIONS_MAP, SEED_MFS_PROVIDERS, SEED_EXPENSE_CATEGORIES, SEED_UNITS } from './index';
import { Id } from '@core/domain/Id';

export class SeedRunner {
  private db: any;

  constructor(db?: any) {
    if (db) {
      this.db = db;
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getConnection } = require('../connection');
        this.db = getConnection();
      } catch {
        throw new Error('DB required for SeedRunner in test environment');
      }
    }
  }

  runAll(businessId?: string) {
    this.seedPermissions();
    this.seedRoles();
    this.seedRolePermissions();
    this.seedMfsProviders();
    if (businessId) {
      this.seedUnits(businessId);
      this.seedExpenseCategories(businessId);
    }
  }

  seedPermissions() {
    const now = Date.now();
    for (const perm of SEED_PERMISSIONS) {
      const existing = this.db.prepare('SELECT id FROM permissions WHERE code = ?').get(perm.code);
      if (!existing) {
        const id = Id.generate();
        this.db.prepare(`
          INSERT INTO permissions (id, code, name, name_bn, module, description, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, perm.code, perm.name, perm.nameBn, perm.module, '', now);
      }
    }
  }

  seedRoles() {
    const now = Date.now();
    for (const role of SEED_ROLES) {
      const existing = this.db.prepare('SELECT id FROM roles WHERE code = ?').get(role.code);
      if (!existing) {
        const id = Id.generate();
        this.db.prepare(`
          INSERT INTO roles (id, code, name, name_bn, description, is_system, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, role.code, role.name, role.nameBn, role.description, role.isSystem ? 1 : 0, now, now);
      }
    }
  }

  seedRolePermissions() {
    const now = Date.now();
    for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS_MAP)) {
      const role = this.db.prepare('SELECT id FROM roles WHERE code = ?').get(roleCode) as { id: string } | undefined;
      if (!role) continue;

      for (const permCode of permCodes) {
        const perm = this.db.prepare('SELECT id FROM permissions WHERE code = ?').get(permCode) as { id: string } | undefined;
        if (!perm) continue;

        const existing = this.db.prepare('SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?').get(role.id, perm.id);
        if (!existing) {
          const id = Id.generate();
          this.db.prepare(`
            INSERT INTO role_permissions (id, role_id, permission_id, created_at)
            VALUES (?, ?, ?, ?)
          `).run(id, role.id, perm.id, now);
        }
      }
    }
  }

  seedMfsProviders() {
    const now = Date.now();
    for (const provider of SEED_MFS_PROVIDERS) {
      const existing = this.db.prepare('SELECT id FROM mfs_providers WHERE code = ?').get(provider.code);
      if (!existing) {
        const id = Id.generate();
        this.db.prepare(`
          INSERT INTO mfs_providers (id, code, name, name_bn, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, provider.code, provider.name, provider.nameBn, 1, now);
      }
    }
  }

  seedUnits(businessId: string) {
    const now = Date.now();
    for (const unit of SEED_UNITS) {
      const existing = this.db.prepare('SELECT id FROM units WHERE business_id = ? AND name = ?').get(businessId, unit.name);
      if (!existing) {
        const id = Id.generate();
        this.db.prepare(`
          INSERT INTO units (id, business_id, name, short_name, name_bn, is_base_unit, unit_group, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, businessId, unit.name, unit.shortName, unit.nameBn, unit.isBase ? 1 : 0, unit.unitGroup, 1, now, now);
      }
    }
  }

  seedExpenseCategories(businessId: string) {
    const now = Date.now();
    for (const cat of SEED_EXPENSE_CATEGORIES) {
      const existing = this.db.prepare('SELECT id FROM expense_categories WHERE business_id = ? AND name = ?').get(businessId, cat.name);
      if (!existing) {
        const id = Id.generate();
        this.db.prepare(`
          INSERT INTO expense_categories (id, business_id, name, name_bn, is_system, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, businessId, cat.name, cat.nameBn, cat.isSystem ? 1 : 0, 1, now, now);
      }
    }
  }
}
