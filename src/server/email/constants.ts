/**
 * Lifecycle automation lead-time constants (in days).
 *
 * Business dates are calculated in `Africa/Johannesburg` (see ADR-001) while
 * the deadlines themselves are exclusive-end UTC timestamps. The lead windows
 * defined here are deliberately conservative:
 *
 * - REMINDER_DOWNLOAD_LEAD_DAYS: download reminders start 7 days before the
 *   download deadline (matches the Gold/Platinum guest experience where the
 *   download window is meaningful).
 * - UPLOAD_EXPIRY_WARNING_LEAD_DAYS: the "vault closes soon" warning fires
 *   during the final 7 days before the download deadline.
 * - DOWNLOAD_EXPIRY_WARNING_LEAD_DAYS: the "uploads close soon" warning fires
 *   during the final 3 days before the upload deadline (short enough to be
 *   actionable, long enough to be noticed).
 */
export const EMAIL_LIFECYCLE_LEAD_DAYS = {
  REMINDER_DOWNLOAD_LEAD_DAYS: 7,
  UPLOAD_EXPIRY_WARNING_LEAD_DAYS: 7,
  DOWNLOAD_EXPIRY_WARNING_LEAD_DAYS: 3,
} as const;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;