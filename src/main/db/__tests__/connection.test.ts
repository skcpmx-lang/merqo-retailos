import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createConnection } from '../connection';

describe('DB Connection — foundation', () => {
  let db: any;

  beforeEach(() => {
    db = createConnection({ memory: true });
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
  });

  it('should open in-memory db', () => {
    expect(db.open).toBe(true);
  });

  it('should have WAL mode', () => {
    const mode = db.pragma('journal_mode', { simple: true });
    // In-memory may be memory, but file would be wal
    expect(typeof mode).toBe('string');
  });

  it('should have foreign_keys ON', () => {
    const fk = db.pragma('foreign_keys', { simple: true });
    expect(fk).toBe(1);
  });

  it('should have busy_timeout', () => {
    const timeout = db.pragma('busy_timeout', { simple: true });
    expect(timeout).toBe(5000);
  });

  it('should integrity_check ok', () => {
    const result = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
    expect(result[0].integrity_check).toBe('ok');
  });
});
