import { describe, it, expect } from 'vitest';
import { Id } from '../Id';

describe('Id — nanoid consistent', () => {
  it('should generate id', () => {
    const id = Id.generate();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThanOrEqual(10);
  });

  it('should generate unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => Id.generate()));
    expect(ids.size).toBe(100);
  });

  it('should validate', () => {
    expect(Id.isValid('abc123def456')).toBe(true);
    expect(Id.isValid('')).toBe(false);
    expect(Id.isValid(null)).toBe(false);
    expect(Id.isValid(123 as any)).toBe(false);
  });

  it('should require valid', () => {
    expect(() => Id.requireValid('')).toThrow();
    expect(Id.requireValid('validId12345')).toBe('validId12345');
  });
});
