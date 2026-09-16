import { describe, it, expect } from 'vitest';
import { InventoryDomainService } from '../services/inventory.service';

describe('InventoryDomainService', () => {
  const service = new InventoryDomainService();

  it('should validate movement', () => {
    expect(() =>
      service.validateMovement({
        businessId: 'b1',
        productId: 'p1',
        movementType: 'purchase',
        quantityMilli: 1000,
        costPaisa: 10000,
      })
    ).not.toThrow();

    expect(() =>
      service.validateMovement({
        businessId: 'b1',
        productId: 'p1',
        movementType: 'purchase',
        quantityMilli: 0,
        costPaisa: 10000,
      })
    ).toThrow();

    expect(() =>
      service.validateMovement({
        businessId: 'b1',
        productId: 'p1',
        movementType: 'sale' as any,
        quantityMilli: 1000,
        costPaisa: 10000,
      })
    ).toThrow(); // sale must be negative
  });

  it('should check canDeduct', () => {
    expect(service.canDeduct(5000, 3000, true).allowed).toBe(true);
    expect(service.canDeduct(2000, 3000, true).allowed).toBe(false);
    expect(service.canDeduct(0, 3000, false).allowed).toBe(true); // non-trackable
  });

  it('should verify ledger invariant', () => {
    expect(service.verifyLedgerInvariant(5000, 5000).valid).toBe(true);
    expect(service.verifyLedgerInvariant(5000, 4000).valid).toBe(false);
    expect(service.verifyLedgerInvariant(5000, 4000).difference).toBe(1000);
  });

  it('should calculate WAC', () => {
    // 10 existing at 100, 5 new at 120 => (1000+600)/15 = 106.66 => 10667 paisa? Actually WACCalculator uses integer
    const newWac = service.calculateNewWAC(10000, 10000, 5000, 12000);
    // (10*100 +5*120)/15 = 106.66
    expect(newWac).toBeGreaterThan(10000);
    expect(newWac).toBeLessThan(12000);
  });

  it('should build opening movement', () => {
    const m = service.buildOpeningMovement('b1', 'p1', 5000, 10000);
    expect(m).not.toBeNull();
    expect(m!.quantityMilli).toBe(5000);
    expect(m!.movementType).toBe('opening');

    const m2 = service.buildOpeningMovement('b1', 'p1', 0, 10000);
    expect(m2).toBeNull();
  });
});
