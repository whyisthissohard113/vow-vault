import { sql } from 'drizzle-orm';
import {
  index,
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { organizations } from './organizations';
import { weddings } from './weddings';
import { guestSessionStatus, vaultAccessRole, vaultStatus } from './enums';

/**
 * vaults — the public-facing memory vault for a wedding.
 *
 * `public_id` is the opaque identifier used in public routes/QR destinations,
 * and `slug` drives the stable `/w/[slug]` route. Never expose internal `id`.
 */
export const vaults = pgTable(
  'vaults',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    publicId: varchar('public_id', { length: 32 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    title: varchar('title', { length: 200 }),
    description: text('description'),
    isPublic: boolean('is_public').notNull().default(true),
    // Default `noindex` for public vault routes (spec requirement).
    noIndex: boolean('no_index').notNull().default(true),
    status: vaultStatus('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('vaults_public_id_unique_idx').on(table.publicId),
    uniqueIndex('vaults_slug_unique_idx')
      .on(table.slug)
      .where(sql`${table.deletedAt} is null`),
    index('vaults_wedding_idx').on(table.weddingId),
    index('vaults_org_idx').on(table.organizationId),
    index('vaults_status_idx').on(table.status),
  ],
);

/**
 * guest_sessions — short-lived, scoped, token-based guest access.
 *
 * `token` is the opaque lookup key. For security, the application stores a
 * one-way hash of the raw token here (never the raw value) and keeps
 * `expires_at` mandatory. Upload counters support fair-use rate limiting.
 */
export const guestSessions = pgTable(
  'guest_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vaultId: uuid('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 128 }).notNull(),
    displayName: varchar('display_name', { length: 120 }),
    status: guestSessionStatus('status').notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
    uploadCount: integer('upload_count').notNull().default(0),
    maxUploads: integer('max_uploads').notNull().default(100),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('guest_sessions_token_unique_idx').on(table.token),
    // Composite (vault_id, status): the Phase 13 lifecycle engine revokes guest
    // sessions with `WHERE vault_id IN (…) AND status = 'active'` and purges by
    // `vault_id`; the composite serves both (vault_id is a proper prefix).
    // Replaces the standalone vault_id index, which was fully redundant.
    index('guest_sessions_vault_status_idx').on(table.vaultId, table.status),
    index('guest_sessions_status_expires_idx').on(table.status, table.expiresAt),
  ],
);

/**
 * vault_access — named access grants (couple members, wedding-company staff,
 * platform admins) to a specific vault. Guests are handled by
 * `guest_sessions`; both paths are enforced server-side.
 */
export const vaultAccess = pgTable(
  'vault_access',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vaultId: uuid('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    guestSessionId: uuid('guest_session_id').references(() => guestSessions.id, {
      onDelete: 'set null',
    }),
    role: vaultAccessRole('role').notNull().default('guest'),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('vault_access_vault_user_unique_idx')
      .on(table.vaultId, table.userId)
      .where(sql`${table.deletedAt} is null`),
    index('vault_access_user_idx').on(table.userId),
    index('vault_access_guest_session_idx').on(table.guestSessionId),
  ],
);

export type Vault = typeof vaults.$inferSelect;
export type NewVault = typeof vaults.$inferInsert;
export type GuestSession = typeof guestSessions.$inferSelect;
export type NewGuestSession = typeof guestSessions.$inferInsert;
export type VaultAccess = typeof vaultAccess.$inferSelect;
export type NewVaultAccess = typeof vaultAccess.$inferInsert;