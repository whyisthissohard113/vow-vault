ALTER TYPE "public"."email_job_type" ADD VALUE 'build_started';--> statement-breakpoint
ALTER TYPE "public"."email_job_type" ADD VALUE 'qr_ready';--> statement-breakpoint
ALTER TYPE "public"."email_job_type" ADD VALUE 'download_reminder';--> statement-breakpoint
ALTER TYPE "public"."email_job_type" ADD VALUE 'upload_expiry_warning';--> statement-breakpoint
ALTER TYPE "public"."email_job_type" ADD VALUE 'download_expiry_warning';--> statement-breakpoint
ALTER TYPE "public"."email_job_type" ADD VALUE 'upload_closed';--> statement-breakpoint
ALTER TYPE "public"."email_job_type" ADD VALUE 'download_closed';--> statement-breakpoint
ALTER TYPE "public"."email_job_type" ADD VALUE 'support_notification';