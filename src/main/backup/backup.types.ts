/**
 * Backup & Restore Types — P4.3
 * Offline-first, atomic, verifiable, recoverable
 */

export type BackupType = 'manual' | 'automatic' | 'safety-pre-restore' | 'auto-startup';

export interface BackupMetadata {
  id: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  checksum: string;
  checksumAlgorithm: 'SHA-256';
  createdAt: number;
  appVersion: string;
  schemaVersion: number;
  schemaMigrations: string[];
  businessId?: string;
  businessName?: string;
  type: BackupType;
  validationStatus: 'valid' | 'invalid' | 'unknown';
  validationErrors?: string[];
  sourceDbPath?: string;
  notes?: string;
}

export interface BackupInfo extends BackupMetadata {
  exists: boolean;
  isValid: boolean;
}

export interface BackupResult {
  success: boolean;
  backup?: BackupInfo;
  message: string;
  messageBn: string;
  error?: string;
  durationMs?: number;
}

export interface ValidationResult {
  isValid: boolean;
  integrityCheck: { ok: boolean; errors: string[] };
  foreignKeyCheck: { ok: boolean; errors: any[] };
  tablesCheck: { ok: boolean; missingTables: string[]; existingTables: string[] };
  migrationsCheck: { ok: boolean; count: number; migrations: string[] };
  invariantsCheck?: {
    stockOk: boolean;
    customerOk: boolean;
    supplierOk: boolean;
    financeOk: boolean;
    errors: string[];
  };
  errors: string[];
  warnings: string[];
  checkedAt: number;
  fileSizeBytes?: number;
  checksum?: string;
}

export interface RestoreResult {
  success: boolean;
  restoredFrom?: BackupInfo;
  safetyBackup?: BackupInfo;
  message: string;
  messageBn: string;
  error?: string;
  validationAfterRestore?: ValidationResult;
  durationMs?: number;
  rollbackPerformed?: boolean;
}

export interface BackupListResult {
  backups: BackupInfo[];
  totalCount: number;
  totalSizeBytes: number;
}

export interface BackupConfig {
  enabled: boolean;
  autoBackupOnStartup: boolean;
  autoBackupOnClose: boolean;
  retentionCount: number; // keep last N
  retentionDays: number; // keep last N days (0 = disabled)
  backupPath: string;
  lastAutoBackupAt?: number;
  updatedAt: number;
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  enabled: true,
  autoBackupOnStartup: true,
  autoBackupOnClose: false,
  retentionCount: 10,
  retentionDays: 0,
  backupPath: '',
  updatedAt: Date.now(),
};

export const CORE_TABLES = [
  'businesses',
  'users',
  'permissions',
  'roles',
  'role_permissions',
  'units',
  'unit_conversions',
  'categories',
  'brands',
  'products',
  'product_barcodes',
  'stock_levels',
  'stock_movements',
  'suppliers',
  'supplier_transactions',
  'purchases',
  'purchase_items',
  'purchase_returns',
  'purchase_return_items',
  'customers',
  'customer_transactions',
  'sales',
  'sale_items',
  'sale_payments',
  'sale_returns',
  'sale_return_items',
  'cash_accounts',
  'cash_movements',
  'bank_accounts',
  'bank_transactions',
  'mfs_providers',
  'mfs_accounts',
  'mfs_transactions',
  'expense_categories',
  'expenses',
  'transfers',
  'shifts',
  'shift_transactions',
  'held_sales',
  'audit_logs',
  'system_settings',
  'migrations',
  'backups',
];
