DROP INDEX IF EXISTS "guest_sessions_vault_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guest_sessions_vault_status_idx" ON "guest_sessions" USING btree ("vault_id","status");