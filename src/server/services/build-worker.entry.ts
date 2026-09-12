/**
 * Build Worker standalone entrypoint.
 *
 * Run locally with: npm run worker:dev
 *
 * Polls the database for pending build jobs and executes the build pipeline
 * (validate → verify payment → vault creation → template → QR → publish →
 * email queue). Idempotent and retryable; safe to run alongside the app.
 */
import "dotenv/config";
import { startBuildWorker } from "./build-worker";

startBuildWorker().catch((error) => {
  console.error("[BuildWorker] Fatal startup error:", error);
  process.exit(1);
});