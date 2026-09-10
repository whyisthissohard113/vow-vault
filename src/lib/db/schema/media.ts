import { sql } from 'drizzle-orm';
import {
  index,
  bigint,
  boolean,
  char,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { organizations } from './organizations';
import { guestSessions } from './vaults';
import { weddings } from './weddings';
import {
  mediaJobType,
  mediaStatus,
  mediaVariantType,
  memoryStatus,
  processingJobStatus,
} from './enums';

/**
 * memories — logical groupings of one or more media uploads
 * (e.g. a guest shares "Our table" with three photos).
 */
export const memories = pgTable(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }),
    description: text('description'),
    memoryDate: date('memory_date', { mode: 'date' }),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    guestSessionId: uuid('guest_session_id').references(() => guestSessions.id, {
      onDelete: 'set null',
    }),
    isFeatured: boolean('is_featured').notNull().default(false),
    status: memoryStatus('status').notNull().default('pending_approval'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('memories_wedding_idx').on(table.weddingId),
    index('memories_org_idx').on(table.organizationId),
    index('memories_status_idx').on(table.status),
    index('memories_guest_session_idx').on(table.guestSessionId),
  ],
);

/**
 * media — individual uploaded assets (photos/videos).
 *
 * Object storage keys are namespaced (`{tenant}/{wedding}/{uuid}.{ext}`) and
 * never user-controlled. `sha256_hash` enables content-hash duplicate
 * detection and integrity checks.
 */
export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    memoryId: uuid('memory_id').references(() => memories.id, { onDelete: 'set null' }),
    // Couple/staff uploads set `uploaded_by`; guest uploads may leave it null
    // and rely on `guest_session_id`.
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    guestSessionId: uuid('guest_session_id').references(() => guestSessions.id, {
      onDelete: 'set null',
    }),
    storageKey: text('storage_key').notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    contentType: varchar('content_type', { length: 100 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
    sha256Hash: char('sha256_hash', { length: 64 }),
    width: integer('width'),
    height: integer('height'),
    durationMs: integer('duration_ms'),
    status: mediaStatus('status').notNull().default('uploaded'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    // A soft-deleted media row can be purged later; the storage key must be
    // reusable after logical deletion, hence the partial unique index.
    uniqueIndex('media_org_storage_key_unique_idx')
      .on(table.organizationId, table.storageKey)
      .where(sql`${table.deletedAt} is null`),
    index('media_wedding_idx').on(table.weddingId),
    index('media_org_idx').on(table.organizationId),
    index('media_memory_idx').on(table.memoryId),
    index('media_uploaded_by_idx').on(table.uploadedBy),
    index('media_guest_session_idx').on(table.guestSessionId),
    index('media_sha256_hash_idx').on(table.sha256Hash),
    index('media_status_idx').on(table.status),
  ],
);

/**
 * media_variants — derived renditions (thumbnails, optimized full-size,
 * HLS segments) produced by the processing pipeline.
 */
export const mediaVariants = pgTable(
  'media_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    variantType: mediaVariantType('variant_type').notNull().default('original'),
    storageKey: text('storage_key').notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    contentType: varchar('content_type', { length: 100 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('media_variants_media_type_unique_idx').on(table.mediaId, table.variantType),
    index('media_variants_media_idx').on(table.mediaId),
  ],
);

/**
 * media_processing_jobs — retryable processing work per media asset.
 * `idempotency_key` prevents duplicate processing after retries.
 */
export const mediaProcessingJobs = pgTable(
  'media_processing_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    jobType: mediaJobType('job_type').notNull(),
    status: processingJobStatus('status').notNull().default('pending'),
    idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('media_processing_jobs_idempotency_key_unique_idx').on(table.idempotencyKey),
    index('media_processing_jobs_media_idx').on(table.mediaId),
    index('media_processing_jobs_org_idx').on(table.organizationId),
    index('media_processing_jobs_status_idx').on(table.status),
  ],
);

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type MediaVariant = typeof mediaVariants.$inferSelect;
export type NewMediaVariant = typeof mediaVariants.$inferInsert;
export type MediaProcessingJob = typeof mediaProcessingJobs.$inferSelect;
export type NewMediaProcessingJob = typeof mediaProcessingJobs.$inferInsert;