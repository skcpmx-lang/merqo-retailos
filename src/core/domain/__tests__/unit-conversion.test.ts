import { describe, it, expect } from 'vitest';
import { UnitConversionService } from '../services/unit-conversion.service';

describe('UnitConversionService', () => {
  const service = new UnitConversionService();

  it('should convert directly', () => {
    const conversions = [
      { fromUnitId: 'carton', toUnitId: 'piece', conversionFactor: 12 },
    ];
    const result = service.convert(2000, 'carton', 'piece', conversions);
    // 2 pieces (2000 milli = 2) *12 = 24 pieces => 24000 milli
    expect(result).toBe(24000);
  });

  it('should convert via reverse', () => {
    const conversions = [
      { fromUnitId: 'carton', toUnitId: 'piece', conversionFactor: 12 },
    ];
    const result = service.convert(12000, 'piece', 'carton', conversions);
    // 12 pieces -> 1 carton => 1000 milli
    expect(result).toBe(1000);
  });

  it('should convert via path', () => {
    const conversions = [
      { fromUnitId: 'carton', toUnitId: 'box', conversionFactor: 2 },
      { fromUnitId: 'box', toUnitId: 'piece', conversionFactor: 6 },
    ];
    const result = service.convert(1000, 'carton', 'piece', conversions);
    // 1 carton = 2 box = 12 pieces => 12000 milli
    expect(result).toBe(12000);
  });

  it('should return same quantity for same unit', () => {
    const result = service.convert(5000, 'piece', 'piece', []);
    expect(result).toBe(5000);
  });

  it('should throw if no path', () => {
    const conversions = [
      { fromUnitId: 'kg', toUnitId: 'g', conversionFactor: 1000 },
    ];
    expect(() => service.convert(1000, 'kg', 'piece', conversions)).toThrow();
  });

  it('should validate conversions', () => {
    const valid = service.validateConversions([
      { fromUnitId: 'a', toUnitId: 'b', conversionFactor: 10 },
    ]);
    expect(valid.valid).toBe(true);

    const invalid = service.validateConversions([
      { fromUnitId: 'a', toUnitId: 'a', conversionFactor: 10 },
      { fromUnitId: 'b', toUnitId: 'c', conversionFactor: 0 },
    ]);
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBe(2);
  });

  it('toBaseMilli and fromBaseMilli', () => {
    expect(service.toBaseMilli(2, 12)).toBe(24000);
    expect(service.fromBaseMilli(24000, 12)).toBe(2);
  });
});
