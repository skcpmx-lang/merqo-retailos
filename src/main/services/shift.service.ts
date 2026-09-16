/**
 * Shift Service — production cash drawer
 * Open -> transactions during shift -> close with expected vs actual
 * No double close, no editing closed shift, no deletion
 */

import { ShiftRepository, CashMovementRepository, CashAccountRepository } from '../db/repositories/finance.repository';
import { SaleRepository } from '../db/repositories/sale.repository';
import { AuditService } from './audit.service';

export interface OpenShiftInput {
  businessId: string;
  cashAccountId: string;
  openingCashPaisa: number;
  openedByUserId: string;
  notes?: string;
}

export interface CloseShiftInput {
  shiftId: string;
  actualCashPaisa: number;
  closedByUserId: string;
  notes?: string;
}

export class ShiftService {
  private shiftRepo: ShiftRepository;
  private cashMovementRepo: CashMovementRepository;
  private cashAccountRepo: CashAccountRepository;
  private saleRepo: SaleRepository;
  private auditService: AuditService;

  constructor(db?: any) {
    this.shiftRepo = new ShiftRepository(db);
    this.cashMovementRepo = new CashMovementRepository(db);
    this.cashAccountRepo = new CashAccountRepository(db);
    this.saleRepo = new SaleRepository(db);
    this.auditService = new AuditService(db);
  }

  open(input: OpenShiftInput) {
    if (input.openingCashPaisa < 0) throw new Error('ওপেনিং ক্যাশ ঋণাত্মক হতে পারে না');
    if (!Number.isInteger(input.openingCashPaisa)) throw new Error('টাকার পরিমাণ পয়সায় পূর্ণসংখ্যা হতে হবে');

    const existingOpen = this.shiftRepo.findOpenByBusiness(input.businessId);
    if (existingOpen) throw new Error('একটি শিফট ইতিমধ্যে খোলা আছে। নতুন শিফট খোলার আগে বর্তমান শিফট বন্ধ করুন');

    const cashAcc = this.cashAccountRepo.findById(input.cashAccountId);
    if (!cashAcc) throw new Error('নগদ হিসাব পাওয়া যায়নি');

    const db = (this.shiftRepo as any).db;
    const tx = db.transaction(() => {
      const shiftNumber = this.shiftRepo.getNextShiftNumber(input.businessId);
      const shift = this.shiftRepo.create({
        businessId: input.businessId,
        shiftNumber,
        cashAccountId: input.cashAccountId,
        openedByUserId: input.openedByUserId,
        openedAt: Date.now(),
        openingCashPaisa: input.openingCashPaisa,
        notes: input.notes || null,
      });

      this.auditService.log({
        businessId: input.businessId,
        userId: input.openedByUserId,
        action: 'open',
        entityType: 'shift',
        entityId: shift.id,
        newValues: JSON.stringify({ shiftNumber, opening: input.openingCashPaisa }),
      });

      return shift;
    });

    return tx();
  }

  getCurrent(businessId: string) {
    return this.shiftRepo.findOpenByBusiness(businessId);
  }

  list(businessId: string, limit = 50, offset = 0) {
    return this.shiftRepo.findByBusiness(businessId, limit, offset);
  }

  getById(id: string) {
    const shift = this.shiftRepo.findById(id);
    if (!shift) throw new Error('শিফট পাওয়া যায়নি');
    return shift;
  }

