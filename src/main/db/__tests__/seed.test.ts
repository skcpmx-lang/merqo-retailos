import { describe, it, expect, beforeEach } from 'vitest';
import { SeedRunner } from '../seeds/seed';
import { getTestDb, seedBusiness } from './test-helpers';

describe('SeedRunner', () => {
  let db: any;
  let seeder: SeedRunner;
  const businessId = 'biz_seed';

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    seeder = new SeedRunner(db);
  });

  it('should seed permissions', () => {
    seeder.seedPermissions();
    const count = db.prepare('SELECT COUNT(*) as count FROM permissions').get() as { count: number };
    expect(count.count).toBeGreaterThan(20);

    // Idempotent
    seeder.seedPermissions();
    const count2 = db.prepare('SELECT COUNT(*) as count FROM permissions').get() as { count: number };
    expect(count2.count).toBe(count.count);
  });

  it('should seed roles', () => {
    seeder.seedRoles();
    const count = db.prepare('SELECT COUNT(*) as count FROM roles').get() as { count: number };
    expect(count.count).toBe(5);

    seeder.seedRoles();
    const count2 = db.prepare('SELECT COUNT(*) as count FROM roles').get() as { count: number };
    expect(count2.count).toBe(5);
  });

  it('should seed role permissions', () => {
    seeder.seedPermissions();
    seeder.seedRoles();
    seeder.seedRolePermissions();

    const ownerRole = db.prepare('SELECT id FROM roles WHERE code = ?').get('owner') as { id: string };
    const permCount = db.prepare('SELECT COUNT(*) as count FROM role_permissions WHERE role_id = ?').get(ownerRole.id) as { count: number };
    expect(permCount.count).toBeGreaterThan(20);

    const cashierRole = db.prepare('SELECT id FROM roles WHERE code = ?').get('cashier') as { id: string };
    const cashierPermCount = db.prepare('SELECT COUNT(*) as count FROM role_permissions WHERE role_id = ?').get(cashierRole.id) as { count: number };
    expect(cashierPermCount.count).toBeLessThan(permCount.count);
  });

  it('should seed MFS providers', () => {
    seeder.seedMfsProviders();
    const count = db.prepare('SELECT COUNT(*) as count FROM mfs_providers').get() as { count: number };
    expect(count.count).toBe(6);

    const bkash = db.prepare('SELECT * FROM mfs_providers WHERE code = ?').get('bkash') as any;
    expect(bkash).toBeDefined();
    expect(bkash.name).toBe('bKash');
  });

  it('should seed units for business', () => {
    seeder.seedUnits(businessId);
    const count = db.prepare('SELECT COUNT(*) as count FROM units WHERE business_id = ?').get(businessId) as { count: number };
    expect(count.count).toBeGreaterThan(5);

    seeder.seedUnits(businessId);
    const count2 = db.prepare('SELECT COUNT(*) as count FROM units WHERE business_id = ?').get(businessId) as { count: number };
    expect(count2.count).toBe(count.count);
  });

  it('should seed expense categories for business', () => {
    seeder.seedExpenseCategories(businessId);
    const count = db.prepare('SELECT COUNT(*) as count FROM expense_categories WHERE business_id = ?').get(businessId) as { count: number };
    expect(count.count).toBeGreaterThan(5);
  });

  it('should run all seeds', () => {
    seeder.runAll(businessId);

    const roles = db.prepare('SELECT COUNT(*) as count FROM roles').get() as { count: number };
    const perms = db.prepare('SELECT COUNT(*) as count FROM permissions').get() as { count: number };
    const mfs = db.prepare('SELECT COUNT(*) as count FROM mfs_providers').get() as { count: number };
    const units = db.prepare('SELECT COUNT(*) as count FROM units WHERE business_id = ?').get(businessId) as { count: number };
    const expenseCats = db.prepare('SELECT COUNT(*) as count FROM expense_categories WHERE business_id = ?').get(businessId) as { count: number };

    expect(roles.count).toBe(5);
    expect(perms.count).toBeGreaterThan(20);
    expect(mfs.count).toBe(6);
    expect(units.count).toBeGreaterThan(5);
    expect(expenseCats.count).toBeGreaterThan(5);
  });
});
