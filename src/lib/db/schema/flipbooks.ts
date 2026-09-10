import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { buildJobs } from './build';
import { media } from './media';
import { organizations } from './organizations';
import { templates } from './templates';
import { weddings } from './weddings';
import { generatedAssetStatus } from './enums';

/**
 * flipbooks — digital flipbook asset (Platinum entitlement).
 */
export const flipbooks = pgTable(
  'flipbooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
    buildJobId: uuid('build_job_id').references(() => buildJobs.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 200 }),
    // Page layout, cover, zoom/pan settings, etc.
    config: jsonb('config').$type<Record<string, unknown>>(),
    status: generatedAssetStatus('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('flipbooks_wedding_idx').on(table.weddingId),
    index('flipbooks_org_idx').on(table.organizationId),
    index('flipbooks_status_idx').on(table.status),
    index('flipbooks_build_job_idx').on(table.buildJobId),
  ],
);

/**
 * flipbook_pages — ordered pages of a flipbook. A page's rendered content may
 * embed media or be static content (intro page, story, etc.).
 */
export const flipbookPages = pgTable(
  'flipbook_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    flipbookId: uuid('flipbook_id')
      .notNull()
      .references(() => flipbooks.id, { onDelete: 'cascade' }),
    mediaId: uuid('media_id').references(() => media.id, { onDelete: 'set null' }),
    pageNumber: integer('page_number').notNull(),
    content: jsonb('content').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('flipbook_pages_flipbook_page_number_unique_idx').on(
      table.flipbookId,
      table.pageNumber,
    ),
    index('flipbook_pages_media_idx').on(table.mediaId),
  ],
);

export type Flipbook = typeof flipbooks.$inferSelect;
export type NewFlipbook = typeof flipbooks.$inferInsert;
export type FlipbookPage = typeof flipbookPages.$inferSelect;
export type NewFlipbookPage = typeof flipbookPages.$inferInsert;