/**
 * Typed IPC contracts — source of truth for main <-> renderer communication
 * No arbitrary channels allowed
 */

export const IPC_CHANNELS = {
  // App
  APP_GET_INFO: 'app:getInfo',
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_PATHS: 'app:getPaths',

  // Database
  DB_GET_STATUS: 'db:getStatus',
  DB_CHECK_INTEGRITY: 'db:checkIntegrity',
  DB_IS_FIRST_LAUNCH: 'db:isFirstLaunch',

  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGIN_WITH_PIN: 'auth:loginWithPin',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_GET_SESSION: 'auth:getSession',
  AUTH_VERIFY_PASSWORD: 'auth:verifyPassword',

  // Business
  BUSINESS_GET: 'business:get',
  BUSINESS_CREATE: 'business:create',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:getAll',

  // System
  SYSTEM_GET_CONFIG: 'system:getConfig',

  // Hardware (future, but define channel allowlist now)
  HARDWARE_GET_PRINTERS: 'hardware:getPrinters',
  HARDWARE_TEST_PRINTER: 'hardware:testPrinter',
  HARDWARE_BARCODE_TEST: 'hardware:barcodeTest',

  // Suppliers
  SUPPLIER_CREATE: 'supplier:create',
  SUPPLIER_UPDATE: 'supplier:update',
  SUPPLIER_GET: 'supplier:get',
  SUPPLIER_LIST: 'supplier:list',
  SUPPLIER_SEARCH: 'supplier:search',
  SUPPLIER_DEACTIVATE: 'supplier:deactivate',
  SUPPLIER_DELETE: 'supplier:delete',
  SUPPLIER_STATEMENT: 'supplier:statement',
  SUPPLIER_TRANSACTIONS: 'supplier:transactions',
  SUPPLIER_PAY: 'supplier:pay',

  // Purchases
  PURCHASE_CREATE: 'purchase:create',
  PURCHASE_GET: 'purchase:get',
  PURCHASE_LIST: 'purchase:list',
  PURCHASE_CANCEL: 'purchase:cancel',
  PURCHASE_RETURN_CREATE: 'purchase:returnCreate',
  PURCHASE_RETURN_LIST: 'purchase:returnList',

  // Products (for purchase form)
  PRODUCT_SEARCH: 'product:search',
  PRODUCT_GET: 'product:get',

  // Units
  UNIT_LIST: 'unit:list',
  UNIT_CONVERSIONS: 'unit:conversions',

  // Customers
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_GET: 'customer:get',
  CUSTOMER_LIST: 'customer:list',
  CUSTOMER_SEARCH: 'customer:search',
  CUSTOMER_DEACTIVATE: 'customer:deactivate',
  CUSTOMER_ACTIVATE: 'customer:activate',
  CUSTOMER_DELETE: 'customer:delete',
  CUSTOMER_STATEMENT: 'customer:statement',
  CUSTOMER_TRANSACTIONS: 'customer:transactions',
  CUSTOMER_COLLECT: 'customer:collect',

  // Sales
  SALE_CREATE: 'sale:create',
  SALE_GET: 'sale:get',
  SALE_LIST: 'sale:list',
  SALE_CANCEL: 'sale:cancel',
  SALE_RETURN_CREATE: 'sale:returnCreate',
  SALE_RETURN_LIST: 'sale:returnList',

  // Finance
  CASH_ACCOUNT_LIST: 'finance:cashAccountList',
  BANK_ACCOUNT_LIST: 'finance:bankAccountList',
  MFS_ACCOUNT_LIST: 'finance:mfsAccountList',

  // POS
  POS_PRODUCT_BY_BARCODE: 'pos:productByBarcode',
  POS_PRODUCT_SEARCH: 'pos:productSearch',
  POS_HOLD_SALE: 'pos:holdSale',
  POS_HELD_SALES_LIST: 'pos:heldSalesList',
  POS_HELD_SALE_GET: 'pos:heldSaleGet',
  POS_HELD_SALE_CANCEL: 'pos:heldSaleCancel',
  POS_HELD_SALE_RESUME: 'pos:heldSaleResume',
  POS_CURRENT_SHIFT: 'pos:currentShift',
  POS_STOCK_LEVEL: 'pos:stockLevel',

  // Backup (future)
  BACKUP_CREATE: 'backup:create',
  BACKUP_LIST: 'backup:list',
  BACKUP_RESTORE: 'backup:restore',

  // Logging
  LOG_GET_RECENT: 'log:getRecent',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

// Allowlist for preload bridge — only these channels can be invoked from renderer
export const ALLOWED_IPC_CHANNELS: IpcChannel[] = Object.values(IPC_CHANNELS);

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    messageBn: string;
    correlationId: string;
    field?: string;
  };
}

// Specific request/response types
export interface AppInfo {
  name: string;
  version: string;
  isDev: boolean;
  isFirstLaunch: boolean;
}

export interface DbStatus {
  isOpen: boolean;
  path: string;
  integrityOk: boolean;
  isFirstLaunch: boolean;
  tableCount: number;
}

export interface SessionInfo {
  isLoggedIn: boolean;
  user?: {
    userId: string;
    name: string;
    phone: string;
    isOwner: boolean;
    permissions: string[];
  };
  sessionId?: string;
  loginAt?: number;
}

export interface BusinessInfo {
  id: string;
  name: string;
  tradeName?: string;
  address?: string;
  phone?: string;
  email?: string;
}
