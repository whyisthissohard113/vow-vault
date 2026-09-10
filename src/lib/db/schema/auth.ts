import { index, pgTable, timestamp, uniqueIndex, uuid, varchar, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { userStatus } from './enums';

/**
 * users — global identity records.
 *
 * A user may belong to multiple organizations via `organization_members`.
 * Guests of a vault do NOT require a user record; they are represented by
 * `guest_sessions` (token-based, expiring).
 *
 * Email uniqueness is enforced only among non-deleted rows so that a logically
 * deleted user can later re-register with the same email.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 320 }).notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
    fullName: varchar('full_name', { length: 200 }),
    avatarUrl: text('avatar_url'),
    // Nullable: OAuth-only users may not carry a password hash.
    passwordHash: text('password_hash'),
    status: userStatus('status').notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('users_email_unique_idx')
      .on(table.email)
      .where(sql`${table.deletedAt} is null`),
    index('users_status_idx').on(table.status),
    index('users_created_at_idx').on(table.createdAt),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;