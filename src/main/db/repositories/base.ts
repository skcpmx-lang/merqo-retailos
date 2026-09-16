/**
 * Base repository — thin wrappers, no business logic, no permission checks
 * All writes should be called inside service transaction
 */

import { Id } from '@core/domain/Id';
import { ConflictError, DatabaseError } from '@core/domain/errors/AppError';

export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt?: number;
}

export class BaseRepository {
  protected db: any;

  constructor(db?: any) {
    if (db) {
      this.db = db;
    } else {
      // Lazy import to avoid circular deps in tests
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getConnection } = require('../connection');
        this.db = getConnection();
      } catch {
        // In tests, db must be provided explicitly
        this.db = null;
      }
    }

    if (!this.db) {
      throw new Error('Database connection not provided and getConnection failed. Pass db explicitly in tests.');
    }
  }

  protected generateId(): string {
    return Id.generate();
  }

  protected now(): number {
    return Date.now();
  }

  protected handleError(e: unknown, entity: string): never {
    const msg = String(e);
    if (msg.includes('UNIQUE constraint failed')) {
      throw new ConflictError(msg, 'এই তথ্যটি ইতিমধ্যে বিদ্যমান');
    }
    throw new DatabaseError(msg, 'ডাটাবেসে সমস্যা হয়েছে');
  }
}
