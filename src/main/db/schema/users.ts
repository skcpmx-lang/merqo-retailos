import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { businesses } from './business';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  businessId: text('business_id').references(() => businesses.id),
  name: text('name').notNull(),
  phone: text('phone'),
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

export const permissions = sqliteTable('permissions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameBn: text('name_bn'),
  description: text('description'),
  module: text('module').notNull(),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const rolePermissions = sqliteTable('role_permissions', {
  id: text('id').primaryKey(),
  roleId: text('role_id').notNull().references(() => roles.id),
  permissionId: text('permission_id').notNull().references(() => permissions.id),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const userRoles = sqliteTable('user_roles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  roleId: text('role_id').notNull().references(() => roles.id),
  assignedByUserId: text('assigned_by_user_id'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});
