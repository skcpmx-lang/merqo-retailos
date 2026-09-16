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

  // Finance
  finance: {
    cashAccounts: (businessId: string) => invoke('finance:cashAccountList', { businessId }),
    bankAccounts: (businessId: string) => invoke('finance:bankAccountList', { businessId }),
    mfsAccounts: (businessId: string) => invoke('finance:mfsAccountList', { businessId }),
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

  // Hardware (future, but expose now for diagnostics)
  hardware: {
    getPrinters: () => invoke('hardware:getPrinters'),
    testPrinter: (id: string) => invoke('hardware:testPrinter', { id }),
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
