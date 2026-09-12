/**
 * Email Worker standalone entrypoint.
 *
 * Run locally with: npm run email:dev
 *
 * Polls the database for pending transactional email jobs and sends them
 * through the configured EmailProvider (SMTP when EMAIL_SMTP_HOST is set,
 * console otherwise). Also sweeps the email lifecycle automation on a slower
 * cadence. Idempotent and retryable; safe to run alongside the app.
 */
import "dotenv/config";
import { startEmailWorker } from "./email-worker";

startEmailWorker().catch((error) => {
  console.error("[EmailWorker] Fatal startup error:", error);
  process.exit(1);
});