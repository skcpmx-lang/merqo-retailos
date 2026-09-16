import { describe, it, expect } from 'vitest';
import { WACCalculator } from '../WACCalculator';

describe('WACCalculator — weighted average cost', () => {
  it('should return new cost if old qty zero', () => {
    const wac = WACCalculator.calculate({
      oldQtyMilli: 0n,
      oldWacPaisa: 0n,
      newQtyMilli: 1000n,
      newCostPaisa: 10000n,
    });
    expect(wac).toBe(10000n);
  });

  it('should calculate WAC correctly', () => {
    // Old: 38 pcs * 100 BDT = 3800
    // New: 24 pcs * 120 BDT = 2880
    // Total: 62 pcs, value 6680, WAC 107.74
    const wac = WACCalculator.calculate({
      oldQtyMilli: 38000n, // 38 pcs in milli
      oldWacPaisa: 10000n, // 100 BDT = 10000 paisa
      newQtyMilli: 24000n,
      newCostPaisa: 12000n,
    });
    // Expected ~10774 paisa (107.74 BDT)
    expect(Number(wac)).toBeGreaterThan(10700);
    expect(Number(wac)).toBeLessThan(10800);
  });

  it('should handle exact calculation', () => {
    // Old 10 * 100 = 1000, New 10 * 200 = 2000, Total 20, WAC 150
    const wac = WACCalculator.calculate({
      oldQtyMilli: 10000n,
      oldWacPaisa: 10000n,
      newQtyMilli: 10000n,
      newCostPaisa: 20000n,
    });
    expect(wac).toBe(15000n);
  });
});
