import { z } from 'zod';

// Common validators
export const idSchema = z.string().min(10).max(32);
export const paisaSchema = z.number().int().min(0).or(z.bigint());
export const milliSchema = z.number().int().min(0).or(z.bigint());
export const phoneSchema = z.string().min(11).max(15).regex(/^[0-9+\-() ]+$/, 'ফোন নম্বর সঠিক নয়');
export const emailSchema = z.string().email('ইমেইল সঠিক নয়').optional().or(z.literal(''));
export const nameSchema = z.string().min(1, 'নাম আবশ্যক').max(200, 'নাম অনেক বড়');
export const skuSchema = z.string().min(1).max(50);
export const barcodeSchema = z.string().min(4).max(48);

// Business validators
export const businessSchema = z.object({
  name: nameSchema,
  tradeName: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema,
});

export const productSchema = z.object({
  name: nameSchema,
  sku: skuSchema.optional(),
  barcode: barcodeSchema.optional(),
  baseUnitId: idSchema,
  costPricePaisa: z.number().int().min(0),
  sellingPricePaisa: z.number().int().min(0),
  minStockMilli: z.number().int().min(0).optional(),
});

export const customerSchema = z.object({
  name: nameSchema,
  phone: phoneSchema.optional(),
  email: emailSchema,
  openingDuePaisa: z.number().int().min(0).optional(),
});

export const supplierSchema = z.object({
  name: nameSchema,
  phone: phoneSchema.optional(),
  email: emailSchema,
  openingPayablePaisa: z.number().int().min(0).optional(),
});

