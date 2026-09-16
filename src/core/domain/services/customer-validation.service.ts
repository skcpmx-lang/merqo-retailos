import { ValidationError } from '../errors/AppError';

export class CustomerValidationService {
  validate(input: { businessId: string; name: string; phone?: string; alternatePhone?: string; email?: string; openingDuePaisa?: number; creditLimitPaisa?: number }): void {
    const errors: string[] = [];

    if (!input.businessId) errors.push('ব্যবসা আইডি প্রয়োজন');
    if (!input.name || input.name.trim().length === 0) errors.push('গ্রাহকের নাম লিখুন');
    if (input.name && input.name.length > 200) errors.push('নাম ২০০ অক্ষরের বেশি হতে পারবে না');

    if (input.phone && !/^\+?[0-9\s-]{7,20}$/.test(input.phone)) {
      errors.push('সঠিক ফোন নম্বর দিন');
    }

    if (input.alternatePhone && !/^\+?[0-9\s-]{7,20}$/.test(input.alternatePhone)) {
      errors.push('বিকল্প ফোন নম্বর সঠিক নয়');
    }

    if (input.email && !/^[^\\s@]+@[^\\s@]+\.[^\\s@]+$/.test(input.email)) {
      errors.push('সঠিক ইমেইল দিন');
    }

    if (input.openingDuePaisa !== undefined && input.openingDuePaisa < 0) {
      errors.push('প্রারম্ভিক বকেয়া ঋণাত্মক হতে পারে না');
    }

    if (input.creditLimitPaisa !== undefined && input.creditLimitPaisa < 0) {
      errors.push('ক্রেডিট লিমিট ঋণাত্মক হতে পারে না');
    }

    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '), errors.join(', '));
    }
  }
}

export class SaleItemInput {
  productId!: string;
  unitId!: string;
  quantityMilli!: number;
  unitPricePaisa!: number;
  discountPaisa?: number;
  taxPaisa?: number;
}

export class SaleInput {
  businessId!: string;
  customerId?: string | null;
  saleDate?: number;
  items!: SaleItemInput[];
  discountPaisa?: number;
  discountType?: string;
  discountValue?: number;
  taxPaisa?: number;
  shippingPaisa?: number;
  paidPaisa?: number;
  notes?: string;
}

export class SaleValidationService {
  validate(input: SaleInput): void {
    const errors: string[] = [];

    if (!input.businessId) errors.push('ব্যবসা আইডি প্রয়োজন');

    if (!input.items || input.items.length === 0) {
      errors.push('কমপক্ষে একটি পণ্য প্রয়োজন');
    }

    if (input.items) {
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        if (!item.productId) errors.push(`আইটেম ${i + 1}: পণ্য প্রয়োজন`);
        if (!item.unitId) errors.push(`আইটেম ${i + 1}: ইউনিট প্রয়োজন`);
        if (item.quantityMilli === undefined || item.quantityMilli <= 0) errors.push(`আইটেম ${i + 1}: পরিমাণ ০ এর বেশি হতে হবে`);
        if (item.unitPricePaisa === undefined || item.unitPricePaisa < 0) errors.push(`আইটেম ${i + 1}: বিক্রয় মূল্য ঋণাত্মক হতে পারে না`);
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
