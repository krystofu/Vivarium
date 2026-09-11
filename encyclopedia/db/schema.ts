import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const library = sqliteTable('library', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  document: text('document').notNull(),
});
export const oauthClients = sqliteTable('oauth_clients', {
  id: text('id').primaryKey(),
  redirects: text('redirects').notNull(),
  name: text('name').notNull(),
  expires: integer('expires').notNull(),
});
export const oauthGrants = sqliteTable('oauth_grants', {
  hash: text('hash').primaryKey(),
  kind: text('kind').notNull(),
  payload: text('payload').notNull(),
  expires: integer('expires').notNull(),
});
export const appOwner = sqliteTable('app_owner', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  claimedAt: integer('claimed_at').notNull(),
});