// IPC payload validators — extended for P4.2 hardware
export const ipcPayloadSchemas: Record<string, z.ZodSchema> = {
  'app:getInfo': z.object({}),
  'app:getVersion': z.object({}),
  'app:getPaths': z.object({}),
  'db:getStatus': z.object({}),
  'db:checkIntegrity': z.object({}),
  'db:isFirstLaunch': z.object({}),
  'auth:login': z.object({
    phone: z.string().min(1),
    password: z.string().min(1),
  }),
  'auth:loginWithPin': z.object({
    phone: z.string().min(1),
    pin: z.string().min(4).max(6),
  }),
  'auth:logout': z.object({}),
  'auth:getSession': z.object({}),
  'auth:verifyPassword': z.object({
    password: z.string().min(1),
  }),
  'business:get': z.object({}),
  'business:create': z.object({}).passthrough(),
  'settings:get': z.object({
    key: z.string().min(1),
  }),
  'settings:getAll': z.object({}),
  'settings:set': z.object({
    key: z.string().min(1),
    value: z.unknown(),
  }),
  'system:getConfig': z.object({}),

  // Hardware P4.2
  'hardware:getPrinters': z.object({}),
  'hardware:getDefaultPrinter': z.object({}),
  'hardware:getConfiguredPrinter': z.object({}),
  'hardware:savePrinterConfig': z.object({
    selectedPrinterId: z.string().max(200).nullable().optional(),
    selectedPrinterName: z.string().max(200).nullable().optional(),
    paperWidth: z.enum(['58mm', '80mm', 'A4']).optional(),
    a4PrinterId: z.string().max(200).nullable().optional(),
    a4PrinterName: z.string().max(200).nullable().optional(),
    autoPrintOnSale: z.boolean().optional(),
    showLogo: z.boolean().optional(),
    showCustomer: z.boolean().optional(),
    showBarcode: z.boolean().optional(),
    receiptFooter: z.string().max(500).optional(),
    copies: z.number().int().min(1).max(10).optional(),
  }).passthrough(),
  'hardware:getPrinterStatus': z.object({
    id: z.string().min(1).max(200),
  }),
  'hardware:printReceipt': z.object({
    saleId: z.string().min(10).max(64),
    printerId: z.string().max(200).optional(),
    printerName: z.string().max(200).optional(),
    paperWidth: z.enum(['58mm', '80mm', 'A4']).optional(),
    copies: z.number().int().min(1).max(10).optional(),
    silent: z.boolean().optional(),
  }),
  'hardware:printInvoice': z.object({
    saleId: z.string().min(10).max(64),
    printerId: z.string().max(200).optional(),
    printerName: z.string().max(200).optional(),
    copies: z.number().int().min(1).max(10).optional(),
    silent: z.boolean().optional(),
  }),
  'hardware:reprintReceipt': z.object({
    saleId: z.string().min(10).max(64),
    printerId: z.string().max(200).optional(),
    printerName: z.string().max(200).optional(),
    paperWidth: z.enum(['58mm', '80mm', 'A4']).optional(),
    copies: z.number().int().min(1).max(10).optional(),
    silent: z.boolean().optional(),
  }),
  'hardware:testPrinter': z.object({
    id: z.string().min(1).max(200),
  }),
  'hardware:getScannerConfig': z.object({}),
  'hardware:saveScannerConfig': z.object({
    enabled: z.boolean().optional(),
    minLength: z.number().int().min(1).max(20).optional(),
    maxLength: z.number().int().min(4).max(128).optional(),
    suffix: z.enum(['Enter', 'Tab', 'None']).optional(),
    charThresholdMs: z.number().int().min(10).max(200).optional(),
    scanTimeoutMs: z.number().int().min(50).max(1000).optional(),
    prefix: z.string().max(20).optional(),
    testMode: z.boolean().optional(),
  }).passthrough(),
  'hardware:getDiagnostics': z.object({}),
  'hardware:barcodeTest': z.object({
    barcode: z.string().min(1).max(128),
  }),

  // Suppliers etc — allow passthrough for existing channels (validated in service layer)
  'supplier:create': z.object({}).passthrough(),
  'supplier:update': z.object({ id: z.string(), data: z.object({}).passthrough() }),
  'supplier:get': z.object({ id: z.string() }),
  'supplier:list': z.object({ businessId: z.string() }),
  'supplier:search': z.object({ businessId: z.string(), query: z.string(), includeInactive: z.boolean().optional() }),
  'supplier:deactivate': z.object({ id: z.string() }),
  'supplier:delete': z.object({ id: z.string() }),
  'supplier:statement': z.object({ supplierId: z.string(), fromDate: z.number().optional(), toDate: z.number().optional() }),
  'supplier:transactions': z.object({ supplierId: z.string(), limit: z.number().optional() }),
  'supplier:pay': z.object({}).passthrough(),

  'purchase:create': z.object({}).passthrough(),
  'purchase:get': z.object({ id: z.string() }),
  'purchase:list': z.object({ businessId: z.string(), filters: z.any().optional(), limit: z.number().optional(), offset: z.number().optional() }),
  'purchase:cancel': z.object({ id: z.string(), reason: z.string() }),
  'purchase:returnCreate': z.object({}).passthrough(),
  'purchase:returnList': z.object({ purchaseId: z.string() }),

  'product:search': z.object({ businessId: z.string(), query: z.string() }),
  'product:get': z.object({ id: z.string() }),

  'unit:list': z.object({ businessId: z.string() }),
  'unit:conversions': z.object({ businessId: z.string() }),

  'customer:create': z.object({}).passthrough(),
  'customer:update': z.object({ id: z.string(), data: z.object({}).passthrough() }),
  'customer:get': z.object({ id: z.string() }),
  'customer:list': z.object({ businessId: z.string() }),
  'customer:search': z.object({ businessId: z.string(), query: z.string(), includeInactive: z.boolean().optional() }),
  'customer:deactivate': z.object({ id: z.string() }),
  'customer:activate': z.object({ id: z.string() }),
  'customer:delete': z.object({ id: z.string() }),
  'customer:statement': z.object({ customerId: z.string(), fromDate: z.number().optional(), toDate: z.number().optional() }),
  'customer:transactions': z.object({ customerId: z.string(), limit: z.number().optional() }),
  'customer:collect': z.object({}).passthrough(),

  'sale:create': z.object({}).passthrough(),
  'sale:get': z.object({ id: z.string() }),
  'sale:list': z.object({ businessId: z.string(), filters: z.any().optional(), limit: z.number().optional(), offset: z.number().optional() }),
  'sale:cancel': z.object({ id: z.string(), reason: z.string() }),
  'sale:returnCreate': z.object({}).passthrough(),
  'sale:returnList': z.object({ saleId: z.string() }),

  'finance:cashAccountList': z.object({ businessId: z.string(), includeInactive: z.boolean().optional() }),
  'finance:cashAccountCreate': z.object({}).passthrough(),
  'finance:cashAccountGet': z.object({ id: z.string() }),
  'finance:cashAccountUpdate': z.object({ id: z.string(), data: z.any(), businessId: z.string() }),
  'finance:cashAccountDeactivate': z.object({ id: z.string(), businessId: z.string() }),
  'finance:cashAccountStatement': z.object({ accountId: z.string(), fromDate: z.number().optional(), toDate: z.number().optional() }),
  'finance:cashAccountBalance': z.object({ accountId: z.string() }),
  'finance:cashMovementList': z.object({ businessId: z.string(), limit: z.number().optional(), offset: z.number().optional(), filters: z.any().optional() }),
  'finance:cashTransferCreate': z.object({}).passthrough(),
  'finance:transferList': z.object({ businessId: z.string(), limit: z.number().optional(), offset: z.number().optional() }),

  'finance:bankAccountList': z.object({ businessId: z.string(), includeInactive: z.boolean().optional() }),
  'finance:bankAccountCreate': z.object({}).passthrough(),
  'finance:bankAccountGet': z.object({ id: z.string() }),
  'finance:bankAccountUpdate': z.object({ id: z.string(), data: z.any() }),
  'finance:bankAccountDeactivate': z.object({ id: z.string() }),
  'finance:bankAccountStatement': z.object({ accountId: z.string(), fromDate: z.number().optional(), toDate: z.number().optional() }),
  'finance:bankAccountBalance': z.object({ accountId: z.string() }),
  'finance:bankTransactionList': z.object({ businessId: z.string(), limit: z.number().optional(), offset: z.number().optional(), filters: z.any().optional() }),

  'finance:mfsAccountList': z.object({ businessId: z.string(), includeInactive: z.boolean().optional() }),
  'finance:mfsAccountCreate': z.object({}).passthrough(),
  'finance:mfsAccountGet': z.object({ id: z.string() }),
  'finance:mfsAccountUpdate': z.object({ id: z.string(), data: z.any() }),
  'finance:mfsAccountDeactivate': z.object({ id: z.string() }),
  'finance:mfsAccountStatement': z.object({ accountId: z.string(), fromDate: z.number().optional(), toDate: z.number().optional() }),
  'finance:mfsAccountBalance': z.object({ accountId: z.string() }),
  'finance:mfsProviderList': z.object({}),
  'finance:mfsTransactionList': z.object({ businessId: z.string(), limit: z.number().optional(), offset: z.number().optional(), filters: z.any().optional() }),
  'finance:mfsCashIn': z.object({}).passthrough(),
  'finance:mfsCashOut': z.object({}).passthrough(),

  'finance:expenseCategoryList': z.object({ businessId: z.string() }),
  'finance:expenseCreate': z.object({}).passthrough(),
  'finance:expenseList': z.object({ businessId: z.string(), limit: z.number().optional(), offset: z.number().optional(), filters: z.any().optional() }),
  'finance:expenseGet': z.object({ id: z.string() }),
  'finance:expenseVoid': z.object({ id: z.string(), reason: z.string(), businessId: z.string() }),

  'finance:dashboard': z.object({ businessId: z.string() }),
  'finance:reconcile': z.object({ businessId: z.string(), accountId: z.string(), accountType: z.string() }),

  'finance:shiftOpen': z.object({}).passthrough(),
  'finance:shiftList': z.object({ businessId: z.string(), limit: z.number().optional(), offset: z.number().optional() }),
  'finance:shiftGet': z.object({ id: z.string() }),
  'finance:shiftCurrent': z.object({ businessId: z.string() }),
  'finance:shiftClose': z.object({ shiftId: z.string(), actualCashPaisa: z.number(), notes: z.string().optional() }),
  'finance:shiftReconciliation': z.object({ shiftId: z.string() }),

  'pos:productByBarcode': z.object({ businessId: z.string(), barcode: z.string() }),
  'pos:productSearch': z.object({ businessId: z.string(), query: z.string(), limit: z.number().optional() }),
  'pos:holdSale': z.object({}).passthrough(),
  'pos:heldSalesList': z.object({ businessId: z.string() }),
  'pos:heldSaleGet': z.object({ id: z.string() }),
  'pos:heldSaleCancel': z.object({ id: z.string() }),
  'pos:heldSaleResume': z.object({ id: z.string() }),
  'pos:currentShift': z.object({ businessId: z.string() }),
  'pos:stockLevel': z.object({ productId: z.string() }),

  // Backup P4.3
  'backup:create': z.object({
    type: z.enum(['manual', 'automatic', 'safety-pre-restore', 'auto-startup']).optional(),
    businessId: z.string().min(10).max(64).optional(),
    notes: z.string().max(500).optional(),
  }).passthrough(),
  'backup:list': z.object({}),
  'backup:validate': z.object({
    filePath: z.string().min(1).max(500),
  }),
  'backup:restore': z.object({
    filePath: z.string().min(1).max(500),
  }),
  'backup:delete': z.object({
    filePath: z.string().min(1).max(500),
  }),
  'backup:getConfig': z.object({}),
  'backup:saveConfig': z.object({
    enabled: z.boolean().optional(),
    autoBackupOnStartup: z.boolean().optional(),
    autoBackupOnClose: z.boolean().optional(),
    retentionCount: z.number().int().min(1).max(100).optional(),
    retentionDays: z.number().int().min(0).max(365).optional(),
    backupPath: z.string().max(500).optional(),
  }).passthrough(),
  'backup:getStatus': z.object({}),
  'backup:openFolder': z.object({}),
  'backup:getDetails': z.object({
    filePath: z.string().min(1).max(500),
  }),
  'log:getRecent': z.object({}).passthrough(),
} as const;

export type IpcChannel = keyof typeof ipcPayloadSchemas;

export function validateIpcPayload(channel: string, payload: unknown): { valid: boolean; error?: string } {
  const schema = (ipcPayloadSchemas as Record<string, z.ZodSchema>)[channel];
  if (!schema) {
    return { valid: false, error: `Unknown channel: ${channel}` };
  }
  try {
    schema.parse(payload);
    return { valid: true };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { valid: false, error: e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ') };
    }
    return { valid: false, error: String(e) };
  }
}
