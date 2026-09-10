import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  date,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { customers } from './customers';
import { products } from './products';
import { templates } from './templates';
import { weddingStatus } from './enums';

/**
 * weddings — the core tenant-scoped wedding dossier.
 *
 * `wedding_date` is a calendar DATE (no time-of-day), never a timestamp: all
 * business deadlines (upload/download windows) are derived from it in
 * `Africa/Johannesburg` by the expiry service and persisted as UTC timestamps
 * in `expiry_rules`.
 */
export const weddings = pgTable(
  'weddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    // Opaque public identifier for the wedding (guest-facing media links).
    publicId: varchar('public_id', { length: 32 }).notNull(),
    // Internal human-readable code, e.g. `WED-2026-0007`.
    code: varchar('code', { length: 40 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    partnerOneName: varchar('partner_one_name', { length: 120 }),
    partnerTwoName: varchar('partner_two_name', { length: 120 }),
    status: weddingStatus('status').notNull().default('draft'),
    weddingDate: date('wedding_date', { mode: 'date' }),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Africa/Johannesburg'),
    templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('weddings_org_public_id_unique_idx').on(table.organizationId, table.publicId),
    uniqueIndex('weddings_org_code_unique_idx')
      .on(table.organizationId, table.code)
      .where(sql`${table.deletedAt} is null`),
    index('weddings_org_idx').on(table.organizationId),
    index('weddings_customer_idx').on(table.customerId),
    index('weddings_status_idx').on(table.status),
    // Lifecycle/expiry jobs scan for upcoming wedding dates frequently.
    index('weddings_wedding_date_idx').on(table.weddingDate),
  ],
);

export type Wedding = typeof weddings.$inferSelect;
export type NewWedding = typeof weddings.$inferInsert;