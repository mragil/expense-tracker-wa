import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  whatsappNumber: text('whatsapp_number').primaryKey(),
  displayName: text('display_name'),
  onboardingStep: text('onboarding_step').default('voucher'),
  isActive: integer('is_active', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const vouchers = sqliteTable('vouchers', {
  code: text('code').primaryKey(),
  isUsed: integer('is_used', { mode: 'boolean' }).default(false),
  usedBy: text('used_by').references(() => users.whatsappNumber),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  whatsappId: text('whatsapp_id').notNull(),
  amount: real('amount').notNull(),
  transactionType: text('transaction_type').notNull(),
  category: text('category'),
  description: text('description'),
  loggedBy: text('logged_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const invitations = sqliteTable('invitations', {
  code: text('code').primaryKey(),
  ownerWhatsappNumber: text('owner_whatsapp_number').notNull(),
  isUsed: integer('is_used', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const budgets = sqliteTable('budgets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  whatsappNumber: text('whatsapp_number').notNull(),
  amount: real('amount').notNull(),
  period: text('period').notNull(),
  thresholdPercent: integer('threshold_percent').default(80),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const reportRequests = sqliteTable('report_requests', {
  id: text('id').primaryKey(),
  whatsappId: text('whatsapp_id').notNull(),
  status: text('status').default('pending'),
  filePath: text('file_path'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
