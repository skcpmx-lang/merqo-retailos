/**
 * SQLite connection with better-sqlite3 (preferred) or node:sqlite fallback
 * WAL mode, foreign_keys ON, busy_timeout, etc.
 */

import path from 'path';
import fs from 'fs';
import { logger } from '../logging/logger';
import { getConfigManager } from '../config';
import { createFallbackConnection as createFallbackConnectionImpl } from './connection.fallback';

let dbInstance: any = null;
let usingFallback = false;

export interface DbConnectionOptions {
  dbPath?: string;
  readonly?: boolean;
  memory?: boolean;
}

export function getDbPath(): string {
  try {
    const config = getConfigManager();
    return config.getDbPath();
  } catch {
    // For tests, use in-memory or temp path
    return ':memory:';
  }
}

function tryCreateBetterSqlite3(dbPath: string, readonly: boolean): any {
  try {
    // Dynamic require to handle missing native module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, {
      readonly: readonly || false,
      fileMustExist: false,
      timeout: 5000,
    });

    // Configure pragmas
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -20000'); // 20MB
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 268435456'); // 256MB

    logger.info(`Database opened: ${dbPath === ':memory:' ? 'in-memory' : dbPath} (better-sqlite3)`, {
      dbPath: dbPath === ':memory:' ? 'memory' : 'file',
    });

    usingFallback = false;
    return db;
  } catch (e) {
    logger.warn('better-sqlite3 not available, falling back to node:sqlite', { error: String(e) });
    return null;
  }
}

function createFallback(dbPath: string): any {
  usingFallback = true;
  return createFallbackConnectionImpl(dbPath);
}

export function createConnection(options: DbConnectionOptions = {}): any {
  const dbPath = options.memory ? ':memory:' : options.dbPath || getDbPath();

  // Ensure directory exists for file DB
  if (dbPath !== ':memory:' && !options.readonly) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Try better-sqlite3 first
  const betterDb = tryCreateBetterSqlite3(dbPath, !!options.readonly);
  if (betterDb) {
    return betterDb;
  }

  // Fallback to node:sqlite
  return createFallback(dbPath);
}

export function getConnection(): any {
  if (!dbInstance) {
    dbInstance = createConnection();
  }
  return dbInstance;
}

export function setConnection(db: any) {
  dbInstance = db;
}

export function closeConnection() {
  if (dbInstance) {
    try {
      dbInstance.close();
      logger.info('Database closed');
    } catch (e) {
      logger.error('Failed to close database', e);
    }
    dbInstance = null;
  }
}

export function isConnectionOpen(): boolean {
  return dbInstance !== null && dbInstance.open;
}

export function isUsingFallback(): boolean {
  return usingFallback;
}

// Transaction helper
export function withTransaction<T>(fn: (db: any) => T): T {
  const db = getConnection();
  const transaction = db.transaction(fn);
  return transaction(db);
}

export function checkIntegrity(): { ok: boolean; errors: string[] } {
  const db = getConnection();
  try {
    const result = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
    const errors = result.filter(r => r.integrity_check !== 'ok').map(r => r.integrity_check);
    return { ok: errors.length === 0, errors };
  } catch (e) {
    return { ok: false, errors: [String(e)] };
  }
}
