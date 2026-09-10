import { sql } from 'drizzle-orm';
import {
  check,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { weddings } from './weddings';

/**
 * wedding_settings — one row per wedding with presentation and guest-upload
 * preferences.
 *
 * `banner_media_id` / `intro_media_id` reference `media` rows that already
 * carry the `wedding_id` foreign key; the reverse reference is intentionally
 * NOT a database foreign key (it would create a circular dependency with
 * `media`), and is enforced by application services.
 */
export const weddingSettings = pgTable(
  'wedding_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    themeColor: varchar('theme_color', { length: 7 }).notNull().default('#8B5E3C'),
    accentColor: varchar('accent_color', { length: 7 }).notNull().default('#D4AF37'),
    bannerMediaId: uuid('banner_media_id'),
    introMediaId: uuid('intro_media_id'),
    coupleStory: text('couple_story'),
    customMessage: text('custom_message'),
    allowGuestUploads: boolean('allow_guest_uploads').notNull().default(true),
    requireApproval: boolean('require_approval').notNull().default(false),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check('wedding_settings_theme_color_format', sql`${table.themeColor} ~ '^#[0-9A-Fa-f]{6}$'`),
    check('wedding_settings_accent_color_format', sql`${table.accentColor} ~ '^#[0-9A-Fa-f]{6}$'`),
    uniqueIndex('wedding_settings_wedding_unique_idx').on(table.weddingId),
    index('wedding_settings_banner_idx').on(table.bannerMediaId),
  ],
);

export type WeddingSettings = typeof weddingSettings.$inferSelect;
export type NewWeddingSettings = typeof weddingSettings.$inferInsert;