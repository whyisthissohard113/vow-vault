ALTER TABLE "media" ADD COLUMN "public_id" varchar(32);--> statement-breakpoint
UPDATE "media" SET "public_id" = md5("id"::text) WHERE "public_id" IS NULL;--> statement-breakpoint
ALTER TABLE "media" ALTER COLUMN "public_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "media_public_id_unique_idx" ON "media" USING btree ("public_id") WHERE "media"."deleted_at" is null;