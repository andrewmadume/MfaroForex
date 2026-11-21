import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable('accounts', { userId:text('user_id').primaryKey(), state:text('state').notNull(), version:integer('version').notNull().default(0), updatedAt:text('updated_at').notNull() });
export const requestLimits = sqliteTable('request_limits', {userId:text('user_id').primaryKey(),window:integer('window_id').notNull(),count:integer('count').notNull()});


export const activeSessions=sqliteTable('active_sessions',{idHash:text('id_hash').primaryKey(),userId:text('user_id').notNull(),expiresAt:integer('expires_at').notNull()});
export const marketLimits=sqliteTable('market_limits',{provider:text('provider').primaryKey(),window:integer('window_id').notNull(),count:integer('count').notNull()});
