import { sql } from 'drizzle-orm';
import {
  index,
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { vaults } from './vaults';
import { weddings } from './weddings';
import { qrStatus } from './enums';

/**
 * qr_designs — visual designs for QR codes (platform-wide when
 * `organization_id` is NULL; wedding companies may define branded designs).
 */
export const qrDesigns = pgTable(
  'qr_designs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    code: varchar('code', { length: 100 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    backgroundColor: varchar('background_color', { length: 7 }).notNull().default('#FFFFFF'),
    foregroundColor: varchar('foreground_color', { length: 7 }).notNull().default('#000000'),
    logoKey: text('logo_key'),
    isPlatform: boolean('is_platform').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('qr_designs_platform_code_unique_idx')
      .on(table.code)
      .where(sql`${table.organizationId} is null and ${table.deletedAt} is null`),
    uniqueIndex('qr_designs_org_code_unique_idx')
      .on(table.organizationId, table.code)
      .where(sql`${table.organizationId} is not null and ${table.deletedAt} is null`),
    index('qr_designs_org_idx').on(table.organizationId),
  ],
);

/**
 * qr_codes — issued QR codes per wedding.
 *
 * `public_id` is the only identifier encoded into the QR payload (stable
 * public destination); the code remains valid across design changes. QR
 * payloads never contain private data or internal IDs.
 */
export const qrCodes = pgTable(
  'qr_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    vaultId: uuid('vault_id').references(() => vaults.id, { onDelete: 'set null' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    designId: uuid('design_id').references(() => qrDesigns.id, { onDelete: 'set null' }),
    publicId: varchar('public_id', { length: 32 }).notNull(),
    // Stable destination resolved server-side (never a raw storage URL).
    targetUrl: text('target_url'),
    status: qrStatus('status').notNull().default('active'),
    generatedAt: timestamp('generated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('qr_codes_public_id_unique_idx').on(table.publicId),
    index('qr_codes_wedding_idx').on(table.weddingId),
    index('qr_codes_vault_idx').on(table.vaultId),
    index('qr_codes_org_idx').on(table.organizationId),
    index('qr_codes_design_idx').on(table.designId),
  ],
);

export type QrDesign = typeof qrDesigns.$inferSelect;
export type NewQrDesign = typeof qrDesigns.$inferInsert;
export type QrCode = typeof qrCodes.$inferSelect;
export type NewQrCode = typeof qrCodes.$inferInsert;