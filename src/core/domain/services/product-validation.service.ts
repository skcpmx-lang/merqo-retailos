/**
 * Product Validation Service — business rules for product entity
 */

import { ValidationError } from '../errors/AppError';

export interface ProductInput {
  businessId: string;
  name: string;
  nameBn?: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
  brandId?: string;
  baseUnitId: string;
  purchaseUnitId?: string;
  saleUnitId?: string;
  costPricePaisa: number;
  sellingPricePaisa: number;
  mrpPaisa?: number;
  minStockMilli?: number;
  reorderLevelMilli?: number;
  openingStockMilli?: number;
  isStockTrackable?: boolean;
  taxRate?: number;
}

export class ProductValidationService {
  validate(input: ProductInput): void {
    const errors: string[] = [];

    if (!input.businessId) errors.push('ব্যবসা আইডি প্রয়োজন');
    if (!input.name || input.name.trim().length === 0) errors.push('পণ্যের নাম প্রয়োজন');
    if (input.name && input.name.length > 200) errors.push('পণ্যের নাম ২০০ অক্ষরের বেশি হতে পারবে না');

    if (!input.sku || input.sku.trim().length === 0) errors.push('SKU প্রয়োজন');
    if (input.sku && !/^[A-Z0-9-_]+$/i.test(input.sku)) errors.push('SKU শুধুমাত্র অক্ষর, সংখ্যা, - এবং _ থাকতে পারে');

    if (!input.baseUnitId) errors.push('বেস ইউনিট প্রয়োজন');

    if (input.costPricePaisa === undefined || input.costPricePaisa === null) errors.push('ক্রয় মূল্য প্রয়োজন');
    if (input.costPricePaisa !== undefined && input.costPricePaisa < 0) errors.push('ক্রয় মূল্য ঋণাত্মক হতে পারে না');

    if (input.sellingPricePaisa === undefined || input.sellingPricePaisa === null) errors.push('বিক্রয় মূল্য প্রয়োজন');
    if (input.sellingPricePaisa !== undefined && input.sellingPricePaisa < 0) errors.push('বিক্রয় মূল্য ঋণাত্মক হতে পারে না');

    if (input.mrpPaisa !== undefined && input.mrpPaisa !== null && input.mrpPaisa < 0) errors.push('MRP ঋণাত্মক হতে পারে না');

    if (input.taxRate !== undefined && (input.taxRate < 0 || input.taxRate > 100)) errors.push('ভ্যাট ০-১০০% এর মধ্যে হতে হবে');

    if (input.minStockMilli !== undefined && input.minStockMilli < 0) errors.push('ন্যূনতম স্টক ঋণাত্মক হতে পারে না');
    if (input.reorderLevelMilli !== undefined && input.reorderLevelMilli < 0) errors.push('রি-অর্ডার লেভেল ঋণাত্মক হতে পারে না');
    if (input.openingStockMilli !== undefined && input.openingStockMilli < 0) errors.push('প্রারম্ভিক স্টক ঋণাত্মক হতে পারে না');

    // Selling price should generally be >= cost price (warning, not hard error for flexibility)
    // But we enforce if both provided and selling < cost, allow but note

    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '), 'পণ্যের তথ্য সঠিক নয়');
    }
  }

  validatePriceUpdate(newCostPaisa: number, newSellingPaisa: number, oldCostPaisa: number): { warning?: string } {
    if (newCostPaisa < 0) throw new ValidationError('ক্রয় মূল্য ঋণাত্মক হতে পারে না', 'ক্রয় মূল্য ঋণাত্মক হতে পারে না');
    if (newSellingPaisa < 0) throw new ValidationError('বিক্রয় মূল্য ঋণাত্মক হতে পারে না', 'বিক্রয় মূল্য ঋণাত্মক হতে পারে না');

    const warnings: string[] = [];

    // Significant cost increase (>50%)
    if (oldCostPaisa > 0 && newCostPaisa > oldCostPaisa * 1.5) {
      warnings.push(`ক্রয় মূল্য ${Math.round(((newCostPaisa - oldCostPaisa) / oldCostPaisa) * 100)}% বৃদ্ধি পেয়েছে`);
    }

    // Selling below cost
    if (newSellingPaisa < newCostPaisa) {
      warnings.push('বিক্রয় মূল্য ক্রয় মূল্যের চেয়ে কম');
    }

    return { warning: warnings.length > 0 ? warnings.join(', ') : undefined };
  }

  validateBarcode(barcode: string): void {
    if (!barcode) return;
    if (barcode.length < 4) throw new ValidationError('বারকোড কমপক্ষে ৪ অক্ষরের হতে হবে', 'বারকোড কমপক্ষে ৪ অক্ষরের হতে হবে');
    if (barcode.length > 50) throw new ValidationError('বারকোড ৫০ অক্ষরের বেশি হতে পারবে না', 'বারকোড ৫০ অক্ষরের বেশি হতে পারবে না');
    if (!/^[0-9A-Za-z-_]+$/.test(barcode)) throw new ValidationError('বারকোডে শুধুমাত্র অক্ষর, সংখ্যা, - এবং _ থাকতে পারে', 'বারকোডে শুধুমাত্র অক্ষর, সংখ্যা, - এবং _ থাকতে পারে');
  }
}
