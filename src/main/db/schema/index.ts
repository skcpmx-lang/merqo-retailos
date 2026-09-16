/**
 * Drizzle schema — Phase 1 foundation tables
 * Full schema will be built in Phase 2, but foundation includes core tables for migration infrastructure
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// System settings (key-value)
export const systemSettings = sqliteTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

// Businesses (single per installation for V1, but table ready)
export const businesses = sqliteTable('businesses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tradeName: text('trade_name'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  bin: text('bin'),
  logoPath: text('logo_path'),
  currency: text('currency').notNull().default('BDT'),
  fiscalYearStartMonth: integer('fiscal_year_start_month').notNull().default(7),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

// Business settings (key-value per business)
export const businessSettings = sqliteTable('business_settings', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  key: text('key').notNull(),
  value: text('value'),
  valueType: text('value_type').notNull().default('string'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

// Users
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  businessId: text('business_id').references(() => businesses.id),
  name: text('name').notNull(),
  phone: text('phone').unique(),
  email: text('email'),
  passwordHash: text('password_hash').notNull(),
  pinHash: text('pin_hash'),
  isOwner: integer('is_owner', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastLoginAt: integer('last_login_at'),
  avatarPath: text('avatar_path'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
  deletedAt: integer('deleted_at'),
});

// Roles
export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  businessId: text('business_id').references(() => businesses.id),
  name: text('name').notNull(),
  nameBn: text('name_bn'),
  description: text('description'),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

// Permissions (seeded)
export const permissions = sqliteTable('permissions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameBn: text('name_bn'),
  description: text('description'),
  module: text('module').notNull(),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

// Role Permissions
export const rolePermissions = sqliteTable('role_permissions', {
  id: text('id').primaryKey(),
  roleId: text('role_id').notNull().references(() => roles.id),
  permissionId: text('permission_id').notNull().references(() => permissions.id),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

// User Roles
export const userRoles = sqliteTable('user_roles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  roleId: text('role_id').notNull().references(() => roles.id),
  assignedByUserId: text('assigned_by_user_id'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

// Audit Logs (immutable)
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  businessId: text('business_id').references(() => businesses.id),
  userId: text('user_id').references(() => users.id),
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

// Migrations tracking (Drizzle uses __drizzle_migrations, but we also track custom)
export const migrations = sqliteTable('migrations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  executedAt: integer('executed_at').notNull().$defaultFn(() => Date.now()),
  checksum: text('checksum'),
});
