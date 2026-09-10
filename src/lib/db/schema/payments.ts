import { sql } from 'drizzle-orm';
import {
  check,
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
import { orders } from './orders';
import { paymentEventStatus, paymentEventType, paymentProvider, paymentStatus } from './enums';

/**
 * payments — one payment attempt against an order.
 *
 * `provider_reference` is globally UNIQUE and is the webhook idempotency anchor
 * for payments (along with `payment_events.provider_event_id`). Payment rows are
 * immutable financial records and are never soft-deleted.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    provider: paymentProvider('provider').notNull(),
    // Unique per provider (single-column unique so provider events can be
    // correlated without a composite key; the billing layer prefixes
    // references by provider when needed).
    providerReference: varchar('provider_reference', { length: 200 }).notNull(),
    status: paymentStatus('status').notNull().default('pending'),
    amountCents: integer('amount_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('ZAR'),
    failureReason: text('failure_reason'),
    refundAmountCents: integer('refund_amount_cents'),
    refundReason: text('refund_reason'),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
    refundedAt: timestamp('refunded_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('payments_provider_reference_unique_idx').on(table.providerReference),
    check('payments_amount_positive', sql`${table.amountCents} > 0`),
    check('payments_refund_nonnegative', sql`${table.refundAmountCents} is null or ${table.refundAmountCents} >= 0`),
    index('payments_org_idx').on(table.organizationId),
    index('payments_order_idx').on(table.orderId),
    index('payments_status_idx').on(table.status),
  ],
);

/**
 * payment_events — raw provider webhooks/events. Append-only and immutable.
 *
 * `provider_event_id` is UNIQUE: replaying a webhook cannot create a duplicate
 * row. `processed_at` records when the event was handled; the webhook handler
 * marks events `processed` idempotently.
 */
export const paymentEvents = pgTable(
  'payment_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    // May be null if the event arrives before its payment row is created.
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
    providerEventId: varchar('provider_event_id', { length: 200 }).notNull(),
    eventType: paymentEventType('event_type').notNull(),
    provider: paymentProvider('provider').notNull(),
    status: paymentEventStatus('status').notNull().default('received'),
    // Complete raw payload retained for replay/audit.
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('payment_events_provider_event_id_unique_idx').on(table.providerEventId),
    index('payment_events_payment_idx').on(table.paymentId),
    index('payment_events_status_idx').on(table.status),
    index('payment_events_processed_at_idx').on(table.processedAt),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentEvent = typeof paymentEvents.$inferSelect;
export type NewPaymentEvent = typeof paymentEvents.$inferInsert;