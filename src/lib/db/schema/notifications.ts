import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { organizations } from './organizations';
import { notificationKind } from './enums';

/**
 * notifications — in-app and email notifications for signed-in users.
 * `related_entity_type`/`related_entity_id` point at the domain record
 * (e.g. `wedding`, `build_job`) for deep links.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    kind: notificationKind('kind').notNull().default('in_app'),
    title: varchar('title', { length: 200 }),
    body: text('body'),
    relatedEntityType: varchar('related_entity_type', { length: 60 }),
    relatedEntityId: uuid('related_entity_id'),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('notifications_user_idx').on(table.userId),
    index('notifications_org_idx').on(table.organizationId),
    index('notifications_user_read_idx').on(table.userId, table.readAt),
    index('notifications_related_idx').on(table.relatedEntityType, table.relatedEntityId),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;