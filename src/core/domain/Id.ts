import { nanoid } from 'nanoid';

/**
 * ID strategy: nanoid 21 chars, TEXT PRIMARY KEY
 * Consistent across all entities, prevents guessing, offline-safe
 */
export class Id {
  static generate(): string {
    return nanoid();
  }

  static isValid(id: unknown): boolean {
    return typeof id === 'string' && id.length >= 10 && id.length <= 32;
  }

  static requireValid(id: unknown, fieldName = 'id'): string {
    if (!Id.isValid(id)) {
      throw new Error(`Invalid ID for ${fieldName}: ${String(id)}`);
    }
    return id as string;
  }
}
