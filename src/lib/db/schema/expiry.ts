import {
  index,
  date,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { organizations } from './organizations';
import { weddings } from './weddings';
import { lifecycleEventType, weddingStatus } from './enums';

/**
 * expiry_rules — snapshot of the upload/download deadlines derived from the
 * scheduled wedding date in `Africa/Johannesburg`.
 *
 * Deadlines are stored as exclusive-end UTC timestamps. `calculated_at` and
 * `wedding_date_at_calculation` provide the audit trail required when a future
 * wedding date changes and deadlines must be recalculated.
 */
export const expiryRules = pgTable(
  'expiry_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    uploadDeadline: timestamp('upload_deadline', { withTimezone: true, mode: 'date' }).notNull(),
    downloadDeadline: timestamp('download_deadline', { withTimezone: true, mode: 'date' }).notNull(),
    // Snapshot of the entitlement windows used in the calculation.
    uploadWindowDays: integer('upload_window_days').notNull(),
    downloadWindowDays: integer('download_window_days').notNull(),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Africa/Johannesburg'),
    calculatedAt: timestamp('calculated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    // The wedding date used for this calculation (audit of re-calculations).
    weddingDateAtCalculation: date('wedding_date_at_calculation', { mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('expiry_rules_wedding_id_unique_idx').on(table.weddingId),
    index('expiry_rules_org_idx').on(table.organizationId),
    // Lifecycle jobs scan for approaching/passed deadlines.
    index('expiry_rules_upload_deadline_idx').on(table.uploadDeadline),
    index('expiry_rules_download_deadline_idx').on(table.downloadDeadline),
  ],
);

/**
 * lifecycle_events — append-only audit trail of wedding lifecycle transitions
 * and notable lifecycle moments. Hard-delete (never soft-deleted).
 */
export const lifecycleEvents = pgTable(
  'lifecycle_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    eventType: lifecycleEventType('event_type').notNull(),
    fromStatus: weddingStatus('from_status'),
    toStatus: weddingStatus('to_status'),
    reason: varchar('reason', { length: 255 }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('lifecycle_events_wedding_idx').on(table.weddingId),
    index('lifecycle_events_org_idx').on(table.organizationId),
    index('lifecycle_events_type_idx').on(table.eventType),
    index('lifecycle_events_occurred_at_idx').on(table.occurredAt),
  ],
);

export type ExpiryRule = typeof expiryRules.$inferSelect;
export type NewExpiryRule = typeof expiryRules.$inferInsert;
export type LifecycleEvent = typeof lifecycleEvents.$inferSelect;
export type NewLifecycleEvent = typeof lifecycleEvents.$inferInsert;