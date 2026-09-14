/**
 * PATCH /api/weddings/[id] — input contract.
 *
 * Phase 13 (ADR-011) semantics:
 *  - `status` is NOT a free-form column write. It is validated against the
 *    lifecycle machine's `MANUAL_TRANSITIONS` whitelist in the route handler
 *    and applied through `transitionWeddingStatus` (CAS-guarded, writes
 *    lifecycle_events + audit_logs). `deleted` is deliberately NOT in the
 *    enumerable set: it is only ever reached via the retention/purge tail.
 *  - `weddingDate` / `packageCode` changes trigger a deadline recalculation in
 *    the handler (`recalculateWeddingDeadlines`, ADR-001).
 */

import { z } from "zod";

export const WEDDING_STATUSES = [
  "draft",
  "building",
  "active",
  "upload_closed",
  "download_only",
  "expired",
  "archived",
  "deletion_pending",
] as const;

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color");

export const updateWeddingSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    partnerOneName: z.string().max(120).nullable().optional(),
    partnerTwoName: z.string().max(120).nullable().optional(),
    weddingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "weddingDate must be YYYY-MM-DD")
      .nullable()
      .optional(),
    packageCode: z.enum(["silver", "gold", "platinum"]).nullable().optional(),
    status: z.enum(WEDDING_STATUSES).optional(),
    customerEmail: z.string().email().max(320).optional(),
    settings: z
      .object({
        themeColor: hexColor.optional(),
        accentColor: hexColor.optional(),
        allowGuestUploads: z.boolean().optional(),
        requireApproval: z.boolean().optional(),
        coupleStory: z.string().max(5000).nullable().optional(),
        customMessage: z.string().max(5000).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type UpdateWeddingBody = z.infer<typeof updateWeddingSchema>;
export type WeddingStatusInput = (typeof WEDDING_STATUSES)[number];