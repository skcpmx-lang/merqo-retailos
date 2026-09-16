/**
 * Weighted Average Cost Calculator
 * Formula: New WAC = (Old Qty * Old WAC + New Qty * New Cost) / (Old Qty + New Qty)
 * All quantities in milli, costs in paisa (bigint)
 */

export interface WACInput {
  oldQtyMilli: bigint;
  oldWacPaisa: bigint;
  newQtyMilli: bigint;
  newCostPaisa: bigint; // per base unit
}

export class WACCalculator {
  static calculate(input: WACInput): bigint {
    const { oldQtyMilli, oldWacPaisa, newQtyMilli, newCostPaisa } = input;

    if (newQtyMilli <= 0n) {
      throw new Error('New quantity must be >0 for WAC calculation');
    }

    if (oldQtyMilli < 0n) {
      throw new Error('Old quantity cannot be negative for WAC');
    }

    if (oldQtyMilli === 0n) {
      return newCostPaisa;
    }

    // (oldQty * oldWac + newQty * newCost) / (oldQty + newQty)
    // Qty in milli, cost in paisa, result in paisa
    // Need to handle milli: qty_milli * cost_paisa = cost_paisa * milli
    // But division by total qty milli cancels out, so we can use milli directly
    const oldValue = oldQtyMilli * oldWacPaisa;
    const newValue = newQtyMilli * newCostPaisa;
    const totalQty = oldQtyMilli + newQtyMilli;

    // Round half-up
    const totalValue = oldValue + newValue;
    const result = totalValue / totalQty;
    const remainder = totalValue % totalQty;

    // Half-up rounding: if remainder*2 >= totalQty, round up
    if (remainder * 2n >= totalQty) {
      return result + 1n;
    }
    return result;
  }

  static calculateFromNumbers(oldQty: number, oldWac: number, newQty: number, newCost: number): number {
    // Helper for JS numbers (paisa as number)
    if (oldQty === 0) return newCost;
    return (oldQty * oldWac + newQty * newCost) / (oldQty + newQty);
  }
}
