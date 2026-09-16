import { describe, it, expect } from 'vitest';
import { Money } from '../Money';

describe('Money — integer paisa, no FLOAT', () => {
  it('should create from paisa', () => {
    const m = Money.fromPaisa(12550);
    expect(m.toPaisa()).toBe(12550);
    expect(m.toBDT()).toBe(125.5);
  });

  it('should create from BDT', () => {
    const m = Money.fromBDT(125.5);
    expect(m.toPaisa()).toBe(12550);
  });

  it('should handle zero', () => {
    const m = Money.zero();
    expect(m.isZero()).toBe(true);
    expect(m.toPaisa()).toBe(0);
  });

  it('should add', () => {
    const a = Money.fromPaisa(10050);
    const b = Money.fromPaisa(20025);
    const sum = a.add(b);
    expect(sum.toPaisa()).toBe(30075);
  });

  it('should subtract', () => {
    const a = Money.fromPaisa(50000);
    const b = Money.fromPaisa(20000);
    const diff = a.subtract(b);
    expect(diff.toPaisa()).toBe(30000);
  });

  it('should multiply by factor', () => {
    const m = Money.fromPaisa(10000); // 100 BDT
    const result = m.multiply(1.5);
    expect(result.toPaisa()).toBe(15000);
  });

  it('should multiply by percent', () => {
    const m = Money.fromPaisa(10000);
    const discount = m.multiplyByPercent(10); // 10%
    expect(discount.toPaisa()).toBe(1000);
  });

  it('should format BDT', () => {
    const m = Money.fromPaisa(125050); // 1250.50
    expect(m.formatBDT()).toContain('1,250');
    expect(m.formatBDT()).toContain('৳');
  });

  it('should handle negative', () => {
    const m = Money.fromPaisa(-5000);
    expect(m.isNegative()).toBe(true);
    expect(m.toPaisa()).toBe(-5000);
  });

  it('should sum array', () => {
    const moneys = [Money.fromPaisa(1000), Money.fromPaisa(2000), Money.fromPaisa(3000)];
    const sum = Money.sum(moneys);
    expect(sum.toPaisa()).toBe(6000);
  });

  it('should not use FLOAT — precise paisa', () => {
    // 0.1 + 0.2 = 0.3 in BDT should be exact in paisa
    const a = Money.fromBDT(0.1);
    const b = Money.fromBDT(0.2);
    const sum = a.add(b);
    expect(sum.toPaisa()).toBe(30); // 0.30 BDT = 30 paisa
  });
});
