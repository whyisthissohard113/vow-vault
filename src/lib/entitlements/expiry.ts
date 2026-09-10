/**
 * Expiry calculation service.
 *
 * Calculates upload/download deadlines from the scheduled wedding date
 * using Africa/Johannesburg timezone. All persisted timestamps are UTC.
 */

import { type PackageCode, getPackageExpiryWindows } from "./packages";

/**
 * Business timezone for wedding date calculations.
 * Per MASTER_SPEC: "Business timezone Africa/Johannesburg; persist UTC timestamps."
 */
export const BUSINESS_TIMEZONE = "Africa/Johannesburg";

/**
 * Represents a wedding date with timezone context.
 */
export interface WeddingDateInput {
  /** ISO date string (YYYY-MM-DD) or Date object in local/Africa/Johannesburg time */
  date: string | Date;
  /** Optional explicit timezone; defaults to BUSINESS_TIMEZONE */
  timezone?: string;
}

/**
 * Calculated expiry deadlines.
 * All timestamps are exclusive-end UTC (per schema).
 */
export interface ExpiryDeadlines {
  /** Upload deadline (exclusive end) - UTC timestamp */
  uploadDeadline: Date;
  /** Download deadline (exclusive end) - UTC timestamp */
  downloadDeadline: Date;
  /** The wedding date used for calculation (Africa/Johannesburg date) */
  weddingDateJNB: Date;
  /** Upload window days from package */
  uploadWindowDays: number;
  /** Download window days from package */
  downloadWindowDays: number;
  /** Timestamp when calculation was performed */
  calculatedAt: Date;
}

/**
 * Error thrown when wedding date is invalid.
 */
export class InvalidWeddingDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWeddingDateError";
  }
}

/**
 * Parse a wedding date string/Date into a Date in Africa/Johannesburg timezone.
 * The input date is treated as local to the business timezone (no time component).
 */
function parseWeddingDate(input: WeddingDateInput): Date {
  const tz = input.timezone ?? BUSINESS_TIMEZONE;
  let date: Date;

  if (typeof input.date === "string") {
    // Parse as YYYY-MM-DD in the business timezone
    const [year, month, day] = input.date.split("-").map(Number);
    if (!year || !month || !day) {
      throw new InvalidWeddingDateError(`Invalid date format: ${input.date}. Expected YYYY-MM-DD`);
    }
    // Create date at midnight in JNB timezone
    date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  } else {
    date = input.date;
  }

  // Validate the date is reasonable
  const now = new Date();
  const minDate = new Date(now.getFullYear() - 1, 0, 1); // At least 1 year ago
  const maxDate = new Date(now.getFullYear() + 5, 11, 31); // At most 5 years ahead

  if (date < minDate || date > maxDate) {
    throw new InvalidWeddingDateError(`Wedding date out of reasonable range: ${date.toISOString()}`);
  }

  return date;
}

/**
 * Add days to a date in Africa/Johannesburg timezone and return UTC timestamp.
 *
 * Key insight: The wedding date is a "business date" in JNB timezone.
 * We add days in JNB time, then convert the end-of-day to UTC.
 *
 * Example: Wedding 2025-12-15 (JNB), upload_days = 2
 * - JNB end of day 2025-12-17 23:59:59.999
 * - Convert to UTC for storage
 */
