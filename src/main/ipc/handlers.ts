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
