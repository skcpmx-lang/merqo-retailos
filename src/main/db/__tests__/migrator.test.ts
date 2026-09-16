import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createConnection } from '../connection';
import { Migrator } from '../migrator';

describe('Migrator — foundation', () => {
  let db: any;
  let migrator: Migrator;

  beforeEach(() => {
    db = createConnection({ memory: true });
    migrator = new Migrator(db, '/tmp/nonexistent-migrations');
  });

  afterEach(() => {
    if (db && db.open) db.close();
  });

  it('should create initial schema', () => {
    const result = migrator.createInitialSchema();
    expect(result.success).toBe(true);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('businesses');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('roles');
    expect(tableNames).toContain('permissions');
  });

  it('should detect first launch', () => {
    migrator.createInitialSchema();
    expect(migrator.isFirstLaunch()).toBe(true);

    // Insert business and user
    db.prepare('INSERT INTO businesses (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run('test-id', 'Test', Date.now(), Date.now());
    db.prepare('INSERT INTO users (id, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('user-id', 'Owner', 'hash', Date.now(), Date.now());

    expect(migrator.isFirstLaunch()).toBe(false);
  });

  it('should initialize successfully', () => {
    const result = migrator.initialize();
    expect(result.success).toBe(true);
    expect(result.isFirstLaunch).toBe(true);
  });

  it('should handle integrity check', () => {
    migrator.createInitialSchema();
    const integrity = migrator.checkIntegrity();
    expect(integrity.ok).toBe(true);
  });
});
