import { index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { buildJobs } from './build';
import { media } from './media';
import { organizations } from './organizations';
import { templates } from './templates';
import { weddings } from './weddings';
import { generatedAssetStatus } from './enums';

/**
 * slideshows — generated slideshow asset (Gold/Platinum entitlement).
 */
export const slideshows = pgTable(
  'slideshows',
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
    // Transitions, durations, music reference, aspect-ratio, etc.
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
    index('slideshows_wedding_idx').on(table.weddingId),
    index('slideshows_org_idx').on(table.organizationId),
    index('slideshows_status_idx').on(table.status),
    index('slideshows_build_job_idx').on(table.buildJobId),
  ],
);

/**
 * slideshow_items — ordered media sequence within a slideshow.
 */
export const slideshowItems = pgTable(
  'slideshow_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slideshowId: uuid('slideshow_id')
      .notNull()
      .references(() => slideshows.id, { onDelete: 'cascade' }),
    mediaId: uuid('media_id').references(() => media.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    durationMs: integer('duration_ms'),
    transition: varchar('transition', { length: 40 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('slideshow_items_slideshow_order_idx').on(table.slideshowId, table.sortOrder),
    index('slideshow_items_media_idx').on(table.mediaId),
  ],
);

export type Slideshow = typeof slideshows.$inferSelect;
export type NewSlideshow = typeof slideshows.$inferInsert;
export type SlideshowItem = typeof slideshowItems.$inferSelect;
export type NewSlideshowItem = typeof slideshowItems.$inferInsert;