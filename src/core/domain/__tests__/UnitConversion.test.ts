import { describe, it, expect } from 'vitest';
import { UnitConversion } from '../UnitConversion';

describe('UnitConversion — graph-based', () => {
  it('should convert 1 carton = 24 pieces', () => {
    const conv = new UnitConversion([
      { fromUnitId: 'carton', toUnitId: 'piece', factor: 24 },
    ]);
    expect(conv.convert(1, 'carton', 'piece')).toBe(24);
    expect(conv.convert(2, 'carton', 'piece')).toBe(48);
  });

  it('should convert reverse', () => {
    const conv = new UnitConversion([
      { fromUnitId: 'carton', toUnitId: 'piece', factor: 24 },
    ]);
    expect(conv.convert(24, 'piece', 'carton')).toBe(1);
  });

  it('should convert via path', () => {
    const conv = new UnitConversion([
      { fromUnitId: 'carton', toUnitId: 'box', factor: 2 },
      { fromUnitId: 'box', toUnitId: 'piece', factor: 12 },
    ]);
    // 1 carton = 2 boxes = 24 pieces
    expect(conv.convert(1, 'carton', 'piece')).toBe(24);
  });

  it('should throw if no path', () => {
    const conv = new UnitConversion([
      { fromUnitId: 'carton', toUnitId: 'piece', factor: 24 },
    ]);
    expect(() => conv.convert(1, 'kg', 'piece')).toThrow();
  });

  it('should handle same unit', () => {
    const conv = new UnitConversion([]);
    expect(conv.convert(5, 'piece', 'piece')).toBe(5);
  });
});
