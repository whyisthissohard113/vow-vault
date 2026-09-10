import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { templates } from './templates';
import { weddings } from './weddings';
import { buildJobStatus, buildJobStepStatus, buildType } from './enums';

/**
 * build_jobs — retryable, observable, idempotent Build Engine jobs.
 *
 * Two idempotency anchors:
 *  - `idempotency_key` is UNIQUE (re-enqueueing the same build does nothing);
 *  - (`wedding_id`, `version`) is UNIQUE so repeated builds pin a version and
 *    cannot duplicate production vaults.
 */
export const buildJobs = pgTable(
  'build_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    buildType: buildType('build_type').notNull(),
    templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
    idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull(),
    version: integer('version').notNull().default(1),
    status: buildJobStatus('status').notNull().default('pending'),
    // Validated build input snapshot (template version, field values, media refs).
    input: jsonb('input').$type<Record<string, unknown>>(),
    // Produced artifacts (vault id/public url, slideshow id, flipbook id...).
    result: jsonb('result').$type<Record<string, unknown>>(),
    errorMessage: text('error_message'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    enqueuedAt: timestamp('enqueued_at', { withTimezone: true, mode: 'date' }),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('build_jobs_idempotency_key_unique_idx').on(table.idempotencyKey),
    uniqueIndex('build_jobs_wedding_version_unique_idx').on(table.weddingId, table.version),
    index('build_jobs_org_idx').on(table.organizationId),
    index('build_jobs_status_idx').on(table.status),
    index('build_jobs_wedding_idx').on(table.weddingId),
  ],
);

/**
 * build_job_steps — granular progress within a build job
 * (validate → verify payment → create vault → apply template → publish → email).
 */
export const buildJobSteps = pgTable(
  'build_job_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    buildJobId: uuid('build_job_id')
      .notNull()
      .references(() => buildJobs.id, { onDelete: 'cascade' }),
    stepKey: varchar('step_key', { length: 80 }).notNull(),
    stepOrder: integer('step_order').notNull().default(0),
    status: buildJobStepStatus('status').notNull().default('pending'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('build_job_steps_job_step_key_unique_idx').on(table.buildJobId, table.stepKey),
    index('build_job_steps_status_idx').on(table.status),
    index('build_job_steps_order_idx').on(table.buildJobId, table.stepOrder),
  ],
);

export type BuildJob = typeof buildJobs.$inferSelect;
export type NewBuildJob = typeof buildJobs.$inferInsert;
export type BuildJobStep = typeof buildJobSteps.$inferSelect;
export type NewBuildJobStep = typeof buildJobSteps.$inferInsert;