  // Calculate expected cash: opening + inflows - outflows during shift
  calculateExpected(shiftId: string) {
    const shift = this.shiftRepo.findById(shiftId);
    if (!shift) throw new Error('শিফট পাওয়া যায়নি');

    const db = (this.shiftRepo as any).db;

    // All cash movements for this cash account during shift period
    const from = shift.openedAt;
    const to = shift.closedAt || Date.now();

    const movements = db.prepare(`
      SELECT movement_type, amount_paisa FROM cash_movements
      WHERE cash_account_id = ? AND created_at >= ? AND created_at <= ?
      ORDER BY created_at ASC, rowid ASC
    `).all(shift.cashAccountId, from, to) as { movement_type: string; amount_paisa: number }[];

    let inflows = 0;
    let outflows = 0;
    let salesCash = 0;
    let expenses = 0;
    let collections = 0;
    let supplierPayments = 0;
    let refunds = 0;
    let transfersIn = 0;
    let transfersOut = 0;

    for (const m of movements) {
      const amt = m.amount_paisa;
      if (amt > 0) inflows += amt;
      else outflows += Math.abs(amt);

      // Categorize
      if (m.movement_type === 'sale' || m.movement_type === 'sale_cash') salesCash += amt > 0 ? amt : 0;
      if (m.movement_type === 'expense') expenses += Math.abs(amt);
      if (m.movement_type === 'customer_payment' || m.movement_type === 'customer_collection') collections += amt > 0 ? amt : 0;
      if (m.movement_type === 'supplier_payment' || m.movement_type === 'purchase_payment') supplierPayments += Math.abs(amt);
      if (m.movement_type.includes('return') || m.movement_type.includes('refund') || m.movement_type === 'sale_cancel') refunds += Math.abs(amt);
      if (m.movement_type === 'transfer_in') transfersIn += amt;
      if (m.movement_type === 'transfer_out') transfersOut += Math.abs(amt);
      if (m.movement_type === 'mfs_cash_in') {
        // cash outflow for MFS top-up
        // already counted in outflows
      }
      if (m.movement_type === 'mfs_cash_out') {
        // cash inflow from MFS
      }
    }

    const expected = shift.openingCashPaisa + inflows - outflows;

    return {
      shift,
      opening: shift.openingCashPaisa,
      inflows,
      outflows,
      expected,
      breakdown: {
        salesCash,
        collections,
        supplierPayments,
        expenses,
        refunds,
        transfersIn,
        transfersOut,
      }
    };
  }

  close(input: CloseShiftInput) {
    if (!Number.isInteger(input.actualCashPaisa)) throw new Error('টাকার পরিমাণ পয়সায় পূর্ণসংখ্যা হতে হবে');
    if (input.actualCashPaisa < 0) throw new Error('গণনা করা নগদ ঋণাত্মক হতে পারে না');

    const shift = this.shiftRepo.findById(input.shiftId);
    if (!shift) throw new Error('শিফট পাওয়া যায়নি');
    if (shift.status === 'closed') throw new Error('শিফট ইতিমধ্যে বন্ধ করা হয়েছে');

    const db = (this.shiftRepo as any).db;
    const tx = db.transaction(() => {
      const calc = this.calculateExpected(input.shiftId);
      const expected = calc.expected;

      const closed = this.shiftRepo.close(input.shiftId, expected, input.actualCashPaisa, input.closedByUserId, input.notes);

      // If variance material, record adjustment? For V1, we just audit variance, not auto-adjust
      if (Math.abs(expected - input.actualCashPaisa) > 0) {
        // Variance recorded in shift variance_paisa, reason required if material
        const variance = input.actualCashPaisa - expected;
        if (Math.abs(variance) > 10000) { // >100 BDT material
          if (!input.notes || input.notes.trim().length === 0) {
            throw new Error('বড় ঘাটতি/অতিরিক্তের জন্য কারণ লিখতে হবে');
          }
        }
      }

      this.auditService.log({
        businessId: shift.businessId,
        userId: input.closedByUserId,
        action: 'close',
        entityType: 'shift',
        entityId: shift.id,
        newValues: JSON.stringify({ expected, actual: input.actualCashPaisa, variance: input.actualCashPaisa - expected }),
      });

      return closed;
    });

    return tx();
  }

  getReconciliation(shiftId: string) {
    const calc = this.calculateExpected(shiftId);
    const shift = calc.shift;
    return {
      shiftNumber: shift.shiftNumber,
      status: shift.status,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openingCashPaisa: shift.openingCashPaisa,
      expectedCashPaisa: calc.expected,
      actualCashPaisa: shift.actualCashPaisa,
      variancePaisa: shift.actualCashPaisa !== null && shift.actualCashPaisa !== undefined ? shift.actualCashPaisa - calc.expected : null,
      breakdown: calc.breakdown,
      inflows: calc.inflows,
      outflows: calc.outflows,
    };
  }
}
