/**
 * Purchase Application Service — full workflow: create, receive, pay, return, cancel
 * Atomic transactions across inventory, WAC, supplier ledger, audit
 */

import { PurchaseRepository, PurchaseItemRepository, PurchasePaymentRepository, PurchaseReturnRepository, PurchaseReturnItemRepository } from '../db/repositories/purchase.repository';
import { SupplierRepository, SupplierTransactionRepository } from '../db/repositories/supplier.repository';
import { ProductRepository } from '../db/repositories/product.repository';
import { UnitRepository, UnitConversionRepository } from '../db/repositories/unit.repository';
import { StockLevelRepository, StockMovementRepository } from '../db/repositories/inventory.repository';
import { ProductCostHistoryRepository } from '../db/repositories/product.repository';
import { CashAccountRepository, CashMovementRepository, BankTransactionRepository, MfsTransactionRepository } from '../db/repositories/finance.repository';
import { PurchaseValidationService } from '@core/domain/services/purchase-validation.service';
import { UnitConversionService } from '@core/domain/services/unit-conversion.service';
import { InventoryDomainService } from '@core/domain/services/inventory.service';
import { FinancialLedgerService } from '@core/domain/services/financial-ledger.service';
import { PurchaseStateMachine } from '@core/domain/services/purchase-state-machine';
import { AuditService } from './audit.service';

export interface PurchaseItemInput {
  productId: string;
  unitId: string;
  quantityMilli: number;
  costPerUnitPaisa: number;
  discountPaisa?: number;
  taxPaisa?: number;
}

export interface CreatePurchaseInput {
  businessId: string;
  supplierId: string;
  purchaseDate?: number;
  items: PurchaseItemInput[];
  discountPaisa?: number;
  taxPaisa?: number;
  shippingPaisa?: number;
  paidPaisa?: number;
  payments?: { method: string; amountPaisa: number; cashAccountId?: string; bankAccountId?: string; mfsAccountId?: string; chequeNumber?: string; cardLast4?: string }[];
  notes?: string;
  createdBy?: string;
}

export interface PurchaseReturnInput {
  businessId: string;
  purchaseId: string;
  items: { productId: string; unitId?: string; quantityMilli: number; costPaisa?: number; reason?: string }[];
  reason?: string;
  notes?: string;
  refundMethod?: string;
  createdBy?: string;
}

export class PurchaseService {
  private purchaseRepo: PurchaseRepository;
  private purchaseItemRepo: PurchaseItemRepository;
  private purchasePaymentRepo: PurchasePaymentRepository;
  private purchaseReturnRepo: PurchaseReturnRepository;
  private purchaseReturnItemRepo: PurchaseReturnItemRepository;
  private supplierRepo: SupplierRepository;
  private supplierTxRepo: SupplierTransactionRepository;
  private productRepo: ProductRepository;
  private unitRepo: UnitRepository;
  private unitConversionRepo: UnitConversionRepository;
  private stockLevelRepo: StockLevelRepository;
  private stockMovementRepo: StockMovementRepository;
  private costHistoryRepo: ProductCostHistoryRepository;

  private validationService = new PurchaseValidationService();
  private unitConversionService = new UnitConversionService();
  private inventoryService = new InventoryDomainService();
  private ledgerService = new FinancialLedgerService();
  private stateMachine = new PurchaseStateMachine();
  private auditService: AuditService;

  constructor(db?: any) {
    this.purchaseRepo = new PurchaseRepository(db);
    this.purchaseItemRepo = new PurchaseItemRepository(db);
    this.purchasePaymentRepo = new PurchasePaymentRepository(db);
    this.purchaseReturnRepo = new PurchaseReturnRepository(db);
    this.purchaseReturnItemRepo = new PurchaseReturnItemRepository(db);
    this.supplierRepo = new SupplierRepository(db);
    this.supplierTxRepo = new SupplierTransactionRepository(db);
    this.productRepo = new ProductRepository(db);
    this.unitRepo = new UnitRepository(db);
    this.unitConversionRepo = new UnitConversionRepository(db);
    this.stockLevelRepo = new StockLevelRepository(db);
    this.stockMovementRepo = new StockMovementRepository(db);
    this.costHistoryRepo = new ProductCostHistoryRepository(db);
    this.auditService = new AuditService(db);
  }

