import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { templateFieldType, templateStatus } from './enums';

/**
 * templates — visual design templates for vaults (platform-wide when
 * `organization_id` is NULL) plus tenant-custom templates.
 */
export const templates = pgTable(
  'templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    code: varchar('code', { length: 100 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    thumbnailKey: text('thumbnail_key'),
    isPlatform: boolean('is_platform').notNull().default(true),
    status: templateStatus('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('templates_platform_code_unique_idx')
      .on(table.code)
      .where(sql`${table.organizationId} is null and ${table.deletedAt} is null`),
    uniqueIndex('templates_org_code_unique_idx')
      .on(table.organizationId, table.code)
      .where(sql`${table.organizationId} is not null and ${table.deletedAt} is null`),
    index('templates_org_idx').on(table.organizationId),
    index('templates_status_idx').on(table.status),
  ],
);

/**
 * template_fields — declared customization fields for a template
 * (e.g. `couple_names`, `theme_color`, `banner_image`, `intro_video`).
 */
export const templateFields = pgTable(
  'template_fields',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    fieldKey: varchar('field_key', { length: 100 }).notNull(),
    label: varchar('label', { length: 200 }).notNull(),
    fieldType: templateFieldType('field_type').notNull(),
    isRequired: boolean('is_required').notNull().default(false),
    defaultValue: jsonb('default_value').$type<unknown>(),
    options: jsonb('options').$type<unknown[]>(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('template_fields_template_key_unique_idx').on(table.templateId, table.fieldKey),
    index('template_fields_template_idx').on(table.templateId),
  ],
);

/**
 * template_versions — immutable snapshots of a template's full content.
 * Versions are append-only; the build engine pins the version it renders with.
 */
export const templateVersions = pgTable(
  'template_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    // Serialized template definition consumed by the Build Engine.
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    isLatest: boolean('is_latest').notNull().default(false),
    publishedBy: uuid('published_by'),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('template_versions_template_version_unique_idx').on(
      table.templateId,
      table.version,
    ),
    index('template_versions_is_latest_idx')
      .on(table.templateId, table.isLatest)
      .where(sql`${table.isLatest} = true`),
  ],
);

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type TemplateField = typeof templateFields.$inferSelect;
export type NewTemplateField = typeof templateFields.$inferInsert;
export type TemplateVersion = typeof templateVersions.$inferSelect;
export type NewTemplateVersion = typeof templateVersions.$inferInsert;