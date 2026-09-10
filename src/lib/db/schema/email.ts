import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { weddings } from './weddings';
import { emailJobStatus, emailJobType, emailEventType } from './enums';

/**
 * email_jobs — async transactional email abstraction (payment success, vault
 * ready, QR/card, reminders, expiry warnings, build failure).
 *
 * `idempotency_key` is UNIQUE so retries/duplicates never send twice.
 * `provider_message_id` links back to provider delivery state.
 */
export const emailJobs = pgTable(
  'email_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    weddingId: uuid('wedding_id').references(() => weddings.id, { onDelete: 'set null' }),
    emailType: emailJobType('email_type').notNull(),
    toEmail: varchar('to_email', { length: 320 }).notNull(),
    toName: varchar('to_name', { length: 200 }),
    fromEmail: varchar('from_email', { length: 320 }),
    subject: varchar('subject', { length: 200 }).notNull(),
    bodyHtml: text('body_html'),
    bodyText: text('body_text'),
    templateKey: varchar('template_key', { length: 120 }),
    status: emailJobStatus('status').notNull().default('pending'),
    idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull(),
    providerMessageId: varchar('provider_message_id', { length: 200 }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'date' }),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('email_jobs_idempotency_key_unique_idx').on(table.idempotencyKey),
    index('email_jobs_org_idx').on(table.organizationId),
    index('email_jobs_wedding_idx').on(table.weddingId),
    index('email_jobs_status_idx').on(table.status),
    index('email_jobs_scheduled_at_idx').on(table.scheduledAt),
  ],
);

/**
 * email_events — append-only delivery/provider events for an email job
 * (sent/delivered/opened/clicked/bounced/complained/failed). Hard-delete.
 */
export const emailEvents = pgTable(
  'email_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    emailJobId: uuid('email_job_id')
      .notNull()
      .references(() => emailJobs.id, { onDelete: 'cascade' }),
    eventType: emailEventType('event_type').notNull(),
    providerEventId: varchar('provider_event_id', { length: 200 }),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    // Partial unique so events without a provider id are not blocked.
    uniqueIndex('email_events_provider_event_id_unique_idx')
      .on(table.providerEventId)
      .where(sql`${table.providerEventId} is not null`),
    index('email_events_job_idx').on(table.emailJobId),
    index('email_events_type_idx').on(table.eventType),
  ],
);

export type EmailJob = typeof emailJobs.$inferSelect;
export type NewEmailJob = typeof emailJobs.$inferInsert;
export type EmailEvent = typeof emailEvents.$inferSelect;
export type NewEmailEvent = typeof emailEvents.$inferInsert;