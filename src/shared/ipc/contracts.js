"use strict";
/**
 * Typed IPC contracts — source of truth for main <-> renderer communication
 * No arbitrary channels allowed
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_IPC_CHANNELS = exports.IPC_CHANNELS = void 0;
exports.IPC_CHANNELS = {
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
    // Backup (future)
    BACKUP_CREATE: 'backup:create',
    BACKUP_LIST: 'backup:list',
    BACKUP_RESTORE: 'backup:restore',
    // Logging
    LOG_GET_RECENT: 'log:getRecent',
};
// Allowlist for preload bridge — only these channels can be invoked from renderer
exports.ALLOWED_IPC_CHANNELS = Object.values(exports.IPC_CHANNELS);
