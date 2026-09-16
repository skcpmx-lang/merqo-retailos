/**
 * IPC handlers — typed, validated, secure
 * All handlers wrapped with error handling and logging
 */

import { ipcMain, app } from 'electron';
import { IPC_CHANNELS, type IpcResponse } from '@shared/ipc/contracts';
import { validateChannel, validatePayload } from './validator';
import { logger } from '../logging/logger';
import { getConfigManager } from '../config';
import { getConnection, checkIntegrity, isConnectionOpen } from '../db/connection';
import { Migrator } from '../db/migrator';
import { sessionManager } from '../security/session';
import { HashingService } from '../security/hashing';
import { AppError } from '@core/domain/errors/AppError';
import { Id } from '@core/domain/Id';

function withErrorHandling<T>(handler: (event: Electron.IpcMainInvokeEvent, payload: unknown) => Promise<T>) {
  return async (event: Electron.IpcMainInvokeEvent, payload: unknown): Promise<IpcResponse<T>> => {
    const correlationId = Id.generate();
    const start = Date.now();
    const channel = (event as any)._channel || 'unknown';

    try {
      // Validate channel (event doesn't have channel, we pass via closure)
      // Payload already validated in wrapper below
      const result = await handler(event, payload);
      const duration = Date.now() - start;
      logger.ipcResponse(channel, correlationId, duration, true);
      return { success: true, data: result };
    } catch (e) {
      const duration = Date.now() - start;
      logger.ipcResponse(channel, correlationId, duration, false);

      if (e instanceof AppError) {
        logger.warn(`IPC error: ${channel}`, { correlationId, code: e.code, message: e.message });
        return {
          success: false,
          error: {
            code: e.code,
            message: e.message,
            messageBn: e.messageBn,
            correlationId: e.correlationId,
            field: e.field,
          },
        };
      }

      const error = e instanceof Error ? e : new Error(String(e));
      logger.error(`IPC unhandled error: ${channel}`, error, { correlationId });
      return {
        success: false,
        error: {
          code: 'SYSTEM_ERROR',
          message: error.message,
          messageBn: 'একটি সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
          correlationId,
        },
      };
    }
  };
}

function createHandler<T>(channel: string, handler: (event: Electron.IpcMainInvokeEvent, payload: any) => Promise<T>) {
  const wrapped = withErrorHandling(handler);
  // Store channel for logging
  const handlerWithChannel = async (event: Electron.IpcMainInvokeEvent, payload: unknown) => {
    (event as any)._channel = channel;
    validateChannel(channel);
    validatePayload(channel, payload);
    logger.ipcRequest(channel, Id.generate(), sessionManager.getCurrentUser()?.userId);
    return wrapped(event, payload);
  };
  ipcMain.handle(channel, handlerWithChannel);
}

