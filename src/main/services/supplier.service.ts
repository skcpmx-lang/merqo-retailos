import { SupplierRepository, SupplierTransactionRepository } from '../db/repositories/supplier.repository';
import { SupplierValidationService } from '@core/domain/services/purchase-validation.service';
import { FinancialLedgerService } from '@core/domain/services/financial-ledger.service';
import { AuditService } from './audit.service';

export interface CreateSupplierInput {
  businessId: string;
  name: string;
  companyName?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  notes?: string;
  openingPayablePaisa?: number;
  createdBy?: string;
}

export interface UpdateSupplierInput {
  name?: string;
  companyName?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  notes?: string;
  isActive?: boolean;
  updatedBy?: string;
}

export class SupplierService {
  private supplierRepo: SupplierRepository;
  private supplierTxRepo: SupplierTransactionRepository;
  private validationService = new SupplierValidationService();
  private ledgerService = new FinancialLedgerService();
  private auditService: AuditService;

  constructor(db?: any) {
    this.supplierRepo = new SupplierRepository(db);
    this.supplierTxRepo = new SupplierTransactionRepository(db);
    this.auditService = new AuditService(db);
  }

  create(input: CreateSupplierInput) {
    this.validationService.validate({
      businessId: input.businessId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      openingPayablePaisa: input.openingPayablePaisa,
    });

    const db = (this.supplierRepo as any).db;
    const transaction = db.transaction(() => {
      const supplier = this.supplierRepo.create({
        businessId: input.businessId,
        name: input.name,
        companyName: input.companyName || null,
        phone: input.phone || null,
        alternatePhone: input.alternatePhone || null,
        email: input.email || null,
        address: input.address || null,
        contactPerson: input.contactPerson || null,
        notes: input.notes || null,
        openingPayablePaisa: input.openingPayablePaisa ?? 0,
        currentPayablePaisa: input.openingPayablePaisa ?? 0,
        isActive: true,
      } as any);

      // Opening balance ledger entry if >0
      if (supplier.openingPayablePaisa > 0) {
        const tx = this.ledgerService.buildSupplierTransaction(
          supplier.businessId,
          supplier.id,
          'opening_payable',
          supplier.openingPayablePaisa,
          'opening',
          supplier.id,
          'প্রারম্ভিক বকেয়া',
          input.createdBy
        );
        this.supplierTxRepo.create(tx);
      }

      this.auditService.log({
        businessId: supplier.businessId,
        userId: input.createdBy || null,
        action: 'create',
        entityType: 'supplier',
        entityId: supplier.id,
        newValues: JSON.stringify({ name: supplier.name, phone: supplier.phone, opening: supplier.openingPayablePaisa }),
      });

      return supplier;
    });

    return transaction();
  }

  update(id: string, input: UpdateSupplierInput) {
    const existing = this.supplierRepo.findById(id);
    if (!existing) throw new Error('সাপ্লায়ার পাওয়া যায়নি');

    if (input.name !== undefined) {
      this.validationService.validate({
        businessId: existing.businessId,
        name: input.name,
        phone: input.phone ?? existing.phone ?? undefined,
        email: input.email ?? existing.email ?? undefined,
      });
    }

    const db = (this.supplierRepo as any).db;
    const transaction = db.transaction(() => {
      const updated = this.supplierRepo.update(id, {
        name: input.name ?? existing.name,
        companyName: input.companyName ?? (existing as any).companyName,
        phone: input.phone ?? existing.phone,
        alternatePhone: input.alternatePhone ?? (existing as any).alternatePhone,
        email: input.email ?? existing.email,
        address: input.address ?? existing.address,
        contactPerson: input.contactPerson ?? existing.contactPerson,
        notes: input.notes ?? (existing as any).notes,
        isActive: input.isActive ?? existing.isActive,
      } as any);

      this.auditService.log({
        businessId: existing.businessId,
        userId: input.updatedBy || null,
        action: 'update',
        entityType: 'supplier',
        entityId: id,
        oldValues: JSON.stringify({ name: existing.name }),
        newValues: JSON.stringify({ name: updated!.name }),
      });

      return updated;
    });

    return transaction();
  }

  deactivate(id: string, userId?: string) {
    const existing = this.supplierRepo.findById(id);
    if (!existing) throw new Error('সাপ্লায়ার পাওয়া যায়নি');

    // Check if has payable
    const currentPayable = this.supplierTxRepo.getCurrentPayable(id);
    if (currentPayable > 0) {
      // Allow deactivation but warn? Business rule: allow deactivation even with payable, but log
      // For stricter rule, prevent: throw new Error('বকেয়া থাকা অবস্থায় নিষ্ক্রিয় করা যাবে না');
    }

    this.supplierRepo.deactivate(id);

    this.auditService.log({
      businessId: existing.businessId,
      userId: userId || null,
      action: 'deactivate',
      entityType: 'supplier',
      entityId: id,
    });
  }

  delete(id: string, userId?: string) {
    const existing = this.supplierRepo.findById(id);
    if (!existing) throw new Error('সাপ্লায়ার পাওয়া যায়নি');

    if (this.supplierRepo.hasTransactions(id) || this.supplierRepo.hasPurchases(id)) {
      throw new Error('এই সাপ্লায়ারের লেনদেন রয়েছে, মুছে ফেলা যাবে না। নিষ্ক্রিয় করুন।');
    }

    this.supplierRepo.softDelete(id);

    this.auditService.log({
      businessId: existing.businessId,
      userId: userId || null,
      action: 'delete',
      entityType: 'supplier',
      entityId: id,
    });
  }

  findById(id: string) {
    return this.supplierRepo.findById(id);
  }

  findByBusiness(businessId: string) {
    return this.supplierRepo.findByBusiness(businessId);
  }

  search(businessId: string, query: string, includeInactive = false) {
    return this.supplierRepo.search(businessId, query, includeInactive);
  }

  getStatement(supplierId: string, fromDate?: number, toDate?: number) {
    const supplier = this.supplierRepo.findById(supplierId);
    if (!supplier) throw new Error('সাপ্লায়ার পাওয়া যায়নি');

    const transactions = this.supplierTxRepo.getStatementWithRunningBalance(supplierId, fromDate, toDate);
    const currentPayable = this.supplierTxRepo.getCurrentPayable(supplierId);

    // Calculate opening for range
    let openingBalance = 0;
    if (fromDate) {
      const beforeRow = (this.supplierTxRepo as any).db.prepare('SELECT SUM(amount_paisa) as total FROM supplier_transactions WHERE supplier_id = ? AND created_at < ?').get(supplierId, fromDate) as { total: number | null };
      openingBalance = beforeRow.total || 0;
    }

    return {
      supplier,
      openingBalance,
      transactions,
      currentPayable,
    };
  }

  getTransactionHistory(supplierId: string, limit = 100) {
    return this.supplierTxRepo.findBySupplier(supplierId, limit);
  }
}
