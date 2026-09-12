/**
 * Media Worker standalone entrypoint.
 *
 * Run locally with: npm run media:dev
 *
 * Polls for pending media processing jobs (content hash / thumbnails / optimize
 * variants) and executes them. Idempotent and retryable; safe to run alongside
 * the app and other workers.
 */
import "dotenv/config";
import { startMediaWorker } from "./media-worker";

startMediaWorker().catch((error) => {
  console.error("[MediaWorker] Fatal startup error:", error);
  process.exit(1);
});