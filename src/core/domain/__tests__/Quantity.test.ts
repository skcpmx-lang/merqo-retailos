import { describe, it, expect } from 'vitest';
import { Quantity } from '../Quantity';

describe('Quantity — milli precision, no FLOAT', () => {
  it('should create from milli', () => {
    const q = Quantity.fromMilli(1500);
    expect(q.toMilli()).toBe(1500);
    expect(q.toUnits()).toBe(1.5);
  });

  it('should create from units', () => {
    const q = Quantity.fromUnits(1.5);
    expect(q.toMilli()).toBe(1500);
  });

  it('should handle zero', () => {
    const q = Quantity.zero();
    expect(q.isZero()).toBe(true);
  });

  it('should add', () => {
    const a = Quantity.fromMilli(1000);
    const b = Quantity.fromMilli(500);
    expect(a.add(b).toMilli()).toBe(1500);
  });

  it('should subtract', () => {
    const a = Quantity.fromMilli(2000);
    const b = Quantity.fromMilli(500);
    expect(a.subtract(b).toMilli()).toBe(1500);
  });

  it('should handle fractional via milli', () => {
    // 0.1 + 0.2 should be exact in milli
    const a = Quantity.fromUnits(0.1);
    const b = Quantity.fromUnits(0.2);
    const sum = a.add(b);
    expect(sum.toMilli()).toBe(300); // 0.3 units = 300 milli
  });

  it('should sum', () => {
    const qs = [Quantity.fromMilli(1000), Quantity.fromMilli(2000)];
    expect(Quantity.sum(qs).toMilli()).toBe(3000);
  });
});
