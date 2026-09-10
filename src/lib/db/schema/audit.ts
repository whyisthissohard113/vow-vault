import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { organizations } from './organizations';

/**
 * audit_logs — append-only security and compliance trail. Hard-delete only;
 * rows are immutable once written.
 *
 * `resource_type`/`resource_id` identify the affected record; `before`/`after`
 * capture minimal field-level diffs for meaningful review (never tokens,
 * password hashes, or storage credentials).
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 120 }).notNull(),
    resourceType: varchar('resource_type', { length: 80 }).notNull(),
    resourceId: uuid('resource_id'),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_org_idx').on(table.organizationId),
    index('audit_logs_actor_idx').on(table.actorUserId),
    index('audit_logs_resource_idx').on(table.resourceType, table.resourceId),
    index('audit_logs_created_at_idx').on(table.createdAt),
    index('audit_logs_action_idx').on(table.action),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;