  /**
   * Create and receive purchase atomically
   * Updates inventory, WAC, supplier ledger
   */
  create(input: CreatePurchaseInput) {
    this.validationService.validate({
      businessId: input.businessId,
      supplierId: input.supplierId,
      items: input.items.map(i => ({
        productId: i.productId,
        unitId: i.unitId,
        quantityMilli: i.quantityMilli,
        costPerUnitPaisa: i.costPerUnitPaisa,
        discountPaisa: i.discountPaisa,
        taxPaisa: i.taxPaisa,
      })),
      discountPaisa: input.discountPaisa,
      taxPaisa: input.taxPaisa,
      shippingPaisa: input.shippingPaisa,
      paidPaisa: input.paidPaisa,
    });

    const supplier = this.supplierRepo.findById(input.supplierId);
    if (!supplier) throw new Error('সাপ্লায়ার পাওয়া যায়নি');
    if (!supplier.isActive) throw new Error('নিষ্ক্রিয় সাপ্লায়ারের জন্য ক্রয় করা যাবে না');

    const db = (this.purchaseRepo as any).db;

    const transaction = db.transaction(() => {
      // Calculate totals
      let subtotalPaisa = 0;
      const processedItems: {
        productId: string;
        unitId: string;
        quantityMilli: number;
        baseQuantityMilli: number;
        costPerUnitPaisa: number;
        baseCostPerUnitPaisa: number;
        discountPaisa: number;
        taxPaisa: number;
        lineTotalPaisa: number;
        product: any;
      }[] = [];

      // Load conversions once for business
      const conversions = this.unitConversionRepo.findByBusiness(input.businessId);

      for (const item of input.items) {
        const product = this.productRepo.findById(item.productId);
        if (!product) throw new Error(`পণ্য পাওয়া যায়নি: ${item.productId}`);
        if (!product.isActive) throw new Error(`পণ্য নিষ্ক্রিয়: ${product.name}`);
        if (!product.isPurchasable) throw new Error(`পণ্যটি ক্রয়যোগ্য নয়: ${product.name}`);

        const unit = this.unitRepo.findById(item.unitId);
        if (!unit) throw new Error(`ইউনিট পাওয়া যায়নি: ${item.unitId}`);

        // Convert quantity to base unit milli
        let baseQuantityMilli: number;
        if (item.unitId === product.baseUnitId) {
          baseQuantityMilli = item.quantityMilli;
        } else {
          // Use conversion service
          try {
            baseQuantityMilli = this.unitConversionService.convert(item.quantityMilli, item.unitId, product.baseUnitId, conversions);
          } catch (e) {
            throw new Error(`ইউনিট রূপান্তর ব্যর্থ: ${product.name} (${String(e)})`);
          }
        }

        // Convert cost per unit to base cost per unit
        // costPerUnit is for the given unit, need base cost
        // Example: 1 carton = 24 pcs, cost 2400 BDT per carton => base cost 100 BDT per piece
        // So baseCost = costPerUnit / conversion_factor
        // We have baseQuantity = quantity * factor, so to get base cost: costPerUnit / factor
        // But easier: line total / base quantity
        const quantityInUnit = item.quantityMilli / 1000; // e.g., 5 cartons
        const lineTotalBeforeDiscount = quantityInUnit * (item.costPerUnitPaisa / 1); // costPerUnitPaisa is per unit, not per milli? Actually cost per unit paisa is per 1 unit (not per milli)
        // Let's define: costPerUnitPaisa is per 1 unit (e.g., per carton). So line total = qty_in_units * cost_per_unit
        // But we store quantityMilli, so qty_in_units = quantityMilli/1000
        const qtyUnits = item.quantityMilli / 1000;
        const itemSubtotal = Math.round(qtyUnits * item.costPerUnitPaisa);
        const discount = item.discountPaisa || 0;
        const tax = item.taxPaisa || 0;
        const lineTotal = itemSubtotal - discount + tax;

        // Base cost per base unit (per 1 base unit, e.g., per piece)
        // baseQuantityMilli /1000 = base qty in units, lineTotal / baseQty = base cost per unit
        const baseQtyUnits = baseQuantityMilli / 1000;
        const baseCostPerUnit = baseQtyUnits > 0 ? Math.round(lineTotal / baseQtyUnits) : item.costPerUnitPaisa;

        subtotalPaisa += lineTotal;

        processedItems.push({
          productId: item.productId,
          unitId: item.unitId,
          quantityMilli: item.quantityMilli,
          baseQuantityMilli,
          costPerUnitPaisa: item.costPerUnitPaisa,
          baseCostPerUnitPaisa: baseCostPerUnit,
          discountPaisa: discount,
          taxPaisa: tax,
          lineTotalPaisa: lineTotal,
          product,
        });
      }

      const discountPaisa = input.discountPaisa || 0;
      const taxPaisa = input.taxPaisa || 0;
      const shippingPaisa = input.shippingPaisa || 0;
      const totalPaisa = subtotalPaisa - discountPaisa + taxPaisa + shippingPaisa;

      if (totalPaisa < 0) throw new Error('মোট টাকা ঋণাত্মক হতে পারে না');

      let paidPaisa = input.paidPaisa || 0;
      // If split payments provided, sum them
      if (input.payments && input.payments.length > 0) {
        const paymentsSum = input.payments.reduce((sum, p) => sum + p.amountPaisa, 0);
        if (paidPaisa === 0) paidPaisa = paymentsSum;
        else if (paidPaisa !== paymentsSum) {
          throw new Error('পরিশোধিত টাকা এবং পেমেন্ট পদ্ধতির যোগফল মিলছে না');
        }
      }

      if (paidPaisa > totalPaisa) throw new Error('পরিশোধিত টাকা মোট টাকার চেয়ে বেশি হতে পারে না');

      const duePaisa = totalPaisa - paidPaisa;
      const isPaid = duePaisa === 0;

      // Determine status
      let status: 'draft' | 'received' | 'partially_paid' | 'paid' | 'cancelled' = 'received';
      if (duePaisa === 0) status = 'paid';
      else if (paidPaisa > 0) status = 'partially_paid';
      else status = 'received';

      const purchaseNumber = this.purchaseRepo.getNextPurchaseNumber(input.businessId);

      // Create purchase header
      const purchase = this.purchaseRepo.create({
        businessId: input.businessId,
        supplierId: input.supplierId,
        purchaseNumber,
        purchaseDate: input.purchaseDate || this.purchaseRepo['now'](),
        status,
        subtotalPaisa,
        discountPaisa,
        taxPaisa,
        shippingPaisa,
        totalPaisa,
        paidPaisa,
        duePaisa,
        notes: input.notes || null,
        isPaid,
        createdBy: input.createdBy || null,
      });

      // Create purchase items + update inventory
      for (const pItem of processedItems) {
        this.purchaseItemRepo.create({
          purchaseId: purchase.id,
          productId: pItem.productId,
          unitId: pItem.unitId,
          quantityMilli: pItem.quantityMilli,
          baseQuantityMilli: pItem.baseQuantityMilli,
          costPerUnitPaisa: pItem.costPerUnitPaisa,
          baseCostPerUnitPaisa: pItem.baseCostPerUnitPaisa,
          discountPaisa: pItem.discountPaisa,
          taxPaisa: pItem.taxPaisa,
          lineTotalPaisa: pItem.lineTotalPaisa,
        });

        // Inventory update — WAC
        const currentLevel = this.stockLevelRepo.findByProductAndLocation(pItem.productId, 'main');
        const currentStockMilli = currentLevel?.quantityMilli ?? 0;
        const currentWac = pItem.product.costPricePaisa;

        const newWac = this.inventoryService.calculateNewWAC(
          currentStockMilli,
          currentWac,
          pItem.baseQuantityMilli,
          pItem.baseCostPerUnitPaisa
        );

        // Stock movement
        const movement = this.inventoryService.buildPurchaseMovement(
          input.businessId,
          pItem.productId,
          pItem.baseQuantityMilli,
          pItem.baseCostPerUnitPaisa,
          purchase.id,
          input.createdBy
        );
        this.stockMovementRepo.create(movement);

        // Upsert stock level
        const newQty = currentStockMilli + pItem.baseQuantityMilli;
        this.stockLevelRepo.upsert({
          businessId: input.businessId,
          productId: pItem.productId,
          locationId: 'main',
          quantityMilli: newQty,
          reservedMilli: currentLevel?.reservedMilli ?? 0,
          lastMovementAt: Date.now(),
        });

        // Update product WAC
        this.productRepo.update(pItem.productId, {
          costPricePaisa: newWac,
          updatedBy: input.createdBy || null,
        } as any);

        // Cost history
        this.costHistoryRepo.create({
          productId: pItem.productId,
          purchaseId: purchase.id,
          oldCostPaisa: currentWac,
          newCostPaisa: pItem.baseCostPerUnitPaisa,
          oldWacPaisa: currentWac,
          newWacPaisa: newWac,
          reason: 'purchase',
          createdBy: input.createdBy || null,
        });
      }

      // Supplier ledger — purchase increases payable
      const supplierTx = this.ledgerService.buildSupplierTransaction(
        input.businessId,
        input.supplierId,
        'purchase',
        totalPaisa,
        'purchase',
        purchase.id,
        `ক্রয়: ${purchaseNumber}`,
        input.createdBy
      );
      this.supplierTxRepo.create(supplierTx);

      // Update supplier current payable (materialized)
      const newPayable = this.supplierTxRepo.getCurrentPayable(input.supplierId);
      this.supplierRepo.update(input.supplierId, {
        currentPayablePaisa: newPayable,
      } as any);

      // Purchase payments — split
      if (paidPaisa > 0) {
        if (input.payments && input.payments.length > 0) {
          for (const pay of input.payments) {
            const paymentNumber = this.purchasePaymentRepo.getNextPaymentNumber(input.businessId);
            this.purchasePaymentRepo.create({
              businessId: input.businessId,
              supplierId: input.supplierId,
              purchaseId: purchase.id,
              paymentNumber,
              paymentDate: input.purchaseDate || Date.now(),
              amountPaisa: pay.amountPaisa,
              paymentMethod: pay.method,
              cashAccountId: pay.cashAccountId || null,
              bankAccountId: pay.bankAccountId || null,
              mfsAccountId: pay.mfsAccountId || null,
              chequeNumber: pay.chequeNumber || null,
              cardLast4: pay.cardLast4 || null,
              notes: null,
              createdBy: input.createdBy || null,
            });

            // Supplier payment ledger — reduces payable
            const payTx = this.ledgerService.buildSupplierTransaction(
              input.businessId,
              input.supplierId,
              'payment',
              pay.amountPaisa,
              'purchase_payment',
              purchase.id,
              `পরিশোধ: ${paymentNumber} (${pay.method})`,
              input.createdBy
            );
            this.supplierTxRepo.create(payTx);
          }
        } else {
          // Single cash payment
          const paymentNumber = this.purchasePaymentRepo.getNextPaymentNumber(input.businessId);
          this.purchasePaymentRepo.create({
            businessId: input.businessId,
            supplierId: input.supplierId,
            purchaseId: purchase.id,
            paymentNumber,
            paymentDate: input.purchaseDate || Date.now(),
            amountPaisa: paidPaisa,
            paymentMethod: 'cash',
            notes: null,
            createdBy: input.createdBy || null,
          });

          const payTx = this.ledgerService.buildSupplierTransaction(
            input.businessId,
            input.supplierId,
            'payment',
            paidPaisa,
            'purchase_payment',
            purchase.id,
            `পরিশোধ: ${paymentNumber}`,
            input.createdBy
          );
          this.supplierTxRepo.create(payTx);
        }

        // Update payable after payments
        const payableAfterPayments = this.supplierTxRepo.getCurrentPayable(input.supplierId);
        this.supplierRepo.update(input.supplierId, {
          currentPayablePaisa: payableAfterPayments,
        } as any);
      }

      // Audit
      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'create',
        entityType: 'purchase',
        entityId: purchase.id,
        newValues: JSON.stringify({ purchaseNumber, total: totalPaisa, paid: paidPaisa, due: duePaisa, items: processedItems.length }),
      });

      return purchase;
    });

    return transaction();
  }

  findById(id: string) {
    const purchase = this.purchaseRepo.findById(id);
    if (!purchase) return null;
    const items = this.purchaseItemRepo.findByPurchase(id);
    const payments = this.purchasePaymentRepo.findByPurchase(id);
    const returns = this.purchaseReturnRepo.findByPurchase(id);
    return { purchase, items, payments, returns };
  }

  findByBusiness(businessId: string, filters?: any, limit = 50, offset = 0) {
    return this.purchaseRepo.findByBusiness(businessId, filters, limit, offset);
  }

  /**
   * Supplier payment (without purchase link — advance or due payment)
   * Now also creates financial movement (cash/bank/mfs) atomically
   */
  paySupplier(input: {
    businessId: string;
    supplierId: string;
    amountPaisa: number;
    method: string;
    cashAccountId?: string;
    bankAccountId?: string;
    mfsAccountId?: string;
    chequeNumber?: string;
    notes?: string;
    createdBy?: string;
  }) {
    if (input.amountPaisa <= 0) throw new Error('পরিমাণ ০ এর বেশি হতে হবে');

    const supplier = this.supplierRepo.findById(input.supplierId);
    if (!supplier) throw new Error('সাপ্লায়ার পাওয়া যায়নি');

    const db = (this.purchaseRepo as any).db;
    const transaction = db.transaction(() => {
      const cashMovementRepo = new CashMovementRepository(db);
      const bankTxRepo = new BankTransactionRepository(db);
      const mfsTxRepo = new MfsTransactionRepository(db);

      const paymentNumber = this.purchasePaymentRepo.getNextPaymentNumber(input.businessId);

      const payment = this.purchasePaymentRepo.create({
        businessId: input.businessId,
        supplierId: input.supplierId,
        purchaseId: null,
        paymentNumber,
        paymentDate: Date.now(),
        amountPaisa: input.amountPaisa,
        paymentMethod: input.method,
        cashAccountId: input.cashAccountId || null,
        bankAccountId: input.bankAccountId || null,
        mfsAccountId: input.mfsAccountId || null,
        chequeNumber: input.chequeNumber || null,
        notes: input.notes || null,
        createdBy: input.createdBy || null,
      });

      const tx = this.ledgerService.buildSupplierTransaction(
        input.businessId,
        input.supplierId,
        'payment',
        input.amountPaisa,
        'supplier_payment',
        payment.id,
        `সাপ্লায়ার পরিশোধ: ${paymentNumber}`,
        input.createdBy
      );
      this.supplierTxRepo.create(tx);

      const newPayable = this.supplierTxRepo.getCurrentPayable(input.supplierId);
      this.supplierRepo.update(input.supplierId, { currentPayablePaisa: newPayable } as any);

      // Financial movements — supplier payment is outflow
      const methodLower = input.method.toLowerCase();
      if (methodLower === 'cash') {
        const cashAccountId = input.cashAccountId || this.getDefaultCashAccountId(db, input.businessId);
        if (cashAccountId) {
          cashMovementRepo.create({
            businessId: input.businessId,
            cashAccountId,
            movementType: 'supplier_payment',
            amountPaisa: -input.amountPaisa,
            referenceType: 'supplier_payment',
            referenceId: payment.id,
            notes: input.notes || `সাপ্লায়ার পরিশোধ: ${supplier.name}`,
            createdBy: input.createdBy,
          });
        }
      } else if (['bank', 'card', 'cheque'].includes(methodLower)) {
        if (input.bankAccountId) {
          bankTxRepo.create({
            businessId: input.businessId,
            bankAccountId: input.bankAccountId,
            transactionType: 'supplier_payment',
            amountPaisa: -input.amountPaisa,
            referenceType: 'supplier_payment',
            referenceId: payment.id,
            chequeNumber: input.chequeNumber || null,
            notes: input.notes || `সাপ্লায়ার পরিশোধ: ${supplier.name}`,
            createdBy: input.createdBy,
          });
        }
      } else if (['bkash', 'nagad', 'rocket', 'upay', 'mfs'].includes(methodLower)) {
        if (input.mfsAccountId) {
          mfsTxRepo.create({
            businessId: input.businessId,
            mfsAccountId: input.mfsAccountId,
            transactionType: 'supplier_payment',
            amountPaisa: input.amountPaisa,
            customerChargePaisa: 0,
            commissionPaisa: 0,
            netAmountPaisa: -input.amountPaisa,
            notes: input.notes || `সাপ্লায়ার পরিশোধ: ${supplier.name}`,
            createdBy: input.createdBy,
          } as any);
        }
      }

      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'payment',
        entityType: 'supplier',
        entityId: input.supplierId,
        newValues: JSON.stringify({ amount: input.amountPaisa, method: input.method, payable: newPayable }),
      });

      return { payment, newPayable };
    });

    return transaction();
  }

  private getDefaultCashAccountId(db: any, businessId: string): string | null {
    try {
      const row = db.prepare('SELECT id FROM cash_accounts WHERE business_id = ? AND is_active = 1 ORDER BY is_default DESC LIMIT 1').get(businessId) as { id: string } | undefined;
      return row?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Purchase return — full or partial
   */
  createReturn(input: PurchaseReturnInput) {
    const purchaseData = this.purchaseRepo.findById(input.purchaseId);
    if (!purchaseData) throw new Error('ক্রয় পাওয়া যায়নি');
    if (purchaseData.status === 'cancelled') throw new Error('বাতিল ক্রয় ফেরত দেওয়া যাবে না');

    const supplier = this.supplierRepo.findById(purchaseData.supplierId);
    if (!supplier) throw new Error('সাপ্লায়ার পাওয়া যায়নি');

    const purchaseItems = this.purchaseItemRepo.findByPurchase(input.purchaseId);

    const db = (this.purchaseRepo as any).db;
    const transaction = db.transaction(() => {
      let totalReturnPaisa = 0;
      const processedReturnItems: { productId: string; unitId?: string; quantityMilli: number; baseQuantityMilli: number; costPaisa: number; lineTotal: number }[] = [];

      const conversions = this.unitConversionRepo.findByBusiness(input.businessId);

      for (const retItem of input.items) {
        const purchaseItem = purchaseItems.find(pi => pi.productId === retItem.productId);
        if (!purchaseItem) throw new Error(`ক্রয়ে পণ্য নেই: ${retItem.productId}`);

        // Check already returned quantity
        const alreadyReturned = this.purchaseReturnItemRepo.getReturnedQuantityForPurchase(retItem.productId, input.purchaseId);
        const eligibleMilli = purchaseItem.baseQuantityMilli - alreadyReturned;

        if (eligibleMilli <= 0) throw new Error(`পণ্যটির ফেরতযোগ্য পরিমাণ শেষ: ${purchaseItem.productId}`);

        // Convert return quantity to base if needed
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

        // Validate return quantity
        if (baseQtyMilli <= 0) throw new Error('ফেরত পরিমাণ ০ এর বেশি হতে হবে');
        if (baseQtyMilli > eligibleMilli) {
          throw new Error(`ফেরত পরিমাণ বেশি: সর্বোচ্চ ${eligibleMilli / 1000}`);
        }

        // Check stock availability for deduction
        const currentLevel = this.stockLevelRepo.findByProductAndLocation(retItem.productId, 'main');
        const currentStock = currentLevel?.quantityMilli ?? 0;
        if (currentStock < baseQtyMilli) {
          throw new Error(`স্টকে পর্যাপ্ত পণ্য নেই ফেরতের জন্য: বর্তমান ${currentStock / 1000}, প্রয়োজন ${baseQtyMilli / 1000}`);
        }

        const costPaisa = retItem.costPaisa || purchaseItem.baseCostPerUnitPaisa;
        const lineTotal = Math.round((baseQtyMilli / 1000) * costPaisa);

        totalReturnPaisa += lineTotal;

        processedReturnItems.push({
          productId: retItem.productId,
          unitId: retItem.unitId,
          quantityMilli: retItem.quantityMilli,
          baseQuantityMilli: baseQtyMilli,
          costPaisa,
          lineTotal,
        });
      }

      const returnNumber = this.purchaseReturnRepo.getNextReturnNumber(input.businessId);

      const purchaseReturn = this.purchaseReturnRepo.create({
        businessId: input.businessId,
        purchaseId: input.purchaseId,
        supplierId: purchaseData.supplierId,
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

      // Create return items + inventory deduction
      for (const retItem of processedReturnItems) {
        this.purchaseReturnItemRepo.create({
          returnId: purchaseReturn.id,
          productId: retItem.productId,
          unitId: retItem.unitId || null,
          quantityMilli: retItem.quantityMilli,
          baseQuantityMilli: retItem.baseQuantityMilli,
          costPaisa: retItem.costPaisa,
          lineTotalPaisa: retItem.lineTotal,
        });

        // Inventory deduction — purchase_return movement negative
        const movement = {
          businessId: input.businessId,
          productId: retItem.productId,
          movementType: 'purchase_return',
          quantityMilli: -Math.abs(retItem.baseQuantityMilli),
          costPaisa: retItem.costPaisa,
          referenceType: 'purchase_return',
          referenceId: purchaseReturn.id,
          notes: `ক্রয় ফেরত: ${returnNumber}`,
          locationId: 'main',
          createdBy: input.createdBy,
        };
        this.stockMovementRepo.create(movement as any);

        const currentLevel = this.stockLevelRepo.findByProductAndLocation(retItem.productId, 'main');
        const newQty = (currentLevel?.quantityMilli ?? 0) - retItem.baseQuantityMilli;
        this.stockLevelRepo.upsert({
          businessId: input.businessId,
          productId: retItem.productId,
          locationId: 'main',
          quantityMilli: newQty,
          reservedMilli: currentLevel?.reservedMilli ?? 0,
          lastMovementAt: Date.now(),
        });
      }

      // Supplier ledger — return reduces payable
      const returnTx = this.ledgerService.buildSupplierTransaction(
        input.businessId,
        purchaseData.supplierId,
        'return',
        totalReturnPaisa,
        'purchase_return',
        purchaseReturn.id,
        `ক্রয় ফেরত: ${returnNumber}`,
        input.createdBy
      );
      this.supplierTxRepo.create(returnTx);

      const newPayable = this.supplierTxRepo.getCurrentPayable(purchaseData.supplierId);
      this.supplierRepo.update(purchaseData.supplierId, { currentPayablePaisa: newPayable } as any);

      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'return',
        entityType: 'purchase_return',
        entityId: purchaseReturn.id,
        newValues: JSON.stringify({ returnNumber, total: totalReturnPaisa, purchaseId: input.purchaseId }),
      });

      return { return: purchaseReturn, items: processedReturnItems, newPayable };
    });

    return transaction();
  }

  cancel(id: string, reason: string, userId?: string) {
    const existing = this.purchaseRepo.findById(id);
    if (!existing) throw new Error('ক্রয় পাওয়া যায়নি');
    if (existing.status === 'cancelled') throw new Error('ক্রয় ইতিমধ্যে বাতিল');
    if (existing.status === 'paid' || existing.status === 'partially_paid') {
      throw new Error('পরিশোধিত ক্রয় বাতিল করা যাবে না, ফেরত ব্যবহার করুন');
    }

    const db = (this.purchaseRepo as any).db;
    const transaction = db.transaction(() => {
      // Check if any returns exist
      const returns = this.purchaseReturnRepo.findByPurchase(id);
      if (returns.length > 0) throw new Error('ফেরত থাকা ক্রয় বাতিল করা যাবে না');

      // Reverse inventory — for each item, deduct stock that was added
      const items = this.purchaseItemRepo.findByPurchase(id);
      for (const item of items) {
        const currentLevel = this.stockLevelRepo.findByProductAndLocation(item.productId, 'main');
        const currentStock = currentLevel?.quantityMilli ?? 0;
        if (currentStock < item.baseQuantityMilli) {
          throw new Error(`স্টকে পর্যাপ্ত পণ্য নেই বাতিলের জন্য: ${item.productId}`);
        }

        this.stockMovementRepo.create({
          businessId: existing.businessId,
          productId: item.productId,
          movementType: 'purchase_return',
          quantityMilli: -item.baseQuantityMilli,
          costPaisa: item.baseCostPerUnitPaisa,
          referenceType: 'purchase_cancel',
          referenceId: id,
          notes: `ক্রয় বাতিল: ${existing.purchaseNumber}`,
          locationId: 'main',
          createdBy: userId,
        } as any);

        const newQty = currentStock - item.baseQuantityMilli;
        this.stockLevelRepo.upsert({
          businessId: existing.businessId,
          productId: item.productId,
          locationId: 'main',
          quantityMilli: newQty,
          reservedMilli: currentLevel?.reservedMilli ?? 0,
          lastMovementAt: Date.now(),
        });
      }

      // Reverse supplier ledger — create adjustment negative for purchase amount
      const cancelTx = this.ledgerService.buildSupplierTransaction(
        existing.businessId,
        existing.supplierId,
        'adjustment',
        -existing.totalPaisa,
        'purchase_cancel',
        id,
        `ক্রয় বাতিল: ${existing.purchaseNumber} - ${reason}`,
        userId
      );
      this.supplierTxRepo.create(cancelTx);

      const newPayable = this.supplierTxRepo.getCurrentPayable(existing.supplierId);
      this.supplierRepo.update(existing.supplierId, { currentPayablePaisa: newPayable } as any);

      this.purchaseRepo.void(id, reason, userId);

      this.auditService.log({
        businessId: existing.businessId,
        userId: userId || null,
        action: 'cancel',
        entityType: 'purchase',
        entityId: id,
        newValues: JSON.stringify({ reason, purchaseNumber: existing.purchaseNumber }),
      });
    });

    return transaction();
  }
}
