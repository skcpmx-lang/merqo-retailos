export interface POSCartItem {
  id: string; // temp id for cart line
  productId: string;
  productName: string;
  sku: string;
  barcode?: string | null;
  unitId: string;
  unitName: string;
  unitShortName: string;
  quantity: number; // display qty
  quantityMilli: number; // milli for backend
  baseQuantityMilli?: number; // converted base qty
  unitPricePaisa: number;
  discountPaisa: number;
  lineTotalPaisa: number;
  stockMilli: number;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
  brand?: string;
  category?: string;
  barcodeDetail?: {
    id: string;
    unitId?: string | null;
    quantityMilli: number;
  } | null;
}

export interface POSCart {
  items: POSCartItem[];
  subtotalPaisa: number;
  discountPaisa: number;
  taxPaisa: number;
  shippingPaisa: number;
  totalPaisa: number;
  customerId?: string | null;
}

export interface POSPayment {
  method: string;
  amountPaisa: number;
  amount: number; // BDT
  cashAccountId?: string;
  bankAccountId?: string;
  mfsAccountId?: string;
  chequeNumber?: string;
  transactionRef?: string;
}

export function calculateCartTotals(items: POSCartItem[], discountPaisa = 0, taxPaisa = 0, shippingPaisa = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotalPaisa, 0);
  const total = subtotal - discountPaisa + taxPaisa + shippingPaisa;
  return {
    subtotalPaisa: subtotal,
    discountPaisa,
    taxPaisa,
    shippingPaisa,
    totalPaisa: Math.max(0, total),
  };
}

export function formatPaisa(paisa: number): string {
  return `৳ ${(paisa / 100).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatQty(qty: number): string {
  return qty.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}
