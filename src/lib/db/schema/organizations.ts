import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  integer,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { organizationRole, organizationStatus, organizationType, membershipStatus } from './enums';

/**
 * organizations — tenant root. Every tenant-scoped table carries an
 * `organization_id` foreign key to enforce server-side tenant isolation.
 */
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Opaque external identifier (never expose internal `id`).
    publicId: varchar('public_id', { length: 32 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    type: organizationType('type').notNull().default('wedding_company'),
    status: organizationStatus('status').notNull().default('active'),
    billingEmail: varchar('billing_email', { length: 320 }),
    phone: varchar('phone', { length: 30 }),
    // ISO 3166-1 alpha-2 country code.
    country: varchar('country', { length: 2 }),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Africa/Johannesburg'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('organizations_public_id_unique_idx').on(table.publicId),
    uniqueIndex('organizations_slug_unique_idx')
      .on(table.slug)
      .where(sql`${table.deletedAt} is null`),
    index('organizations_status_idx').on(table.status),
  ],
);

/**
 * organization_members — membership of a user in a tenant with a role.
 * A user can belong to many organizations; a role is scoped to one membership.
 */
export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: organizationRole('role').notNull(),
    status: membershipStatus('status').notNull().default('active'),
    // Position for ordering within a tenant (owner first, etc.).
    sortOrder: integer('sort_order').notNull().default(0),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('organization_members_org_user_unique_idx')
      .on(table.organizationId, table.userId)
      .where(sql`${table.deletedAt} is null`),
    index('organization_members_org_idx').on(table.organizationId),
    index('organization_members_user_idx').on(table.userId),
    index('organization_members_role_idx').on(table.role),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;