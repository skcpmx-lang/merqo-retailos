/**
 * Financial Ledger Service — supplier, customer, cash, bank, MFS ledgers
 * Invariant: current balance = SUM(transaction amount_paisa)
 * Immutable ledger, no UPDATE
 */

export type SupplierTxType = 'opening_payable' | 'purchase' | 'payment' | 'return' | 'adjustment';
export type CustomerTxType = 'opening_due' | 'sale' | 'payment' | 'return' | 'adjustment';

export class FinancialLedgerService {
  /**
   * Supplier ledger: payable increases with purchase (+), decreases with payment (-)
   * Convention:
   * - purchase: +amount (you owe more)
   * - payment: -amount (you paid, owe less)
   * - return: -amount (supplier owes you back)
   * - opening_payable: +opening amount
   */
  buildSupplierTransaction(
    businessId: string,
    supplierId: string,
    type: SupplierTxType,
    amountPaisa: number,
    referenceType?: string,
    referenceId?: string,
    notes?: string,
    createdBy?: string
  ): {
    businessId: string;
    supplierId: string;
    transactionType: SupplierTxType;
    amountPaisa: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
    createdBy?: string;
  } {
    let signedAmount = amountPaisa;

    switch (type) {
      case 'opening_payable':
      case 'purchase':
        signedAmount = Math.abs(amountPaisa); // positive payable
        break;
      case 'payment':
      case 'return':
        signedAmount = -Math.abs(amountPaisa); // negative reduces payable
        break;
      case 'adjustment':
        signedAmount = amountPaisa; // can be positive or negative
        break;
    }

    if (signedAmount === 0) throw new Error('Transaction amount cannot be zero');

    return {
      businessId,
      supplierId,
      transactionType: type,
      amountPaisa: signedAmount,
      referenceType,
      referenceId,
      notes,
      createdBy,
    };
  }

  buildCustomerTransaction(
    businessId: string,
    customerId: string,
    type: CustomerTxType,
    amountPaisa: number,
    referenceType?: string,
    referenceId?: string,
    notes?: string,
    createdBy?: string
  ): {
    businessId: string;
    customerId: string;
    transactionType: CustomerTxType;
    amountPaisa: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
    createdBy?: string;
  } {
    let signedAmount = amountPaisa;

    switch (type) {
      case 'opening_due':
      case 'sale':
        signedAmount = Math.abs(amountPaisa); // positive due
        break;
      case 'payment':
      case 'return':
        signedAmount = -Math.abs(amountPaisa); // negative reduces due
        break;
      case 'adjustment':
        signedAmount = amountPaisa;
        break;
    }

    if (signedAmount === 0) throw new Error('Transaction amount cannot be zero');

    return {
      businessId,
      customerId,
      transactionType: type,
      amountPaisa: signedAmount,
      referenceType,
      referenceId,
      notes,
      createdBy,
    };
  }

  verifyLedgerInvariant(currentBalance: number, sumTransactions: number): { valid: boolean; difference: number } {
    const diff = currentBalance - sumTransactions;
    return { valid: diff === 0, difference: diff };
  }

  /**
   * MFS transaction breakdown:
   * - customer pays amount + charge
   * - you receive amount, pay charge to operator? Actually agent model:
   * - amount: transaction amount (e.g., 1000 Tk sent)
   * - customer_charge: fee customer pays (e.g., 20 Tk)
   * - commission: your commission from operator (e.g., 5 Tk)
   * - net: amount that affects your balance
   *   For cash-in: customer gives cash, you add e-money to their account
   *   Your cash balance +amount+charge, e-money balance -amount, commission +commission
   */
  calculateMfsNet(
    type: 'cash_in' | 'cash_out' | 'send_money' | 'payment' | 'agent_commission',
    amountPaisa: number,
    customerChargePaisa: number,
    commissionPaisa: number
  ): { netPaisa: number; breakdown: string } {
    switch (type) {
      case 'cash_in':
        // Customer gives cash, you give e-money. Cash +, e-money -, commission +
        // Net cash: +amount+charge, Net e-money: -amount, commission is separate income
        return {
          netPaisa: amountPaisa, // e-money outflow magnitude
          breakdown: `Cash In: Cash +${amountPaisa + customerChargePaisa}, eMoney -${amountPaisa}, commission +${commissionPaisa}`,
        };
      case 'cash_out':
        return {
          netPaisa: -amountPaisa,
          breakdown: `Cash Out: Cash -${amountPaisa}, eMoney +${amountPaisa}, commission +${commissionPaisa}`,
        };
      case 'send_money':
        return {
          netPaisa: -amountPaisa,
          breakdown: `Send Money: eMoney -${amountPaisa}, charge ${customerChargePaisa}, commission ${commissionPaisa}`,
        };
      default:
        return { netPaisa: amountPaisa, breakdown: `${type}: ${amountPaisa}` };
    }
  }
}
