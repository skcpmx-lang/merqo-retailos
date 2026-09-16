/**
 * Report Types — P4.4
 * All money = integer paisa, quantity = milli
 * Date ranges inclusive start/end
 */

export type DateRangePreset = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'prevMonth' | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  start: number; // inclusive ms
  end: number; // inclusive ms
  label: string;
  labelBn: string;
}

export interface ReportFilter {
  businessId?: string;
  dateRange?: DateRange;
  fromDate?: number;
  toDate?: number;
  productId?: string;
  categoryId?: string;
  brandId?: string;
  customerId?: string;
  supplierId?: string;
  cashierId?: string;
  userId?: string;
  paymentMethod?: string;
  cashAccountId?: string;
  bankAccountId?: string;
  mfsAccountId?: string;
  locationId?: string;
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
}

export interface SalesSummary {
  grossSalesPaisa: number;
  discountPaisa: number;
  taxPaisa: number;
  shippingPaisa: number;
  netSalesPaisa: number;
  paidPaisa: number;
  duePaisa: number;
  returnPaisa: number;
  refundPaisa: number;
  netSalesAfterReturnPaisa: number;
  transactionCount: number;
  totalQuantityMilli: number;
  averageSalePaisa: number;
}

export interface SalesByProductRow {
  productId: string;
  productName: string;
  productNameBn?: string;
  sku: string;
  barcode?: string;
  unitId?: string;
  unitName?: string;
  quantityMilli: number;
  quantityUnits: number;
  grossSalesPaisa: number;
  discountPaisa: number;
  netSalesPaisa: number;
  cogsPaisa: number;
  grossProfitPaisa: number;
  marginPercent: number | null;
}

export interface SalesByCategoryRow {
  categoryId: string;
  categoryName: string;
  categoryNameBn?: string;
  parentId?: string;
  quantityMilli: number;
  salesPaisa: number;
  cogsPaisa: number;
  grossProfitPaisa: number;
  productCount: number;
}

export interface SalesByCashierRow {
  cashierId: string;
  cashierName: string;
  transactionCount: number;
  salesPaisa: number;
  discountPaisa: number;
  returnPaisa: number;
  netSalesPaisa: number;
  paidPaisa: number;
  duePaisa: number;
}

export interface SalesByPaymentMethodRow {
  method: string;
  methodLabel: string;
  methodLabelBn: string;
  count: number;
  amountPaisa: number;
  percentage: number;
}

export interface PurchaseSummary {
  purchaseCount: number;
  subtotalPaisa: number;
  discountPaisa: number;
  taxPaisa: number;
  shippingPaisa: number;
  totalPaisa: number;
  paidPaisa: number;
  duePaisa: number;
  returnPaisa: number;
  netPurchasePaisa: number;
}

export interface PurchaseBySupplierRow {
  supplierId: string;
  supplierName: string;
  phone?: string;
  purchaseCount: number;
  purchaseAmountPaisa: number;
  paidPaisa: number;
  payablePaisa: number;
  returnPaisa: number;
}

export interface PurchaseByProductRow {
  productId: string;
  productName: string;
  sku: string;
  quantityMilli: number;
  quantityUnits: number;
  purchaseCostPaisa: number;
  avgCostPaisa: number;
  returnedQuantityMilli: number;
  netQuantityMilli: number;
  netCostPaisa: number;
}

export interface InventoryStockRow {
  productId: string;
  productName: string;
  productNameBn?: string;
  sku: string;
  barcode?: string;
  baseUnitId: string;
  baseUnitName?: string;
  currentQuantityMilli: number;
  quantityUnits: number;
  reservedMilli: number;
  availableMilli: number;
  wacPaisa: number;
  stockValuePaisa: number;
  minStockMilli: number;
  reorderLevelMilli: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstock';
  categoryName?: string;
}

export interface LowStockRow extends InventoryStockRow {
  deficitMilli: number;
}

export interface StockMovementRow {
  id: string;
  createdAt: number;
  productId: string;
  productName: string;
  sku?: string;
  movementType: string;
  movementTypeBn: string;
  quantityMilli: number;
  quantityUnits: number;
  costPaisa: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  locationId: string;
  notes?: string;
  balanceAfterMilli?: number;
  createdBy?: string;
}

