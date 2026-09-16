/**
 * Backup Service Tests — P4.3
 * Uses isolated temp databases/directories
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Id } from '@core/domain/Id';

// Mock electron before importing backup service
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return path.join(os.tmpdir(), 'merqo-test-userdata');
      return os.tmpdir();
    },
    getVersion: () => '0.1.0',
  },
  shell: {
    openPath: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}));

// We will mock config manager via vi.mock
let tempDir = '';
let dbPath = '';
let backupsDir = '';

vi.mock('../../config', () => {
  return {
    getConfigManager: () => ({
      getAppConfig: () => ({
        appName: 'MERQO RetailOS',
        version: '0.1.0',
        isDev: false,
        isProd: true,
        userDataPath: tempDir,
        logsPath: path.join(tempDir, 'logs'),
        backupsPath: backupsDir,
        dbPath: dbPath,
        configPath: path.join(tempDir, 'config.json'),
        minWindowWidth: 1280,
        minWindowHeight: 720,
        defaultWindowWidth: 1366,
        defaultWindowHeight: 768,
      }),
      getBusinessConfig: () => ({}),
      getUserSettings: () => ({}),
      getDbPath: () => dbPath,
    }),
    resetConfigManager: vi.fn(),
  };
});

import { createConnection, setConnection, closeConnection, getConnection } from '../../db/connection';
import { Migrator } from '../../db/migrator';
import { BackupService } from '../backup.service';
import { validateBackupFile, calculateChecksum } from '../backup.validator';

function createTempDir(): string {
  const dir = path.join(os.tmpdir(), `merqo-backup-test-${Date.now()}-${Id.generate().slice(-4)}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'backups'), { recursive: true });
  return dir;
}

function createTestDb(p: string) {
  const db = createConnection({ dbPath: p });
  const migrator = new Migrator(db);
  migrator.createInitialSchema();
  const pending = migrator.getPendingMigrations();
  if (pending.length > 0) {
    migrator.runMigrations();
  }
  return db;
}

function seedBusiness(db: any, businessId: string) {
  db.prepare(`INSERT INTO businesses (id, name, trade_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`).run(
    businessId,
    'Test Business',
    'Test Trade',
    Date.now(),
    Date.now()
  );
}

function seedPopulatedDb(db: any, businessId: string) {
  const now = Date.now();
  seedBusiness(db, businessId);

  const userId = Id.generate();
  db.prepare(`INSERT INTO users (id, business_id, name, phone, password_hash, is_owner, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    userId,
    businessId,
    'Owner',
    '01700000000',
    'hash',
    1,
    1,
    now,
    now
  );

  const baseUnitId = Id.generate();
  db.prepare(`INSERT INTO units (id, business_id, name, short_name, is_base_unit, unit_group, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    baseUnitId,
    businessId,
    'Piece',
    'pcs',
    1,
    'piece',
    1,
    now,
    now
  );

  const productId = Id.generate();
  db.prepare(`INSERT INTO products (id, business_id, name, sku, base_unit_id, cost_price_paisa, selling_price_paisa, is_active, is_sellable, is_purchasable, is_stock_trackable, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    productId,
    businessId,
    'চাল ১ কেজি',
    'RICE-1KG',
    baseUnitId,
    5000,
    6000,
    1,
    1,
    1,
    1,
    now,
    now
  );

  const barcodeId = Id.generate();
  db.prepare(`INSERT INTO product_barcodes (id, product_id, barcode, unit_id, quantity_milli, is_primary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    barcodeId,
    productId,
    '1234567890123',
    baseUnitId,
    1000,
    1,
    now
  );

  const locationId = 'main';
  const stockLevelId = Id.generate();
  db.prepare(`INSERT INTO stock_movements (id, business_id, product_id, movement_type, quantity_milli, unit_id, cost_paisa, reference_type, reference_id, location_id, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    Id.generate(),
    businessId,
    productId,
    'in',
    10000,
    baseUnitId,
    5000,
    'purchase',
    Id.generate(),
    locationId,
    now,
    userId
  );
  db.prepare(`INSERT INTO stock_levels (id, business_id, product_id, location_id, quantity_milli, reserved_milli, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    stockLevelId,
    businessId,
    productId,
    locationId,
    10000,
    0,
    now
  );

  const supplierId = Id.generate();
  db.prepare(`INSERT INTO suppliers (id, business_id, name, phone, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    supplierId,
    businessId,
    'Supplier A',
    '01800000000',
    1,
    now,
    now
  );

  const purchaseId = Id.generate();
  db.prepare(`INSERT INTO purchases (id, business_id, supplier_id, purchase_number, purchase_date, status, subtotal_paisa, total_paisa, paid_paisa, due_paisa, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    purchaseId,
    businessId,
    supplierId,
    'PUR-001',
    now,
    'received',
    5000,
    5000,
    5000,
    0,
    now,
    now,
    userId
  );

  const customerId = Id.generate();
  db.prepare(`INSERT INTO customers (id, business_id, name, phone, current_due_paisa, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    customerId,
    businessId,
    'রহিম উদ্দিন',
    '01900000000',
    0,
    1,
    now,
    now
  );

  const saleId = Id.generate();
  db.prepare(`INSERT INTO sales (id, business_id, customer_id, sale_number, sale_date, status, subtotal_paisa, discount_paisa, tax_paisa, total_paisa, paid_paisa, due_paisa, change_paisa, is_due, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    saleId,
    businessId,
    customerId,
    'SALE-001',
    now,
    'completed',
    6000,
    0,
    0,
    6000,
    6000,
    0,
    0,
    0,
    now,
    now,
    userId
  );

  db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, unit_id, quantity_milli, base_quantity_milli, unit_price_paisa, base_unit_price_paisa, line_total_paisa, product_name_snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    Id.generate(),
    saleId,
    productId,
    baseUnitId,
    1000,
    1000,
    6000,
    6000,
    6000,
    'চাল ১ কেজি',
    now
  );

  db.prepare(`INSERT INTO sale_payments (id, business_id, sale_id, payment_method, amount_paisa, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    Id.generate(),
    businessId,
    saleId,
    'cash',
    6000,
    now
  );

  const cashId = Id.generate();
  db.prepare(`INSERT INTO cash_accounts (id, business_id, name, opening_balance_paisa, current_balance_paisa, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    cashId,
    businessId,
    'Main Cash',
    0,
    6000,
    1,
    now,
    now
  );

  db.prepare(`INSERT INTO cash_movements (id, business_id, cash_account_id, amount_paisa, movement_type, reference_type, reference_id, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    Id.generate(),
    businessId,
    cashId,
    6000,
    'in',
    'sale',
    saleId,
    now,
    userId
  );

  db.prepare(`INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, description, description_bn, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    Id.generate(),
    businessId,
    userId,
    'sale_created',
    'sale',
    saleId,
    'Sale created',
    'বিক্রয় তৈরি',
    now
  );

  return { productId, customerId, supplierId, saleId, userId, cashId };
}

describe('BackupService P4.3', () => {
  let businessId: string;
  let db: any;

  beforeEach(() => {
    tempDir = createTempDir();
    dbPath = path.join(tempDir, 'merqo.db');
    backupsDir = path.join(tempDir, 'backups');
    businessId = Id.generate();
    db = createTestDb(dbPath);
    setConnection(db);
  });

  afterEach(() => {
    try {
      closeConnection();
    } catch {}
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('should create fresh backup', async () => {
    seedBusiness(db, businessId);
    const service = BackupService.getInstance();
    const result = await service.createBackup({ type: 'manual', businessId, userId: 'test-user' });
    expect(result.success).toBe(true);
    expect(result.backup).toBeDefined();
    expect(result.backup?.fileName).toContain('MERQO-RetailOS-Backup');
    expect(result.backup?.fileName).toMatch(/\.db$/);
    expect(fs.existsSync(result.backup!.filePath)).toBe(true);
    expect(result.backup?.fileSizeBytes).toBeGreaterThan(0);
    expect(result.backup?.checksum).toBeDefined();
    expect(result.backup?.checksum.length).toBe(64);
  });

  it('should create populated backup', async () => {
    seedPopulatedDb(db, businessId);
    const service = BackupService.getInstance();
    const result = await service.createBackup({ type: 'manual', businessId });
    expect(result.success).toBe(true);
    expect(result.backup?.fileSizeBytes).toBeGreaterThan(0);
  });

  it('should have collision-safe naming', async () => {
    seedBusiness(db, businessId);
    const service = BackupService.getInstance();
    const r1 = await service.createBackup({ type: 'manual', businessId });
    const r2 = await service.createBackup({ type: 'manual', businessId });
    expect(r1.backup?.fileName).not.toBe(r2.backup?.fileName);
    expect(fs.existsSync(r1.backup!.filePath)).toBe(true);
    expect(fs.existsSync(r2.backup!.filePath)).toBe(true);
  });

  it('should use atomic temp file and cleanup on failure', async () => {
    seedBusiness(db, businessId);
    const service = BackupService.getInstance();
    const result = await service.createBackup({ type: 'manual', businessId });
    expect(result.success).toBe(true);
    const files = fs.readdirSync(backupsDir);
    const tmpFiles = files.filter(f => f.includes('.tmp-'));
    expect(tmpFiles.length).toBe(0);
  });

  it('should validate backup integrity_check', async () => {
    seedBusiness(db, businessId);
    const service = BackupService.getInstance();
    const result = await service.createBackup({ type: 'manual', businessId });
    expect(result.success).toBe(true);
    const validation = await service.validateBackup(result.backup!.filePath);
    expect(validation.isValid).toBe(true);
    expect(validation.integrityCheck.ok).toBe(true);
    expect(validation.foreignKeyCheck.ok).toBe(true);
  });

  it('should check foreign_key_check', async () => {
    seedPopulatedDb(db, businessId);
    const service = BackupService.getInstance();
    const result = await service.createBackup({ type: 'manual', businessId });
    const validation = await service.validateBackup(result.backup!.filePath);
    expect(validation.foreignKeyCheck.ok).toBe(true);
  });

  it('should have checksum', async () => {
    seedBusiness(db, businessId);
    const service = BackupService.getInstance();
    const result = await service.createBackup({ type: 'manual', businessId });
    expect(result.backup?.checksum).toBeDefined();
    const calculated = calculateChecksum(result.backup!.filePath);
    expect(calculated).toBe(result.backup?.checksum);
  });

  it('should have metadata JSON', async () => {
    seedBusiness(db, businessId);
    const service = BackupService.getInstance();
    const result = await service.createBackup({ type: 'manual', businessId });
    const metaPath = `${result.backup!.filePath}.json`;
    expect(fs.existsSync(metaPath)).toBe(true);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    expect(meta.id).toBeDefined();
    expect(meta.appVersion).toBeDefined();
    expect(meta.schemaVersion).toBeGreaterThanOrEqual(0);
    expect(meta.checksum).toBeDefined();
    expect(meta.type).toBe('manual');
  });

  it('should audit log backup creation', async () => {
    seedBusiness(db, businessId);
    const service = BackupService.getInstance();
    await service.createBackup({ type: 'manual', businessId, userId: 'user1' });
    const logs = db.prepare(`SELECT * FROM audit_logs WHERE action = 'backup_created'`).all() as any[];
    expect(logs.length).toBeGreaterThan(0);
  });

  it('should list backups with real files', async () => {
    seedBusiness(db, businessId);
    const service = BackupService.getInstance();
    await service.createBackup({ type: 'manual', businessId });
    await service.createBackup({ type: 'manual', businessId });
    const list = await service.listBackups();
    expect(list.totalCount).toBe(2);
    expect(list.backups.length).toBe(2);
    expect(list.totalSizeBytes).toBeGreaterThan(0);
    for (const b of list.backups) {
      expect(fs.existsSync(b.filePath)).toBe(true);
    }
  });

  it('should restore valid backup preserves products', async () => {
    seedPopulatedDb(db, businessId);
    const service = BackupService.getInstance();
    const backupResult = await service.createBackup({ type: 'manual', businessId });
    expect(backupResult.success).toBe(true);

    // Delete in FK-safe order
    try { db.exec('PRAGMA foreign_keys = OFF'); } catch {}
    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sale_payments').run();
    db.prepare('DELETE FROM purchase_items').run();
    db.prepare('DELETE FROM stock_levels').run();
    db.prepare('DELETE FROM stock_movements').run();
    db.prepare('DELETE FROM product_barcodes').run();
    db.prepare('DELETE FROM product_prices').run();
    db.prepare('DELETE FROM products').run();
    try { db.exec('PRAGMA foreign_keys = ON'); } catch {}
    expect((db.prepare('SELECT COUNT(*) as c FROM products').get() as any).c).toBe(0);

    const restoreResult = await service.restoreBackup(backupResult.backup!.filePath, 'user1');
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.rollbackPerformed).toBe(false);

    const count = getConnection().prepare('SELECT COUNT(*) as c FROM products').get() as any;
    expect(count.c).toBeGreaterThan(0);
  });

  it('should restore preserves stock', async () => {
    seedPopulatedDb(db, businessId);
    const service = BackupService.getInstance();
    const backupResult = await service.createBackup({ type: 'manual', businessId });

    const beforeLevels = db.prepare('SELECT * FROM stock_levels').all() as any[];
    const beforeCount = beforeLevels.length;

    try { db.exec('PRAGMA foreign_keys = OFF'); } catch {}
    db.prepare('DELETE FROM stock_levels').run();
    db.prepare('DELETE FROM stock_movements').run();
    try { db.exec('PRAGMA foreign_keys = ON'); } catch {}

    const restoreResult = await service.restoreBackup(backupResult.backup!.filePath);
    expect(restoreResult.success).toBe(true);

    const afterLevels = getConnection().prepare('SELECT * FROM stock_levels').all() as any[];
    expect(afterLevels.length).toBe(beforeCount);
  });

  it('should restore preserves sales', async () => {
    seedPopulatedDb(db, businessId);
    const service = BackupService.getInstance();
    const backupResult = await service.createBackup({ type: 'manual', businessId });

    const beforeSales = (db.prepare('SELECT COUNT(*) as c FROM sales').get() as any).c;
    try { db.exec('PRAGMA foreign_keys = OFF'); } catch {}
    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sale_payments').run();
    db.prepare('DELETE FROM sales').run();
    try { db.exec('PRAGMA foreign_keys = ON'); } catch {}

    const restoreResult = await service.restoreBackup(backupResult.backup!.filePath);
    expect(restoreResult.success).toBe(true);

    const afterSales = (getConnection().prepare('SELECT COUNT(*) as c FROM sales').get() as any).c;
    expect(afterSales).toBe(beforeSales);
  });

  it('should restore preserves payments and customer due', async () => {
    seedPopulatedDb(db, businessId);
    const service = BackupService.getInstance();
    const backupResult = await service.createBackup({ type: 'manual', businessId });

    const beforePayments = (db.prepare('SELECT COUNT(*) as c FROM sale_payments').get() as any).c;
    try { db.exec('PRAGMA foreign_keys = OFF'); } catch {}
    db.prepare('DELETE FROM sale_payments').run();
    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sales').run();
    try { db.exec('PRAGMA foreign_keys = ON'); } catch {}

    const restoreResult = await service.restoreBackup(backupResult.backup!.filePath);
    expect(restoreResult.success).toBe(true);

    const afterPayments = (getConnection().prepare('SELECT COUNT(*) as c FROM sale_payments').get() as any).c;
    expect(afterPayments).toBe(beforePayments);
  });

  it('should restore preserves finance', async () => {
    seedPopulatedDb(db, businessId);
    const service = BackupService.getInstance();
    const backupResult = await service.createBackup({ type: 'manual', businessId });

    const beforeCash = (db.prepare('SELECT COUNT(*) as c FROM cash_accounts').get() as any).c;
    try { db.exec('PRAGMA foreign_keys = OFF'); } catch {}
    db.prepare('DELETE FROM cash_movements').run();
    db.prepare('DELETE FROM cash_accounts').run();
    try { db.exec('PRAGMA foreign_keys = ON'); } catch {}

    const restoreResult = await service.restoreBackup(backupResult.backup!.filePath);
    expect(restoreResult.success).toBe(true);

    const afterCash = (getConnection().prepare('SELECT COUNT(*) as c FROM cash_accounts').get() as any).c;
    expect(afterCash).toBe(beforeCash);
  });

  it('should restore preserves audit logs', async () => {
    seedPopulatedDb(db, businessId);
    const service = BackupService.getInstance();
    const backupResult = await service.createBackup({ type: 'manual', businessId });

    const beforeLogs = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any).c;

    const restoreResult = await service.restoreBackup(backupResult.backup!.filePath);
    expect(restoreResult.success).toBe(true);

    const afterLogs = (getConnection().prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any).c;
    expect(afterLogs).toBeGreaterThanOrEqual(beforeLogs);
  });

  it('should reject invalid backup file', async () => {
    const invalidPath = path.join(backupsDir, 'invalid.db');
    fs.writeFileSync(invalidPath, 'not a sqlite file');
    const service = BackupService.getInstance();
    const validation = await validateBackupFile(invalidPath);
    expect(validation.isValid).toBe(false);

    await expect(service.restoreBackup(invalidPath)).rejects.toThrow();
  });

  it('should reject corrupted backup', async () => {
    seedBusiness(db, businessId);
    const service = BackupService.getInstance();
    const result = await service.createBackup({ type: 'manual', businessId });
    expect(result.success).toBe(true);

    const corruptPath = path.join(backupsDir, 'corrupt.db');
    fs.copyFileSync(result.backup!.filePath, corruptPath);
    const fd = fs.openSync(corruptPath, 'r+');
    fs.writeSync(fd, Buffer.alloc(100, 0), 0, 100, 0);
    fs.closeSync(fd);

    const validation = await validateBackupFile(corruptPath);
    expect(validation.isValid).toBe(false);

    const before = (db.prepare('SELECT COUNT(*) as c FROM businesses').get() as any).c;

    await expect(service.restoreBackup(corruptPath)).rejects.toThrow();

    const after = (getConnection().prepare('SELECT COUNT(*) as c FROM businesses').get() as any).c;
    expect(after).toBe(before);
  });

  it('should create safety backup before restore and require it', async () => {
    seedBusiness(db, businessId);
    const service = BackupService.getInstance();
    const backupResult = await service.createBackup({ type: 'manual', businessId });
    const listBefore = await service.listBackups();
    const countBefore = listBefore.totalCount;

    const restoreResult = await service.restoreBackup(backupResult.backup!.filePath);
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.safetyBackup).toBeDefined();
    expect(restoreResult.safetyBackup?.type).toBe('safety-pre-restore');

    const listAfter = await service.listBackups();
    expect(listAfter.totalCount).toBeGreaterThanOrEqual(countBefore);
  });

  it('should handle stale WAL/SHM after restore', async () => {
    seedBusiness(db, businessId);
    const service = BackupService.getInstance();
    const backupResult = await service.createBackup({ type: 'manual', businessId });

    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    fs.writeFileSync(walPath, 'dummy wal');
    fs.writeFileSync(shmPath, 'dummy shm');

    const restoreResult = await service.restoreBackup(backupResult.backup!.filePath);
    expect(restoreResult.success).toBe(true);

    expect(fs.existsSync(walPath)).toBe(false);
    expect(fs.existsSync(shmPath)).toBe(false);
  });

  it('should verify invariants after backup/restore', async () => {
    seedPopulatedDb(db, businessId);
    const service = BackupService.getInstance();
    const backupResult = await service.createBackup({ type: 'manual', businessId });
    expect(backupResult.success).toBe(true);

    const beforeValidation = await service.validateBackup(backupResult.backup!.filePath);
    expect(beforeValidation.isValid).toBe(true);

    const restoreResult = await service.restoreBackup(backupResult.backup!.filePath);
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.validationAfterRestore?.isValid).toBe(true);
    expect(restoreResult.validationAfterRestore?.integrityCheck.ok).toBe(true);
    expect(restoreResult.validationAfterRestore?.foreignKeyCheck.ok).toBe(true);
  });

  it('should handle retention cleanup', async () => {
    seedBusiness(db, businessId);
    const service = BackupService.getInstance();
    service.saveConfig({ retentionCount: 2 });

    await service.createBackup({ type: 'manual', businessId });
    await new Promise(r => setTimeout(r, 20));
    await service.createBackup({ type: 'manual', businessId });
    await new Promise(r => setTimeout(r, 20));
    await service.createBackup({ type: 'manual', businessId });

    const list = await service.listBackups();
    expect(list.totalCount).toBeLessThanOrEqual(2);
  });

  it('should calculate checksum correctly', async () => {
    seedBusiness(db, businessId);
    const service = BackupService.getInstance();
    const result = await service.createBackup({ type: 'manual', businessId });
    const checksum = calculateChecksum(result.backup!.filePath);
    expect(checksum).toBe(result.backup?.checksum);
    expect(checksum.length).toBe(64);
  });

  it('should preserve all data after full cycle', async () => {
    seedPopulatedDb(db, businessId);
    const service = BackupService.getInstance();

    const beforeProducts = (db.prepare('SELECT COUNT(*) as c FROM products').get() as any).c;
    const beforeSales = (db.prepare('SELECT COUNT(*) as c FROM sales').get() as any).c;
    const beforeStockLevels = (db.prepare('SELECT SUM(quantity_milli) as sum FROM stock_levels').get() as any).sum;
    const beforeCustomers = (db.prepare('SELECT COUNT(*) as c FROM customers').get() as any).c;
    const beforeSuppliers = (db.prepare('SELECT COUNT(*) as c FROM suppliers').get() as any).c;

    const backupResult = await service.createBackup({ type: 'manual', businessId });
    expect(backupResult.success).toBe(true);

    const validation = await service.validateBackup(backupResult.backup!.filePath);
    expect(validation.isValid).toBe(true);

    closeConnection();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const wal = `${dbPath}-wal`;
    const shm = `${dbPath}-shm`;
    if (fs.existsSync(wal)) fs.unlinkSync(wal);
    if (fs.existsSync(shm)) fs.unlinkSync(shm);

    const emptyDb = createTestDb(dbPath);
    setConnection(emptyDb);
    expect((emptyDb.prepare('SELECT COUNT(*) as c FROM products').get() as any).c).toBe(0);

    const restoreResult = await service.restoreBackup(backupResult.backup!.filePath);
    expect(restoreResult.success).toBe(true);

    const afterDb = getConnection();
    const afterProducts = (afterDb.prepare('SELECT COUNT(*) as c FROM products').get() as any).c;
    const afterSales = (afterDb.prepare('SELECT COUNT(*) as c FROM sales').get() as any).c;
    const afterStockLevels = (afterDb.prepare('SELECT SUM(quantity_milli) as sum FROM stock_levels').get() as any).sum;
    const afterCustomers = (afterDb.prepare('SELECT COUNT(*) as c FROM customers').get() as any).c;
    const afterSuppliers = (afterDb.prepare('SELECT COUNT(*) as c FROM suppliers').get() as any).c;

    expect(afterProducts).toBe(beforeProducts);
    expect(afterSales).toBe(beforeSales);
    expect(afterStockLevels).toBe(beforeStockLevels);
    expect(afterCustomers).toBe(beforeCustomers);
    expect(afterSuppliers).toBe(beforeSuppliers);
  });
});
