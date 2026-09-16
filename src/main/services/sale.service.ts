/**
 * Sale Application Service — production-grade
 * Flow: Customer -> Products -> Qty -> Unit -> Price -> Discount -> Tax -> Total -> Payment -> Inventory deduction -> Customer ledger -> Financial ledger -> Audit
 * Atomic transactions with rollback tested
 */

import { SaleRepository, SaleItemRepository, SalePaymentRepository, SaleReturnRepository, SaleReturnItemRepository } from '../db/repositories/sale.repository';
import { CustomerRepository, CustomerTransactionRepository } from '../db/repositories/customer.repository';
import { ProductRepository } from '../db/repositories/product.repository';
import { UnitRepository, UnitConversionRepository } from '../db/repositories/unit.repository';
import { StockLevelRepository, StockMovementRepository } from '../db/repositories/inventory.repository';
import { CashAccountRepository, CashMovementRepository, BankAccountRepository, BankTransactionRepository, MfsAccountRepository, MfsTransactionRepository } from '../db/repositories/finance.repository';
import { SaleValidationService } from '@core/domain/services/customer-validation.service';
import { UnitConversionService } from '@core/domain/services/unit-conversion.service';
import { InventoryDomainService } from '@core/domain/services/inventory.service';
import { FinancialLedgerService } from '@core/domain/services/financial-ledger.service';
import { SaleStateMachine, type SaleStatus } from '@core/domain/services/sale-state-machine';
import { AuditService } from './audit.service';

export interface SaleItemInput {
  productId: string;
  unitId: string;
  quantityMilli: number;
  unitPricePaisa: number;
  discountPaisa?: number;
  taxPaisa?: number;
}

export interface CreateSaleInput {
  businessId: string;
  customerId?: string | null;
  saleDate?: number;
  items: SaleItemInput[];
  discountPaisa?: number;
  discountType?: string;
  discountValue?: number;
  taxPaisa?: number;
  shippingPaisa?: number;
  paidPaisa?: number;
  payments?: { method: string; amountPaisa: number; cashAccountId?: string; bankAccountId?: string; mfsAccountId?: string; chequeNumber?: string; transactionRef?: string; cardLast4?: string }[];
  notes?: string;
  createdBy?: string;
  shiftId?: string;
}

export interface SaleReturnInput {
  businessId: string;
  saleId: string;
  items: { productId: string; unitId?: string; quantityMilli: number; unitPricePaisa?: number; reason?: string; restock?: boolean }[];
  reason?: string;
  notes?: string;
  refundMethod?: string;
  createdBy?: string;
}

export class SaleService {
  private saleRepo: SaleRepository;
  private saleItemRepo: SaleItemRepository;
  private salePaymentRepo: SalePaymentRepository;
  private saleReturnRepo: SaleReturnRepository;
  private saleReturnItemRepo: SaleReturnItemRepository;
  private customerRepo: CustomerRepository;
  private customerTxRepo: CustomerTransactionRepository;
  private productRepo: ProductRepository;
  private unitRepo: UnitRepository;
  private unitConversionRepo: UnitConversionRepository;
  private stockLevelRepo: StockLevelRepository;
  private stockMovementRepo: StockMovementRepository;
  private cashAccountRepo: CashAccountRepository;
  private cashMovementRepo: CashMovementRepository;
  private bankAccountRepo: BankAccountRepository;
  private bankTxRepo: BankTransactionRepository;
  private mfsAccountRepo: MfsAccountRepository;
  private mfsTxRepo: MfsTransactionRepository;

  private validationService = new SaleValidationService();
  private unitConversionService = new UnitConversionService();
  private inventoryService = new InventoryDomainService();
  private ledgerService = new FinancialLedgerService();
  private stateMachine = new SaleStateMachine();
  private auditService: AuditService;

