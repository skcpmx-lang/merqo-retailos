/**
 * Migration infrastructure
 * Handles first-launch DB initialization, schema versioning, integrity checks
 * Phase 2: Full schema for products, inventory, suppliers, customers, finance
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../logging/logger';
import { getConnection } from './connection';

export interface Migration {
  name: string;
  sql: string;
  checksum?: string;
}

export class Migrator {
  private db: any;
  private migrationsPath: string;

  constructor(db?: any, migrationsPath?: string) {
    this.db = db || getConnection();
    this.migrationsPath = migrationsPath || path.join(__dirname, 'migrations');
  }

  initMigrationsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at INTEGER NOT NULL,
        checksum TEXT
      );
    `);
  }

  getExecutedMigrations(): string[] {
    try {
      const rows = this.db.prepare('SELECT name FROM migrations ORDER BY id').all() as Array<{ name: string }>;
      return rows.map(r => r.name);
    } catch {
      return [];
    }
  }

  getPendingMigrations(): Migration[] {
    if (!fs.existsSync(this.migrationsPath)) {
      return [];
    }

    const files = fs.readdirSync(this.migrationsPath)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const executed = this.getExecutedMigrations();
    const pending: Migration[] = [];

    for (const file of files) {
      const name = path.basename(file, '.sql');
      if (!executed.includes(name)) {
        const filePath = path.join(this.migrationsPath, file);
        const sql = fs.readFileSync(filePath, 'utf-8');
        pending.push({ name, sql });
      }
    }

    return pending;
  }

  runMigrations(): { success: boolean; executed: string[]; error?: string } {
    this.initMigrationsTable();

    const pending = this.getPendingMigrations();
    if (pending.length === 0) {
      logger.info('No pending migrations');
      return { success: true, executed: [] };
    }

    logger.info(`Running ${pending.length} pending migrations`, { migrations: pending.map(m => m.name) });

    const executed: string[] = [];

    try {
      const integrity = this.checkIntegrity();
      if (!integrity.ok) {
        throw new Error(`Database integrity check failed before migrations: ${integrity.errors.join(', ')}`);
      }

      for (const migration of pending) {
        logger.info(`Executing migration: ${migration.name}`);

        const transaction = this.db.transaction(() => {
          this.db.exec(migration.sql);
          this.db.prepare('INSERT INTO migrations (name, executed_at) VALUES (?, ?)').run(migration.name, Date.now());
        });

        try {
          transaction();
          executed.push(migration.name);
          logger.info(`Migration executed: ${migration.name}`);
        } catch (e) {
          logger.error(`Migration failed: ${migration.name}`, e);
          throw new Error(`Migration ${migration.name} failed: ${String(e)}`);
        }
      }

      const afterIntegrity = this.checkIntegrity();
      if (!afterIntegrity.ok) {
        throw new Error(`Database integrity check failed after migrations: ${afterIntegrity.errors.join(', ')}`);
      }

      logger.info(`All migrations executed: ${executed.join(', ')}`);
      return { success: true, executed };
    } catch (e) {
      const errorMsg = String(e);
      logger.error('Migration run failed', e, { executed });
      return { success: false, executed, error: errorMsg };
    }
  }

  /**
   * Create initial schema — Phase 1 + Phase 2 full schema for new DBs
   */
  createInitialSchema() {
    logger.info('Creating initial schema (Phase 1 + Phase 2 full)');

    const phase1Sql = `
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS businesses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        trade_name TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        bin TEXT,
        logo_path TEXT,
        currency TEXT NOT NULL DEFAULT 'BDT',
        fiscal_year_start_month INTEGER NOT NULL DEFAULT 7,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS business_settings (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        key TEXT NOT NULL,
        value TEXT,
        value_type TEXT NOT NULL DEFAULT 'string',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(business_id, key)
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        business_id TEXT REFERENCES businesses(id),
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        password_hash TEXT NOT NULL,
        pin_hash TEXT,
        is_owner INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        last_login_at INTEGER,
        avatar_path TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id);
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        business_id TEXT REFERENCES businesses(id),
        code TEXT,
        name TEXT NOT NULL,
        name_bn TEXT,
        description TEXT,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_roles_business_id ON roles(business_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_code ON roles(code);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_business_name ON roles(business_id, name);

      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT NOT NULL,
        name_bn TEXT,
        description TEXT,
        module TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
      CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

      CREATE TABLE IF NOT EXISTS role_permissions (
        id TEXT PRIMARY KEY,
        role_id TEXT NOT NULL REFERENCES roles(id),
        permission_id TEXT NOT NULL REFERENCES permissions(id),
        created_at INTEGER NOT NULL,
        UNIQUE(role_id, permission_id)
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        role_id TEXT NOT NULL REFERENCES roles(id),
        assigned_by_user_id TEXT,
        created_at INTEGER NOT NULL,
        UNIQUE(user_id, role_id)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        business_id TEXT REFERENCES businesses(id),
        user_id TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        before_json TEXT,
        after_json TEXT,
        description TEXT,
        description_bn TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_business_created ON audit_logs(business_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at INTEGER NOT NULL,
        checksum TEXT
      );
    `;

    // Try to load Phase 2 migration file for full schema if exists
    let phase2Sql = '';
    const possiblePaths = [
      path.join(__dirname, 'migrations', '0002_phase2_full_schema.sql'),
      path.join(process.cwd(), 'src/main/db/migrations/0002_phase2_full_schema.sql'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        phase2Sql = fs.readFileSync(p, 'utf-8');
        logger.info(`Loaded Phase 2 schema from ${p}`);
        break;
      }
    }

    // If file not found, use embedded minimal Phase 2 schema (fallback)
    if (!phase2Sql) {
      logger.warn('Phase 2 migration file not found, using embedded schema');
      phase2Sql = `
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          parent_id TEXT,
          name TEXT NOT NULL,
          name_bn TEXT,
          description TEXT,
          image_path TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS brands (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          name TEXT NOT NULL,
          name_bn TEXT,
          logo_path TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS units (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          name TEXT NOT NULL,
          short_name TEXT,
          name_bn TEXT,
          is_base_unit INTEGER NOT NULL DEFAULT 0,
          unit_group TEXT NOT NULL DEFAULT 'piece',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS unit_conversions (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          from_unit_id TEXT NOT NULL REFERENCES units(id),
          to_unit_id TEXT NOT NULL REFERENCES units(id),
          conversion_factor REAL NOT NULL,
          is_base_conversion INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          UNIQUE(from_unit_id, to_unit_id)
        );
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          category_id TEXT REFERENCES categories(id),
          brand_id TEXT REFERENCES brands(id),
          base_unit_id TEXT NOT NULL REFERENCES units(id),
          purchase_unit_id TEXT REFERENCES units(id),
          sale_unit_id TEXT REFERENCES units(id),
          name TEXT NOT NULL,
          name_bn TEXT,
          description TEXT,
          sku TEXT NOT NULL,
          barcode TEXT,
          cost_price_paisa INTEGER NOT NULL DEFAULT 0,
          selling_price_paisa INTEGER NOT NULL DEFAULT 0,
          mrp_paisa INTEGER,
          min_stock_milli INTEGER NOT NULL DEFAULT 0,
          reorder_level_milli INTEGER NOT NULL DEFAULT 0,
          opening_stock_milli INTEGER NOT NULL DEFAULT 0,
          is_stock_trackable INTEGER NOT NULL DEFAULT 1,
          is_sellable INTEGER NOT NULL DEFAULT 1,
          is_purchasable INTEGER NOT NULL DEFAULT 1,
          is_active INTEGER NOT NULL DEFAULT 1,
          image_path TEXT,
          tax_rate REAL NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER,
          created_by TEXT,
          updated_by TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
        CREATE TABLE IF NOT EXISTS product_barcodes (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL REFERENCES products(id),
          unit_id TEXT REFERENCES units(id),
          barcode TEXT NOT NULL,
          quantity_milli INTEGER NOT NULL DEFAULT 1000,
          is_primary INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_product_barcodes_barcode ON product_barcodes(barcode);
        CREATE TABLE IF NOT EXISTS stock_levels (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          product_id TEXT NOT NULL REFERENCES products(id),
          location_id TEXT NOT NULL DEFAULT 'main',
          quantity_milli INTEGER NOT NULL DEFAULT 0,
          reserved_milli INTEGER NOT NULL DEFAULT 0,
          last_movement_at INTEGER,
          updated_at INTEGER NOT NULL,
          UNIQUE(product_id, location_id)
        );
        CREATE TABLE IF NOT EXISTS stock_movements (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          product_id TEXT NOT NULL REFERENCES products(id),
          movement_type TEXT NOT NULL,
          quantity_milli INTEGER NOT NULL,
          unit_id TEXT REFERENCES units(id),
          cost_paisa INTEGER NOT NULL DEFAULT 0,
          reference_type TEXT,
          reference_id TEXT,
          notes TEXT,
          location_id TEXT NOT NULL DEFAULT 'main',
          created_at INTEGER NOT NULL,
          created_by TEXT,
          CHECK(quantity_milli != 0)
        );
        CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          address TEXT,
          contact_person TEXT,
          opening_payable_paisa INTEGER NOT NULL DEFAULT 0,
          current_payable_paisa INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS supplier_transactions (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          supplier_id TEXT NOT NULL REFERENCES suppliers(id),
          transaction_type TEXT NOT NULL,
          amount_paisa INTEGER NOT NULL,
          reference_type TEXT,
          reference_id TEXT,
          notes TEXT,
          created_at INTEGER NOT NULL,
          created_by TEXT
        );
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          address TEXT,
          opening_due_paisa INTEGER NOT NULL DEFAULT 0,
          current_due_paisa INTEGER NOT NULL DEFAULT 0,
          credit_limit_paisa INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS customer_transactions (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          customer_id TEXT NOT NULL REFERENCES customers(id),
          transaction_type TEXT NOT NULL,
          amount_paisa INTEGER NOT NULL,
          reference_type TEXT,
          reference_id TEXT,
          notes TEXT,
          created_at INTEGER NOT NULL,
          created_by TEXT
        );
        CREATE TABLE IF NOT EXISTS expense_categories (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          name TEXT NOT NULL,
          name_bn TEXT,
          description TEXT,
          is_system INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS mfs_providers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          name_bn TEXT,
          code TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_mfs_providers_code ON mfs_providers(code);
        CREATE TABLE IF NOT EXISTS product_cost_history (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL REFERENCES products(id),
          purchase_id TEXT,
          old_cost_paisa INTEGER NOT NULL,
          new_cost_paisa INTEGER NOT NULL,
          old_wac_paisa INTEGER NOT NULL,
          new_wac_paisa INTEGER NOT NULL,
          reason TEXT NOT NULL DEFAULT 'purchase',
          created_at INTEGER NOT NULL,
          created_by TEXT
        );
      `;
    }

    try {
      this.db.exec(phase1Sql);
      if (phase2Sql) {
        this.db.exec(phase2Sql);
      }
      // Record that phase2 migration is applied for new DBs
      try {
        this.db.prepare('INSERT OR IGNORE INTO migrations (name, executed_at) VALUES (?, ?)').run('0002_phase2_full_schema', Date.now());
      } catch {}
      logger.info('Initial schema created (Phase 1 + Phase 2)');
      return { success: true };
    } catch (e) {
      logger.error('Failed to create initial schema', e);
      return { success: false, error: String(e) };
    }
  }

  checkIntegrity() {
    try {
      const result = this.db.pragma('integrity_check') as Array<{ integrity_check: string }>;
      const errors = result.filter(r => r.integrity_check !== 'ok').map(r => r.integrity_check);
      return { ok: errors.length === 0, errors };
    } catch (e) {
      return { ok: false, errors: [String(e)] };
    }
  }

  isFirstLaunch(): boolean {
    try {
      const businessCount = this.db.prepare('SELECT COUNT(*) as count FROM businesses').get() as { count: number };
      const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      return businessCount.count === 0 && userCount.count === 0;
    } catch {
      return true;
    }
  }

  initialize(): { success: boolean; isFirstLaunch: boolean; error?: string; executedMigrations: string[] } {
    try {
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='businesses'").get();
      if (!tables) {
        const result = this.createInitialSchema();
        if (!result.success) {
          return { success: false, isFirstLaunch: true, error: result.error, executedMigrations: [] };
        }
      } else {
        this.initMigrationsTable();
      }

      const migrationResult = this.runMigrations();
      if (!migrationResult.success) {
        return { success: false, isFirstLaunch: false, error: migrationResult.error, executedMigrations: migrationResult.executed };
      }

      const isFirst = this.isFirstLaunch();

      logger.info(`Database initialized. First launch: ${isFirst}`, { isFirstLaunch: isFirst, migrations: migrationResult.executed });

      return { success: true, isFirstLaunch: isFirst, executedMigrations: migrationResult.executed };
    } catch (e) {
      logger.error('Database initialization failed', e);
      return { success: false, isFirstLaunch: false, error: String(e), executedMigrations: [] };
    }
  }
}