export interface StockValuation {
  totalProducts: number;
  totalQuantityMilli: number;
  totalValuePaisa: number;
  averageWacPaisa: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface CustomerDueRow {
  customerId: string;
  customerName: string;
  phone?: string;
  openingDuePaisa: number;
  salesPaisa: number;
  paymentsPaisa: number;
  returnsPaisa: number;
  currentDuePaisa: number;
  creditLimitPaisa: number;
  availableCreditPaisa: number;
  lastTransactionAt?: number;
}

export interface CustomerStatementRow {
  id: string;
  date: number;
  type: string;
  typeBn: string;
  amountPaisa: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  notes?: string;
  runningBalancePaisa: number;
}

export interface CustomerStatement {
  customerId: string;
  customerName: string;
  openingBalancePaisa: number;
  closingBalancePaisa: number;
  rows: CustomerStatementRow[];
  totalSalesPaisa: number;
  totalPaymentsPaisa: number;
  totalReturnsPaisa: number;
}

export interface SupplierPayableRow {
  supplierId: string;
  supplierName: string;
  phone?: string;
  openingPayablePaisa: number;
  purchasesPaisa: number;
  paymentsPaisa: number;
  returnsPaisa: number;
  currentPayablePaisa: number;
  lastTransactionAt?: number;
}

export interface SupplierStatementRow {
  id: string;
  date: number;
  type: string;
  typeBn: string;
  amountPaisa: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  notes?: string;
  runningBalancePaisa: number;
}

export interface SupplierStatement {
  supplierId: string;
  supplierName: string;
  openingBalancePaisa: number;
  closingBalancePaisa: number;
  rows: SupplierStatementRow[];
  totalPurchasesPaisa: number;
  totalPaymentsPaisa: number;
  totalReturnsPaisa: number;
}

export interface CashReport {
  accountId: string;
  accountName: string;
  openingBalancePaisa: number;
  inflows: {
    salesPaisa: number;
    customerCollectionsPaisa: number;
    transfersInPaisa: number;
    mfsCashOutPaisa: number;
    otherInPaisa: number;
    totalInPaisa: number;
  };
  outflows: {
    supplierPaymentsPaisa: number;
    expensesPaisa: number;
    transfersOutPaisa: number;
    mfsCashInPaisa: number;
    otherOutPaisa: number;
    totalOutPaisa: number;
  };
  closingBalancePaisa: number;
  movements: {
    id: string;
    date: number;
    type: string;
    typeBn: string;
    amountPaisa: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
    balanceAfterPaisa: number;
  }[];
}

export interface BankReport {
  accountId: string;
  accountName: string;
  bankName: string;
  openingBalancePaisa: number;
  inflows: {
    salesPaisa: number;
    transfersInPaisa: number;
    otherInPaisa: number;
    totalInPaisa: number;
  };
  outflows: {
    supplierPaymentsPaisa: number;
    expensesPaisa: number;
    transfersOutPaisa: number;
    otherOutPaisa: number;
    totalOutPaisa: number;
  };
  closingBalancePaisa: number;
  movements: {
    id: string;
    date: number;
    type: string;
    typeBn: string;
    amountPaisa: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
    balanceAfterPaisa: number;
  }[];
}

export interface MfsReport {
  accountId: string;
  accountName: string;
  accountNumber: string;
  providerId: string;
  providerName: string;
  providerNameBn?: string;
  openingBalancePaisa: number;
  cashInPaisa: number;
  cashOutPaisa: number;
  salesPaisa: number;
  customerPaymentsPaisa: number;
  chargesPaisa: number;
  commissionPaisa: number;
  transfersInPaisa: number;
  transfersOutPaisa: number;
  closingBalancePaisa: number;
  movements: {
    id: string;
    date: number;
    type: string;
    typeBn: string;
    amountPaisa: number;
    netAmountPaisa: number;
    commissionPaisa: number;
    chargePaisa: number;
    balanceAfterPaisa: number;
    notes?: string;
  }[];
}

export interface ExpenseSummary {
  expenseCount: number;
  totalExpensePaisa: number;
  voidedCount: number;
  voidedAmountPaisa: number;
  activeExpensePaisa: number;
}

export interface ExpenseByCategoryRow {
  categoryId: string;
  categoryName: string;
  categoryNameBn?: string;
  count: number;
  amountPaisa: number;
  percentage: number;
}

export interface ExpenseReportRow {
  id: string;
  expenseNumber: string;
  date: number;
  categoryName: string;
  amountPaisa: number;
  paymentMethod: string;
  status: string;
  notes?: string;
  cashAccountName?: string;
  bankAccountName?: string;
  mfsAccountName?: string;
}

export interface ShiftReportRow {
  id: string;
  shiftNumber: string;
  cashierId: string;
  cashierName?: string;
  cashAccountId: string;
  cashAccountName?: string;
  openedAt: number;
  closedAt?: number;
  openingCashPaisa: number;
  expectedCashPaisa?: number;
  actualCashPaisa?: number;
  variancePaisa?: number;
  totalSalesPaisa: number;
  status: string;
  notes?: string;
}

export interface ProfitLossReport {
  revenue: {
    grossSalesPaisa: number;
    discountsPaisa: number;
    returnsPaisa: number;
    netSalesPaisa: number;
  };
  cogs: {
    cogsPaisa: number;
  };
  grossProfit: {
    grossProfitPaisa: number;
    marginPercent: number | null;
  };
  expenses: {
    operatingExpensesPaisa: number;
    expenseByCategory: ExpenseByCategoryRow[];
  };
  netProfit: {
    netProfitPaisa: number;
    marginPercent: number | null;
  };
  period: DateRange;
}

export interface DashboardMetrics {
  today: {
    salesPaisa: number;
    transactionCount: number;
    grossProfitPaisa: number;
    expensePaisa: number;
    cashBalancePaisa: number;
  };
  receivablePaisa: number;
  payablePaisa: number;
  lowStockCount: number;
  totalStockValuePaisa: number;
  totalProducts: number;
  totalCustomers: number;
  totalSuppliers: number;
  recentSales: {
    id: string;
    saleNumber: string;
    totalPaisa: number;
    createdAt: number;
    customerName?: string;
  }[];
  recentExpenses: {
    id: string;
    expenseNumber: string;
    amountPaisa: number;
    createdAt: number;
    categoryName?: string;
  }[];
  salesTrend: {
    date: string;
    label: string;
    salesPaisa: number;
    transactionCount: number;
  }[];
  paymentMix: SalesByPaymentMethodRow[];
  topProducts: SalesByProductRow[];
  lowStockProducts: LowStockRow[];
}

export const PAYMENT_METHOD_LABELS: Record<string, { en: string; bn: string }> = {
  cash: { en: 'Cash', bn: 'নগদ' },
  bank: { en: 'Bank', bn: 'ব্যাংক' },
  card: { en: 'Card', bn: 'কার্ড' },
  cheque: { en: 'Cheque', bn: 'চেক' },
  bkash: { en: 'bKash', bn: 'বিকাশ' },
  nagad: { en: 'Nagad', bn: 'নগদ' },
  rocket: { en: 'Rocket', bn: 'রকেট' },
  upay: { en: 'Upay', bn: 'উপায়' },
  mfs: { en: 'MFS', bn: 'মোবাইল ফাইন্যান্স' },
  due: { en: 'Due', bn: 'বাকি' },
  other: { en: 'Other', bn: 'অন্যান্য' },
};

export const MOVEMENT_TYPE_LABELS: Record<string, { en: string; bn: string }> = {
  purchase: { en: 'Purchase', bn: 'ক্রয়' },
  sale: { en: 'Sale', bn: 'বিক্রয়' },
  purchase_return: { en: 'Purchase Return', bn: 'ক্রয় ফেরত' },
  sale_return: { en: 'Sale Return', bn: 'বিক্রয় ফেরত' },
  adjustment: { en: 'Adjustment', bn: 'সমন্বয়' },
  in: { en: 'Stock In', bn: 'স্টক ইন' },
  out: { en: 'Stock Out', bn: 'স্টক আউট' },
  transfer: { en: 'Transfer', bn: 'স্থানান্তর' },
  sale_cancel: { en: 'Sale Cancel', bn: 'বিক্রয় বাতিল' },
  purchase_cancel: { en: 'Purchase Cancel', bn: 'ক্রয় বাতিল' },
  opening: { en: 'Opening', bn: 'ওপেনিং' },
};