function addBusinessDays(baseDate: Date, days: number): Date {
  // Create a date at end of day in JNB timezone
  // We use Intl.DateTimeFormat to handle DST correctly
  const jnbDate = new Date(baseDate.getTime());

  // Add the days
  jnbDate.setUTCDate(jnbDate.getUTCDate() + days);

  // Set to end of day (23:59:59.999) in JNB
  // We need to be careful about DST. Use the timezone to get the correct offset.
  const endOfDayJNB = new Date(
    jnbDate.toLocaleString("en-CA", {
      timeZone: BUSINESS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).replace(",", ""),
  );

  // The above gives us local JNB time. Now we need to interpret it as UTC.
  // Actually, let's use a more robust approach: calculate the UTC equivalent
  // of end-of-day in JNB.

  // Get the offset at that date in JNB
  const offsetMs = getTimezoneOffset(endOfDayJNB, BUSINESS_TIMEZONE);

  // End of day in JNB = 23:59:59.999 local
  // UTC = local - offset
  const endOfDayUTC = new Date(endOfDayJNB.getTime() - offsetMs);
  endOfDayUTC.setUTCHours(23, 59, 59, 999);

  return endOfDayUTC;
}

/**
 * Get timezone offset in milliseconds for a given date and timezone.
 * Uses Intl API for accurate DST handling.
 */
function getTimezoneOffset(date: Date, timeZone: string): number {
  // Format the date in the target timezone to get the offset
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) {
    values[part.type] = part.value;
  }

  // Reconstruct the local date components
  const localDate = new Date(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  // The difference between UTC and local is the offset
  return date.getTime() - localDate.getTime();
}

/**
 * Calculate expiry deadlines from a wedding date and package.
 *
 * @param weddingDate - The scheduled wedding date (YYYY-MM-DD or Date)
 * @param packageCode - The package code (silver/gold/platinum)
 * @returns Calculated expiry deadlines in UTC
 */
export function calculateExpiryDeadlines(
  weddingDate: WeddingDateInput,
  packageCode: PackageCode,
): ExpiryDeadlines {
  const calculatedAt = new Date();
  const { uploadDays, downloadDays } = getPackageExpiryWindows(packageCode);

  // Parse wedding date in business timezone
  const weddingDateJNB = parseWeddingDate(weddingDate);

  // Calculate deadlines: wedding date + N days (exclusive end)
  // The wedding day itself is day 0. Day 1 starts at midnight after wedding.
  // Silver upload = +48 hours = end of day 2
  // Gold upload = +7 days = end of day 7
  // Download similar
  const uploadDeadline = addBusinessDays(weddingDateJNB, uploadDays);
  const downloadDeadline = addBusinessDays(weddingDateJNB, downloadDays);

  return {
    uploadDeadline,
    downloadDeadline,
    weddingDateJNB,
    uploadWindowDays: uploadDays,
    downloadWindowDays: downloadDays,
    calculatedAt,
  };
}

/**
 * Check if uploads are still allowed (before upload deadline).
 */
export function isUploadOpen(uploadDeadline: Date, now: Date = new Date()): boolean {
  return now < uploadDeadline;
}

/**
 * Check if downloads are still allowed (before download deadline).
 */
export function isDownloadOpen(downloadDeadline: Date, now: Date = new Date()): boolean {
  return now < downloadDeadline;
}

/**
 * Get the current lifecycle status based on deadlines.
 */
export function getLifecycleStatusFromDeadlines(
  uploadDeadline: Date,
  downloadDeadline: Date,
  now: Date = new Date(),
): "active" | "upload_closed" | "download_only" | "expired" {
  if (now < uploadDeadline) return "active";
  if (now < downloadDeadline) return "upload_closed";
  return "expired";
}

/**
 * Calculate how many days until a deadline.
 * Returns 0 if deadline has passed.
 */
export function daysUntilDeadline(deadline: Date, now: Date = new Date()): number {
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Format a UTC deadline as Africa/Johannesburg date string for display.
 */
export function formatDeadlineForDisplay(deadline: Date): string {
  return deadline.toLocaleDateString("en-ZA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Recalculate deadlines when wedding date changes.
 * Returns new deadlines and whether they changed.
 */
export function recalculateDeadlines(
  currentWeddingDate: WeddingDateInput,
  newWeddingDate: WeddingDateInput,
  packageCode: PackageCode,
): { newDeadlines: ExpiryDeadlines; changed: boolean } {
  const current = calculateExpiryDeadlines(currentWeddingDate, packageCode);
  const updated = calculateExpiryDeadlines(newWeddingDate, packageCode);

  const changed =
    current.uploadDeadline.getTime() !== updated.uploadDeadline.getTime() ||
    current.downloadDeadline.getTime() !== updated.downloadDeadline.getTime();

  return { newDeadlines: updated, changed };
}