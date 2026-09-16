/**
 * Mandatory test: transaction atomicity
 * Begin transaction, create A, B, force C to fail, verify A and B rolled back
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createConnection } from '../connection';
import { Migrator } from '../migrator';

describe('DB Transaction — atomicity mandatory test', () => {
  let db: any;

  beforeEach(() => {
    db = createConnection({ memory: true });
    const migrator = new Migrator(db);
    migrator.createInitialSchema();
  });

  afterEach(() => {
    if (db && db.open) db.close();
  });

  it('should rollback on failure — no partial data', () => {
    // Create a transaction that does A, B, then fails on C
    const transaction = db.transaction(() => {
      // Operation A: insert business
      db.prepare('INSERT INTO businesses (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run('biz-1', 'Business A', Date.now(), Date.now());

      // Operation B: insert another business
      db.prepare('INSERT INTO businesses (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run('biz-2', 'Business B', Date.now(), Date.now());

      // Operation C: force failure — duplicate ID
      db.prepare('INSERT INTO businesses (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run('biz-1', 'Duplicate', Date.now(), Date.now());
    });

    // Expect transaction to throw
    expect(() => transaction()).toThrow();

    // Verify A and B were rolled back — no businesses should exist
    const count = db.prepare('SELECT COUNT(*) as count FROM businesses').get() as { count: number };
    expect(count.count).toBe(0);
  });

  it('should commit on success', () => {
    const transaction = db.transaction(() => {
      db.prepare('INSERT INTO businesses (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run('biz-1', 'Business A', Date.now(), Date.now());
      db.prepare('INSERT INTO businesses (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run('biz-2', 'Business B', Date.now(), Date.now());
    });

    transaction();

    const count = db.prepare('SELECT COUNT(*) as count FROM businesses').get() as { count: number };
    expect(count.count).toBe(2);
  });

  it('should handle financial ledger rollback', () => {
    // Simulate financial operation: insert business + user, but fail on duplicate id
    db.prepare('INSERT INTO businesses (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run('biz-1', 'Test Biz', Date.now(), Date.now());

    const transaction = db.transaction(() => {
      // Insert user
      db.prepare('INSERT INTO users (id, name, phone, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        'user-1',
        'User 1',
        '01700000001',
        'hash',
        Date.now(),
        Date.now()
      );

      // Insert audit log
      db.prepare('INSERT INTO audit_logs (id, action, entity_type, created_at) VALUES (?, ?, ?, ?)').run(
        'audit-1',
        'create',
        'user',
        Date.now()
      );

      // Fail: duplicate id
      db.prepare('INSERT INTO users (id, name, phone, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        'user-1',
        'User 2',
        '01700000002',
        'hash',
        Date.now(),
        Date.now()
      );
    });

    expect(() => transaction()).toThrow();

    // Verify no user and no audit log inserted (atomic)
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const auditCount = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number };

    expect(userCount.count).toBe(0);
    expect(auditCount.count).toBe(0);
  });
});
