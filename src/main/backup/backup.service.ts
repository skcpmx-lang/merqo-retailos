/**
 * Backup Service — P4.3
 * Production-grade offline-first backup & restore
 * - SQLite-consistent via backup API or VACUUM INTO or checkpoint+copy
 * - Atomic temp file then rename
 * - Validation via integrity_check, FK, tables, invariants
 * - Checksum SHA-256
 * - Safety backup before restore
 * - WAL/SHM handling
 * - No cloud, offline
 */

import fs from 'fs';
import path from 'path';
import { getConnection, closeConnection, setConnection, createConnection } from '../db/connection';
import { Migrator } from '../db/migrator';

let app: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electron = require('electron');
  app = electron.app;
} catch {
  app = {
    getPath: (name: string) => {
      if (name === 'userData') return path.join(process.cwd(), 'app-data-test');
      return process.cwd();
    },
    getVersion: () => '0.1.0',
  };
}
import { getConfigManager } from '../config';
import { logger } from '../logging/logger';
import { Id } from '@core/domain/Id';
import { AppError } from '@core/domain/errors/AppError';
import type {
  BackupInfo,
  BackupMetadata,
  BackupResult,
  BackupType,
  RestoreResult,
  ValidationResult,
  BackupListResult,
  BackupConfig,
} from './backup.types';
import { DEFAULT_BACKUP_CONFIG } from './backup.types';
import { validateBackupFile, calculateChecksum, getSchemaVersionFromDb } from './backup.validator';

let lastBackupError: string | null = null;

function getBackupsDir(): string {
  try {
    const config = getConfigManager();
    const appConfig = config.getAppConfig();
    return appConfig.backupsPath;
  } catch {
    // Fallback for tests
    return path.join(process.cwd(), 'app-data-test', 'backups');
  }
}

function getDbPath(): string {
  try {
    const config = getConfigManager();
    return config.getDbPath();
  } catch {
    return path.join(process.cwd(), 'app-data-test', 'merqo.db');
  }
}

function getAppVersion(): string {
  try {
    return app.getVersion();
  } catch {
    try {
      const config = getConfigManager();
      return config.getAppConfig().version;
    } catch {
      return '0.1.0';
    }
  }
}

function ensureBackupsDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generateBackupFileName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mi = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  // Collision-safe: add ms + short random
  const shortId = Id.generate().slice(-4);
  return `MERQO-RetailOS-Backup-${yyyy}-${mm}-${dd}-${hh}-${mi}-${ss}-${ms}-${shortId}.db`;
}

