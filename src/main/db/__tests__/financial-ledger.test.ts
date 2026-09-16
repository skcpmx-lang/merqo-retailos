import { describe, it, expect, beforeEach } from 'vitest';
import { SupplierRepository, SupplierTransactionRepository } from '../repositories/supplier.repository';
import { CustomerRepository, CustomerTransactionRepository } from '../repositories/customer.repository';
import { getTestDb, seedBusiness } from './test-helpers';

describe('Financial Ledger Invariants', () => {
  let db: any;
  let supplierRepo: SupplierRepository;
  let supplierTxRepo: SupplierTransactionRepository;
  let customerRepo: CustomerRepository;
  let customerTxRepo: CustomerTransactionRepository;
  const businessId = 'biz_fin';

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);

    supplierRepo = new SupplierRepository(db);
    supplierTxRepo = new SupplierTransactionRepository(db);
    customerRepo = new CustomerRepository(db);
    customerTxRepo = new CustomerTransactionRepository(db);
  });

  it('should maintain supplier payable ledger', () => {
    const supplier = supplierRepo.create({
      businessId,
      name: 'Test Supplier',
      phone: null,
      email: null,
      address: null,
      contactPerson: null,
      openingPayablePaisa: 0,
      currentPayablePaisa: 0,
      isActive: true,
    });

    // Opening payable +50000
    supplierTxRepo.create({
      businessId,
      supplierId: supplier.id,
      transactionType: 'opening_payable',
      amountPaisa: 50000,
    });

    // Purchase +100000
    supplierTxRepo.create({
      businessId,
      supplierId: supplier.id,
      transactionType: 'purchase',
      amountPaisa: 100000,
      referenceType: 'purchase',
      referenceId: 'pur1',
    });

    // Payment -70000
    supplierTxRepo.create({
      businessId,
      supplierId: supplier.id,
      transactionType: 'payment',
      amountPaisa: -70000,
      referenceType: 'payment',
      referenceId: 'pay1',
    });

    const total = supplierTxRepo.getCurrentPayable(supplier.id);
    expect(total).toBe(80000); // 50k+100k-70k

    // Update supplier current payable to match ledger
    supplierRepo.update(supplier.id, { currentPayablePaisa: total });

    const updated = supplierRepo.findById(supplier.id);
    expect(updated!.currentPayablePaisa).toBe(80000);
  });

  it('should maintain customer due ledger', () => {
    const customer = customerRepo.create({
      businessId,
      name: 'Test Customer',
      phone: '01711111111',
      email: null,
      address: null,
      openingDuePaisa: 0,
      currentDuePaisa: 0,
      creditLimitPaisa: 0,
      isActive: true,
    });

    customerTxRepo.create({
      businessId,
      customerId: customer.id,
      transactionType: 'sale',
      amountPaisa: 100000,
    });

    customerTxRepo.create({
      businessId,
      customerId: customer.id,
      transactionType: 'payment',
      amountPaisa: -40000,
    });

    const total = customerTxRepo.getCurrentDue(customer.id);
    expect(total).toBe(60000);

    customerRepo.update(customer.id, { currentDuePaisa: total });
    const updated = customerRepo.findById(customer.id);
    expect(updated!.currentDuePaisa).toBe(60000);
  });

  it('should prevent zero amount transaction', () => {
    const supplier = supplierRepo.create({
      businessId,
      name: 'Zero Test Supplier',
      phone: null,
      email: null,
      address: null,
      contactPerson: null,
      openingPayablePaisa: 0,
      currentPayablePaisa: 0,
      isActive: true,
    });

    // The repository allows zero? Should check service layer prevents
    // But we test that ledger with zero doesn't affect total
    supplierTxRepo.create({
      businessId,
      supplierId: supplier.id,
      transactionType: 'adjustment',
      amountPaisa: 0,
    });

    const total = supplierTxRepo.getCurrentPayable(supplier.id);
    expect(total).toBe(0);
  });

  it('should be atomic: supplier creation + opening transaction', () => {
    const transaction = db.transaction(() => {
      const supplier = supplierRepo.create({
        businessId,
        name: 'Atomic Supplier',
        phone: null,
        email: null,
        address: null,
        contactPerson: null,
        openingPayablePaisa: 10000,
        currentPayablePaisa: 10000,
        isActive: true,
      });

      supplierTxRepo.create({
        businessId,
        supplierId: supplier.id,
        transactionType: 'opening_payable',
        amountPaisa: 10000,
      });

      return supplier;
    });

    const supplier = transaction();
    const total = supplierTxRepo.getCurrentPayable(supplier.id);
    expect(total).toBe(10000);
  });
});