export function registerIpcHandlers() {
  logger.info('Registering IPC handlers');

  // App
  createHandler(IPC_CHANNELS.APP_GET_INFO, async () => {
    const config = getConfigManager().getAppConfig();
    const migrator = new Migrator();
    const isFirstLaunch = migrator.isFirstLaunch();
    return {
      name: config.appName,
      version: config.version,
      isDev: config.isDev,
      isFirstLaunch,
    };
  });

  createHandler(IPC_CHANNELS.APP_GET_VERSION, async () => {
    return app.getVersion();
  });

  createHandler(IPC_CHANNELS.APP_GET_PATHS, async () => {
    const config = getConfigManager().getAppConfig();
    return {
      userData: config.userDataPath,
      logs: config.logsPath,
      backups: config.backupsPath,
      db: config.dbPath,
    };
  });

  // DB
  createHandler(IPC_CHANNELS.DB_GET_STATUS, async () => {
    const config = getConfigManager().getAppConfig();
    const db = getConnection();
    const tableCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number };
    const integrity = checkIntegrity();
    const migrator = new Migrator(db);
    return {
      isOpen: isConnectionOpen(),
      path: config.dbPath,
      integrityOk: integrity.ok,
      isFirstLaunch: migrator.isFirstLaunch(),
      tableCount: tableCount.count,
    };
  });

  createHandler(IPC_CHANNELS.DB_CHECK_INTEGRITY, async () => {
    return checkIntegrity();
  });

  createHandler(IPC_CHANNELS.DB_IS_FIRST_LAUNCH, async () => {
    const migrator = new Migrator();
    return { isFirstLaunch: migrator.isFirstLaunch() };
  });

  // Auth
  createHandler(IPC_CHANNELS.AUTH_LOGIN, async (_event, payload: { phone: string; password: string }) => {
    const db = getConnection();
    const user = db.prepare('SELECT * FROM users WHERE phone = ? AND deleted_at IS NULL').get(payload.phone) as any;

    if (!user) {
      throw new AppError({
        code: 'AUTHENTICATION_ERROR',
        message: 'User not found',
        messageBn: 'ব্যবহারকারী পাওয়া যায়নি',
        statusCode: 401,
      });
    }

    if (!user.is_active) {
      throw new AppError({
        code: 'AUTHENTICATION_ERROR',
        message: 'User inactive',
        messageBn: 'এই অ্যাকাউন্টটি নিষ্ক্রিয়',
        statusCode: 401,
      });
    }

    const valid = await HashingService.verifyPassword(user.password_hash, payload.password);
    if (!valid) {
      throw new AppError({
        code: 'AUTHENTICATION_ERROR',
        message: 'Invalid password',
        messageBn: 'পাসওয়ার্ড সঠিক নয়',
        statusCode: 401,
      });
    }

    // Update last login
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Date.now(), user.id);

    // Get permissions
    const permissions = db.prepare(`
      SELECT p.id FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      JOIN user_roles ur ON ur.role_id = rp.role_id
      WHERE ur.user_id = ?
    `).all(user.id) as Array<{ id: string }>;

    const sessionUser = {
      userId: user.id,
      businessId: user.business_id,
      name: user.name,
      phone: user.phone,
      isOwner: !!user.is_owner,
      roleIds: [],
      permissions: permissions.map(p => p.id),
    };

    const session = sessionManager.createSession(sessionUser);

    // Audit log
    try {
      const auditId = Id.generate();
      db.prepare(`
        INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, description, description_bn, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(auditId, user.business_id, user.id, 'login', 'user', `User ${user.name} logged in`, `ব্যবহারকারী ${user.name} লগইন করেছেন`, Date.now());
    } catch (e) {
      logger.warn('Failed to create audit log for login', { error: String(e) });
    }

    return {
      sessionId: session.sessionId,
      user: sessionUser,
    };
  });

  createHandler(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    const session = sessionManager.getSession();
    if (session) {
      const db = getConnection();
      try {
        const auditId = Id.generate();
        db.prepare(`
          INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, description, description_bn, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(auditId, session.user.businessId, session.user.userId, 'logout', 'user', `User ${session.user.name} logged out`, `ব্যবহারকারী ${session.user.name} লগআউট করেছেন`, Date.now());
      } catch {}
    }
    sessionManager.clearSession();
    return { success: true };
  });

  createHandler(IPC_CHANNELS.AUTH_GET_SESSION, async () => {
    const session = sessionManager.getSession();
    if (!session || sessionManager.isExpired()) {
      return { isLoggedIn: false };
    }
    sessionManager.updateActivity();
    return {
      isLoggedIn: true,
      user: session.user,
      sessionId: session.sessionId,
      loginAt: session.loginAt,
    };
  });

  createHandler(IPC_CHANNELS.AUTH_VERIFY_PASSWORD, async (_event, payload: { password: string }) => {
    const currentUser = sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new AppError({
        code: 'AUTHENTICATION_ERROR',
        message: 'Not logged in',
        messageBn: 'লগইন করা নেই',
        statusCode: 401,
      });
    }
    const db = getConnection();
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(currentUser.userId) as any;
    if (!user) return { valid: false };
    const valid = await HashingService.verifyPassword(user.password_hash, payload.password);
    return { valid };
  });

  // Business
  createHandler(IPC_CHANNELS.BUSINESS_GET, async () => {
    const db = getConnection();
    const business = db.prepare('SELECT * FROM businesses LIMIT 1').get() as any;
    return business || null;
  });

  // Settings
  createHandler(IPC_CHANNELS.SETTINGS_GET, async (_event, payload: { key: string }) => {
    const db = getConnection();
    const setting = db.prepare('SELECT * FROM system_settings WHERE key = ?').get(payload.key) as any;
    return setting || null;
  });

  createHandler(IPC_CHANNELS.SETTINGS_GET_ALL, async () => {
    const db = getConnection();
    const settings = db.prepare('SELECT * FROM system_settings').all() as any[];
    return settings;
  });

  createHandler(IPC_CHANNELS.SETTINGS_SET, async (_event, payload: { key: string; value: unknown }) => {
    const db = getConnection();
    const valueStr = typeof payload.value === 'string' ? payload.value : JSON.stringify(payload.value);
    db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `).run(payload.key, valueStr, Date.now(), valueStr, Date.now());
    return { success: true };
  });

  createHandler(IPC_CHANNELS.SYSTEM_GET_CONFIG, async () => {
    const config = getConfigManager();
    return {
      app: config.getAppConfig(),
      userSettings: config.getUserSettings(),
      businessConfig: config.getBusinessConfig(),
    };
  });

  // Suppliers
  createHandler(IPC_CHANNELS.SUPPLIER_CREATE, async (_event, payload: any) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SupplierService } = require('../services/supplier.service');
    const service = new SupplierService(db);
    // Authorization check
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('suppliers.manage') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'সাপ্লায়ার তৈরির অনুমতি নেই', statusCode: 403 });
    }
    return service.create({ ...payload, createdBy: currentUser?.userId });
  });

  createHandler(IPC_CHANNELS.SUPPLIER_UPDATE, async (_event, payload: { id: string; data: any }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SupplierService } = require('../services/supplier.service');
    const service = new SupplierService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('suppliers.manage') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'অনুমতি নেই', statusCode: 403 });
    }
    return service.update(payload.id, { ...payload.data, updatedBy: currentUser?.userId });
  });

  createHandler(IPC_CHANNELS.SUPPLIER_GET, async (_event, payload: { id: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SupplierService } = require('../services/supplier.service');
    const service = new SupplierService(db);
    return service.findById(payload.id);
  });

  createHandler(IPC_CHANNELS.SUPPLIER_LIST, async (_event, payload: { businessId: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SupplierService } = require('../services/supplier.service');
    const service = new SupplierService(db);
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    if (!businessId) throw new AppError({ code: 'VALIDATION_ERROR', message: 'businessId required', messageBn: 'ব্যবসা আইডি প্রয়োজন', statusCode: 400 });
    return service.findByBusiness(businessId);
  });

  createHandler(IPC_CHANNELS.SUPPLIER_SEARCH, async (_event, payload: { businessId: string; query: string; includeInactive?: boolean }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SupplierService } = require('../services/supplier.service');
    const service = new SupplierService(db);
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    return service.search(businessId, payload.query || '', payload.includeInactive);
  });

  createHandler(IPC_CHANNELS.SUPPLIER_DEACTIVATE, async (_event, payload: { id: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SupplierService } = require('../services/supplier.service');
    const service = new SupplierService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('suppliers.manage') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'অনুমতি নেই', statusCode: 403 });
    }
    service.deactivate(payload.id, currentUser?.userId);
    return { success: true };
  });

  createHandler(IPC_CHANNELS.SUPPLIER_DELETE, async (_event, payload: { id: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SupplierService } = require('../services/supplier.service');
    const service = new SupplierService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('suppliers.manage') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'অনুমতি নেই', statusCode: 403 });
    }
    service.delete(payload.id, currentUser?.userId);
    return { success: true };
  });

  createHandler(IPC_CHANNELS.SUPPLIER_STATEMENT, async (_event, payload: { supplierId: string; fromDate?: number; toDate?: number }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SupplierService } = require('../services/supplier.service');
    const service = new SupplierService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('suppliers.manage') && !currentUser.permissions.includes('purchases.view') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'সাপ্লায়ার আর্থিক তথ্য দেখার অনুমতি নেই', statusCode: 403 });
    }
    return service.getStatement(payload.supplierId, payload.fromDate, payload.toDate);
  });

  createHandler(IPC_CHANNELS.SUPPLIER_TRANSACTIONS, async (_event, payload: { supplierId: string; limit?: number }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SupplierService } = require('../services/supplier.service');
    const service = new SupplierService(db);
    return service.getTransactionHistory(payload.supplierId, payload.limit);
  });

  createHandler(IPC_CHANNELS.SUPPLIER_PAY, async (_event, payload: any) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { PurchaseService } = require('../services/purchase.service');
    const service = new PurchaseService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('purchases.payment') && !currentUser.permissions.includes('suppliers.manage') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'পরিশোধের অনুমতি নেই', statusCode: 403 });
    }
    return service.paySupplier({ ...payload, createdBy: currentUser?.userId });
  });

  // Purchases
  createHandler(IPC_CHANNELS.PURCHASE_CREATE, async (_event, payload: any) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { PurchaseService } = require('../services/purchase.service');
    const service = new PurchaseService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('purchases.create') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'ক্রয় তৈরির অনুমতি নেই', statusCode: 403 });
    }
    return service.create({ ...payload, businessId: payload.businessId || currentUser?.businessId, createdBy: currentUser?.userId });
  });

  createHandler(IPC_CHANNELS.PURCHASE_GET, async (_event, payload: { id: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { PurchaseService } = require('../services/purchase.service');
    const service = new PurchaseService(db);
    return service.findById(payload.id);
  });

  createHandler(IPC_CHANNELS.PURCHASE_LIST, async (_event, payload: { businessId: string; filters?: any; limit?: number; offset?: number }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { PurchaseService } = require('../services/purchase.service');
    const service = new PurchaseService(db);
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    return service.findByBusiness(businessId, payload.filters, payload.limit, payload.offset);
  });

  createHandler(IPC_CHANNELS.PURCHASE_CANCEL, async (_event, payload: { id: string; reason: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { PurchaseService } = require('../services/purchase.service');
    const service = new PurchaseService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('purchases.create') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'বাতিলের অনুমতি নেই', statusCode: 403 });
    }
    service.cancel(payload.id, payload.reason, currentUser?.userId);
    return { success: true };
  });

  createHandler(IPC_CHANNELS.PURCHASE_RETURN_CREATE, async (_event, payload: any) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { PurchaseService } = require('../services/purchase.service');
    const service = new PurchaseService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('purchases.create') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'ফেরতের অনুমতি নেই', statusCode: 403 });
    }
    return service.createReturn({ ...payload, createdBy: currentUser?.userId });
  });

  createHandler(IPC_CHANNELS.PURCHASE_RETURN_LIST, async (_event, payload: { purchaseId: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { PurchaseReturnRepository } = require('../db/repositories/purchase.repository');
    const repo = new PurchaseReturnRepository(db);
    return repo.findByPurchase(payload.purchaseId);
  });

  // Products for purchase form
  createHandler(IPC_CHANNELS.PRODUCT_SEARCH, async (_event, payload: { businessId: string; query: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { ProductRepository } = require('../db/repositories/product.repository');
    const repo = new ProductRepository(db);
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    return repo.search(businessId, payload.query || '');
  });

  createHandler(IPC_CHANNELS.PRODUCT_GET, async (_event, payload: { id: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { ProductRepository } = require('../db/repositories/product.repository');
    const repo = new ProductRepository(db);
    return repo.findById(payload.id);
  });

  // Units
  createHandler(IPC_CHANNELS.UNIT_LIST, async (_event, payload: { businessId: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { UnitRepository } = require('../db/repositories/unit.repository');
    const repo = new UnitRepository(db);
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    return repo.findByBusiness(businessId);
  });

  createHandler(IPC_CHANNELS.UNIT_CONVERSIONS, async (_event, payload: { businessId: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { UnitConversionRepository } = require('../db/repositories/unit.repository');
    const repo = new UnitConversionRepository(db);
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    return repo.findByBusiness(businessId);
  });

  // Customers
  createHandler(IPC_CHANNELS.CUSTOMER_CREATE, async (_event, payload: any) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { CustomerService } = require('../services/customer.service');
    const service = new CustomerService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('customers.manage') && !currentUser.permissions.includes('customer.create') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'গ্রাহক তৈরির অনুমতি নেই', statusCode: 403 });
    }
    return service.create({ ...payload, createdBy: currentUser?.userId });
  });

  createHandler(IPC_CHANNELS.CUSTOMER_UPDATE, async (_event, payload: { id: string; data: any }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { CustomerService } = require('../services/customer.service');
    const service = new CustomerService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('customers.manage') && !currentUser.permissions.includes('customer.update') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'অনুমতি নেই', statusCode: 403 });
    }
    return service.update(payload.id, { ...payload.data, updatedBy: currentUser?.userId });
  });

  createHandler(IPC_CHANNELS.CUSTOMER_GET, async (_event, payload: { id: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { CustomerService } = require('../services/customer.service');
    const service = new CustomerService(db);
    return service.findById(payload.id);
  });

  createHandler(IPC_CHANNELS.CUSTOMER_LIST, async (_event, payload: { businessId: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { CustomerService } = require('../services/customer.service');
    const service = new CustomerService(db);
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    if (!businessId) throw new AppError({ code: 'VALIDATION_ERROR', message: 'businessId required', messageBn: 'ব্যবসা আইডি প্রয়োজন', statusCode: 400 });
    return service.findByBusiness(businessId);
  });

  createHandler(IPC_CHANNELS.CUSTOMER_SEARCH, async (_event, payload: { businessId: string; query: string; includeInactive?: boolean }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { CustomerService } = require('../services/customer.service');
    const service = new CustomerService(db);
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    return service.search(businessId, payload.query || '', payload.includeInactive);
  });

  createHandler(IPC_CHANNELS.CUSTOMER_DEACTIVATE, async (_event, payload: { id: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { CustomerService } = require('../services/customer.service');
    const service = new CustomerService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('customers.manage') && !currentUser.permissions.includes('customer.deactivate') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'অনুমতি নেই', statusCode: 403 });
    }
    service.deactivate(payload.id, currentUser?.userId);
    return { success: true };
  });

  createHandler(IPC_CHANNELS.CUSTOMER_ACTIVATE, async (_event, payload: { id: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { CustomerService } = require('../services/customer.service');
    const service = new CustomerService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('customers.manage') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'অনুমতি নেই', statusCode: 403 });
    }
    service.activate(payload.id, currentUser?.userId);
    return { success: true };
  });

  createHandler(IPC_CHANNELS.CUSTOMER_DELETE, async (_event, payload: { id: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { CustomerService } = require('../services/customer.service');
    const service = new CustomerService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('customers.manage') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'অনুমতি নেই', statusCode: 403 });
    }
    service.delete(payload.id, currentUser?.userId);
    return { success: true };
  });

  createHandler(IPC_CHANNELS.CUSTOMER_STATEMENT, async (_event, payload: { customerId: string; fromDate?: number; toDate?: number }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { CustomerService } = require('../services/customer.service');
    const service = new CustomerService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('customers.manage') && !currentUser.permissions.includes('customer.statement') && !currentUser.permissions.includes('sales.view') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'গ্রাহক আর্থিক তথ্য দেখার অনুমতি নেই', statusCode: 403 });
    }
    return service.getStatement(payload.customerId, payload.fromDate, payload.toDate);
  });

  createHandler(IPC_CHANNELS.CUSTOMER_TRANSACTIONS, async (_event, payload: { customerId: string; limit?: number }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { CustomerService } = require('../services/customer.service');
    const service = new CustomerService(db);
    return service.getTransactionHistory(payload.customerId, payload.limit);
  });

  createHandler(IPC_CHANNELS.CUSTOMER_COLLECT, async (_event, payload: any) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { CustomerService } = require('../services/customer.service');
    const service = new CustomerService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('customers.manage') && !currentUser.permissions.includes('customer.collect') && !currentUser.permissions.includes('sales.payment') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'বকেয়া আদায়ের অনুমতি নেই', statusCode: 403 });
    }
    return service.collectDue({ ...payload, createdBy: currentUser?.userId });
  });

  // Sales
  createHandler(IPC_CHANNELS.SALE_CREATE, async (_event, payload: any) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SaleService } = require('../services/sale.service');
    const service = new SaleService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('sales.create') && !currentUser.permissions.includes('pos.sell') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'বিক্রয় তৈরির অনুমতি নেই', statusCode: 403 });
    }
    return service.create({ ...payload, businessId: payload.businessId || currentUser?.businessId, createdBy: currentUser?.userId });
  });

  createHandler(IPC_CHANNELS.SALE_GET, async (_event, payload: { id: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SaleService } = require('../services/sale.service');
    const service = new SaleService(db);
    return service.findById(payload.id);
  });

  createHandler(IPC_CHANNELS.SALE_LIST, async (_event, payload: { businessId: string; filters?: any; limit?: number; offset?: number }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SaleService } = require('../services/sale.service');
    const service = new SaleService(db);
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    return service.findByBusiness(businessId, payload.filters, payload.limit, payload.offset);
  });

  createHandler(IPC_CHANNELS.SALE_CANCEL, async (_event, payload: { id: string; reason: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SaleService } = require('../services/sale.service');
    const service = new SaleService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('sales.cancel') && !currentUser.permissions.includes('sales.create') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'বাতিলের অনুমতি নেই', statusCode: 403 });
    }
    service.cancel(payload.id, payload.reason, currentUser?.userId);
    return { success: true };
  });

  createHandler(IPC_CHANNELS.SALE_RETURN_CREATE, async (_event, payload: any) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SaleService } = require('../services/sale.service');
    const service = new SaleService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('sales.return') && !currentUser.permissions.includes('sales.create') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'ফেরতের অনুমতি নেই', statusCode: 403 });
    }
    return service.createReturn({ ...payload, createdBy: currentUser?.userId });
  });

  createHandler(IPC_CHANNELS.SALE_RETURN_LIST, async (_event, payload: { saleId: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { SaleReturnRepository } = require('../db/repositories/sale.repository');
    const repo = new SaleReturnRepository(db);
    return repo.findBySale(payload.saleId);
  });

  // Finance accounts
  createHandler(IPC_CHANNELS.CASH_ACCOUNT_LIST, async (_event, payload: { businessId: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { CashAccountRepository } = require('../db/repositories/finance.repository');
    const repo = new CashAccountRepository(db);
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    return repo.findByBusiness(businessId);
  });

  createHandler(IPC_CHANNELS.BANK_ACCOUNT_LIST, async (_event, payload: { businessId: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { BankAccountRepository } = require('../db/repositories/finance.repository');
    const repo = new BankAccountRepository(db);
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    return repo.findByBusiness(businessId);
  });

  createHandler(IPC_CHANNELS.MFS_ACCOUNT_LIST, async (_event, payload: { businessId: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { MfsAccountRepository } = require('../db/repositories/finance.repository');
    const repo = new MfsAccountRepository(db);
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    return repo.findByBusiness(businessId);
  });

  // POS — Barcode & Product
  createHandler(IPC_CHANNELS.POS_PRODUCT_BY_BARCODE, async (_event, payload: { businessId: string; barcode: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { ProductRepository } = require('../db/repositories/product.repository');
    const { StockLevelRepository } = require('../db/repositories/inventory.repository');
    const { UnitRepository } = require('../db/repositories/unit.repository');
    const productRepo = new ProductRepository(db);
    const stockRepo = new StockLevelRepository(db);
    const unitRepo = new UnitRepository(db);

    const barcode = (payload.barcode || '').trim();
    if (!barcode) throw new AppError({ code: 'VALIDATION_ERROR', message: 'Barcode required', messageBn: 'বারকোড প্রয়োজন', statusCode: 400 });

    const results = productRepo.findByBarcodeAll(barcode);
    if (!results || results.length === 0) {
      throw new AppError({ code: 'NOT_FOUND', message: 'Product not found', messageBn: 'পণ্যটি খুঁজে পাওয়া যায়নি।', statusCode: 404 });
    }

    // Enrich with stock and unit
    return results.map((r: any) => {
      const stock = stockRepo.findByProductAndLocation(r.product.id, 'main');
      const unit = r.barcodeDetail?.unitId ? unitRepo.findById(r.barcodeDetail.unitId) : unitRepo.findById(r.product.saleUnitId || r.product.baseUnitId);
      return {
        product: r.product,
        barcodeDetail: r.barcodeDetail,
        stockMilli: stock?.quantityMilli || 0,
        unit: unit || null,
      };
    });
  });

  createHandler(IPC_CHANNELS.POS_PRODUCT_SEARCH, async (_event, payload: { businessId: string; query: string; limit?: number }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { ProductRepository } = require('../db/repositories/product.repository');
    const { StockLevelRepository } = require('../db/repositories/inventory.repository');
    const productRepo = new ProductRepository(db);
    const stockRepo = new StockLevelRepository(db);
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    const query = (payload.query || '').trim();
    if (query.length < 2) return [];

    const products = productRepo.search(businessId, query, payload.limit || 20);
    return products.map((p: any) => {
      const stock = stockRepo.findByProductAndLocation(p.id, 'main');
      return {
        ...p,
        stockMilli: stock?.quantityMilli || 0,
      };
    });
  });

  createHandler(IPC_CHANNELS.POS_STOCK_LEVEL, async (_event, payload: { productId: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { StockLevelRepository } = require('../db/repositories/inventory.repository');
    const stockRepo = new StockLevelRepository(db);
    return stockRepo.findByProductAndLocation(payload.productId, 'main');
  });

  // POS — Held Sales
  createHandler(IPC_CHANNELS.POS_HOLD_SALE, async (_event, payload: any) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { HeldSaleService } = require('../services/held-sale.service');
    const service = new HeldSaleService(db);
    const currentUser = sessionManager.getCurrentUser();
    if (currentUser && !currentUser.permissions.includes('pos.sell') && !currentUser.permissions.includes('sales.create') && !currentUser.isOwner) {
      throw new AppError({ code: 'AUTHORIZATION_ERROR', message: 'Not authorized', messageBn: 'হোল্ড করার অনুমতি নেই', statusCode: 403 });
    }
    return service.hold({
      businessId: payload.businessId || currentUser?.businessId,
      customerId: payload.customerId || null,
      cart: payload.cart,
      notes: payload.notes,
      createdBy: currentUser?.userId,
      expiresAt: payload.expiresAt,
    });
  });

  createHandler(IPC_CHANNELS.POS_HELD_SALES_LIST, async (_event, payload: { businessId: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { HeldSaleService } = require('../services/held-sale.service');
    const service = new HeldSaleService(db);
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    return service.list(businessId);
  });

  createHandler(IPC_CHANNELS.POS_HELD_SALE_GET, async (_event, payload: { id: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { HeldSaleService } = require('../services/held-sale.service');
    const service = new HeldSaleService(db);
    const result = service.getById(payload.id);
    if (!result) throw new AppError({ code: 'NOT_FOUND', message: 'Held sale not found', messageBn: 'হোল্ড করা বিক্রয় পাওয়া যায়নি', statusCode: 404 });
    return result;
  });

  createHandler(IPC_CHANNELS.POS_HELD_SALE_CANCEL, async (_event, payload: { id: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { HeldSaleService } = require('../services/held-sale.service');
    const service = new HeldSaleService(db);
    const currentUser = sessionManager.getCurrentUser();
    return service.cancel(payload.id, currentUser?.userId);
  });

  createHandler(IPC_CHANNELS.POS_HELD_SALE_RESUME, async (_event, payload: { id: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const { HeldSaleService } = require('../services/held-sale.service');
    const service = new HeldSaleService(db);
    const held = service.resume(payload.id);
    // Delete after resume
    service.deleteAfterResume(payload.id);
    return held;
  });

  createHandler(IPC_CHANNELS.POS_CURRENT_SHIFT, async (_event, payload: { businessId: string }) => {
    const { getConnection } = require('../db/connection');
    const db = getConnection();
    const currentUser = sessionManager.getCurrentUser();
    const businessId = payload.businessId || currentUser?.businessId;
    try {
      const row = db.prepare('SELECT * FROM shifts WHERE business_id = ? AND status = ? ORDER BY opened_at DESC LIMIT 1').get(businessId, 'open') as any;
      return row || null;
    } catch {
      return null;
    }
  });

  // Hardware placeholders (future)
  createHandler(IPC_CHANNELS.HARDWARE_GET_PRINTERS, async () => {
    return { printers: [], message: 'Not implemented in Phase 1' };
  });

  logger.info('IPC handlers registered');
}

export function unregisterIpcHandlers() {
  for (const channel of Object.values(IPC_CHANNELS)) {
    ipcMain.removeHandler(channel);
  }
}