  constructor(db?: any) {
    this.saleRepo = new SaleRepository(db);
    this.saleItemRepo = new SaleItemRepository(db);
    this.salePaymentRepo = new SalePaymentRepository(db);
    this.saleReturnRepo = new SaleReturnRepository(db);
    this.saleReturnItemRepo = new SaleReturnItemRepository(db);
    this.customerRepo = new CustomerRepository(db);
    this.customerTxRepo = new CustomerTransactionRepository(db);
    this.productRepo = new ProductRepository(db);
    this.unitRepo = new UnitRepository(db);
    this.unitConversionRepo = new UnitConversionRepository(db);
    this.stockLevelRepo = new StockLevelRepository(db);
    this.stockMovementRepo = new StockMovementRepository(db);
    this.cashAccountRepo = new CashAccountRepository(db);
    this.cashMovementRepo = new CashMovementRepository(db);
    this.bankAccountRepo = new BankAccountRepository(db);
    this.bankTxRepo = new BankTransactionRepository(db);
    this.mfsAccountRepo = new MfsAccountRepository(db);
    this.mfsTxRepo = new MfsTransactionRepository(db);
    this.auditService = new AuditService(db);
  }

  /**
   * Create sale atomically
   * Validates stock, calculates totals, deducts inventory, updates customer ledger, creates financial movements
   */
  create(input: CreateSaleInput) {
    this.validationService.validate({
      businessId: input.businessId,
      customerId: input.customerId || null,
      saleDate: input.saleDate,
      items: input.items.map(i => ({
        productId: i.productId,
        unitId: i.unitId,
        quantityMilli: i.quantityMilli,
        unitPricePaisa: i.unitPricePaisa,
        discountPaisa: i.discountPaisa,
        taxPaisa: i.taxPaisa,
      })),
      discountPaisa: input.discountPaisa,
      taxPaisa: input.taxPaisa,
      shippingPaisa: input.shippingPaisa,
      paidPaisa: input.paidPaisa,
    } as any);

    // Customer validation if provided
    let customer: any = null;
    if (input.customerId) {
      customer = this.customerRepo.findById(input.customerId);
      if (!customer) throw new Error('গ্রাহক পাওয়া যায়নি');
      if (!customer.isActive) throw new Error('নিষ্ক্রিয় গ্রাহকের জন্য বিক্রয় করা যাবে না');
    }

    const db = (this.saleRepo as any).db;

    const transaction = db.transaction(() => {
      // Load conversions once
      const conversions = this.unitConversionRepo.findByBusiness(input.businessId);

      // Pre-validate stock availability for all items (first pass)
      let subtotalPaisa = 0;
      const processedItems: {
        productId: string;
        unitId: string;
        quantityMilli: number;
        baseQuantityMilli: number;
        unitPricePaisa: number;
        baseUnitPricePaisa: number;
        costPerUnitPaisa: number;
        discountPaisa: number;
        taxPaisa: number;
        lineTotalPaisa: number;
        lineCostTotalPaisa: number;
        product: any;
        productNameSnapshot: string;
      }[] = [];

      for (const item of input.items) {
        const product = this.productRepo.findById(item.productId);
        if (!product) throw new Error(`পণ্য পাওয়া যায়নি: ${item.productId}`);
        if (!product.isActive) throw new Error(`পণ্য নিষ্ক্রিয়: ${product.name}`);
        if (!product.isSellable) throw new Error(`পণ্যটি বিক্রয়যোগ্য নয়: ${product.name}`);

        const unit = this.unitRepo.findById(item.unitId);
        if (!unit) throw new Error(`ইউনিট পাওয়া যায়নি: ${item.unitId}`);

        // Convert quantity to base
        let baseQuantityMilli: number;
        if (item.unitId === product.baseUnitId) {
          baseQuantityMilli = item.quantityMilli;
        } else {
          try {
            baseQuantityMilli = this.unitConversionService.convert(item.quantityMilli, item.unitId, product.baseUnitId, conversions);
          } catch (e) {
            throw new Error(`ইউনিট রূপান্তর ব্যর্থ: ${product.name}`);
          }
        }

        if (baseQuantityMilli <= 0) throw new Error('পরিমাণ ০ এর বেশি হতে হবে');

        // Stock check for trackable products
        if (product.isStockTrackable) {
          const currentLevel = this.stockLevelRepo.findByProductAndLocation(item.productId, 'main');
          const currentStock = currentLevel?.quantityMilli ?? 0;
          const check = this.inventoryService.canDeduct(currentStock, baseQuantityMilli, true);
          if (!check.allowed) {
            throw new Error(check.reason || `এই পণ্যের পর্যাপ্ত স্টক নেই।`);
          }
        }

        // Price calculations
        const qtyUnits = item.quantityMilli / 1000;
        const itemSubtotal = Math.round(qtyUnits * item.unitPricePaisa);
        const discount = item.discountPaisa || 0;
        const tax = item.taxPaisa || 0;
        const lineTotal = itemSubtotal - discount + tax;

        if (lineTotal < 0) throw new Error('লাইন মোট ঋণাত্মক হতে পারে না');

        // Base price per base unit
        const baseQtyUnits = baseQuantityMilli / 1000;
        const baseUnitPrice = baseQtyUnits > 0 ? Math.round(lineTotal / baseQtyUnits) : item.unitPricePaisa;

        // Cost snapshot — WAC at time of sale
        const costPerUnit = product.costPricePaisa; // WAC
        const lineCostTotal = Math.round((baseQuantityMilli / 1000) * costPerUnit);

        subtotalPaisa += lineTotal;

        processedItems.push({
          productId: item.productId,
          unitId: item.unitId,
          quantityMilli: item.quantityMilli,
          baseQuantityMilli,
          unitPricePaisa: item.unitPricePaisa,
          baseUnitPricePaisa: baseUnitPrice,
          costPerUnitPaisa: costPerUnit,
          discountPaisa: discount,
          taxPaisa: tax,
          lineTotalPaisa: lineTotal,
          lineCostTotalPaisa: lineCostTotal,
          product,
          productNameSnapshot: product.name,
        });
      }

      const discountPaisa = input.discountPaisa || 0;
      const taxPaisa = input.taxPaisa || 0;
      const shippingPaisa = input.shippingPaisa || 0;
      const totalPaisa = subtotalPaisa - discountPaisa + taxPaisa + shippingPaisa;

      if (totalPaisa < 0) throw new Error('মোট টাকা ঋণাত্মক হতে পারে না');

      let paidPaisa = input.paidPaisa || 0;
      if (input.payments && input.payments.length > 0) {
        const paymentsSum = input.payments.reduce((sum, p) => sum + p.amountPaisa, 0);
        if (paidPaisa === 0) paidPaisa = paymentsSum;
        else if (paidPaisa !== paymentsSum) {
          throw new Error('পরিশোধিত টাকা এবং পেমেন্ট পদ্ধতির যোগফল মিলছে না');
        }
      }

      if (paidPaisa > totalPaisa) throw new Error('পরিশোধিত টাকা মোট টাকার চেয়ে বেশি হতে পারে না');

      const duePaisa = totalPaisa - paidPaisa;
      const isDue = duePaisa > 0;

      // Due requires customer
      if (isDue && !input.customerId) {
        throw new Error('বাকি বিক্রয়ের জন্য গ্রাহক নির্বাচন করতে হবে');
      }

      // Credit limit check
      if (isDue && customer && customer.creditLimitPaisa > 0) {
        const currentDue = this.customerTxRepo.getCurrentDue(customer.id);
        if (currentDue + duePaisa > customer.creditLimitPaisa) {
          throw new Error(`ক্রেডিট লিমিট অতিক্রম করেছে। বর্তমান বকেয়া: ${currentDue / 100}, লিমিট: ${customer.creditLimitPaisa / 100}`);
        }
      }

      // Status determination
      let status: 'draft' | 'completed' | 'partially_paid' | 'paid' | 'cancelled' = 'completed';
      if (duePaisa === 0) status = 'paid';
      else if (paidPaisa > 0) status = 'partially_paid';
      else status = 'completed'; // full due

      const saleNumber = this.saleRepo.getNextSaleNumber(input.businessId);

      // Create sale header
      const sale = this.saleRepo.create({
        businessId: input.businessId,
        customerId: input.customerId || null,
        saleNumber,
        saleDate: input.saleDate || Date.now(),
        status,
        subtotalPaisa,
        discountType: input.discountType || null,
        discountValue: input.discountValue ?? 0,
        discountPaisa,
        taxPaisa,
        shippingPaisa,
        totalPaisa,
        paidPaisa,
        duePaisa,
        changePaisa: 0,
        notes: input.notes || null,
        isDue,
        createdBy: input.createdBy || null,
        shiftId: input.shiftId || null,
      });

      // Create sale items + inventory deduction
      for (const pItem of processedItems) {
        this.saleItemRepo.create({
          saleId: sale.id,
          productId: pItem.productId,
          unitId: pItem.unitId,
          quantityMilli: pItem.quantityMilli,
          baseQuantityMilli: pItem.baseQuantityMilli,
          unitPricePaisa: pItem.unitPricePaisa,
          baseUnitPricePaisa: pItem.baseUnitPricePaisa,
          costPerUnitPaisa: pItem.costPerUnitPaisa,
          discountPaisa: pItem.discountPaisa,
          taxPaisa: pItem.taxPaisa,
          lineTotalPaisa: pItem.lineTotalPaisa,
          lineCostTotalPaisa: pItem.lineCostTotalPaisa,
          productNameSnapshot: pItem.productNameSnapshot,
        } as any);

        // Inventory deduction — only if trackable
        if (pItem.product.isStockTrackable) {
          const currentLevel = this.stockLevelRepo.findByProductAndLocation(pItem.productId, 'main');
          const currentStockMilli = currentLevel?.quantityMilli ?? 0;

          const movement = this.inventoryService.buildSaleMovement(
            input.businessId,
            pItem.productId,
            pItem.baseQuantityMilli,
            pItem.costPerUnitPaisa,
            sale.id,
            input.createdBy
          );
          this.stockMovementRepo.create(movement as any);

          const newQty = currentStockMilli - pItem.baseQuantityMilli;
          this.stockLevelRepo.upsert({
            businessId: input.businessId,
            productId: pItem.productId,
            locationId: 'main',
            quantityMilli: newQty,
            reservedMilli: currentLevel?.reservedMilli ?? 0,
            lastMovementAt: Date.now(),
          });
        }
      }

      // Customer ledger — if due exists, sale increases receivable
      if (isDue && input.customerId) {
        const saleTx = this.ledgerService.buildCustomerTransaction(
          input.businessId,
          input.customerId,
          'sale',
          duePaisa,
          'sale',
          sale.id,
          `বিক্রয়: ${saleNumber}`,
          input.createdBy
        );
        this.customerTxRepo.create(saleTx);

        const newDue = this.customerTxRepo.getCurrentDue(input.customerId);
        this.customerRepo.update(input.customerId, {
          currentDuePaisa: newDue,
        } as any);
      }

      // Sale payments + financial movements
      if (paidPaisa > 0) {
        if (input.payments && input.payments.length > 0) {
          for (const pay of input.payments) {
            const paymentNumber = this.salePaymentRepo.getNextPaymentNumber(input.businessId);
            this.salePaymentRepo.create({
              businessId: input.businessId,
              saleId: sale.id,
              paymentNumber,
              paymentDate: input.saleDate || Date.now(),
              paymentMethod: pay.method,
              amountPaisa: pay.amountPaisa,
              cashAccountId: pay.cashAccountId || null,
              bankAccountId: pay.bankAccountId || null,
              mfsAccountId: pay.mfsAccountId || null,
              chequeNumber: pay.chequeNumber || null,
              transactionRef: pay.transactionRef || null,
              cardLast4: pay.cardLast4 || null,
              notes: null,
              createdBy: input.createdBy || null,
            });

            // Financial ledger movements
            this.createFinancialMovementForPayment(
              input.businessId,
              pay.method,
              pay.amountPaisa,
              sale.id,
              pay.cashAccountId,
              pay.bankAccountId,
              pay.mfsAccountId,
              input.createdBy,
              customer?.name || 'ওয়াক-ইন গ্রাহক',
              input.customerId
            );
          }
        } else {
          // Single cash payment fallback
          const paymentNumber = this.salePaymentRepo.getNextPaymentNumber(input.businessId);
          this.salePaymentRepo.create({
            businessId: input.businessId,
            saleId: sale.id,
            paymentNumber,
            paymentDate: input.saleDate || Date.now(),
            paymentMethod: 'cash',
            amountPaisa: paidPaisa,
            notes: null,
            createdBy: input.createdBy || null,
          });

          this.createFinancialMovementForPayment(
            input.businessId,
            'cash',
            paidPaisa,
            sale.id,
            undefined,
            undefined,
            undefined,
            input.createdBy,
            customer?.name || 'ওয়াক-ইন গ্রাহক',
            input.customerId
          );
        }
      }

      // Audit
      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'create',
        entityType: 'sale',
        entityId: sale.id,
        newValues: JSON.stringify({ saleNumber, total: totalPaisa, paid: paidPaisa, due: duePaisa, items: processedItems.length }),
      });

      return sale;
    });

    return transaction();
  }

  private createFinancialMovementForPayment(
    businessId: string,
    method: string,
    amountPaisa: number,
    saleId: string,
    cashAccountId?: string,
    bankAccountId?: string,
    mfsAccountId?: string,
    createdBy?: string,
    customerName?: string,
    customerId?: string | null
  ) {
    const methodLower = method.toLowerCase();
    if (methodLower === 'cash') {
      const accountId = cashAccountId || this.getDefaultCashAccountId(businessId);
      if (accountId) {
        this.cashMovementRepo.create({
          businessId,
          cashAccountId: accountId,
          movementType: 'sale',
          amountPaisa,
          referenceType: 'sale',
          referenceId: saleId,
          notes: `বিক্রয়: ${customerName}`,
          createdBy,
        });
      }
    } else if (['bank', 'card', 'cheque'].includes(methodLower)) {
      if (bankAccountId) {
        this.bankTxRepo.create({
          businessId,
          bankAccountId,
          transactionType: 'sale',
          amountPaisa,
          referenceType: 'sale',
          referenceId: saleId,
          chequeNumber: null,
          notes: `বিক্রয়: ${customerName}`,
          createdBy,
        });
      }
      } else if (['bkash', 'nagad', 'rocket', 'upay', 'mfs'].includes(methodLower)) {
      if (mfsAccountId) {
        this.mfsTxRepo.create({
          businessId,
          mfsAccountId,
          transactionType: 'sale',
          amountPaisa,
          customerChargePaisa: 0,
          commissionPaisa: 0,
          netAmountPaisa: amountPaisa,
          transactionRef: null,
          notes: `বিক্রয়: ${customerName}`,
          createdBy,
          customerId: customerId || null,
        } as any);
      }
    }
  }

  private getDefaultCashAccountId(businessId: string): string | null {
    try {
      const db = (this.saleRepo as any).db;
      const row = db.prepare('SELECT id FROM cash_accounts WHERE business_id = ? AND is_active = 1 ORDER BY is_default DESC LIMIT 1').get(businessId) as { id: string } | undefined;
      return row?.id || null;
    } catch {
      return null;
    }
  }

  findById(id: string) {
    const sale = this.saleRepo.findById(id);
    if (!sale) return null;
    const items = this.saleItemRepo.findBySale(id);
    const payments = this.salePaymentRepo.findBySale(id);
    const returns = this.saleReturnRepo.findBySale(id);
    return { sale, items, payments, returns };
  }

  findByBusiness(businessId: string, filters?: any, limit = 50, offset = 0) {
    return this.saleRepo.findByBusiness(businessId, filters, limit, offset);
  }

  /**
   * Cancel / void sale — reverses inventory, customer ledger, financial movements
   */
  cancel(id: string, reason: string, userId?: string) {
    const existing = this.saleRepo.findById(id);
    if (!existing) throw new Error('বিক্রয় পাওয়া যায়নি');
    if (existing.status === 'cancelled' || existing.status === 'voided') throw new Error('বিক্রয় ইতিমধ্যে বাতিল');

    const db = (this.saleRepo as any).db;
    const transaction = db.transaction(() => {
      const returns = this.saleReturnRepo.findBySale(id);
      if (returns.length > 0) throw new Error('ফেরত থাকা বিক্রয় বাতিল করা যাবে না');

      // Reverse inventory
      const items = this.saleItemRepo.findBySale(id);
      for (const item of items) {
        const product = this.productRepo.findById(item.productId);
        if (product?.isStockTrackable) {
          const currentLevel = this.stockLevelRepo.findByProductAndLocation(item.productId, 'main');
          const currentStock = currentLevel?.quantityMilli ?? 0;

          this.stockMovementRepo.create({
            businessId: existing.businessId,
            productId: item.productId,
            movementType: 'sale_return',
            quantityMilli: item.baseQuantityMilli, // positive restock
            costPaisa: item.costPerUnitPaisa,
            referenceType: 'sale_cancel',
            referenceId: id,
            notes: `বিক্রয় বাতিল: ${existing.saleNumber}`,
            locationId: 'main',
            createdBy: userId,
          } as any);

          const newQty = currentStock + item.baseQuantityMilli;
          this.stockLevelRepo.upsert({
            businessId: existing.businessId,
            productId: item.productId,
            locationId: 'main',
            quantityMilli: newQty,
            reservedMilli: currentLevel?.reservedMilli ?? 0,
            lastMovementAt: Date.now(),
          });
        }
      }

      // Reverse customer ledger if due existed
      if (existing.customerId && existing.duePaisa > 0) {
        const cancelTx = this.ledgerService.buildCustomerTransaction(
          existing.businessId,
          existing.customerId,
          'adjustment',
          -existing.duePaisa,
          'sale_cancel',
          id,
          `বিক্রয় বাতিল: ${existing.saleNumber} - ${reason}`,
          userId
        );
        this.customerTxRepo.create(cancelTx);

        const newDue = this.customerTxRepo.getCurrentDue(existing.customerId);
        this.customerRepo.update(existing.customerId, { currentDuePaisa: newDue } as any);
      }

      // Reverse financial movements — create negative movements
      const payments = this.salePaymentRepo.findBySale(id);
      for (const pay of payments) {
        if (pay.paymentMethod === 'cash' && pay.cashAccountId) {
          this.cashMovementRepo.create({
            businessId: existing.businessId,
            cashAccountId: pay.cashAccountId,
            movementType: 'sale_cancel',
            amountPaisa: -pay.amountPaisa,
            referenceType: 'sale_cancel',
            referenceId: id,
            notes: `বিক্রয় বাতিল: ${existing.saleNumber}`,
            createdBy: userId,
          });
        } else if (pay.bankAccountId) {
          this.bankTxRepo.create({
            businessId: existing.businessId,
            bankAccountId: pay.bankAccountId,
            transactionType: 'sale_cancel',
            amountPaisa: -pay.amountPaisa,
            referenceType: 'sale_cancel',
            referenceId: id,
            notes: `বিক্রয় বাতিল: ${existing.saleNumber}`,
            createdBy: userId,
          });
        } else if (pay.mfsAccountId) {
          this.mfsTxRepo.create({
            businessId: existing.businessId,
            mfsAccountId: pay.mfsAccountId,
            transactionType: 'sale_cancel',
            amountPaisa: pay.amountPaisa,
            netAmountPaisa: -pay.amountPaisa,
            notes: `বিক্রয় বাতিল: ${existing.saleNumber}`,
            createdBy: userId,
            customerId: existing.customerId || null,
          } as any);
        }
      }

      this.saleRepo.void(id, reason, userId);

      this.auditService.log({
        businessId: existing.businessId,
        userId: userId || null,
        action: 'cancel',
        entityType: 'sale',
        entityId: id,
        newValues: JSON.stringify({ reason, saleNumber: existing.saleNumber }),
      });
    });

    return transaction();
  }

  /**
   * Sale return — full or partial
   */
  createReturn(input: SaleReturnInput) {
    const saleData = this.saleRepo.findById(input.saleId);
    if (!saleData) throw new Error('বিক্রয় পাওয়া যায়নি');
    if (saleData.status === 'cancelled' || saleData.status === 'voided') throw new Error('বাতিল বিক্রয় ফেরত দেওয়া যাবে না');

    const saleItems = this.saleItemRepo.findBySale(input.saleId);

    const db = (this.saleRepo as any).db;
    const transaction = db.transaction(() => {
      let totalReturnPaisa = 0;
      const processedReturnItems: { productId: string; unitId?: string; quantityMilli: number; baseQuantityMilli: number; unitPricePaisa: number; costPaisa: number; lineTotal: number; restock: boolean }[] = [];

      const conversions = this.unitConversionRepo.findByBusiness(input.businessId);

      for (const retItem of input.items) {
        const saleItem = saleItems.find(si => si.productId === retItem.productId);
        if (!saleItem) throw new Error(`বিক্রয়ে পণ্য নেই: ${retItem.productId}`);

        const alreadyReturned = this.saleReturnItemRepo.getReturnedQuantityForSale(retItem.productId, input.saleId);
        const eligibleMilli = saleItem.baseQuantityMilli - alreadyReturned;

        if (eligibleMilli <= 0) throw new Error(`পণ্যটির ফেরতযোগ্য পরিমাণ শেষ: ${saleItem.productId}`);

        let baseQtyMilli = retItem.quantityMilli;
        if (retItem.unitId) {
          const product = this.productRepo.findById(retItem.productId);
          if (!product) throw new Error('পণ্য পাওয়া যায়নি');
          if (retItem.unitId !== product.baseUnitId) {
            try {
              baseQtyMilli = this.unitConversionService.convert(retItem.quantityMilli, retItem.unitId, product.baseUnitId, conversions);
            } catch (e) {
              throw new Error(`ইউনিট রূপান্তর ব্যর্থ: ${String(e)}`);
            }
          }
        }

        if (baseQtyMilli <= 0) throw new Error('ফেরত পরিমাণ ০ এর বেশি হতে হবে');
        if (baseQtyMilli > eligibleMilli) {
          throw new Error(`ফেরত পরিমাণ বেশি: সর্বোচ্চ ${eligibleMilli / 1000}`);
        }

        const unitPrice = retItem.unitPricePaisa || saleItem.baseUnitPricePaisa;
        const lineTotal = Math.round((baseQtyMilli / 1000) * unitPrice);

        totalReturnPaisa += lineTotal;

        processedReturnItems.push({
          productId: retItem.productId,
          unitId: retItem.unitId,
          quantityMilli: retItem.quantityMilli,
          baseQuantityMilli: baseQtyMilli,
          unitPricePaisa: unitPrice,
          costPaisa: saleItem.costPerUnitPaisa,
          lineTotal,
          restock: retItem.restock ?? true,
        });
      }

      const returnNumber = this.saleReturnRepo.getNextReturnNumber(input.businessId);

      const saleReturn = this.saleReturnRepo.create({
        businessId: input.businessId,
        saleId: input.saleId,
        customerId: saleData.customerId || null,
        returnNumber,
        returnDate: Date.now(),
        totalPaisa: totalReturnPaisa,
        refundPaisa: totalReturnPaisa,
        refundMethod: input.refundMethod || null,
        reason: input.reason || null,
        notes: input.notes || null,
        status: 'completed',
        createdBy: input.createdBy || null,
      });

      for (const retItem of processedReturnItems) {
        this.saleReturnItemRepo.create({
          returnId: saleReturn.id,
          productId: retItem.productId,
          unitId: retItem.unitId || null,
          quantityMilli: retItem.quantityMilli,
          baseQuantityMilli: retItem.baseQuantityMilli,
          unitPricePaisa: retItem.unitPricePaisa,
          costPaisa: retItem.costPaisa,
          lineTotalPaisa: retItem.lineTotal,
          restock: retItem.restock,
        });

        if (retItem.restock) {
          const product = this.productRepo.findById(retItem.productId);
          if (product?.isStockTrackable) {
            this.stockMovementRepo.create({
              businessId: input.businessId,
              productId: retItem.productId,
              movementType: 'sale_return',
              quantityMilli: retItem.baseQuantityMilli,
              costPaisa: retItem.costPaisa,
              referenceType: 'sale_return',
              referenceId: saleReturn.id,
              notes: `বিক্রয় ফেরত: ${returnNumber}`,
              locationId: 'main',
              createdBy: input.createdBy,
            } as any);

            const currentLevel = this.stockLevelRepo.findByProductAndLocation(retItem.productId, 'main');
            const newQty = (currentLevel?.quantityMilli ?? 0) + retItem.baseQuantityMilli;
            this.stockLevelRepo.upsert({
              businessId: input.businessId,
              productId: retItem.productId,
              locationId: 'main',
              quantityMilli: newQty,
              reservedMilli: currentLevel?.reservedMilli ?? 0,
              lastMovementAt: Date.now(),
            });
          }
        }
      }

      // Customer ledger — return reduces receivable if customer exists
      if (saleData.customerId) {
        const returnTx = this.ledgerService.buildCustomerTransaction(
          input.businessId,
          saleData.customerId,
          'return',
          totalReturnPaisa,
          'sale_return',
          saleReturn.id,
          `বিক্রয় ফেরত: ${returnNumber}`,
          input.createdBy
        );
        this.customerTxRepo.create(returnTx);

        const newDue = this.customerTxRepo.getCurrentDue(saleData.customerId);
        this.customerRepo.update(saleData.customerId, { currentDuePaisa: newDue } as any);
      }

      // Refund handling — if sale was paid, need to refund via financial movement
      // For simplicity, if refundMethod provided, create negative cash/bank/mfs movement
      if (saleData.paidPaisa > 0 && input.refundMethod) {
        const refundMethod = input.refundMethod.toLowerCase();
        if (refundMethod === 'cash') {
          const cashAccountId = this.getDefaultCashAccountId(input.businessId);
          if (cashAccountId) {
            this.cashMovementRepo.create({
              businessId: input.businessId,
              cashAccountId,
              movementType: 'sale_return_refund',
              amountPaisa: -totalReturnPaisa,
              referenceType: 'sale_return',
              referenceId: saleReturn.id,
              notes: `বিক্রয় ফেরত রিফান্ড: ${returnNumber}`,
              createdBy: input.createdBy,
            });
          }
        } else if (['bank', 'card', 'cheque'].includes(refundMethod)) {
          // Find a bank account if available, else skip
          try {
            const bankAccount = this.bankAccountRepo.findByBusiness(input.businessId)[0];
            if (bankAccount) {
              this.bankTxRepo.create({
                businessId: input.businessId,
                bankAccountId: bankAccount.id,
                transactionType: 'sale_return_refund',
                amountPaisa: -totalReturnPaisa,
                referenceType: 'sale_return',
                referenceId: saleReturn.id,
                notes: `বিক্রয় ফেরত রিফান্ড: ${returnNumber}`,
                createdBy: input.createdBy,
              });
            }
          } catch {}
        } else if (['bkash', 'nagad', 'rocket', 'upay', 'mfs'].includes(refundMethod)) {
          try {
            const mfsAccount = this.mfsAccountRepo.findByBusiness(input.businessId)[0];
            if (mfsAccount) {
              this.mfsTxRepo.create({
                businessId: input.businessId,
                mfsAccountId: mfsAccount.id,
                transactionType: 'sale_return_refund',
                amountPaisa: totalReturnPaisa,
                netAmountPaisa: -totalReturnPaisa,
                notes: `বিক্রয় ফেরত রিফান্ড: ${returnNumber}`,
                createdBy: input.createdBy,
                customerId: saleData.customerId || null,
              } as any);
            }
          } catch {}
        }
      }

      // Update sale status to partially_returned or refunded based on total returned
      const totalReturnedAfter = processedReturnItems.reduce((sum, i) => sum + i.baseQuantityMilli, 0);
      const totalSold = saleItems.reduce((sum, i) => sum + i.baseQuantityMilli, 0);
      // Need to calculate total returned including previous
      let totalReturnedAll = 0;
      for (const si of saleItems) {
        totalReturnedAll += this.saleReturnItemRepo.getReturnedQuantityForSale(si.productId, input.saleId);
      }
      // totalReturnedAll already includes current because we just inserted
      let newStatus: SaleStatus = saleData.status as SaleStatus;
      if (totalReturnedAll >= totalSold) {
        newStatus = 'refunded';
      } else if (totalReturnedAll > 0) {
        newStatus = 'partially_returned';
      }
      if (newStatus !== saleData.status) {
        this.saleRepo.update(input.saleId, { status: newStatus } as any);
      }

      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'return',
        entityType: 'sale_return',
        entityId: saleReturn.id,
        newValues: JSON.stringify({ returnNumber, total: totalReturnPaisa, saleId: input.saleId }),
      });

      return { return: saleReturn, items: processedReturnItems };
    });

    return transaction();
  }
}
