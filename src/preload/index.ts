/**
 * Preload bridge — secure, restrictive IPC surface
 * Renderer must not receive unrestricted Node.js access
 */

import { contextBridge, ipcRenderer } from 'electron';
import { ALLOWED_IPC_CHANNELS, type IpcChannel } from '../shared/ipc/contracts';

// Type-safe IPC invoke
async function invoke(channel: IpcChannel, payload?: unknown) {
  if (!ALLOWED_IPC_CHANNELS.includes(channel)) {
    throw new Error(`Blocked IPC channel: ${channel}`);
  }
  return ipcRenderer.invoke(channel, payload);
}

// Expose only allowlisted, typed API to renderer
const merqoAPI = {
  // App
  app: {
    getInfo: () => invoke('app:getInfo'),
    getVersion: () => invoke('app:getVersion'),
    getPaths: () => invoke('app:getPaths'),
  },

  // DB
  db: {
    getStatus: () => invoke('db:getStatus'),
    checkIntegrity: () => invoke('db:checkIntegrity'),
    isFirstLaunch: () => invoke('db:isFirstLaunch'),
  },

  // Auth
  auth: {
    login: (payload: { phone: string; password: string }) => invoke('auth:login', payload),
    loginWithPin: (payload: { phone: string; pin: string }) => invoke('auth:loginWithPin', payload),
    logout: () => invoke('auth:logout'),
    getSession: () => invoke('auth:getSession'),
    verifyPassword: (payload: { password: string }) => invoke('auth:verifyPassword', payload),
  },

  // Business
  business: {
    get: () => invoke('business:get'),
  },

  // Settings
  settings: {
    get: (key: string) => invoke('settings:get', { key }),
    getAll: () => invoke('settings:getAll'),
    set: (key: string, value: unknown) => invoke('settings:set', { key, value }),
  },

  // System
  system: {
    getConfig: () => invoke('system:getConfig'),
  },

  // Suppliers
  supplier: {
    create: (payload: any) => invoke('supplier:create', payload),
    update: (payload: { id: string; data: any }) => invoke('supplier:update', payload),
    get: (id: string) => invoke('supplier:get', { id }),
    list: (businessId: string) => invoke('supplier:list', { businessId }),
    search: (payload: { businessId: string; query: string; includeInactive?: boolean }) => invoke('supplier:search', payload),
    deactivate: (id: string) => invoke('supplier:deactivate', { id }),
    delete: (id: string) => invoke('supplier:delete', { id }),
    statement: (payload: { supplierId: string; fromDate?: number; toDate?: number }) => invoke('supplier:statement', payload),
    transactions: (payload: { supplierId: string; limit?: number }) => invoke('supplier:transactions', payload),
    pay: (payload: any) => invoke('supplier:pay', payload),
  },

  // Purchases
  purchase: {
    create: (payload: any) => invoke('purchase:create', payload),
    get: (id: string) => invoke('purchase:get', { id }),
    list: (payload: { businessId: string; filters?: any; limit?: number; offset?: number }) => invoke('purchase:list', payload),
    cancel: (payload: { id: string; reason: string }) => invoke('purchase:cancel', payload),
    returnCreate: (payload: any) => invoke('purchase:returnCreate', payload),
    returnList: (purchaseId: string) => invoke('purchase:returnList', { purchaseId }),
  },

  // Products
  product: {
    search: (payload: { businessId: string; query: string }) => invoke('product:search', payload),
    get: (id: string) => invoke('product:get', { id }),
  },

  // Units
  unit: {
    list: (businessId: string) => invoke('unit:list', { businessId }),
    conversions: (businessId: string) => invoke('unit:conversions', { businessId }),
  },

  // Customers
  customer: {
    create: (payload: any) => invoke('customer:create', payload),
    update: (payload: { id: string; data: any }) => invoke('customer:update', payload),
    get: (id: string) => invoke('customer:get', { id }),
    list: (businessId: string) => invoke('customer:list', { businessId }),
    search: (payload: { businessId: string; query: string; includeInactive?: boolean }) => invoke('customer:search', payload),
    deactivate: (id: string) => invoke('customer:deactivate', { id }),
    activate: (id: string) => invoke('customer:activate', { id }),
    delete: (id: string) => invoke('customer:delete', { id }),
    statement: (payload: { customerId: string; fromDate?: number; toDate?: number }) => invoke('customer:statement', payload),
    transactions: (payload: { customerId: string; limit?: number }) => invoke('customer:transactions', payload),
    collect: (payload: any) => invoke('customer:collect', payload),
  },

  // Sales
  sale: {
    create: (payload: any) => invoke('sale:create', payload),
    get: (id: string) => invoke('sale:get', { id }),
    list: (payload: { businessId: string; filters?: any; limit?: number; offset?: number }) => invoke('sale:list', payload),
    cancel: (payload: { id: string; reason: string }) => invoke('sale:cancel', payload),
    returnCreate: (payload: any) => invoke('sale:returnCreate', payload),
    returnList: (saleId: string) => invoke('sale:returnList', { saleId }),
  },

  // Finance - Phase 3D
  finance: {
    cashAccounts: (businessId: string) => invoke('finance:cashAccountList', { businessId }),
    cashAccountCreate: (payload: any) => invoke('finance:cashAccountCreate', payload),
    cashAccountGet: (id: string) => invoke('finance:cashAccountGet', { id }),
    cashAccountUpdate: (payload: { id: string; data: any; businessId: string }) => invoke('finance:cashAccountUpdate', payload),
    cashAccountDeactivate: (payload: { id: string; businessId: string }) => invoke('finance:cashAccountDeactivate', payload),
    cashAccountStatement: (payload: { accountId: string; fromDate?: number; toDate?: number }) => invoke('finance:cashAccountStatement', payload),
    cashAccountBalance: (accountId: string) => invoke('finance:cashAccountBalance', { accountId }),
    cashMovements: (payload: { businessId: string; limit?: number; offset?: number; filters?: any }) => invoke('finance:cashMovementList', payload),
    bankAccounts: (businessId: string) => invoke('finance:bankAccountList', { businessId }),
    bankAccountCreate: (payload: any) => invoke('finance:bankAccountCreate', payload),
    bankAccountGet: (id: string) => invoke('finance:bankAccountGet', { id }),
    bankAccountUpdate: (payload: { id: string; data: any }) => invoke('finance:bankAccountUpdate', payload),
    bankAccountDeactivate: (id: string) => invoke('finance:bankAccountDeactivate', { id }),
    bankAccountStatement: (payload: { accountId: string; fromDate?: number; toDate?: number }) => invoke('finance:bankAccountStatement', payload),
    bankAccountBalance: (accountId: string) => invoke('finance:bankAccountBalance', { accountId }),
    bankTransactions: (payload: { businessId: string; limit?: number; offset?: number; filters?: any }) => invoke('finance:bankTransactionList', payload),
    mfsAccounts: (businessId: string) => invoke('finance:mfsAccountList', { businessId }),
    mfsAccountCreate: (payload: any) => invoke('finance:mfsAccountCreate', payload),
    mfsAccountGet: (id: string) => invoke('finance:mfsAccountGet', { id }),
    mfsAccountUpdate: (payload: { id: string; data: any }) => invoke('finance:mfsAccountUpdate', payload),
    mfsAccountDeactivate: (id: string) => invoke('finance:mfsAccountDeactivate', { id }),
    mfsAccountStatement: (payload: { accountId: string; fromDate?: number; toDate?: number }) => invoke('finance:mfsAccountStatement', payload),
    mfsAccountBalance: (accountId: string) => invoke('finance:mfsAccountBalance', { accountId }),
    mfsProviders: () => invoke('finance:mfsProviderList'),
    mfsTransactions: (payload: { businessId: string; limit?: number; offset?: number; filters?: any }) => invoke('finance:mfsTransactionList', payload),
    mfsCashIn: (payload: any) => invoke('finance:mfsCashIn', payload),
    mfsCashOut: (payload: any) => invoke('finance:mfsCashOut', payload),
    cashTransfer: (payload: any) => invoke('finance:cashTransferCreate', payload),
    transfers: (businessId: string) => invoke('finance:transferList', { businessId }),
    expenseCategories: (businessId: string) => invoke('finance:expenseCategoryList', { businessId }),
    expenseCreate: (payload: any) => invoke('finance:expenseCreate', payload),
    expenses: (payload: { businessId: string; limit?: number; offset?: number; filters?: any }) => invoke('finance:expenseList', payload),
    expenseGet: (id: string) => invoke('finance:expenseGet', { id }),
    expenseVoid: (payload: { id: string; reason: string; businessId: string }) => invoke('finance:expenseVoid', payload),
    dashboard: (businessId: string) => invoke('finance:dashboard', { businessId }),
    reconcile: (payload: { businessId: string; accountId: string; accountType: string }) => invoke('finance:reconcile', payload),
  },

  // Shifts
  shift: {
    open: (payload: any) => invoke('finance:shiftOpen', payload),
    list: (businessId: string) => invoke('finance:shiftList', { businessId }),
    get: (id: string) => invoke('finance:shiftGet', { id }),
    current: (businessId: string) => invoke('finance:shiftCurrent', { businessId }),
    close: (payload: { shiftId: string; actualCashPaisa: number; notes?: string }) => invoke('finance:shiftClose', payload),
    reconciliation: (shiftId: string) => invoke('finance:shiftReconciliation', { shiftId }),
  },

  // POS
  pos: {
    productByBarcode: (payload: { businessId: string; barcode: string }) => invoke('pos:productByBarcode', payload),
    productSearch: (payload: { businessId: string; query: string; limit?: number }) => invoke('pos:productSearch', payload),
    stockLevel: (payload: { productId: string }) => invoke('pos:stockLevel', payload),
    holdSale: (payload: any) => invoke('pos:holdSale', payload),
    heldSalesList: (businessId: string) => invoke('pos:heldSalesList', { businessId }),
    heldSaleGet: (id: string) => invoke('pos:heldSaleGet', { id }),
    heldSaleCancel: (id: string) => invoke('pos:heldSaleCancel', { id }),
    heldSaleResume: (id: string) => invoke('pos:heldSaleResume', { id }),
    currentShift: (businessId: string) => invoke('pos:currentShift', { businessId }),
  },

  // Hardware — P4.2
  hardware: {
    getPrinters: () => invoke('hardware:getPrinters'),
    getDefaultPrinter: () => invoke('hardware:getDefaultPrinter'),
    getConfiguredPrinter: () => invoke('hardware:getConfiguredPrinter'),
    savePrinterConfig: (config: any) => invoke('hardware:savePrinterConfig', config),
    getPrinterStatus: (id: string) => invoke('hardware:getPrinterStatus', { id }),
    printReceipt: (payload: { saleId: string; printerId?: string; printerName?: string; paperWidth?: string; copies?: number; silent?: boolean }) => invoke('hardware:printReceipt', payload),
    printInvoice: (payload: { saleId: string; printerId?: string; printerName?: string; copies?: number; silent?: boolean }) => invoke('hardware:printInvoice', payload),
    reprintReceipt: (payload: { saleId: string; printerId?: string; printerName?: string; paperWidth?: string; copies?: number; silent?: boolean }) => invoke('hardware:reprintReceipt', payload),
    testPrinter: (id: string) => invoke('hardware:testPrinter', { id }),
    getScannerConfig: () => invoke('hardware:getScannerConfig'),
    saveScannerConfig: (config: any) => invoke('hardware:saveScannerConfig', config),
    getDiagnostics: () => invoke('hardware:getDiagnostics'),
    barcodeTest: (barcode: string) => invoke('hardware:barcodeTest', { barcode }),
  },

  // Reports — P4.4
  report: {
    salesSummary: (payload: any) => invoke('report:salesSummary', payload),
    salesByProduct: (payload: any) => invoke('report:salesByProduct', payload),
    salesByCategory: (payload: any) => invoke('report:salesByCategory', payload),
    salesByCashier: (payload: any) => invoke('report:salesByCashier', payload),
    salesByPayment: (payload: any) => invoke('report:salesByPayment', payload),
    purchaseSummary: (payload: any) => invoke('report:purchaseSummary', payload),
    purchaseBySupplier: (payload: any) => invoke('report:purchaseBySupplier', payload),
    purchaseByProduct: (payload: any) => invoke('report:purchaseByProduct', payload),
    inventoryStock: (payload: any) => invoke('report:inventoryStock', payload),
    lowStock: (payload: any) => invoke('report:lowStock', payload),
    stockValuation: (payload: any) => invoke('report:stockValuation', payload),
    stockMovements: (payload: any) => invoke('report:stockMovements', payload),
    customerDue: (payload: any) => invoke('report:customerDue', payload),
    customerStatement: (payload: { customerId: string; fromDate?: number; toDate?: number }) => invoke('report:customerStatement', payload),
    supplierPayable: (payload: any) => invoke('report:supplierPayable', payload),
    supplierStatement: (payload: { supplierId: string; fromDate?: number; toDate?: number }) => invoke('report:supplierStatement', payload),
    cash: (payload: { accountId: string; fromDate?: number; toDate?: number }) => invoke('report:cash', payload),
    bank: (payload: { accountId: string; fromDate?: number; toDate?: number }) => invoke('report:bank', payload),
    mfs: (payload: { accountId: string; fromDate?: number; toDate?: number }) => invoke('report:mfs', payload),
    expenseSummary: (payload: any) => invoke('report:expenseSummary', payload),
    expenseByCategory: (payload: any) => invoke('report:expenseByCategory', payload),
    expenseList: (payload: any) => invoke('report:expenseList', payload),
    shift: (payload: any) => invoke('report:shift', payload),
    profitLoss: (payload: any) => invoke('report:profitLoss', payload),
    dashboard: (payload: any) => invoke('report:dashboard', payload),
  },

  // Backup — P4.3
  backup: {
    create: (payload?: { type?: string; businessId?: string; notes?: string }) => invoke('backup:create', payload || {}),
    list: () => invoke('backup:list'),
    validate: (filePath: string) => invoke('backup:validate', { filePath }),
    restore: (filePath: string) => invoke('backup:restore', { filePath }),
    delete: (filePath: string) => invoke('backup:delete', { filePath }),
    getConfig: () => invoke('backup:getConfig'),
    saveConfig: (config: any) => invoke('backup:saveConfig', config),
    getStatus: () => invoke('backup:getStatus'),
    openFolder: () => invoke('backup:openFolder'),
    getDetails: (filePath: string) => invoke('backup:getDetails', { filePath }),
  },

  // Generic invoke with validation (for internal use, but still allowlisted)
  invoke: (channel: IpcChannel, payload?: unknown) => invoke(channel, payload),
};

// Security: only expose merqoAPI, no raw ipcRenderer, no Node.js
contextBridge.exposeInMainWorld('merqo', merqoAPI);

// Type for renderer
declare global {
  interface Window {
    merqo: typeof merqoAPI;
  }
}

console.log('Preload bridge initialized — secure IPC surface ready');
