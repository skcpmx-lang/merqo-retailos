import { ValidationError } from '../errors/AppError';

export interface PurchaseItemInput {
  productId: string;
  unitId: string;
  quantityMilli: number;
  costPerUnitPaisa: number;
  discountPaisa?: number;
  taxPaisa?: number;
}

export interface PurchaseInput {
  businessId: string;
  supplierId: string;
  purchaseDate?: number;
  items: PurchaseItemInput[];
  discountPaisa?: number;
  taxPaisa?: number;
  shippingPaisa?: number;
  paidPaisa?: number;
  notes?: string;
}

export class PurchaseValidationService {
  validate(input: PurchaseInput): void {
    const errors: string[] = [];

    if (!input.businessId) errors.push('ব্যবসা আইডি প্রয়োজন');
    if (!input.supplierId) errors.push('সাপ্লায়ার প্রয়োজন');

    if (!input.items || input.items.length === 0) {
      errors.push('কমপক্ষে একটি পণ্য প্রয়োজন');
    }

    if (input.items) {
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        if (!item.productId) errors.push(`আইটেম ${i + 1}: পণ্য প্রয়োজন`);
        if (!item.unitId) errors.push(`আইটেম ${i + 1}: ইউনিট প্রয়োজন`);
        if (item.quantityMilli === undefined || item.quantityMilli <= 0) errors.push(`আইটেম ${i + 1}: পরিমাণ ০ এর বেশি হতে হবে`);
        if (item.costPerUnitPaisa === undefined || item.costPerUnitPaisa < 0) errors.push(`আইটেম ${i + 1}: ক্রয় মূল্য ঋণাত্মক হতে পারে না`);
        if (item.discountPaisa !== undefined && item.discountPaisa < 0) errors.push(`আইটেম ${i + 1}: ডিসকাউন্ট ঋণাত্মক হতে পারে না`);
        if (item.taxPaisa !== undefined && item.taxPaisa < 0) errors.push(`আইটেম ${i + 1}: ট্যাক্স ঋণাত্মক হতে পারে না`);
      }
    }

    if (input.discountPaisa !== undefined && input.discountPaisa < 0) errors.push('ডিসকাউন্ট ঋণাত্মক হতে পারে না');
    if (input.taxPaisa !== undefined && input.taxPaisa < 0) errors.push('ট্যাক্স ঋণাত্মক হতে পারে না');
    if (input.shippingPaisa !== undefined && input.shippingPaisa < 0) errors.push('শিপিং খরচ ঋণাত্মক হতে পারে না');
    if (input.paidPaisa !== undefined && input.paidPaisa < 0) errors.push('পরিশোধিত টাকা ঋণাত্মক হতে পারে না');

    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '), errors.join(', '));
    }
  }

  validateItem(item: PurchaseItemInput): void {
    if (!item.productId) throw new ValidationError('পণ্য প্রয়োজন', 'পণ্য প্রয়োজন');
    if (!item.unitId) throw new ValidationError('ইউনিট প্রয়োজন', 'ইউনিট প্রয়োজন');
    if (item.quantityMilli <= 0) throw new ValidationError('পরিমাণ ০ এর বেশি হতে হবে', 'পরিমাণ ০ এর বেশি হতে হবে');
    if (item.costPerUnitPaisa < 0) throw new ValidationError('ক্রয় মূল্য ঋণাত্মক হতে পারে না', 'ক্রয় মূল্য ঋণাত্মক হতে পারে না');
  }

  validateReturnQuantity(requestedReturnMilli: number, eligibleMilli: number): void {
    if (requestedReturnMilli <= 0) throw new ValidationError('ফেরত পরিমাণ ০ এর বেশি হতে হবে', 'ফেরত পরিমাণ ০ এর বেশি হতে হবে');
    if (requestedReturnMilli > eligibleMilli) {
      throw new ValidationError(
        `ফেরত পরিমাণ প্রাপ্য পরিমাণের চেয়ে বেশি: প্রাপ্য ${eligibleMilli / 1000}, অনুরোধ ${requestedReturnMilli / 1000}`,
        `ফেরত পরিমাণ বেশি: সর্বোচ্চ ${eligibleMilli / 1000}`
      );
    }
  }
}

export class SupplierValidationService {
  validate(input: { businessId: string; name: string; phone?: string; email?: string; openingPayablePaisa?: number }): void {
    const errors: string[] = [];

    if (!input.businessId) errors.push('ব্যবসা আইডি প্রয়োজন');
    if (!input.name || input.name.trim().length === 0) errors.push('সাপ্লায়ারের নাম প্রয়োজন');
    if (input.name && input.name.length > 200) errors.push('নাম ২০০ অক্ষরের বেশি হতে পারবে না');

    if (input.phone && !/^\+?[0-9\s-]{7,20}$/.test(input.phone)) {
      errors.push('ফোন নম্বর সঠিক নয়');
    }

    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      errors.push('ইমেইল সঠিক নয়');
    }

    if (input.openingPayablePaisa !== undefined && input.openingPayablePaisa < 0) {
      errors.push('প্রারম্ভিক বকেয়া ঋণাত্মক হতে পারে না');
    }

    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '), errors.join(', '));
    }
  }
}