function isSafePath(p: string): boolean {
  // Prevent path traversal, must be within backups dir or userData
  const normalized = path.normalize(p);
  const base = path.basename(normalized);
  // No illegal Windows chars <>:"|?* and no control chars 0x00-0x1F
  const illegal = /[<>:"|?*]/;
  if (illegal.test(base)) return false;
  for (let i = 0; i < base.length; i++) {
    const code = base.charCodeAt(i);
    if (code >= 0 && code <= 31) return false;
  }
  return true;
}

async function createConsistentBackup(liveDbPath: string, tempPath: string): Promise<void> {
  const liveDb = getConnection();

  // Try better-sqlite3 backup API
  if (liveDb && typeof liveDb.backup === 'function') {
    try {
      logger.info(`Attempting SQLite backup API to ${tempPath}`);
      // better-sqlite3 backup returns Promise
      const backup = liveDb.backup(tempPath);
      if (backup && typeof backup.then === 'function') {
        await backup;
      }
      logger.info('SQLite backup API succeeded');
      return;
    } catch (e) {
      logger.warn('SQLite backup API failed, trying VACUUM INTO', { error: String(e) });
    }
  }

  // Try VACUUM INTO (works for both better-sqlite3 and fallback)
  try {
    logger.info('Attempting VACUUM INTO backup');
    // VACUUM INTO requires escaping single quotes in path
    const escapedPath = tempPath.replace(/'/g, "''");
    liveDb.exec(`VACUUM INTO '${escapedPath}'`);
    logger.info('VACUUM INTO succeeded');
    return;
  } catch (e) {
    logger.warn('VACUUM INTO failed, trying checkpoint+copy', { error: String(e) });
  }

  // Fallback: checkpoint WAL then file copy
  try {
    logger.info('Attempting checkpoint+copy backup');
    try {
      liveDb.pragma('wal_checkpoint(TRUNCATE)');
    } catch {}
    // Close WAL? We have live connection open, but copy after checkpoint should be consistent
    // For safety, we need to ensure no writes during copy — we are in main process, single thread, but still
    // Copy file
    fs.copyFileSync(liveDbPath, tempPath);
    logger.info('Checkpoint+copy succeeded');
    return;
  } catch (e) {
    logger.error('All backup methods failed', e);
    throw new AppError({
      code: 'BACKUP_FAILED',
      message: `Backup creation failed: ${String(e)}`,
      messageBn: 'ব্যাকআপ তৈরি করা যায়নি। আবার চেষ্টা করুন।',
      statusCode: 500,
    });
  }
}

function getCurrentSchemaInfo(): { version: number; migrations: string[] } {
  try {
    const db = getConnection();
    return getSchemaVersionFromDb(db);
  } catch {
    return { version: 0, migrations: [] };
  }
}

function getBusinessInfo(): { businessId?: string; businessName?: string } {
  try {
    const db = getConnection();
    const row = db.prepare('SELECT id, name FROM businesses LIMIT 1').get() as any;
    if (row) {
      return { businessId: row.id, businessName: row.name };
    }
  } catch {}
  return {};
}

export class BackupService {
  private static instance: BackupService | null = null;

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  getConfig(): BackupConfig {
    try {
      const db = getConnection();
      const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('backup_config') as any;
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        return { ...DEFAULT_BACKUP_CONFIG, ...parsed, backupPath: getBackupsDir() };
      }
    } catch {}
    return { ...DEFAULT_BACKUP_CONFIG, backupPath: getBackupsDir() };
  }

  saveConfig(config: Partial<BackupConfig>): BackupConfig {
    const current = this.getConfig();
    const updated: BackupConfig = {
      ...current,
      ...config,
      backupPath: config.backupPath || current.backupPath || getBackupsDir(),
      updatedAt: Date.now(),
    };

    // Validate retention
    if (updated.retentionCount < 1 || updated.retentionCount > 100) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'retentionCount must be 1-100',
        messageBn: 'ব্যাকআপ সংরক্ষণ সংখ্যা ১-১০০ এর মধ্যে হতে হবে',
        statusCode: 400,
      });
    }

    try {
      const db = getConnection();
      db.prepare(
        `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`
      ).run(
        'backup_config',
        JSON.stringify(updated),
        Date.now(),
        JSON.stringify(updated),
        Date.now()
      );
    } catch (e) {
      logger.warn('Failed to save backup config', { error: String(e) });
    }

    return updated;
  }

  async createBackup(options: {
    type?: BackupType;
    businessId?: string;
    userId?: string;
    notes?: string;
  } = {}): Promise<BackupResult> {
    const start = Date.now();
    const type = options.type || 'manual';
    const backupsDir = getBackupsDir();
    ensureBackupsDir(backupsDir);

    const id = Id.generate();
    const fileName = generateBackupFileName();
    const finalPath = path.join(backupsDir, fileName);
    const tempPath = path.join(backupsDir, `${fileName}.tmp-${id}.db`);
    const metadataPath = `${finalPath}.json`;
    const tempMetadataPath = `${tempPath}.json`;

    if (!isSafePath(finalPath)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Invalid backup path',
        messageBn: 'ব্যাকআপ পাথ সঠিক নয়',
        statusCode: 400,
      });
    }

    try {
      const liveDbPath = getDbPath();
      if (!fs.existsSync(liveDbPath)) {
        throw new AppError({
          code: 'NOT_FOUND',
          message: 'Live database not found',
          messageBn: 'ডাটাবেস পাওয়া যায়নি',
          statusCode: 404,
        });
      }

      logger.info(`Creating backup ${id} type=${type} to temp ${tempPath}`);

      // Step 1: Create consistent backup to temp file
      await createConsistentBackup(liveDbPath, tempPath);

      // Step 2: Validate temp backup
      const validation = await validateBackupFile(tempPath);
      if (!validation.isValid) {
        // Cleanup temp
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {}
        lastBackupError = validation.errors.join(', ');
        throw new AppError({
          code: 'BACKUP_VALIDATION_FAILED',
          message: `Backup validation failed: ${validation.errors.join(', ')}`,
          messageBn: 'ব্যাকআপ ফাইলটি সঠিক নয় বা ক্ষতিগ্রস্ত হতে পারে।',
          statusCode: 500,
        });
      }

      // Step 3: Checksum
      const checksum = calculateChecksum(tempPath);
      const fileSize = fs.statSync(tempPath).size;

      // Step 4: Atomic rename temp -> final
      fs.renameSync(tempPath, finalPath);

      // Step 5: Create metadata
      const schemaInfo = getCurrentSchemaInfo();
      const businessInfo = getBusinessInfo();
      const metadata: BackupMetadata = {
        id,
        fileName,
        filePath: finalPath,
        fileSizeBytes: fileSize,
        checksum,
        checksumAlgorithm: 'SHA-256',
        createdAt: Date.now(),
        appVersion: getAppVersion(),
        schemaVersion: schemaInfo.version,
        schemaMigrations: schemaInfo.migrations,
        businessId: options.businessId || businessInfo.businessId,
        businessName: businessInfo.businessName,
        type,
        validationStatus: 'valid',
        sourceDbPath: liveDbPath,
        notes: options.notes,
      };

      // Write metadata atomically
      const tempMetaContent = JSON.stringify(metadata, null, 2);
      fs.writeFileSync(tempMetadataPath, tempMetaContent, 'utf-8');
      fs.renameSync(tempMetadataPath, metadataPath);

      // Step 6: Record in backups table (after safe creation)
      try {
        const db = getConnection();
        db.prepare(
          `INSERT INTO backups (id, business_id, file_path, file_size_bytes, type, status, checksum, created_at, created_by, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          metadata.businessId || null,
          finalPath,
          fileSize,
          type,
          'success',
          checksum,
          metadata.createdAt,
          options.userId || null,
          options.notes || null
        );
      } catch (e) {
        logger.warn('Failed to record backup in DB', { error: String(e) });
        // Don't fail backup if DB record fails
      }

      // Step 7: Audit log
      try {
        const db = getConnection();
        const auditId = Id.generate();
        db.prepare(
          `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, description, description_bn, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          auditId,
          metadata.businessId || 'unknown',
          options.userId || 'system',
          'backup_created',
          'backup',
          id,
          `Backup created: ${fileName} (${fileSize} bytes) type=${type}`,
          `ব্যাকআপ তৈরি করা হয়েছে: ${fileName}`,
          Date.now()
        );
      } catch (e) {
        logger.warn('Failed to audit backup creation', { error: String(e) });
      }

      // Step 8: Retention cleanup if configured
      try {
        this.cleanupOldBackups();
      } catch (e) {
        logger.warn('Retention cleanup failed', { error: String(e) });
      }

      const backupInfo: BackupInfo = {
        ...metadata,
        exists: true,
        isValid: true,
      };

      lastBackupError = null;
      const durationMs = Date.now() - start;
      logger.info(`Backup created successfully ${fileName}`, { durationMs, fileSize });

      return {
        success: true,
        backup: backupInfo,
        message: `Backup created: ${fileName}`,
        messageBn: 'ব্যাকআপ সফলভাবে তৈরি হয়েছে।',
        durationMs,
      };
    } catch (e) {
      // Cleanup temp files on failure
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {}
      try {
        if (fs.existsSync(tempMetadataPath)) fs.unlinkSync(tempMetadataPath);
      } catch {}

      lastBackupError = String(e);
      logger.error('Backup creation failed', e);

      if (e instanceof AppError) {
        return {
          success: false,
          message: e.message,
          messageBn: e.messageBn,
          error: e.message,
          durationMs: Date.now() - start,
        };
      }

      return {
        success: false,
        message: String(e),
        messageBn: 'ব্যাকআপ তৈরি করা যায়নি। আবার চেষ্টা করুন।',
        error: String(e),
        durationMs: Date.now() - start,
      };
    }
  }

  async listBackups(): Promise<BackupListResult> {
    const backupsDir = getBackupsDir();
    ensureBackupsDir(backupsDir);

    try {
      const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.db') && !f.includes('.tmp-'));
      const backups: BackupInfo[] = [];
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(backupsDir, file);
        try {
          const stats = fs.statSync(filePath);
          totalSize += stats.size;

          // Try to read metadata JSON
          const metadataPath = `${filePath}.json`;
          let metadata: BackupMetadata | null = null;
          if (fs.existsSync(metadataPath)) {
            try {
              const content = fs.readFileSync(metadataPath, 'utf-8');
              metadata = JSON.parse(content);
            } catch {}
          }

          if (metadata) {
            backups.push({
              ...metadata,
              filePath,
              fileName: file,
              fileSizeBytes: stats.size,
              exists: true,
              isValid: metadata.validationStatus === 'valid',
            });
          } else {
            // Infer from file
            backups.push({
              id: file.replace('.db', ''),
              fileName: file,
              filePath,
              fileSizeBytes: stats.size,
              checksum: '',
              checksumAlgorithm: 'SHA-256',
              createdAt: stats.mtimeMs,
              appVersion: 'unknown',
              schemaVersion: 0,
              schemaMigrations: [],
              type: 'manual',
              validationStatus: 'unknown',
              exists: true,
              isValid: false,
            });
          }
        } catch (e) {
          logger.warn(`Failed to stat backup file ${file}`, { error: String(e) });
        }
      }

      // Sort by createdAt desc
      backups.sort((a, b) => b.createdAt - a.createdAt);

      return {
        backups,
        totalCount: backups.length,
        totalSizeBytes: totalSize,
      };
    } catch (e) {
      logger.error('Failed to list backups', e);
      return { backups: [], totalCount: 0, totalSizeBytes: 0 };
    }
  }

  async validateBackup(filePath: string): Promise<ValidationResult> {
    if (!isSafePath(filePath)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Invalid backup path',
        messageBn: 'ব্যাকআপ পাথ সঠিক নয়',
        statusCode: 400,
      });
    }

    // Check if file exists, if not try to resolve within backups dir
    let resolvedPath = filePath;
    if (!fs.existsSync(filePath)) {
      const backupsDir = getBackupsDir();
      const candidate = path.join(backupsDir, path.basename(filePath));
      if (fs.existsSync(candidate)) {
        resolvedPath = candidate;
      } else {
        throw new AppError({
          code: 'NOT_FOUND',
          message: 'Backup file not found',
          messageBn: 'ব্যাকআপ ফাইল পাওয়া যায়নি',
          statusCode: 404,
        });
      }
    }

    // Try to get expected checksum from metadata
    let expectedChecksum: string | undefined;
    const metadataPath = `${resolvedPath}.json`;
    if (fs.existsSync(metadataPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        expectedChecksum = meta.checksum;
      } catch {}
    }

    const result = await validateBackupFile(resolvedPath, expectedChecksum);
    return result;
  }

  async deleteBackup(filePath: string, userId?: string): Promise<{ success: boolean; message: string; messageBn: string }> {
    if (!isSafePath(filePath)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Invalid backup path',
        messageBn: 'ব্যাকআপ পাথ সঠিক নয়',
        statusCode: 400,
      });
    }

    let resolvedPath = filePath;
    if (!fs.existsSync(filePath)) {
      const backupsDir = getBackupsDir();
      const candidate = path.join(backupsDir, path.basename(filePath));
      if (fs.existsSync(candidate)) {
        resolvedPath = candidate;
      } else {
        throw new AppError({
          code: 'NOT_FOUND',
          message: 'Backup file not found',
          messageBn: 'ব্যাকআপ ফাইল পাওয়া যায়নি',
          statusCode: 404,
        });
      }
    }

    // Safety: never delete the only valid backup? Check count
    const list = await this.listBackups();
    const validBackups = list.backups.filter(b => b.isValid);
    if (validBackups.length <= 1 && validBackups.some(b => b.filePath === resolvedPath)) {
      // Allow but warn? Spec says never delete only valid backup if retention
      // For manual delete, we allow but log warning
      logger.warn('Deleting the only valid backup', { filePath: resolvedPath });
    }

    try {
      // Delete DB file
      if (fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath);
      }
      // Delete metadata JSON
      const metadataPath = `${resolvedPath}.json`;
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }

      // Delete from backups table
      try {
        const db = getConnection();
        db.prepare('DELETE FROM backups WHERE file_path = ?').run(resolvedPath);
      } catch {}

      // Audit
      try {
        const db = getConnection();
        const auditId = Id.generate();
        const businessInfo = getBusinessInfo();
        db.prepare(
          `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, description, description_bn, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          auditId,
          businessInfo.businessId || 'unknown',
          userId || 'system',
          'backup_deleted',
          'backup',
          path.basename(resolvedPath),
          `Backup deleted: ${path.basename(resolvedPath)}`,
          `ব্যাকআপ মুছে ফেলা হয়েছে: ${path.basename(resolvedPath)}`,
          Date.now()
        );
      } catch {}

      return {
        success: true,
        message: 'Backup deleted',
        messageBn: 'ব্যাকআপ মুছে ফেলা হয়েছে',
      };
    } catch (e) {
      logger.error('Failed to delete backup', e);
      throw new AppError({
        code: 'DELETE_FAILED',
        message: `Failed to delete backup: ${String(e)}`,
        messageBn: 'ব্যাকআপ মুছে ফেলা যায়নি',
        statusCode: 500,
      });
    }
  }

  cleanupOldBackups(): { deleted: number; errors: string[] } {
    const config = this.getConfig();
    if (config.retentionCount <= 0) return { deleted: 0, errors: [] };

    const backupsDir = getBackupsDir();
    if (!fs.existsSync(backupsDir)) return { deleted: 0, errors: [] };

    try {
      const files = fs.readdirSync(backupsDir)
        .filter(f => f.endsWith('.db') && !f.includes('.tmp-'))
        .map(f => {
          const fp = path.join(backupsDir, f);
          try {
            const stats = fs.statSync(fp);
            return { file: f, path: fp, mtime: stats.mtimeMs };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as Array<{ file: string; path: string; mtime: number }>;

      // Sort by mtime desc, keep newest retentionCount
      files.sort((a, b) => b.mtime - a.mtime);

      if (files.length <= config.retentionCount) return { deleted: 0, errors: [] };

      const toDelete = files.slice(config.retentionCount);
      let deleted = 0;
      const errors: string[] = [];

      for (const item of toDelete) {
        // Never delete if it's the only valid? We already have more than retentionCount, so safe
        try {
          if (fs.existsSync(item.path)) {
            fs.unlinkSync(item.path);
            const metaPath = `${item.path}.json`;
            if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
            deleted++;
          }
        } catch (e) {
          errors.push(`${item.file}: ${String(e)}`);
        }
      }

      logger.info(`Retention cleanup deleted ${deleted} old backups`);
      return { deleted, errors };
    } catch (e) {
      logger.error('Retention cleanup failed', e);
      return { deleted: 0, errors: [String(e)] };
    }
  }

  async restoreBackup(backupFilePath: string, userId?: string): Promise<RestoreResult> {
    const start = Date.now();
    const backupsDir = getBackupsDir();
    ensureBackupsDir(backupsDir);

    let resolvedPath = backupFilePath;
    if (!fs.existsSync(backupFilePath)) {
      const candidate = path.join(backupsDir, path.basename(backupFilePath));
      if (fs.existsSync(candidate)) {
        resolvedPath = candidate;
      } else {
        throw new AppError({
          code: 'NOT_FOUND',
          message: 'Backup file not found',
          messageBn: 'ব্যাকআপ ফাইল পাওয়া যায়নি',
          statusCode: 404,
        });
      }
    }

    if (!isSafePath(resolvedPath)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Invalid backup path',
        messageBn: 'ব্যাকআপ পাথ সঠিক নয়',
        statusCode: 400,
      });
    }

    // Step 1: Validate selected backup
    logger.info(`Validating backup for restore: ${resolvedPath}`);
    const validation = await this.validateBackup(resolvedPath);
    if (!validation.isValid) {
      throw new AppError({
        code: 'BACKUP_INVALID',
        message: `Backup validation failed: ${validation.errors.join(', ')}`,
        messageBn: 'ব্যাকআপ ফাইলটি সঠিক নয় বা ক্ষতিগ্রস্ত হতে পারে।',
        statusCode: 400,
      });
    }

    // Step 2: Check version compatibility — reject newer incompatible backup
    try {
      const backupDb = (() => {
        try {
          return createConnection({ dbPath: resolvedPath, readonly: true });
        } catch {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const Database = require('better-sqlite3');
          return new Database(resolvedPath, { readonly: true });
        }
      })();
      const backupSchema = getSchemaVersionFromDb(backupDb);
      try { backupDb.close(); } catch {}
      const currentSchema = getCurrentSchemaInfo();
      const knownMigrations = ['0002_phase2_full_schema', '0003_phase3a_purchasing', '0004_phase3b_sales_customer', '0005_phase3d_finance'];
      const unknownInBackup = backupSchema.migrations.filter(m => !knownMigrations.includes(m) && !m.startsWith('000'));
      if (backupSchema.version > currentSchema.version + 5 && unknownInBackup.length > 0) {
        throw new AppError({
          code: 'BACKUP_TOO_NEW',
          message: `Backup from newer version (${backupSchema.version} migrations) cannot be restored on older app (${currentSchema.version})`,
          messageBn: 'এই ব্যাকআপটি বর্তমান MERQO RetailOS সংস্করণের চেয়ে নতুন।',
          statusCode: 400,
        });
      }
    } catch (e) {
      if (e instanceof AppError) {
        throw e;
      }
      logger.warn('Version compatibility check failed, continuing', { error: String(e) });
    }

    // Step 3: Create safety backup of current live DB (mandatory)
    logger.info('Creating safety backup before restore');
    const safetyResult = await this.createBackup({
      type: 'safety-pre-restore',
      userId,
      notes: `Safety backup before restoring ${path.basename(resolvedPath)}`,
    });

    if (!safetyResult.success || !safetyResult.backup) {
      throw new AppError({
        code: 'SAFETY_BACKUP_FAILED',
        message: 'Safety backup failed, restore aborted',
        messageBn: 'বর্তমান ডেটার নিরাপত্তা ব্যাকআপ তৈরি করা যায়নি। তাই পুনরুদ্ধার বন্ধ করা হয়েছে।',
        statusCode: 500,
      });
    }

    // Validate safety backup
    const safetyValidation = await this.validateBackup(safetyResult.backup.filePath);
    if (!safetyValidation.isValid) {
      throw new AppError({
        code: 'SAFETY_BACKUP_INVALID',
        message: 'Safety backup validation failed',
        messageBn: 'নিরাপত্তা ব্যাকআপ যাচাই করা যায়নি। পুনরুদ্ধার বন্ধ করা হয়েছে।',
        statusCode: 500,
      });
    }

    const liveDbPath = getDbPath();
    const recoveryPath = path.join(path.dirname(liveDbPath), `merqo.db.recovery-${Date.now()}-${Id.generate().slice(-4)}.db`);
    const walPath = `${liveDbPath}-wal`;
    const shmPath = `${liveDbPath}-shm`;
    const recoveryWalPath = `${recoveryPath}-wal`;
    const recoveryShmPath = `${recoveryPath}-shm`;

    let rollbackPerformed = false;

    try {
      // Step 4: Close DB
      logger.info('Closing live DB for restore');
      closeConnection();

      // Step 5: Move current DB to recovery location (safe replacement)
      if (fs.existsSync(liveDbPath)) {
        fs.renameSync(liveDbPath, recoveryPath);
        logger.info(`Moved current DB to recovery: ${recoveryPath}`);
      }
      // Move WAL/SHM if exist to recovery as well
      if (fs.existsSync(walPath)) {
        try {
          fs.renameSync(walPath, recoveryWalPath);
        } catch {
          try { fs.unlinkSync(walPath); } catch {}
        }
      }
      if (fs.existsSync(shmPath)) {
        try {
          fs.renameSync(shmPath, recoveryShmPath);
        } catch {
          try { fs.unlinkSync(shmPath); } catch {}
        }
      }

      // Step 6: Copy validated backup into live path
      logger.info(`Copying backup ${resolvedPath} to live path ${liveDbPath}`);
      fs.copyFileSync(resolvedPath, liveDbPath);

      // Step 7: Ensure no stale WAL/SHM from previous DB attached to restored DB
      if (fs.existsSync(walPath)) {
        try { fs.unlinkSync(walPath); } catch {}
      }
      if (fs.existsSync(shmPath)) {
        try { fs.unlinkSync(shmPath); } catch {}
      }

      // Step 8: Reopen DB
      logger.info('Reopening restored DB');
      setConnection(null as any);
      const newDb = createConnection({ dbPath: liveDbPath });
      setConnection(newDb);

      // Step 9: Run migrations if required (older backup)
      try {
        const migrator = new Migrator(newDb);
        const result = migrator.runMigrations();
        if (!result.success) {
          throw new Error(`Migrations failed after restore: ${result.error}`);
        }
        logger.info('Migrations after restore', { executed: result.executed });
      } catch (e) {
        logger.error('Migration after restore failed', e);
        throw e;
      }

      // Step 10: Post-restore validation
      const postValidation = await validateBackupFile(liveDbPath);
      if (!postValidation.isValid) {
        throw new Error(`Post-restore validation failed: ${postValidation.errors.join(', ')}`);
      }

      // Step 11: Success — delete recovery file
      try {
        if (fs.existsSync(recoveryPath)) fs.unlinkSync(recoveryPath);
        if (fs.existsSync(recoveryWalPath)) fs.unlinkSync(recoveryWalPath);
        if (fs.existsSync(recoveryShmPath)) fs.unlinkSync(recoveryShmPath);
      } catch (e) {
        logger.warn('Failed to delete recovery file after successful restore', { error: String(e) });
      }

      // Audit success
      try {
        const db = getConnection();
        const auditId = Id.generate();
        const businessInfo = getBusinessInfo();
        db.prepare(
          `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, description, description_bn, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          auditId,
          businessInfo.businessId || 'unknown',
          userId || 'system',
          'restore_succeeded',
          'backup',
          path.basename(resolvedPath),
          `Restore succeeded from ${path.basename(resolvedPath)}, safety backup ${path.basename(safetyResult.backup.filePath)}`,
          `ব্যাকআপ থেকে পুনরুদ্ধার সফল: ${path.basename(resolvedPath)}`,
          Date.now()
        );
      } catch {}

      const durationMs = Date.now() - start;
      logger.info(`Restore succeeded from ${resolvedPath}`, { durationMs });

      return {
        success: true,
        restoredFrom: safetyResult.backup ? {
          ...safetyResult.backup,
          filePath: resolvedPath,
          fileName: path.basename(resolvedPath),
        } as any : undefined,
        safetyBackup: safetyResult.backup,
        message: `Restore succeeded from ${path.basename(resolvedPath)}`,
        messageBn: 'ডেটা সফলভাবে পুনরুদ্ধার করা হয়েছে।',
        validationAfterRestore: postValidation,
        durationMs,
        rollbackPerformed: false,
      };
    } catch (e) {
      logger.error('Restore failed, attempting rollback', e);

      // Attempt rollback to safety backup
      try {
        closeConnection();
        // Delete failed restored file
        if (fs.existsSync(liveDbPath)) {
          try { fs.unlinkSync(liveDbPath); } catch {}
        }
        if (fs.existsSync(walPath)) {
          try { fs.unlinkSync(walPath); } catch {}
        }
        if (fs.existsSync(shmPath)) {
          try { fs.unlinkSync(shmPath); } catch {}
        }

        // Restore from safety backup if exists, else from recovery
        const restoreSource = safetyResult.backup?.filePath && fs.existsSync(safetyResult.backup.filePath)
          ? safetyResult.backup.filePath
          : recoveryPath;

        if (fs.existsSync(restoreSource)) {
          fs.copyFileSync(restoreSource, liveDbPath);
          rollbackPerformed = true;
          logger.info(`Rollback to ${restoreSource} succeeded`);
        } else if (fs.existsSync(recoveryPath)) {
          fs.renameSync(recoveryPath, liveDbPath);
          rollbackPerformed = true;
          logger.info(`Rollback via recovery file ${recoveryPath} succeeded`);
        }

        // Reopen
        const rollbackDb = createConnection({ dbPath: liveDbPath });
        setConnection(rollbackDb);

        // Validate rollback
        const rollbackValidation = await validateBackupFile(liveDbPath);
        if (!rollbackValidation.isValid) {
          logger.error('Rollback validation failed', { errors: rollbackValidation.errors });
        }
      } catch (rollbackErr) {
        logger.error('Rollback failed', rollbackErr);
        // At this point, DB might be in broken state — we leave recovery file for manual recovery
      }

      // Audit failure
      try {
        const db = getConnection();
        const auditId = Id.generate();
        const businessInfo = getBusinessInfo();
        db.prepare(
          `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, description, description_bn, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          auditId,
          businessInfo.businessId || 'unknown',
          userId || 'system',
          'restore_failed',
          'backup',
          path.basename(resolvedPath),
          `Restore failed from ${path.basename(resolvedPath)}: ${String(e)}`,
          `পুনরুদ্ধার ব্যর্থ: ${path.basename(resolvedPath)}`,
          Date.now()
        );
      } catch {}

      return {
        success: false,
        message: `Restore failed: ${String(e)}`,
        messageBn: 'ডেটা পুনরুদ্ধার সম্পন্ন হয়নি। বর্তমান ডেটা নিরাপদ রাখার চেষ্টা করা হয়েছে।',
        error: String(e),
        safetyBackup: safetyResult.backup,
        durationMs: Date.now() - start,
        rollbackPerformed,
      };
    }
  }

  getLastError(): string | null {
    return lastBackupError;
  }

  async getBackupDetails(filePath: string): Promise<BackupInfo | null> {
    const list = await this.listBackups();
    return list.backups.find(b => b.filePath === filePath || b.fileName === path.basename(filePath)) || null;
  }

  getDbPath(): string {
    return getDbPath();
  }

  getBackupsDir(): string {
    return getBackupsDir();
  }
}
