import { describe, it, expect } from 'vitest';
import { PurchaseValidationService, SupplierValidationService } from '../services/purchase-validation.service';
import { PurchaseStateMachine } from '../services/purchase-state-machine';

describe('PurchaseValidationService', () => {
  const service = new PurchaseValidationService();

  it('should validate valid purchase', () => {
    expect(() =>
      service.validate({
        businessId: 'biz1',
        supplierId: 'sup1',
        items: [{ productId: 'prod1', unitId: 'unit1', quantityMilli: 1000, costPerUnitPaisa: 10000 }],
      })
    ).not.toThrow();
  });

  it('should fail if no items', () => {
    expect(() =>
      service.validate({
        businessId: 'biz1',
        supplierId: 'sup1',
        items: [],
      })
    ).toThrow();
  });

  it('should fail if quantity <=0', () => {
    expect(() =>
      service.validate({
        businessId: 'biz1',
        supplierId: 'sup1',
        items: [{ productId: 'prod1', unitId: 'unit1', quantityMilli: 0, costPerUnitPaisa: 10000 }],
      })
    ).toThrow();
  });

  it('should fail if cost negative', () => {
    expect(() =>
      service.validate({
        businessId: 'biz1',
        supplierId: 'sup1',
        items: [{ productId: 'prod1', unitId: 'unit1', quantityMilli: 1000, costPerUnitPaisa: -100 }],
      })
    ).toThrow();
  });

  it('should validate return quantity', () => {
    expect(() => service.validateReturnQuantity(1000, 5000)).not.toThrow();
    expect(() => service.validateReturnQuantity(6000, 5000)).toThrow();
    expect(() => service.validateReturnQuantity(0, 5000)).toThrow();
  });
});

describe('SupplierValidationService', () => {
  const service = new SupplierValidationService();

  it('should validate valid supplier', () => {
    expect(() => service.validate({ businessId: 'biz1', name: 'Test Supplier', phone: '01711111111' })).not.toThrow();
  });

  it('should fail if name empty', () => {
    expect(() => service.validate({ businessId: 'biz1', name: '' })).toThrow();
  });

  it('should fail if phone invalid', () => {
    expect(() => service.validate({ businessId: 'biz1', name: 'Test', phone: 'invalid' })).toThrow();
  });
});

describe('PurchaseStateMachine', () => {
  const sm = new PurchaseStateMachine();

  it('should allow valid transitions', () => {
    expect(sm.canTransition('draft', 'received')).toBe(true);
    expect(sm.canTransition('received', 'paid')).toBe(true);
    expect(sm.canTransition('received', 'partially_paid')).toBe(true);
    expect(sm.canTransition('partially_paid', 'paid')).toBe(true);
    expect(sm.canTransition('draft', 'cancelled')).toBe(true);
  });

  it('should prevent invalid transitions', () => {
    expect(sm.canTransition('paid', 'cancelled')).toBe(false);
    expect(sm.canTransition('cancelled', 'received')).toBe(false);
    expect(sm.canTransition('paid', 'draft')).toBe(false);
  });

  it('should assert transition throws on invalid', () => {
    expect(() => sm.assertTransition('paid', 'cancelled')).toThrow();
  });

  it('should determine next status after payment', () => {
    expect(sm.getNextStatusAfterPayment(10000, 0, 'received')).toBe('received');
    expect(sm.getNextStatusAfterPayment(10000, 5000, 'received')).toBe('partially_paid');
    expect(sm.getNextStatusAfterPayment(10000, 10000, 'received')).toBe('paid');
  });

  it('should have Bangla labels', () => {
    expect(sm.getStatusLabel('paid').bn).toBe('পরিশোধিত');
    expect(sm.getStatusLabel('cancelled').bn).toBe('বাতিল');
  });
});
