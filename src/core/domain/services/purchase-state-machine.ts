/**
 * Purchase State Machine — documents and enforces legal transitions
 */

export type PurchaseStatus = 'draft' | 'received' | 'partially_paid' | 'paid' | 'cancelled';

export const PURCHASE_STATUS_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  draft: ['received', 'cancelled'],
  received: ['partially_paid', 'paid', 'cancelled'],
  partially_paid: ['paid', 'cancelled'],
  paid: [], // terminal, cannot transition except via return
  cancelled: [], // terminal
};

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, { en: string; bn: string }> = {
  draft: { en: 'Draft', bn: 'খসড়া' },
  received: { en: 'Received', bn: 'গ্রহণ করা হয়েছে' },
  partially_paid: { en: 'Partially Paid', bn: 'আংশিক পরিশোধিত' },
  paid: { en: 'Paid', bn: 'পরিশোধিত' },
  cancelled: { en: 'Cancelled', bn: 'বাতিল' },
};

export class PurchaseStateMachine {
  canTransition(from: PurchaseStatus, to: PurchaseStatus): boolean {
    const allowed = PURCHASE_STATUS_TRANSITIONS[from] || [];
    return allowed.includes(to);
  }

  assertTransition(from: PurchaseStatus, to: PurchaseStatus): void {
    if (!this.canTransition(from, to)) {
      const fromLabel = PURCHASE_STATUS_LABELS[from]?.bn || from;
      const toLabel = PURCHASE_STATUS_LABELS[to]?.bn || to;
      throw new Error(`অবৈধ অবস্থা পরিবর্তন: ${fromLabel} → ${toLabel}`);
    }
  }

  getNextStatusAfterPayment(totalPaisa: number, paidPaisa: number, currentStatus: PurchaseStatus): PurchaseStatus {
    if (currentStatus === 'cancelled' || currentStatus === 'draft') return currentStatus;
    if (paidPaisa <= 0) return 'received';
    if (paidPaisa >= totalPaisa) return 'paid';
    return 'partially_paid';
  }

  getStatusLabel(status: PurchaseStatus): { en: string; bn: string } {
    return PURCHASE_STATUS_LABELS[status] || { en: status, bn: status };
  }
}
