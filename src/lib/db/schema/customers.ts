import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { organizations } from './organizations';

/**
 * customers — the legal/buying entity from the wedding company's perspective.
 * A customer is tenant-scoped and may be linked to an optional user account
 * (the purchaser). Covers couples who purchase a package from a wedding company.
 */
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // The linked account when the customer has registered; otherwise null.
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    // Opaque public identifier for the customer.
    publicId: varchar('public_id', { length: 32 }).notNull(),
    fullName: varchar('full_name', { length: 200 }).notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    phone: varchar('phone', { length: 30 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('customers_org_public_id_unique_idx').on(table.organizationId, table.publicId),
    uniqueIndex('customers_org_email_unique_idx')
      .on(table.organizationId, table.email)
      .where(sql`${table.deletedAt} is null`),
    index('customers_org_idx').on(table.organizationId),
    index('customers_user_id_idx').on(table.userId),
  ],
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;