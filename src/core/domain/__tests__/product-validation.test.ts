import { describe, it, expect } from 'vitest';
import { ProductValidationService } from '../services/product-validation.service';

describe('ProductValidationService', () => {
  const service = new ProductValidationService();

  const validInput = {
    businessId: 'biz1',
    name: 'Test Product',
    sku: 'SKU-001',
    baseUnitId: 'unit1',
    costPricePaisa: 10000,
    sellingPricePaisa: 12000,
  };

  it('should pass valid product', () => {
    expect(() => service.validate(validInput)).not.toThrow();
  });

  it('should fail if name empty', () => {
    expect(() => service.validate({ ...validInput, name: '' })).toThrow();
  });

  it('should fail if SKU invalid', () => {
    expect(() => service.validate({ ...validInput, sku: 'invalid sku!' })).toThrow();
  });

  it('should fail if cost negative', () => {
    expect(() => service.validate({ ...validInput, costPricePaisa: -100 })).toThrow();
  });

  it('should fail if tax out of range', () => {
    expect(() => service.validate({ ...validInput, taxRate: 150 })).toThrow();
  });

  it('should validate barcode', () => {
    expect(() => service.validateBarcode('1234')).not.toThrow();
    expect(() => service.validateBarcode('ab')).toThrow();
    expect(() => service.validateBarcode('a'.repeat(51))).toThrow();
  });

  it('should warn selling below cost', () => {
    const result = service.validatePriceUpdate(10000, 8000, 10000);
    expect(result.warning).toContain('ক্রয় মূল্যের চেয়ে কম');
  });

  it('should warn significant cost increase', () => {
    const result = service.validatePriceUpdate(20000, 25000, 10000);
    expect(result.warning).toContain('বৃদ্ধি');
  });
});
