import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { businesses } from './business';

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  businessId: text('business_id').references(() => businesses.id),
  userId: text('user_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  beforeJson: text('before_json'),
  afterJson: text('after_json'),
  description: text('description'),
  descriptionBn: text('description_bn'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  userId: text('user_id'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  titleBn: text('title_bn'),
  message: text('message'),
  messageBn: text('message_bn'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const backups = sqliteTable('backups', {
  id: text('id').primaryKey(),
  businessId: text('business_id').references(() => businesses.id),
  filePath: text('file_path').notNull(),
  fileSizeBytes: integer('file_size_bytes'),
  type: text('type').notNull().default('manual'),
  status: text('status').notNull().default('success'),
  checksum: text('checksum'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  createdBy: text('created_by'),
  notes: text('notes'),
});

export const printers = sqliteTable('printers', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  name: text('name').notNull(),
  type: text('type').notNull(),
  connection: text('connection').notNull(),
  systemName: text('system_name'),
  paperWidthMm: integer('paper_width_mm'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  settingsJson: text('settings_json'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const importJobs = sqliteTable('import_jobs', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  type: text('type').notNull(),
  fileName: text('file_name').notNull(),
  totalRows: integer('total_rows').notNull().default(0),
  validRows: integer('valid_rows').notNull().default(0),
  invalidRows: integer('invalid_rows').notNull().default(0),
  status: text('status').notNull().default('pending'),
  errorJson: text('error_json'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  createdBy: text('created_by'),
});

export const migrations = sqliteTable('migrations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  executedAt: integer('executed_at').notNull().$defaultFn(() => Date.now()),
  checksum: text('checksum'),
});
