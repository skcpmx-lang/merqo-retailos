import { describe, it, expect } from 'vitest';
import { FinancialLedgerService } from '../services/financial-ledger.service';

describe('FinancialLedgerService', () => {
  const service = new FinancialLedgerService();

  it('should build supplier transaction with correct sign', () => {
    const purchase = service.buildSupplierTransaction('b1', 's1', 'purchase', 10000);
    expect(purchase.amountPaisa).toBe(10000);

    const payment = service.buildSupplierTransaction('b1', 's1', 'payment', 10000);
    expect(payment.amountPaisa).toBe(-10000);

    const ret = service.buildSupplierTransaction('b1', 's1', 'return', 5000);
    expect(ret.amountPaisa).toBe(-5000);
  });

  it('should build customer transaction with correct sign', () => {
    const sale = service.buildCustomerTransaction('b1', 'c1', 'sale', 10000);
    expect(sale.amountPaisa).toBe(10000);

    const payment = service.buildCustomerTransaction('b1', 'c1', 'payment', 10000);
    expect(payment.amountPaisa).toBe(-10000);
  });

  it('should verify ledger invariant', () => {
    expect(service.verifyLedgerInvariant(10000, 10000).valid).toBe(true);
    expect(service.verifyLedgerInvariant(10000, 9000).difference).toBe(1000);
  });

  it('should calculate MFS net', () => {
    const result = service.calculateMfsNet('cash_in', 100000, 2000, 500);
    expect(result.netPaisa).toBe(100000);
    expect(result.breakdown).toContain('Cash In');
  });
});
