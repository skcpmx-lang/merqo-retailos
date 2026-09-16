/**
 * Inventory Domain Service — stock movement atomicity, ledger invariants
 * Ensures stock_levels materialized view matches sum of stock_movements
 * All operations must be transactional
 */

import { WACCalculator } from '../WACCalculator';

export type MovementType =
  | 'purchase'
  | 'sale'
  | 'sale_return'
  | 'purchase_return'
  | 'adjustment'
  | 'transfer'
  | 'opening'
  | 'damage'
  | 'count';

export interface StockMovementInput {
  businessId: string;
  productId: string;
  movementType: MovementType;
  quantityMilli: number; // positive for IN, negative for OUT, never 0
  unitId?: string;
  unitQuantity?: number;
  costPaisa: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  locationId?: string;
  createdBy?: string;
}

export class InventoryDomainService {
  private wacCalculator = new WACCalculator();

  validateMovement(input: StockMovementInput): void {
    if (!input.businessId) throw new Error('businessId required');
    if (!input.productId) throw new Error('productId required');
    if (!input.movementType) throw new Error('movementType required');
    if (input.quantityMilli === 0) throw new Error('quantityMilli cannot be zero');
    if (input.costPaisa < 0) throw new Error('costPaisa cannot be negative');

    const validTypes: MovementType[] = [
      'purchase',
      'sale',
      'sale_return',
      'purchase_return',
      'adjustment',
      'transfer',
      'opening',
      'damage',
      'count',
    ];

    if (!validTypes.includes(input.movementType)) {
      throw new Error(`Invalid movement type: ${input.movementType}`);
    }

    // Sale should be negative (out)
    if (input.movementType === 'sale' && input.quantityMilli > 0) {
      throw new Error('Sale movement must have negative quantity');
    }
    if (input.movementType === 'purchase' && input.quantityMilli < 0) {
      throw new Error('Purchase movement must have positive quantity');
    }
  }

  /**
   * Calculate new WAC after purchase
   */
  calculateNewWAC(
    currentStockMilli: number,
    currentWacPaisa: number,
    purchaseQtyMilli: number,
    purchaseCostPaisa: number
  ): number {
    if (purchaseQtyMilli <= 0) return currentWacPaisa;
    if (currentStockMilli === 0) return purchaseCostPaisa;
    // Use number helper for simplicity (paisa as number)
    return Math.round(WACCalculator.calculateFromNumbers(currentStockMilli, currentWacPaisa, purchaseQtyMilli, purchaseCostPaisa));
  }

  /**
   * Check if stock movement would cause negative stock (if tracking enabled)
   * For some movement types, negative is allowed? No, we prevent negative for sellable items
   */
  canDeduct(currentStockMilli: number, deductMilli: number, isStockTrackable: boolean): { allowed: boolean; reason?: string } {
    if (!isStockTrackable) return { allowed: true };
    if (deductMilli <= 0) return { allowed: true }; // not a deduction

    if (currentStockMilli < deductMilli) {
      return {
        allowed: false,
        reason: `অপর্যাপ্ত স্টক: বর্তমান ${currentStockMilli / 1000}, প্রয়োজন ${deductMilli / 1000}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Ledger invariant: stock_levels.quantity_milli must equal SUM(stock_movements.quantity_milli)
   * This should be checked in tests and after batch operations
   */
  verifyLedgerInvariant(stockLevelMilli: number, movementsSumMilli: number): { valid: boolean; difference: number } {
    const diff = stockLevelMilli - movementsSumMilli;
    return {
      valid: diff === 0,
      difference: diff,
    };
  }

  /**
   * Build movement for opening stock
   */
  buildOpeningMovement(
    businessId: string,
    productId: string,
    quantityMilli: number,
    costPaisa: number,
    createdBy?: string
  ): StockMovementInput | null {
    if (quantityMilli <= 0) return null;
    return {
      businessId,
      productId,
      movementType: 'opening',
      quantityMilli,
      costPaisa,
      referenceType: 'opening_stock',
      referenceId: productId,
      notes: 'Opening stock',
      locationId: 'main',
      createdBy,
    };
  }

  /**
   * Build purchase movement
   */
  buildPurchaseMovement(
    businessId: string,
    productId: string,
    quantityMilli: number,
    costPaisa: number,
    purchaseId: string,
    createdBy?: string
  ): StockMovementInput {
    return {
      businessId,
      productId,
      movementType: 'purchase',
      quantityMilli: Math.abs(quantityMilli),
      costPaisa,
      referenceType: 'purchase',
      referenceId: purchaseId,
      locationId: 'main',
      createdBy,
    };
  }

  /**
   * Build sale movement (negative)
   */
  buildSaleMovement(
    businessId: string,
    productId: string,
    quantityMilli: number,
    costPaisa: number,
    saleId: string,
    createdBy?: string
  ): StockMovementInput {
    return {
      businessId,
      productId,
      movementType: 'sale',
      quantityMilli: -Math.abs(quantityMilli),
      costPaisa,
      referenceType: 'sale',
      referenceId: saleId,
      locationId: 'main',
      createdBy,
    };
  }
}
