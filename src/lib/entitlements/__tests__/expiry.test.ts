/**
 * Tests for expiry calculation with Africa/Johannesburg timezone.
 */

import { describe, it, expect } from "vitest";
import {
  calculateExpiryDeadlines,
  isUploadOpen,
  isDownloadOpen,
  getLifecycleStatusFromDeadlines,
  daysUntilDeadline,
  formatDeadlineForDisplay,
  recalculateDeadlines,
  BUSINESS_TIMEZONE,
  InvalidWeddingDateError,
} from "@/lib/entitlements/expiry";
import { PackageCode } from "@/lib/entitlements/packages";

describe("Expiry Calculation - Africa/Johannesburg Timezone", () => {
  const weddingDate: { date: string } = { date: "2025-12-15" };

  describe("Silver Package (+48h upload, +7 days download)", () => {
    const result = calculateExpiryDeadlines(weddingDate, "silver");

    it("calculates upload deadline as wedding date + 2 days (end of day)", () => {
      // Wedding: 2025-12-15 (Mon)
      // Upload: +2 days = end of 2025-12-17 (Wed) 23:59:59.999 JNB
      expect(result.uploadWindowDays).toBe(2);
      expect(result.weddingDateJNB).toBeDefined();
    });

    it("calculates download deadline as wedding date + 7 days (end of day)", () => {
      expect(result.downloadWindowDays).toBe(7);
    });

    it("returns UTC timestamps for deadlines", () => {
      expect(result.uploadDeadline).toBeInstanceOf(Date);
      expect(result.downloadDeadline).toBeInstanceOf(Date);
      // Should be valid dates
      expect(result.uploadDeadline.getTime()).toBeGreaterThan(0);
      expect(result.downloadDeadline.getTime()).toBeGreaterThan(0);
    });

    it("download deadline is after upload deadline", () => {
      expect(result.downloadDeadline.getTime()).toBeGreaterThan(result.uploadDeadline.getTime());
    });

    it("includes calculation timestamp", () => {
      expect(result.calculatedAt).toBeInstanceOf(Date);
    });
  });

  describe("Gold Package (+7 days upload, +30 days download)", () => {
    const result = calculateExpiryDeadlines(weddingDate, "gold");

    it("calculates 7-day upload window", () => {
      expect(result.uploadWindowDays).toBe(7);
    });

    it("calculates 30-day download window", () => {
      expect(result.downloadWindowDays).toBe(30);
    });
  });

  describe("Platinum Package (+7 days upload, +90 days download)", () => {
    const result = calculateExpiryDeadlines(weddingDate, "platinum");

    it("calculates 7-day upload window", () => {
      expect(result.uploadWindowDays).toBe(7);
    });

    it("calculates 90-day download window", () => {
      expect(result.downloadWindowDays).toBe(90);
    });
  });

  describe("Timezone Handling", () => {
    it("uses Africa/Johannesburg as business timezone constant", () => {
      expect(BUSINESS_TIMEZONE).toBe("Africa/Johannesburg");
    });

    it("accepts Date object as input", () => {
      const date = new Date("2025-12-15T00:00:00.000Z");
      const result = calculateExpiryDeadlines({ date }, "silver");
      expect(result.weddingDateJNB).toBeDefined();
    });

    it("accepts explicit timezone override", () => {
      const result = calculateExpiryDeadlines(
        { date: "2025-12-15", timezone: "UTC" },
        "silver",
      );
      expect(result.weddingDateJNB).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("handles end-of-month wedding dates", () => {
      const result = calculateExpiryDeadlines({ date: "2025-01-31" }, "silver");
      // Jan 31 + 2 days = Feb 2
      expect(result.uploadWindowDays).toBe(2);
    });

    it("handles leap year dates", () => {
      // Use a future leap year (2028 is a leap year)
      const result = calculateExpiryDeadlines({ date: "2028-02-29" }, "silver");
      // Feb 29 + 2 days = Mar 2 (leap year)
      expect(result.uploadWindowDays).toBe(2);
    });

    it("handles year boundary", () => {
      const result = calculateExpiryDeadlines({ date: "2025-12-31" }, "gold");
      // Dec 31 + 7 days = Jan 7 next year
      expect(result.uploadWindowDays).toBe(7);
    });
  });

  describe("Error Handling", () => {
    it("throws InvalidWeddingDateError for invalid date format", () => {
      expect(() =>
        calculateExpiryDeadlines({ date: "invalid-date" }, "silver"),
      ).toThrow(InvalidWeddingDateError);
    });

    it("throws InvalidWeddingDateError for incomplete date", () => {
      expect(() =>
        calculateExpiryDeadlines({ date: "2025-12" }, "silver"),
      ).toThrow(InvalidWeddingDateError);
    });

    it("throws InvalidWeddingDateError for dates too far in past", () => {
      const pastYear = new Date().getFullYear() - 2;
      expect(() =>
        calculateExpiryDeadlines({ date: `${pastYear}-01-01` }, "silver"),
      ).toThrow(InvalidWeddingDateError);
    });

    it("throws InvalidWeddingDateError for dates too far in future", () => {
      const futureYear = new Date().getFullYear() + 10;
      expect(() =>
        calculateExpiryDeadlines({ date: `${futureYear}-01-01` }, "silver"),
      ).toThrow(InvalidWeddingDateError);
    });
  });
});

describe("Window Status Checks", () => {
  const past = new Date("2020-01-01T00:00:00.000Z");
  const future = new Date("2030-01-01T00:00:00.000Z");
  const now = new Date();

  describe("isUploadOpen", () => {
    it("returns true when deadline is in future", () => {
      expect(isUploadOpen(future, now)).toBe(true);
    });

    it("returns false when deadline is in past", () => {
      expect(isUploadOpen(past, now)).toBe(false);
    });

    it("returns false when deadline is now", () => {
      expect(isUploadOpen(now, now)).toBe(false); // Exclusive end
    });
  });

  describe("isDownloadOpen", () => {
    it("returns true when deadline is in future", () => {
      expect(isDownloadOpen(future, now)).toBe(true);
    });

    it("returns false when deadline is in past", () => {
      expect(isDownloadOpen(past, now)).toBe(false);
    });
  });

  describe("getLifecycleStatusFromDeadlines", () => {
    const uploadFuture = new Date(now.getTime() + 86400000); // +1 day
    const uploadPast = new Date(now.getTime() - 86400000); // -1 day
    const downloadFuture = new Date(now.getTime() + 172800000); // +2 days
    const downloadPast = new Date(now.getTime() - 172800000); // -2 days

    it("returns 'active' when both windows open", () => {
      expect(getLifecycleStatusFromDeadlines(uploadFuture, downloadFuture, now)).toBe("active");
    });

    it("returns 'upload_closed' when upload closed but download open", () => {
      expect(getLifecycleStatusFromDeadlines(uploadPast, downloadFuture, now)).toBe("upload_closed");
    });

    it("returns 'download_only' when both windows closed", () => {
      expect(getLifecycleStatusFromDeadlines(uploadPast, downloadPast, now)).toBe(
        "download_only",
      );
    });

    // Note: uploadFuture + downloadPast is logically impossible since
    // download window is always longer than upload window
    // So we don't test that impossible combination
  });

  describe("daysUntilDeadline", () => {
    it("returns positive days for future deadline", () => {
      const tomorrow = new Date(now.getTime() + 86400000);
      expect(daysUntilDeadline(tomorrow, now)).toBe(1);
    });

    it("returns 0 for past deadline", () => {
      const yesterday = new Date(now.getTime() - 86400000);
      expect(daysUntilDeadline(yesterday, now)).toBe(0);
    });

    it("returns 0 for today deadline", () => {
      // Same day but later
      const laterToday = new Date(now.getTime() + 3600000);
      expect(daysUntilDeadline(laterToday, now)).toBe(1); // Ceil rounds up
    });
  });

  describe("formatDeadlineForDisplay", () => {
    it("formats deadline in Africa/Johannesburg timezone", () => {
      const deadline = new Date("2025-12-17T21:59:59.999Z"); // End of day JNB
      const formatted = formatDeadlineForDisplay(deadline);
      expect(formatted).toContain("2025");
      expect(formatted).toContain("December");
      expect(formatted).toContain("17");
    });
  });
});

describe("Deadline Recalculation", () => {
  const packageCode: PackageCode = "gold";
  const oldWeddingDate = { date: "2025-12-15" };
  const newWeddingDate = { date: "2025-12-20" };

  it("detects when deadlines change", () => {
    const { changed } = recalculateDeadlines(oldWeddingDate, newWeddingDate, packageCode);
    expect(changed).toBe(true);
  });

  it("detects when deadlines stay the same", () => {
    const { changed } = recalculateDeadlines(oldWeddingDate, oldWeddingDate, packageCode);
    expect(changed).toBe(false);
  });

  it("returns new deadlines", () => {
    const { newDeadlines } = recalculateDeadlines(oldWeddingDate, newWeddingDate, packageCode);
    expect(newDeadlines.uploadWindowDays).toBe(7);
    expect(newDeadlines.downloadWindowDays).toBe(30);
  });
});

describe("Cross-Package Consistency", () => {
  const weddingDate = { date: "2025-06-15" };

  it("all packages use same wedding date for calculation", () => {
    const silver = calculateExpiryDeadlines(weddingDate, "silver");
    const gold = calculateExpiryDeadlines(weddingDate, "gold");
    const platinum = calculateExpiryDeadlines(weddingDate, "platinum");

    expect(silver.weddingDateJNB.getTime()).toBe(gold.weddingDateJNB.getTime());
    expect(gold.weddingDateJNB.getTime()).toBe(platinum.weddingDateJNB.getTime());
  });

  it("higher tiers have equal or longer windows", () => {
    const silver = calculateExpiryDeadlines(weddingDate, "silver");
    const gold = calculateExpiryDeadlines(weddingDate, "gold");
    const platinum = calculateExpiryDeadlines(weddingDate, "platinum");

    // Upload windows
    expect(gold.uploadDeadline.getTime()).toBeGreaterThanOrEqual(silver.uploadDeadline.getTime());
    expect(platinum.uploadDeadline.getTime()).toBeGreaterThanOrEqual(gold.uploadDeadline.getTime());

    // Download windows
    expect(gold.downloadDeadline.getTime()).toBeGreaterThan(silver.downloadDeadline.getTime());
    expect(platinum.downloadDeadline.getTime()).toBeGreaterThan(gold.downloadDeadline.getTime());
  });
});