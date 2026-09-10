import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  boolean,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  text,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { featureDataType, productStatus, productType } from './enums';

/**
 * products — purchasable packages (Silver/Gold/Platinum).
 *
 * Products with `organization_id` NULL are platform-wide (the default);
 * wedding companies may define their own products (B2B2C reselling).
 * Because PostgreSQL treats NULLs as distinct in unique indexes, two partial
 * unique indexes are required to enforce code uniqueness in both scopes.
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    code: varchar('code', { length: 100 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    type: productType('type').notNull().default('one_time'),
    // Money is stored in integer minor units (cents) to avoid float drift.
    priceCents: integer('price_cents').notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('ZAR'),
    status: productStatus('status').notNull().default('draft'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('products_platform_code_unique_idx')
      .on(table.code)
      .where(sql`${table.organizationId} is null and ${table.deletedAt} is null`),
    uniqueIndex('products_org_code_unique_idx')
      .on(table.organizationId, table.code)
      .where(sql`${table.organizationId} is not null and ${table.deletedAt} is null`),
    index('products_org_idx').on(table.organizationId),
    index('products_status_idx').on(table.status),
  ],
);

/**
 * product_features — catalog of feature definitions (e.g. `max_photos`,
 * `video`, `slideshow`, `flipbook`, `qr_cards`, `upload_days`, `download_days`).
 * Definitions are platform-wide; values are assigned per product.
 */
export const productFeatures = pgTable(
  'product_features',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 100 }).notNull(),
    label: varchar('label', { length: 200 }).notNull(),
    description: text('description'),
    dataType: featureDataType('data_type').notNull().default('boolean'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('product_features_code_unique_idx')
      .on(table.code)
      .where(sql`${table.deletedAt} is null`),
  ],
);

/**
 * product_feature_values — the value assigned to a feature for a product.
 * The `value` jsonb is the authoritative value; typed mirror columns
 * (`integer_value`, `boolean_value`, `string_value`) allow indexed queries
 * (e.g. fair-use cap checks) without casting jsonb.
 */
export const productFeatureValues = pgTable(
  'product_feature_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    featureId: uuid('feature_id')
      .notNull()
      .references(() => productFeatures.id, { onDelete: 'restrict' }),
    value: jsonb('value').$type<unknown>().notNull(),
    integerValue: integer('integer_value'),
    booleanValue: boolean('boolean_value'),
    stringValue: text('string_value'),
    // Optional numeric range for limits (e.g. fair-use window 100..1000).
    minValue: integer('min_value'),
    maxValue: integer('max_value'),
    isUnlimited: boolean('is_unlimited').notNull().default(false),
    effectiveFrom: timestamp('effective_from', { withTimezone: true, mode: 'date' }),
    effectiveTo: timestamp('effective_to', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('product_feature_values_product_feature_unique_idx').on(
      table.productId,
      table.featureId,
    ),
    index('product_feature_values_feature_idx').on(table.featureId),
  ],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductFeature = typeof productFeatures.$inferSelect;
export type NewProductFeature = typeof productFeatures.$inferInsert;
export type ProductFeatureValue = typeof productFeatureValues.$inferSelect;
export type NewProductFeatureValue = typeof productFeatureValues.$inferInsert;