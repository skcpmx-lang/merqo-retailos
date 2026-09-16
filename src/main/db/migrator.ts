/**
 * Migration infrastructure
 * Handles first-launch DB initialization, schema versioning, integrity checks
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

  /**
   * Initialize migrations table
   */
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

  /**
   * Get executed migrations
   */
  getExecutedMigrations(): string[] {
    try {
      const rows = this.db.prepare('SELECT name FROM migrations ORDER BY id').all() as Array<{ name: string }>;
      return rows.map(r => r.name);
    } catch {
      return [];
    }
  }

  /**
   * Get pending migrations from files
   */
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

  /**
   * Run pending migrations inside transaction
   * Fails safely — rolls back on error
   */
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
      // Integrity check before migrations
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

      // Integrity check after
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
   * Create initial schema if no migrations
   * For Phase 1 foundation
   */
  createInitialSchema() {
    logger.info('Creating initial schema (Phase 1 foundation)');

    const schemaSql = `
      -- System settings
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER NOT NULL
      );

      -- Businesses
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

      -- Business settings
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

      -- Users
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        business_id TEXT REFERENCES businesses(id),
        name TEXT NOT NULL,
        phone TEXT UNIQUE,
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

      -- Roles
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        business_id TEXT REFERENCES businesses(id),
        name TEXT NOT NULL,
        name_bn TEXT,
        description TEXT,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_roles_business_id ON roles(business_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_business_name ON roles(business_id, name);

      -- Permissions
      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_bn TEXT,
        description TEXT,
        module TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

      -- Role Permissions
      CREATE TABLE IF NOT EXISTS role_permissions (
        id TEXT PRIMARY KEY,
        role_id TEXT NOT NULL REFERENCES roles(id),
        permission_id TEXT NOT NULL REFERENCES permissions(id),
        created_at INTEGER NOT NULL,
        UNIQUE(role_id, permission_id)
      );

      -- User Roles
      CREATE TABLE IF NOT EXISTS user_roles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        role_id TEXT NOT NULL REFERENCES roles(id),
        assigned_by_user_id TEXT,
        created_at INTEGER NOT NULL,
        UNIQUE(user_id, role_id)
      );

      -- Audit Logs
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        business_id TEXT REFERENCES businesses(id),
        user_id TEXT REFERENCES users(id),
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

      -- Migrations
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at INTEGER NOT NULL,
        checksum TEXT
      );
    `;

    try {
      this.db.exec(schemaSql);
      logger.info('Initial schema created');
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

  /**
   * Detect if DB is new (no businesses, no users)
   */
  isFirstLaunch(): boolean {
    try {
      const businessCount = this.db.prepare('SELECT COUNT(*) as count FROM businesses').get() as { count: number };
      const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      return businessCount.count === 0 && userCount.count === 0;
    } catch {
      // Tables don't exist yet, so first launch
      return true;
    }
  }

  /**
   * Full initialization: create schema if needed, run migrations, verify
   */
  initialize(): { success: boolean; isFirstLaunch: boolean; error?: string; executedMigrations: string[] } {
    try {
      // Check if tables exist, if not create initial schema
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='businesses'").get();
      if (!tables) {
        const result = this.createInitialSchema();
        if (!result.success) {
          return { success: false, isFirstLaunch: true, error: result.error, executedMigrations: [] };
        }
      } else {
        this.initMigrationsTable();
      }

      // Run pending migrations
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
