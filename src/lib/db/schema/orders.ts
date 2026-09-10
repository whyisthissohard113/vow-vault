import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { customers } from './customers';
import { organizations } from './organizations';
import { products } from './products';
import { orderStatus } from './enums';

/**
 * orders — a customer's purchase of a product within a tenant.
 *
 * Monetary fields are integer minor units (cents). Payment state lives in
 * `payments`; an order is only `paid` when a matching payment is `completed`.
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    // Opaque, human-readable order reference shown to the customer.
    orderNumber: varchar('order_number', { length: 32 }).notNull(),
    status: orderStatus('status').notNull().default('pending'),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('ZAR'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    placedAt: timestamp('placed_at', { withTimezone: true, mode: 'date' }),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('orders_org_order_number_unique_idx').on(table.organizationId, table.orderNumber),
    check('orders_total_cents_nonnegative', sql`${table.totalCents} >= 0`),
    check('orders_subtotal_cents_nonnegative', sql`${table.subtotalCents} >= 0`),
    check('orders_discount_cents_nonnegative', sql`${table.discountCents} >= 0`),
    index('orders_org_idx').on(table.organizationId),
    index('orders_customer_idx').on(table.customerId),
    index('orders_status_idx').on(table.status),
    index('orders_placed_at_idx').on(table.placedAt),
  ],
);

/**
 * order_items — line items on an order. Product name/price are snapshotted at
 * purchase time so later product edits do not rewrite purchase history.
 */
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    productName: varchar('product_name', { length: 200 }).notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    quantity: integer('quantity').notNull().default(1),
    lineTotalCents: integer('line_total_cents').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check('order_items_quantity_positive', sql`${table.quantity} > 0`),
    check('order_items_unit_price_nonnegative', sql`${table.unitPriceCents} >= 0`),
    check('order_items_line_total_nonnegative', sql`${table.lineTotalCents} >= 0`),
    index('order_items_order_idx').on(table.orderId),
    index('order_items_product_idx').on(table.productId),
  ],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;