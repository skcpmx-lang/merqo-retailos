import { HeldSaleRepository } from '../db/repositories/held-sale.repository';
import { AuditService } from './audit.service';

export interface HoldSaleInput {
  businessId: string;
  customerId?: string | null;
  cart: any; // POS cart object
  notes?: string;
  createdBy?: string;
  expiresAt?: number;
}

export class HeldSaleService {
  private heldRepo: HeldSaleRepository;
  private auditService: AuditService;

  constructor(db?: any) {
    this.heldRepo = new HeldSaleRepository(db);
    this.auditService = new AuditService(db);
  }

  hold(input: HoldSaleInput) {
    if (!input.cart || !input.cart.items || input.cart.items.length === 0) {
      throw new Error('হোল্ড করার জন্য কার্টে পণ্য থাকতে হবে');
    }

    const db = (this.heldRepo as any).db;
    const transaction = db.transaction(() => {
      const heldNumber = this.heldRepo.getNextHeldNumber(input.businessId);
      const held = this.heldRepo.create({
        businessId: input.businessId,
        heldNumber,
        customerId: input.customerId || null,
        cartJson: JSON.stringify(input.cart),
        notes: input.notes || null,
        expiresAt: input.expiresAt || null,
        createdBy: input.createdBy || null,
      });

      this.auditService.log({
        businessId: input.businessId,
        userId: input.createdBy || null,
        action: 'hold',
        entityType: 'held_sale',
        entityId: held.id,
        newValues: JSON.stringify({ heldNumber, items: input.cart.items.length, total: input.cart.totalPaisa }),
      });

      return held;
    });

    return transaction();
  }

  list(businessId: string, limit = 50) {
    const held = this.heldRepo.findByBusiness(businessId, limit);
    return held.map(h => {
      let cart: any = {};
      try {
        cart = JSON.parse(h.cartJson);
      } catch {}
      return {
        ...h,
        cart,
        itemCount: cart.items?.length || 0,
        totalPaisa: cart.totalPaisa || 0,
      };
    });
  }

  getById(id: string) {
    const held = this.heldRepo.findById(id);
    if (!held) return null;
    let cart: any = {};
    try {
      cart = JSON.parse(held.cartJson);
    } catch {}
    return { ...held, cart };
  }

  resume(id: string) {
    const held = this.getById(id);
    if (!held) throw new Error('হোল্ড করা বিক্রয় পাওয়া যায়নি');
    // Return cart, but do NOT delete yet — caller will delete after successful resume or keep
    return held;
  }

  cancel(id: string, userId?: string) {
    const existing = this.heldRepo.findById(id);
    if (!existing) throw new Error('হোল্ড করা বিক্রয় পাওয়া যায়নি');

    this.heldRepo.delete(id);

    this.auditService.log({
      businessId: existing.businessId,
      userId: userId || null,
      action: 'cancel_hold',
      entityType: 'held_sale',
      entityId: id,
      newValues: JSON.stringify({ heldNumber: existing.heldNumber }),
    });

    return { success: true };
  }

  deleteAfterResume(id: string) {
    this.heldRepo.delete(id);
  }
}
