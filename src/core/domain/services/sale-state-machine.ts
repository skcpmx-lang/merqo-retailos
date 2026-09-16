export type SaleStatus = 'draft' | 'completed' | 'partially_paid' | 'paid' | 'cancelled' | 'voided' | 'partially_returned' | 'refunded';

export const SALE_STATUS_TRANSITIONS: Record<SaleStatus, SaleStatus[]> = {
  draft: ['completed', 'cancelled'],
  completed: ['partially_paid', 'paid', 'partially_returned', 'refunded', 'cancelled', 'voided'],
  partially_paid: ['paid', 'partially_returned', 'refunded', 'cancelled', 'voided'],
  paid: ['partially_returned', 'refunded', 'voided'],
  partially_returned: ['refunded', 'paid', 'partially_paid', 'voided'],
  refunded: ['voided'],
  cancelled: [],
  voided: [],
};

export const SALE_STATUS_LABELS: Record<SaleStatus, { bn: string; en: string }> = {
  draft: { bn: 'খসড়া', en: 'Draft' },
  completed: { bn: 'সম্পন্ন', en: 'Completed' },
  partially_paid: { bn: 'আংশিক পরিশোধিত', en: 'Partially Paid' },
  paid: { bn: 'পরিশোধিত', en: 'Paid' },
  partially_returned: { bn: 'আংশিক ফেরত', en: 'Partially Returned' },
  refunded: { bn: 'ফেরত', en: 'Refunded' },
  cancelled: { bn: 'বাতিল', en: 'Cancelled' },
  voided: { bn: 'বাতিল', en: 'Voided' },
};

export class SaleStateMachine {
  canTransition(from: SaleStatus, to: SaleStatus): boolean {
    const allowed = SALE_STATUS_TRANSITIONS[from] || [];
    return allowed.includes(to);
  }

  assertTransition(from: SaleStatus, to: SaleStatus): void {
    if (!this.canTransition(from, to)) {
      const fromLabel = SALE_STATUS_LABELS[from]?.bn || from;
      const toLabel = SALE_STATUS_LABELS[to]?.bn || to;
      throw new Error(`${fromLabel} থেকে ${toLabel} অবস্থায় পরিবর্তন করা যাবে না`);
    }
  }

  getNextStatusAfterPayment(totalPaisa: number, paidPaisa: number, currentStatus: SaleStatus): SaleStatus {
    if (paidPaisa === 0) return 'completed';
    if (paidPaisa >= totalPaisa) return 'paid';
    if (paidPaisa > 0 && paidPaisa < totalPaisa) return 'partially_paid';
    return currentStatus;
  }

  isTerminal(status: SaleStatus): boolean {
    return ['cancelled', 'voided', 'refunded'].includes(status);
  }

  isPaidStatus(status: SaleStatus): boolean {
    return ['paid'].includes(status);
  }
}
