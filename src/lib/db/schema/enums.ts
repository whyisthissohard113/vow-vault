import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Shared PostgreSQL enum types for the Wedding Memory Vault schema.
 *
 * Note on timestamps: all timestamp columns are stored as `timestamptz` (UTC).
 * Wedding-date business deadlines (upload/download windows) are calculated in
 * `Africa/Johannesburg` by the application layer and persisted as UTC.
 *
 * Guest-facing tokens and public IDs are opaque; see the app services layer.
 */

/** Roles across the platform and within a tenant. Mirrors MASTER_SPEC roles. */
export const organizationRole = pgEnum('organization_role', [
  'platform_admin',
  'platform_support',
  'wedding_company_owner',
  'wedding_company_admin',
  'wedding_company_staff',
  'couple_owner',
  'couple_member',
  'guest',
]);

export const userStatus = pgEnum('user_status', ['active', 'suspended', 'deactivated']);

export const membershipStatus = pgEnum('membership_status', [
  'active',
  'invited',
  'suspended',
  'removed',
]);

export const organizationType = pgEnum('organization_type', ['platform', 'wedding_company']);

export const organizationStatus = pgEnum('organization_status', ['active', 'suspended', 'closed']);

/** Product lifecycle: a product is a purchasable package (Silver/Gold/Platinum). */
export const productType = pgEnum('product_type', ['one_time', 'subscription']);

export const productStatus = pgEnum('product_status', ['draft', 'active', 'inactive', 'retired']);

/** Data type carried by a product feature definition. */
export const featureDataType = pgEnum('feature_data_type', ['boolean', 'integer', 'string', 'json']);

export const orderStatus = pgEnum('order_status', ['pending', 'paid', 'failed', 'cancelled', 'refunded']);

/** Payment providers; the billing layer keeps a provider-neutral interface. */
export const paymentProvider = pgEnum('payment_provider', [
  'payfast',
  'peach_payments',
  'paystack',
  'ozow',
]);

export const paymentStatus = pgEnum('payment_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
]);

export const paymentEventType = pgEnum('payment_event_type', [
  'payment_received',
  'payment_verified',
  'payment_failed',
  'payment_refunded',
  'chargeback',
  'notification',
]);

export const paymentEventStatus = pgEnum('payment_event_status', ['received', 'processed', 'failed']);

/**
 * Wedding lifecycle — exactly mirrors MASTER_SPEC:
 * DRAFT → BUILDING → ACTIVE → UPLOAD_CLOSED → DOWNLOAD_ONLY → EXPIRED →
 * ARCHIVED → DELETION_PENDING → DELETED.
 */
export const weddingStatus = pgEnum('wedding_status', [
  'draft',
  'building',
  'active',
  'upload_closed',
  'download_only',
  'expired',
  'archived',
  'deletion_pending',
  'deleted',
]);

export const vaultStatus = pgEnum('vault_status', ['draft', 'published', 'archived']);

export const vaultAccessRole = pgEnum('vault_access_role', [
  'couple_owner',
  'couple_member',
  'guest',
  'admin',
]);

export const guestSessionStatus = pgEnum('guest_session_status', ['active', 'expired', 'revoked']);

export const memoryStatus = pgEnum('memory_status', ['pending_approval', 'approved', 'rejected', 'hidden']);

export const mediaStatus = pgEnum('media_status', ['uploaded', 'processing', 'processed', 'failed']);

export const mediaVariantType = pgEnum('media_variant_type', [
  'original',
  'thumbnail',
  'preview',
  'full',
  'video_hls',
]);

export const processingJobStatus = pgEnum('processing_job_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const mediaJobType = pgEnum('media_job_type', [
  'thumbnail',
  'optimize',
  'video_transcode',
  'content_hash',
  'malware_scan',
]);

export const buildType = pgEnum('build_type', ['vault', 'slideshow', 'flipbook']);

export const buildJobStatus = pgEnum('build_job_status', [
  'pending',
  'validating',
  'processing',
  'publishing',
  'completed',
  'failed',
]);

export const buildJobStepStatus = pgEnum('build_job_step_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'skipped',
]);

export const lifecycleEventType = pgEnum('lifecycle_event_type', [
  'created',
  'status_changed',
  'wedding_date_changed',
  'deadline_recalculated',
  'upload_deadline_reached',
  'download_deadline_reached',
  'expired',
  'archived',
  'deletion_pending',
  'deleted',
  'build_completed',
  'payment_verified',
]);

export const emailJobType = pgEnum('email_job_type', [
  'payment_success',
  'vault_ready',
  'qr_card',
  'reminder_upload',
  'expiry_warning',
  'build_failure',
  'build_started',
  'qr_ready',
  'download_reminder',
  'upload_expiry_warning',
  'download_expiry_warning',
  'upload_closed',
  'download_closed',
  'support_notification',
]);

export const emailJobStatus = pgEnum('email_job_status', ['pending', 'sending', 'sent', 'failed', 'cancelled']);

export const emailEventType = pgEnum('email_event_type', [
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'complained',
  'failed',
]);

export const notificationKind = pgEnum('notification_kind', ['in_app', 'email']);

export const templateStatus = pgEnum('template_status', ['draft', 'active', 'inactive', 'retired']);

export const templateFieldType = pgEnum('template_field_type', [
  'text',
  'textarea',
  'color',
  'boolean',
  'select',
  'image',
  'video',
]);

export const qrStatus = pgEnum('qr_status', ['active', 'revoked', 'expired']);

/** Shared status for generated assets (slideshows, flipbooks). */
export const generatedAssetStatus = pgEnum('generated_asset_status', [
  'draft',
  'processing',
  'published',
  'failed',
]);