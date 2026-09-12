/**
 * Unit tests for the transactional email template registry.
 *
 * Pure — no database. Verifies that every registered template key renders
 * non-empty subject/html/text, embeds the canonical app URL, and that unknown
 * keys throw instead of silently producing blank mail.
 */

import { describe, it, expect } from "vitest";

import {
  EMAIL_TEMPLATE_KEYS,
  renderEmail,
  appUrl,
  DEFAULT_SUPPORT_EMAIL,
  type EmailTemplateData,
} from "@/server/email/templates";

const SAMPLE_DATA: EmailTemplateData = {
  coupleName: "Alice & Bob",
  partnerOneName: "Alice",
  partnerTwoName: "Bob",
  customerName: "Alice Smith",
  packageName: "Gold",
  vaultUrl: `${appUrl()}/w/alice-bob-20260601-f00d`,
  publicUrl: "/w/alice-bob-20260601-f00d",
  uploadDeadline: "2026-06-28T10:00:00.000Z",
  downloadDeadline: "2026-08-02T10:00:00.000Z",
  weddingDate: "2026-06-01",
  qrNote: "Scan to upload your memories",
  uploadInfo: "Guests can add photos until the upload deadline.",
  supportEmail: DEFAULT_SUPPORT_EMAIL,
  buildInfo: "Build job 123e4567-e89b-12d3-a456-426614174000 failed.",
  buildJobId: "123e4567-e89b-12d3-a456-426614174000",
};

describe("email templates", () => {
  it("exposes exactly the 13 expected template keys", () => {
    expect(EMAIL_TEMPLATE_KEYS).toHaveLength(13);
    expect(EMAIL_TEMPLATE_KEYS).toContain("payment_success");
    expect(EMAIL_TEMPLATE_KEYS).toContain("build_started");
    expect(EMAIL_TEMPLATE_KEYS).toContain("vault_ready");
    expect(EMAIL_TEMPLATE_KEYS).toContain("qr_ready");
    expect(EMAIL_TEMPLATE_KEYS).toContain("qr_card");
    expect(EMAIL_TEMPLATE_KEYS).toContain("reminder_upload");
    expect(EMAIL_TEMPLATE_KEYS).toContain("download_reminder");
    expect(EMAIL_TEMPLATE_KEYS).toContain("upload_expiry_warning");
    expect(EMAIL_TEMPLATE_KEYS).toContain("download_expiry_warning");
    expect(EMAIL_TEMPLATE_KEYS).toContain("upload_closed");
    expect(EMAIL_TEMPLATE_KEYS).toContain("download_closed");
    expect(EMAIL_TEMPLATE_KEYS).toContain("build_failure");
    expect(EMAIL_TEMPLATE_KEYS).toContain("support_notification");
  });

  it.each(EMAIL_TEMPLATE_KEYS)("renders %s with subject, html and text", (key) => {
    const rendered = renderEmail(key, SAMPLE_DATA);
    expect(rendered.subject.length).toBeGreaterThan(0);
    expect(rendered.text.length).toBeGreaterThan(0);
    expect(rendered.html.length).toBeGreaterThan(0);
    expect(rendered.html).toContain("<!DOCTYPE html>");
    expect(rendered.html).toContain("Wedding Memory Vault");
    // HTML body is escaped so template values can never break out of the layout.
    expect(rendered.html).not.toContain("<script");
  });

  it.each(EMAIL_TEMPLATE_KEYS)("embeds the canonical app URL in %s", (key) => {
    const rendered = renderEmail(key, SAMPLE_DATA);
    expect(rendered.html).toContain(appUrl());
  });

  it("renders with defaults when data is minimal", () => {
    const rendered = renderEmail("vault_ready", { coupleName: "Mia & Noah" });
    expect(rendered.subject).toBe("Your wedding vault is ready!");
    // & is HTML-escaped in the body (values are escaped, never injected raw).
    expect(rendered.html).toContain("Mia &amp; Noah");
    expect(rendered.html).toContain("vault");
  });

  it("renders without data (all defaults)", () => {
    const rendered = renderEmail("download_closed");
    expect(rendered.subject.length).toBeGreaterThan(0);
  });

  it("throws for unknown template keys", () => {
    expect(() => renderEmail("expiry_warning", SAMPLE_DATA)).toThrow(/Unknown email template type/);
    expect(() => renderEmail("nope", SAMPLE_DATA)).toThrow(/Unknown email template type/);
  });

  it("uses the support email from data or the DEFAULT_SUPPORT_EMAIL fallback", () => {
    const withSupport = renderEmail("payment_success", { ...SAMPLE_DATA, supportEmail: "billing@example.com" });
    expect(withSupport.html).toContain("billing@example.com");

    const withoutSupport = renderEmail("payment_success", { coupleName: "X & Y" });
    expect(withoutSupport.html).toContain(DEFAULT_SUPPORT_EMAIL);
  });

  it("escapes HTML in user-provided values", () => {
    const rendered = renderEmail("vault_ready", {
      ...SAMPLE_DATA,
      coupleName: `Alice <img src=x onerror=alert(1)> & Bob`,
    });
    expect(rendered.html).not.toContain("<img");
    expect(rendered.html).toContain("&lt;img");
  });
});