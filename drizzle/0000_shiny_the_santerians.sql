CREATE TYPE "public"."build_job_status" AS ENUM('pending', 'validating', 'processing', 'publishing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."build_job_step_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."build_type" AS ENUM('vault', 'slideshow', 'flipbook');--> statement-breakpoint
CREATE TYPE "public"."email_event_type" AS ENUM('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed');--> statement-breakpoint
CREATE TYPE "public"."email_job_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."email_job_type" AS ENUM('payment_success', 'vault_ready', 'qr_card', 'reminder_upload', 'expiry_warning', 'build_failure');--> statement-breakpoint
CREATE TYPE "public"."feature_data_type" AS ENUM('boolean', 'integer', 'string', 'json');--> statement-breakpoint
CREATE TYPE "public"."generated_asset_status" AS ENUM('draft', 'processing', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."guest_session_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_event_type" AS ENUM('created', 'status_changed', 'wedding_date_changed', 'deadline_recalculated', 'upload_deadline_reached', 'download_deadline_reached', 'expired', 'archived', 'deletion_pending', 'deleted', 'build_completed', 'payment_verified');--> statement-breakpoint
CREATE TYPE "public"."media_job_type" AS ENUM('thumbnail', 'optimize', 'video_transcode', 'content_hash', 'malware_scan');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('uploaded', 'processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."media_variant_type" AS ENUM('original', 'thumbnail', 'preview', 'full', 'video_hls');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'invited', 'suspended', 'removed');--> statement-breakpoint
CREATE TYPE "public"."memory_status" AS ENUM('pending_approval', 'approved', 'rejected', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('in_app', 'email');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."organization_role" AS ENUM('platform_admin', 'platform_support', 'wedding_company_owner', 'wedding_company_admin', 'wedding_company_staff', 'couple_owner', 'couple_member', 'guest');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('platform', 'wedding_company');--> statement-breakpoint
CREATE TYPE "public"."payment_event_status" AS ENUM('received', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_event_type" AS ENUM('payment_received', 'payment_verified', 'payment_failed', 'payment_refunded', 'chargeback', 'notification');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('payfast', 'peach_payments', 'paystack', 'ozow');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."processing_job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'inactive', 'retired');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('one_time', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."qr_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."template_field_type" AS ENUM('text', 'textarea', 'color', 'boolean', 'select', 'image', 'video');--> statement-breakpoint
CREATE TYPE "public"."template_status" AS ENUM('draft', 'active', 'inactive', 'retired');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."vault_access_role" AS ENUM('couple_owner', 'couple_member', 'guest', 'admin');--> statement-breakpoint
CREATE TYPE "public"."vault_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."wedding_status" AS ENUM('draft', 'building', 'active', 'upload_closed', 'download_only', 'expired', 'archived', 'deletion_pending', 'deleted');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"email_verified_at" timestamp with time zone,
	"full_name" varchar(200),
	"avatar_url" text,
	"password_hash" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "organization_role" NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" varchar(32) NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"type" "organization_type" DEFAULT 'wedding_company' NOT NULL,
	"status" "organization_status" DEFAULT 'active' NOT NULL,
	"billing_email" varchar(320),
	"phone" varchar(30),
	"country" varchar(2),
	"timezone" varchar(64) DEFAULT 'Africa/Johannesburg' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"public_id" varchar(32) NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(30),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_feature_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"integer_value" integer,
	"boolean_value" boolean,
	"string_value" text,
	"min_value" integer,
	"max_value" integer,
	"is_unlimited" boolean DEFAULT false NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"label" varchar(200) NOT NULL,
	"description" text,
	"data_type" "feature_data_type" DEFAULT 'boolean' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"code" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"type" "product_type" DEFAULT 'one_time' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'ZAR' NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "template_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"field_key" varchar(100) NOT NULL,
	"label" varchar(200) NOT NULL,
	"field_type" "template_field_type" NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"default_value" jsonb,
	"options" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"is_latest" boolean DEFAULT false NOT NULL,
	"published_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"code" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"thumbnail_key" text,
	"is_platform" boolean DEFAULT true NOT NULL,
	"status" "template_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"line_total_cents" integer NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_unit_price_nonnegative" CHECK ("order_items"."unit_price_cents" >= 0),
	CONSTRAINT "order_items_line_total_nonnegative" CHECK ("order_items"."line_total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"order_number" varchar(32) NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'ZAR' NOT NULL,
	"metadata" jsonb,
	"placed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "orders_total_cents_nonnegative" CHECK ("orders"."total_cents" >= 0),
	CONSTRAINT "orders_subtotal_cents_nonnegative" CHECK ("orders"."subtotal_cents" >= 0),
	CONSTRAINT "orders_discount_cents_nonnegative" CHECK ("orders"."discount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"payment_id" uuid,
	"provider_event_id" varchar(200) NOT NULL,
	"event_type" "payment_event_type" NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"status" "payment_event_status" DEFAULT 'received' NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_reference" varchar(200) NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'ZAR' NOT NULL,
	"failure_reason" text,
	"refund_amount_cents" integer,
	"refund_reason" text,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_cents" > 0),
	CONSTRAINT "payments_refund_nonnegative" CHECK ("payments"."refund_amount_cents" is null or "payments"."refund_amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "weddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid,
	"public_id" varchar(32) NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(200) NOT NULL,
	"partner_one_name" varchar(120),
	"partner_two_name" varchar(120),
	"status" "wedding_status" DEFAULT 'draft' NOT NULL,
	"wedding_date" date,
	"timezone" varchar(64) DEFAULT 'Africa/Johannesburg' NOT NULL,
	"template_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wedding_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"theme_color" varchar(7) DEFAULT '#8B5E3C' NOT NULL,
	"accent_color" varchar(7) DEFAULT '#D4AF37' NOT NULL,
	"banner_media_id" uuid,
	"intro_media_id" uuid,
	"couple_story" text,
	"custom_message" text,
	"allow_guest_uploads" boolean DEFAULT true NOT NULL,
	"require_approval" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wedding_settings_theme_color_format" CHECK ("wedding_settings"."theme_color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "wedding_settings_accent_color_format" CHECK ("wedding_settings"."accent_color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "guest_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"token" varchar(128) NOT NULL,
	"display_name" varchar(120),
	"status" "guest_session_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"upload_count" integer DEFAULT 0 NOT NULL,
	"max_uploads" integer DEFAULT 100 NOT NULL,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"guest_session_id" uuid,
	"role" "vault_access_role" DEFAULT 'guest' NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"public_id" varchar(32) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"title" varchar(200),
	"description" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"no_index" boolean DEFAULT true NOT NULL,
	"status" "vault_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "build_job_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_job_id" uuid NOT NULL,
	"step_key" varchar(80) NOT NULL,
	"step_order" integer DEFAULT 0 NOT NULL,
	"status" "build_job_step_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"build_type" "build_type" NOT NULL,
	"template_id" uuid,
	"idempotency_key" varchar(200) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "build_job_status" DEFAULT 'pending' NOT NULL,
	"input" jsonb,
	"result" jsonb,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"enqueued_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"memory_id" uuid,
	"uploaded_by" uuid,
	"guest_session_id" uuid,
	"storage_key" text NOT NULL,
	"filename" varchar(255) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"sha256_hash" char(64),
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"status" "media_status" DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media_processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_type" "media_job_type" NOT NULL,
	"status" "processing_job_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" varchar(200) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"variant_type" "media_variant_type" DEFAULT 'original' NOT NULL,
	"storage_key" text NOT NULL,
	"filename" varchar(255) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(200),
	"description" text,
	"memory_date" date,
	"uploaded_by" uuid,
	"guest_session_id" uuid,
	"is_featured" boolean DEFAULT false NOT NULL,
	"status" "memory_status" DEFAULT 'pending_approval' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "slideshow_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slideshow_id" uuid NOT NULL,
	"media_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"transition" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slideshows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid,
	"build_job_id" uuid,
	"title" varchar(200),
	"config" jsonb,
	"status" "generated_asset_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "flipbook_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flipbook_id" uuid NOT NULL,
	"media_id" uuid,
	"page_number" integer NOT NULL,
	"content" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flipbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid,
	"build_job_id" uuid,
	"title" varchar(200),
	"config" jsonb,
	"status" "generated_asset_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"vault_id" uuid,
	"organization_id" uuid NOT NULL,
	"design_id" uuid,
	"public_id" varchar(32) NOT NULL,
	"target_url" text,
	"status" "qr_status" DEFAULT 'active' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "qr_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"code" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"background_color" varchar(7) DEFAULT '#FFFFFF' NOT NULL,
	"foreground_color" varchar(7) DEFAULT '#000000' NOT NULL,
	"logo_key" text,
	"is_platform" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "expiry_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"upload_deadline" timestamp with time zone NOT NULL,
	"download_deadline" timestamp with time zone NOT NULL,
	"upload_window_days" integer NOT NULL,
	"download_window_days" integer NOT NULL,
	"timezone" varchar(64) DEFAULT 'Africa/Johannesburg' NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"wedding_date_at_calculation" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type" "lifecycle_event_type" NOT NULL,
	"from_status" "wedding_status",
	"to_status" "wedding_status",
	"reason" varchar(255),
	"actor_user_id" uuid,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_job_id" uuid NOT NULL,
	"event_type" "email_event_type" NOT NULL,
	"provider_event_id" varchar(200),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"wedding_id" uuid,
	"email_type" "email_job_type" NOT NULL,
	"to_email" varchar(320) NOT NULL,
	"to_name" varchar(200),
	"from_email" varchar(320),
	"subject" varchar(200) NOT NULL,
	"body_html" text,
	"body_text" text,
	"template_key" varchar(120),
	"status" "email_job_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" varchar(200) NOT NULL,
	"provider_message_id" varchar(200),
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"kind" "notification_kind" DEFAULT 'in_app' NOT NULL,
	"title" varchar(200),
	"body" text,
	"related_entity_type" varchar(60),
	"related_entity_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"actor_user_id" uuid,
	"action" varchar(120) NOT NULL,
	"resource_type" varchar(80) NOT NULL,
	"resource_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_feature_values" ADD CONSTRAINT "product_feature_values_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_feature_values" ADD CONSTRAINT "product_feature_values_feature_id_product_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."product_features"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_fields" ADD CONSTRAINT "template_fields_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weddings" ADD CONSTRAINT "weddings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weddings" ADD CONSTRAINT "weddings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weddings" ADD CONSTRAINT "weddings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weddings" ADD CONSTRAINT "weddings_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_settings" ADD CONSTRAINT "wedding_settings_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_settings" ADD CONSTRAINT "wedding_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_access" ADD CONSTRAINT "vault_access_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_access" ADD CONSTRAINT "vault_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_access" ADD CONSTRAINT "vault_access_guest_session_id_guest_sessions_id_fk" FOREIGN KEY ("guest_session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_access" ADD CONSTRAINT "vault_access_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_job_steps" ADD CONSTRAINT "build_job_steps_build_job_id_build_jobs_id_fk" FOREIGN KEY ("build_job_id") REFERENCES "public"."build_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_jobs" ADD CONSTRAINT "build_jobs_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_jobs" ADD CONSTRAINT "build_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_jobs" ADD CONSTRAINT "build_jobs_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_memory_id_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_guest_session_id_guest_sessions_id_fk" FOREIGN KEY ("guest_session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_processing_jobs" ADD CONSTRAINT "media_processing_jobs_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_processing_jobs" ADD CONSTRAINT "media_processing_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variants_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_guest_session_id_guest_sessions_id_fk" FOREIGN KEY ("guest_session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slideshow_items" ADD CONSTRAINT "slideshow_items_slideshow_id_slideshows_id_fk" FOREIGN KEY ("slideshow_id") REFERENCES "public"."slideshows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slideshow_items" ADD CONSTRAINT "slideshow_items_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slideshows" ADD CONSTRAINT "slideshows_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slideshows" ADD CONSTRAINT "slideshows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slideshows" ADD CONSTRAINT "slideshows_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slideshows" ADD CONSTRAINT "slideshows_build_job_id_build_jobs_id_fk" FOREIGN KEY ("build_job_id") REFERENCES "public"."build_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flipbook_pages" ADD CONSTRAINT "flipbook_pages_flipbook_id_flipbooks_id_fk" FOREIGN KEY ("flipbook_id") REFERENCES "public"."flipbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flipbook_pages" ADD CONSTRAINT "flipbook_pages_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flipbooks" ADD CONSTRAINT "flipbooks_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flipbooks" ADD CONSTRAINT "flipbooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flipbooks" ADD CONSTRAINT "flipbooks_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flipbooks" ADD CONSTRAINT "flipbooks_build_job_id_build_jobs_id_fk" FOREIGN KEY ("build_job_id") REFERENCES "public"."build_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_design_id_qr_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."qr_designs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_designs" ADD CONSTRAINT "qr_designs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expiry_rules" ADD CONSTRAINT "expiry_rules_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expiry_rules" ADD CONSTRAINT "expiry_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_job_id_email_jobs_id_fk" FOREIGN KEY ("email_job_id") REFERENCES "public"."email_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_jobs" ADD CONSTRAINT "email_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_jobs" ADD CONSTRAINT "email_jobs_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique_idx" ON "users" USING btree ("email") WHERE "users"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_unique_idx" ON "organization_members" USING btree ("organization_id","user_id") WHERE "organization_members"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "organization_members_org_idx" ON "organization_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_members_role_idx" ON "organization_members" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_public_id_unique_idx" ON "organizations" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique_idx" ON "organizations" USING btree ("slug") WHERE "organizations"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "organizations_status_idx" ON "organizations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_org_public_id_unique_idx" ON "customers" USING btree ("organization_id","public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_org_email_unique_idx" ON "customers" USING btree ("organization_id","email") WHERE "customers"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "customers_org_idx" ON "customers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customers_user_id_idx" ON "customers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_feature_values_product_feature_unique_idx" ON "product_feature_values" USING btree ("product_id","feature_id");--> statement-breakpoint
CREATE INDEX "product_feature_values_feature_idx" ON "product_feature_values" USING btree ("feature_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_features_code_unique_idx" ON "product_features" USING btree ("code") WHERE "product_features"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "products_platform_code_unique_idx" ON "products" USING btree ("code") WHERE "products"."organization_id" is null and "products"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "products_org_code_unique_idx" ON "products" USING btree ("organization_id","code") WHERE "products"."organization_id" is not null and "products"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "products_org_idx" ON "products" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "template_fields_template_key_unique_idx" ON "template_fields" USING btree ("template_id","field_key");--> statement-breakpoint
CREATE INDEX "template_fields_template_idx" ON "template_fields" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_versions_template_version_unique_idx" ON "template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE INDEX "template_versions_is_latest_idx" ON "template_versions" USING btree ("template_id","is_latest") WHERE "template_versions"."is_latest" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "templates_platform_code_unique_idx" ON "templates" USING btree ("code") WHERE "templates"."organization_id" is null and "templates"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "templates_org_code_unique_idx" ON "templates" USING btree ("organization_id","code") WHERE "templates"."organization_id" is not null and "templates"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "templates_org_idx" ON "templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "templates_status_idx" ON "templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_org_order_number_unique_idx" ON "orders" USING btree ("organization_id","order_number");--> statement-breakpoint
CREATE INDEX "orders_org_idx" ON "orders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_placed_at_idx" ON "orders" USING btree ("placed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_event_id_unique_idx" ON "payment_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_events_payment_idx" ON "payment_events" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_events_status_idx" ON "payment_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_events_processed_at_idx" ON "payment_events" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_reference_unique_idx" ON "payments" USING btree ("provider_reference");--> statement-breakpoint
CREATE INDEX "payments_org_idx" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "weddings_org_public_id_unique_idx" ON "weddings" USING btree ("organization_id","public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weddings_org_code_unique_idx" ON "weddings" USING btree ("organization_id","code") WHERE "weddings"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "weddings_org_idx" ON "weddings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "weddings_customer_idx" ON "weddings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "weddings_status_idx" ON "weddings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "weddings_wedding_date_idx" ON "weddings" USING btree ("wedding_date");--> statement-breakpoint
CREATE UNIQUE INDEX "wedding_settings_wedding_unique_idx" ON "wedding_settings" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "wedding_settings_banner_idx" ON "wedding_settings" USING btree ("banner_media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_sessions_token_unique_idx" ON "guest_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "guest_sessions_vault_idx" ON "guest_sessions" USING btree ("vault_id");--> statement-breakpoint
CREATE INDEX "guest_sessions_status_expires_idx" ON "guest_sessions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_access_vault_user_unique_idx" ON "vault_access" USING btree ("vault_id","user_id") WHERE "vault_access"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "vault_access_user_idx" ON "vault_access" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vault_access_guest_session_idx" ON "vault_access" USING btree ("guest_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vaults_public_id_unique_idx" ON "vaults" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vaults_slug_unique_idx" ON "vaults" USING btree ("slug") WHERE "vaults"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "vaults_wedding_idx" ON "vaults" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "vaults_org_idx" ON "vaults" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vaults_status_idx" ON "vaults" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "build_job_steps_job_step_key_unique_idx" ON "build_job_steps" USING btree ("build_job_id","step_key");--> statement-breakpoint
CREATE INDEX "build_job_steps_status_idx" ON "build_job_steps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "build_job_steps_order_idx" ON "build_job_steps" USING btree ("build_job_id","step_order");--> statement-breakpoint
CREATE UNIQUE INDEX "build_jobs_idempotency_key_unique_idx" ON "build_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "build_jobs_wedding_version_unique_idx" ON "build_jobs" USING btree ("wedding_id","version");--> statement-breakpoint
CREATE INDEX "build_jobs_org_idx" ON "build_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "build_jobs_status_idx" ON "build_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "build_jobs_wedding_idx" ON "build_jobs" USING btree ("wedding_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_org_storage_key_unique_idx" ON "media" USING btree ("organization_id","storage_key") WHERE "media"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "media_wedding_idx" ON "media" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "media_org_idx" ON "media" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "media_memory_idx" ON "media" USING btree ("memory_id");--> statement-breakpoint
CREATE INDEX "media_uploaded_by_idx" ON "media" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "media_guest_session_idx" ON "media" USING btree ("guest_session_id");--> statement-breakpoint
CREATE INDEX "media_sha256_hash_idx" ON "media" USING btree ("sha256_hash");--> statement-breakpoint
CREATE INDEX "media_status_idx" ON "media" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "media_processing_jobs_idempotency_key_unique_idx" ON "media_processing_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "media_processing_jobs_media_idx" ON "media_processing_jobs" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "media_processing_jobs_org_idx" ON "media_processing_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "media_processing_jobs_status_idx" ON "media_processing_jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "media_variants_media_type_unique_idx" ON "media_variants" USING btree ("media_id","variant_type");--> statement-breakpoint
CREATE INDEX "media_variants_media_idx" ON "media_variants" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "memories_wedding_idx" ON "memories" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "memories_org_idx" ON "memories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "memories_status_idx" ON "memories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "memories_guest_session_idx" ON "memories" USING btree ("guest_session_id");--> statement-breakpoint
CREATE INDEX "slideshow_items_slideshow_order_idx" ON "slideshow_items" USING btree ("slideshow_id","sort_order");--> statement-breakpoint
CREATE INDEX "slideshow_items_media_idx" ON "slideshow_items" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "slideshows_wedding_idx" ON "slideshows" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "slideshows_org_idx" ON "slideshows" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "slideshows_status_idx" ON "slideshows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "slideshows_build_job_idx" ON "slideshows" USING btree ("build_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flipbook_pages_flipbook_page_number_unique_idx" ON "flipbook_pages" USING btree ("flipbook_id","page_number");--> statement-breakpoint
CREATE INDEX "flipbook_pages_media_idx" ON "flipbook_pages" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "flipbooks_wedding_idx" ON "flipbooks" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "flipbooks_org_idx" ON "flipbooks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "flipbooks_status_idx" ON "flipbooks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "flipbooks_build_job_idx" ON "flipbooks" USING btree ("build_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "qr_codes_public_id_unique_idx" ON "qr_codes" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "qr_codes_wedding_idx" ON "qr_codes" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "qr_codes_vault_idx" ON "qr_codes" USING btree ("vault_id");--> statement-breakpoint
CREATE INDEX "qr_codes_org_idx" ON "qr_codes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "qr_codes_design_idx" ON "qr_codes" USING btree ("design_id");--> statement-breakpoint
CREATE UNIQUE INDEX "qr_designs_platform_code_unique_idx" ON "qr_designs" USING btree ("code") WHERE "qr_designs"."organization_id" is null and "qr_designs"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "qr_designs_org_code_unique_idx" ON "qr_designs" USING btree ("organization_id","code") WHERE "qr_designs"."organization_id" is not null and "qr_designs"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "qr_designs_org_idx" ON "qr_designs" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expiry_rules_wedding_id_unique_idx" ON "expiry_rules" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "expiry_rules_org_idx" ON "expiry_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "expiry_rules_upload_deadline_idx" ON "expiry_rules" USING btree ("upload_deadline");--> statement-breakpoint
CREATE INDEX "expiry_rules_download_deadline_idx" ON "expiry_rules" USING btree ("download_deadline");--> statement-breakpoint
CREATE INDEX "lifecycle_events_wedding_idx" ON "lifecycle_events" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "lifecycle_events_org_idx" ON "lifecycle_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "lifecycle_events_type_idx" ON "lifecycle_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "lifecycle_events_occurred_at_idx" ON "lifecycle_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_events_provider_event_id_unique_idx" ON "email_events" USING btree ("provider_event_id") WHERE "email_events"."provider_event_id" is not null;--> statement-breakpoint
CREATE INDEX "email_events_job_idx" ON "email_events" USING btree ("email_job_id");--> statement-breakpoint
CREATE INDEX "email_events_type_idx" ON "email_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "email_jobs_idempotency_key_unique_idx" ON "email_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "email_jobs_org_idx" ON "email_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "email_jobs_wedding_idx" ON "email_jobs" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "email_jobs_status_idx" ON "email_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_jobs_scheduled_at_idx" ON "email_jobs" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_org_idx" ON "notifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_related_idx" ON "notifications" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_org_idx" ON "audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");