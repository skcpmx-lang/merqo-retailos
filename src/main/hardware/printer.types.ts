/**
 * Printer abstraction types — P4.2 Hardware Integration
 * Clean boundary: renderer never sees native printer objects
 */

export type PaperWidth = '58mm' | '80mm' | 'A4';
export type PrinterConnection = 'windows_spooler' | 'usb' | 'network' | 'pdf';
export type PrinterStatusType = 'online' | 'offline' | 'paper_out' | 'error' | 'unknown';

export interface PrinterInfo {
  id: string; // sanitized device name
  name: string; // raw device name from Electron
  displayName: string; // user-friendly
  description: string;
  isDefault: boolean;
  status: PrinterStatusType;
  options?: {
    copies?: number;
    isVirtual?: boolean;
  };
}

export interface PrinterConfig {
  selectedPrinterId: string | null; // for receipts
  selectedPrinterName: string | null;
  paperWidth: PaperWidth; // 58mm | 80mm
  a4PrinterId: string | null;
  a4PrinterName: string | null;
  autoPrintOnSale: boolean;
  showLogo: boolean;
  showCustomer: boolean;
  showBarcode: boolean;
  receiptFooter: string;
  copies: number;
  updatedAt: number;
}

export interface ReceiptData {
  sale: {
    id: string;
    saleNumber: string;
    saleDate: number;
    subtotalPaisa: number;
    discountPaisa: number;
    taxPaisa: number;
    totalPaisa: number;
    paidPaisa: number;
    duePaisa: number;
    notes?: string | null;
  };
  items: Array<{
    productName: string;
    quantity: number;
    quantityMilli: number;
    unitShortName: string;
    unitPricePaisa: number;
    lineTotalPaisa: number;
    discountPaisa: number;
  }>;
  business?: {
    name: string;
    tradeName?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  customer?: {
    name: string;
    phone?: string | null;
  } | null;
  payments?: Array<{
    method: string;
    amountPaisa: number;
  }>;
  cashier?: string | null;
  changePaisa?: number;
}

export interface PrintOptions {
  printerId?: string;
  printerName?: string;
  paperWidth?: PaperWidth;
  copies?: number;
  silent?: boolean;
}

export interface PrintResult {
  success: boolean;
  jobId?: string;
  message?: string;
  messageBn: string;
  printerName?: string;
  timestamp: number;
}

export interface PrinterStatusResult {
  printerId: string;
  printerName: string;
  status: PrinterStatusType;
  isAvailable: boolean;
  isDefault: boolean;
  message: string;
  messageBn: string;
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  selectedPrinterId: null,
  selectedPrinterName: null,
  paperWidth: '80mm',
  a4PrinterId: null,
  a4PrinterName: null,
  autoPrintOnSale: false,
  showLogo: false,
  showCustomer: true,
  showBarcode: true,
  receiptFooter: 'ধন্যবাদ, আবার আসবেন',
  copies: 1,
  updatedAt: Date.now(),
};

export type ScannerSuffix = 'Enter' | 'Tab' | 'None';

export interface ScannerConfig {
  enabled: boolean;
  minLength: number;
  maxLength: number;
  suffix: ScannerSuffix;
  charThresholdMs: number; // max time between chars for scanner burst
  scanTimeoutMs: number; // time to consider burst ended
  prefix?: string;
  testMode: boolean;
  updatedAt: number;
}

export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  enabled: true,
  minLength: 3,
  maxLength: 64,
  suffix: 'Enter',
  charThresholdMs: 50,
  scanTimeoutMs: 150,
  prefix: '',
  testMode: false,
  updatedAt: Date.now(),
};

export interface HardwareDiagnostics {
  printersDetected: number;
  defaultPrinter: string | null;
  configuredPrinter: string | null;
  a4Printer: string | null;
  lastPrintResult: PrintResult | null;
  lastPrintError: string | null;
  lastScannerEvent: {
    barcode: string;
    timestamp: number;
    isScanner: boolean;
    productFound: boolean;
  } | null;
  scannerConfig: ScannerConfig;
  printerConfig: PrinterConfig;
  systemInfo: {
    platform: string;
    arch: string;
    electronVersion: string;
    appVersion: string;
    userDataPath: string;
  };
  timestamp: number;
}
