/**
 * Transactional email templates.
 *
 * A typed registry renders subject + html + text for every transactional email
 * type. All HTML shares one inline-styled, mobile-friendly layout using the
 * app's cream / rose / gold palette. URLs always come from the canonical
 * `appUrl()` helper so emails work across local/dev/prod without drift.
 *
 * `renderEmail(type, data)` throws for unknown types so callers catch
 * typo'd template keys at runtime instead of silently sending blank mail.
 */

// ── Template registry types ────────────────────────────────────────────────────

export const EMAIL_TEMPLATE_KEYS = [
  "payment_success",
  "build_started",
  "vault_ready",
  "qr_ready",
  "qr_card",
  "reminder_upload",
  "download_reminder",
  "upload_expiry_warning",
  "download_expiry_warning",
  "upload_closed",
  "download_closed",
  "build_failure",
  "support_notification",
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

/** Loose context passed to renderers; every field is optional with a sane default. */
export interface EmailTemplateData {
  coupleName?: string;
  partnerOneName?: string;
  partnerTwoName?: string;
  customerName?: string;
  packageName?: string;
  vaultUrl?: string;
  publicUrl?: string;
  uploadDeadline?: string;
  downloadDeadline?: string;
  weddingDate?: string;
  qrNote?: string;
  uploadInfo?: string;
  supportEmail?: string;
  buildInfo?: string;
  buildJobId?: string;
  [key: string]: unknown;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ── Canonical URL / defaults ───────────────────────────────────────────────────

export function appUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export const DEFAULT_SUPPORT_EMAIL = "support@weddingmemoryvault.app";

const BRAND_NAME = "Wedding Memory Vault";

// ── Shared layout ──────────────────────────────────────────────────────────────

/** Inline-styled, mobile-friendly HTML shell (cream/rose/gold palette). */
function layout(subject: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF6F0;font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF6F0;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#FFFFFF;border:1px solid #EFE3D6;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:#FFFFFF;padding:28px 28px 12px 28px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#B76E79;">${escapeHtml(BRAND_NAME)}</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#FFFFFF;padding:8px 28px 20px 28px;">
              <div style="width:56px;height:3px;background-color:#D4AF37;margin:0 auto 20px auto;border-radius:2px;"></div>
              <h1 style="margin:0 0 14px 0;font-size:22px;line-height:1.3;color:#5B4636;font-weight:normal;text-align:center;">${escapeHtml(subject)}</h1>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:#FAF6F0;padding:20px 28px;text-align:center;color:#8A7561;font-size:12px;line-height:1.6;">
              <p style="margin:0 0 6px 0;">With love,<br/>The ${escapeHtml(BRAND_NAME)} team</p>
              <p style="margin:0;opacity:0.8;">${escapeHtml(appUrl())}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Plain-text body builder: centres on the couple and links as bare URLs. */
function textBody(lines: Array<string | undefined>): string {
  const out = lines.filter((l): l is string => !!l && l.trim().length > 0);
  return out.length > 0 ? out.join("\n\n") : " ";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Data defaults ──────────────────────────────────────────────────────────────

interface Ctx {
  coupleName: string;
  packageName: string;
  vaultUrl: string;
  uploadDeadline: string;
  downloadDeadline: string;
  supportEmail: string;
}

function defaults(data: EmailTemplateData): Ctx {
  const coupleName =
    data.coupleName ??
    ([data.partnerOneName, data.partnerTwoName].filter(Boolean).join(" & ") || "your wedding");
  return {
    coupleName,
    packageName: data.packageName ?? "your",
    vaultUrl: data.vaultUrl ?? data.publicUrl ?? `${appUrl()}/w`,
    uploadDeadline: data.uploadDeadline
      ? new Date(data.uploadDeadline).toISOString()
      : "the upload deadline",
    downloadDeadline: data.downloadDeadline
      ? new Date(data.downloadDeadline).toISOString()
      : "the download deadline",
    supportEmail: data.supportEmail ?? DEFAULT_SUPPORT_EMAIL,
  };
}

function bodyParagraph(html: string): string {
  return `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;color:#6B5A4A;">${html}</p>`;
}

function primaryButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px auto 22px auto;"><tr><td style="border-radius:8px;background-color:#B76E79;padding:12px 26px;"><a href="${escapeHtml(href)}" style="display:inline-block;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(label)}</a></td></tr></table>`;
}

/**
 * Displays a deadline as a human-readable date (UTC instant → JNB local).
 */
function formatDeadline(iso: string | undefined): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

// ── Individual renderers ───────────────────────────────────────────────────────

function paymentSuccess(data: EmailTemplateData): RenderedEmail {
  const c = defaults(data);
  const subject = `Payment confirmed for ${c.coupleName}`;
  const html = layout(
    subject,
    bodyParagraph(`Thank you! Your payment for the ${escapeHtml(c.packageName)} package has been received and confirmed.`) +
      bodyParagraph(`We're now preparing your private wedding memory vault. You'll receive another email the moment it's ready to share.`) +
      bodyParagraph(`If you have any questions, reach us at <a href="mailto:${escapeHtml(c.supportEmail)}" style="color:#B76E79;">${escapeHtml(c.supportEmail)}</a>.`),
  );
  const text = textBody([
    `Payment confirmed for ${c.coupleName}.`,
    `Thank you! Your payment for the ${c.packageName} package has been received and confirmed.`,
    `We're now preparing your private wedding memory vault. You'll receive another email the moment it's ready to share.`,
    `If you have any questions, reach us at ${c.supportEmail}.`,
  ]);
  return { subject, html, text };
}

function buildStarted(data: EmailTemplateData): RenderedEmail {
  const c = defaults(data);
  const subject = `We're building your wedding vault`;
  const html = layout(
    subject,
    bodyParagraph(`Hi ${escapeHtml(c.coupleName)},`) +
      bodyParagraph(`Great news — work on your ${escapeHtml(c.packageName)} wedding memory vault has started. Our build team is crafting your private gallery, QR code and guest experience right now.`) +
      bodyParagraph(`You'll receive a confirmation email with your vault link as soon as it's ready — usually within a few minutes.`),
  );
  const text = textBody([
    `We're building your wedding vault, ${c.coupleName}.`,
    `Great news — work on your ${c.packageName} wedding memory vault has started.`,
    `You'll receive a confirmation email with your vault link as soon as it's ready.`,
  ]);
  return { subject, html, text };
}

function vaultReady(data: EmailTemplateData): RenderedEmail {
  const c = defaults(data);
  const subject = `Your wedding vault is ready!`;
  const html = layout(
    subject,
    bodyParagraph(`Your ${escapeHtml(c.packageName)} wedding vault is ready, ${escapeHtml(c.coupleName)}.`) +
      primaryButton(c.vaultUrl, "Open your vault") +
      bodyParagraph(`Share the link with your guests — they can upload photos and memories directly to your private vault.`),
  );
  const text = textBody([
    `Your wedding vault is ready, ${c.coupleName}!`,
    `Open your vault: ${c.vaultUrl}`,
    `Share the link with your guests so they can upload photos and memories.`,
  ]);
  return { subject, html, text };
}

function qrReady(data: EmailTemplateData): RenderedEmail {
  const c = defaults(data);
  const subject = `Your QR code is ready`;
  const html = layout(
    subject,
    bodyParagraph(`Your custom QR code is ready, ${escapeHtml(c.coupleName)}.`) +
      bodyParagraph(`Print it out or share it digitally — guests scan it to open your ${escapeHtml(c.packageName)} vault and upload their memories.`) +
      (data.qrNote ? bodyParagraph(escapeHtml(data.qrNote)) : "") +
      primaryButton(c.vaultUrl, "View your vault"),
  );
  const text = textBody([
    `Your QR code is ready, ${c.coupleName}.`,
    data.qrNote,
    `Guests scan it to open your ${c.packageName} vault and upload their memories: ${c.vaultUrl}`,
  ]);
  return { subject, html, text };
}

function qrCard(data: EmailTemplateData): RenderedEmail {
  const c = defaults(data);
  const subject = `Your Platinum QR cards are ready`;
  const html = layout(
    subject,
    bodyParagraph(`Your custom Platinum QR design cards are ready, ${escapeHtml(c.coupleName)}.`) +
      bodyParagraph(`Hand them to guests on the big day — each card carries your personalised design and a scannable link straight to your vault.`) +
      primaryButton(c.vaultUrl, "Open your vault"),
  );
  const text = textBody([
    `Your Platinum QR design cards are ready, ${c.coupleName}.`,
    `Each card carries your personalised design and a scannable link straight to your vault: ${c.vaultUrl}`,
  ]);
  return { subject, html, text };
}

function reminderUpload(data: EmailTemplateData): RenderedEmail {
  const c = defaults(data);
  const deadline = formatDeadline(data.uploadDeadline);
  const subject = `Guest uploads are open for ${c.coupleName}`;
  const html = layout(
    subject,
    bodyParagraph(`The upload window for your wedding memories is open, ${escapeHtml(c.coupleName)}!`) +
      bodyParagraph(`Guests can share photos and videos until <strong>${escapeHtml(deadline)}</strong>.`) +
      (data.uploadInfo ? bodyParagraph(escapeHtml(data.uploadInfo)) : "") +
      primaryButton(c.vaultUrl, "Visit your vault") +
      bodyParagraph(`A gentle reminder: after the upload deadline, guests can no longer add memories, so share your link and QR code early.`),
  );
  const text = textBody([
    `Guest uploads are open for ${c.coupleName}!`,
    `Guests can share photos and videos until ${deadline}.`,
    data.uploadInfo,
    `Visit your vault: ${c.vaultUrl}`,
    `After the upload deadline, guests can no longer add memories.`,
  ]);
  return { subject, html, text };
}

function downloadReminder(data: EmailTemplateData): RenderedEmail {
  const c = defaults(data);
  const deadline = formatDeadline(data.downloadDeadline);
  const subject = `Last chance to download your memories`;
  const html = layout(
    subject,
    bodyParagraph(`Your wedding vault's download window closes on <strong>${escapeHtml(deadline)}</strong>.`) +
      bodyParagraph(`Downloads of ${escapeHtml(c.coupleName)}'s photos and videos are still open, but don't wait — once the window closes, your memories can no longer be downloaded.`) +
      primaryButton(c.vaultUrl, "Download your memories"),
  );
  const text = textBody([
    `Last chance to download your memories, ${c.coupleName}.`,
    `Your wedding vault's download window closes on ${deadline}.`,
    `Downloads are still open: ${c.vaultUrl}`,
    `Once the window closes, memories can no longer be downloaded.`,
  ]);
  return { subject, html, text };
}

function uploadExpiryWarning(data: EmailTemplateData): RenderedEmail {
  const c = defaults(data);
  const deadline = formatDeadline(data.downloadDeadline);
  const subject = `Your wedding vault closes soon`;
  const html = layout(
    subject,
    bodyParagraph(`Heads up, ${escapeHtml(c.coupleName)} — your wedding memory vault will close on <strong>${escapeHtml(deadline)}</strong>.`) +
      bodyParagraph(`After that date, the vault and all of its memories will no longer be accessible. Please download anything you'd like to keep before then.`) +
      primaryButton(c.vaultUrl, "Save your memories"),
  );
  const text = textBody([
    `Your wedding vault closes soon, ${c.coupleName}.`,
    `The vault will close on ${deadline}.`,
    `Download anything you'd like to keep before then: ${c.vaultUrl}`,
  ]);
  return { subject, html, text };
}

function downloadExpiryWarning(data: EmailTemplateData): RenderedEmail {
  const c = defaults(data);
  const uploadDeadline = formatDeadline(data.uploadDeadline);
  const downloadDeadline = formatDeadline(data.downloadDeadline);
  const subject = `Guest uploads close soon`;
  const html = layout(
    subject,
    bodyParagraph(`A quick reminder, ${escapeHtml(c.coupleName)}: guest uploads close on <strong>${escapeHtml(uploadDeadline)}</strong>.`) +
      bodyParagraph(`After uploads close, you'll still be able to view and download memories until <strong>${escapeHtml(downloadDeadline)}</strong>.`) +
      bodyParagraph(`Share your QR code and vault link with any guests who haven't uploaded yet.`) +
      primaryButton(c.vaultUrl, "Open your vault"),
  );
  const text = textBody([
    `Guest uploads close soon, ${c.coupleName}.`,
    `Guest uploads close on ${uploadDeadline}.`,
    `You'll still be able to view and download memories until ${downloadDeadline}: ${c.vaultUrl}`,
  ]);
  return { subject, html, text };
}

function uploadClosed(data: EmailTemplateData): RenderedEmail {
  const c = defaults(data);
  const downloadDeadline = formatDeadline(data.downloadDeadline);
  const subject = `Guest uploads are now closed`;
  const html = layout(
    subject,
    bodyParagraph(`Guest uploads for ${escapeHtml(c.coupleName)}'s vault are now closed.`) +
      bodyParagraph(`You can continue viewing and downloading all memories until <strong>${escapeHtml(downloadDeadline)}</strong>.`) +
      primaryButton(c.vaultUrl, "View your vault"),
  );
  const text = textBody([
    `Guest uploads are now closed for ${c.coupleName}.`,
    `You can continue viewing and downloading memories until ${downloadDeadline}: ${c.vaultUrl}`,
  ]);
  return { subject, html, text };
}

function downloadClosed(data: EmailTemplateData): RenderedEmail {
  const c = defaults(data);
  const subject = `Your wedding vault has closed`;
  const html = layout(
    subject,
    bodyParagraph(`Your wedding memory vault for ${escapeHtml(c.coupleName)} has now closed.`) +
      bodyParagraph(`Thank you for trusting us with your memories. If you need a copy of anything from the event, please contact us at <a href="mailto:${escapeHtml(c.supportEmail)}" style="color:#B76E79;">${escapeHtml(c.supportEmail)}</a>.`),
  );
  const text = textBody([
    `Your wedding vault for ${c.coupleName} has closed.`,
    `If you need a copy of anything from the event, contact us at ${c.supportEmail}.`,
  ]);
  return { subject, html, text };
}

function buildFailure(data: EmailTemplateData): RenderedEmail {
  const c = defaults(data);
  const subject = `We hit a snag building your vault`;
  const html = layout(
    subject,
    bodyParagraph(`We're sorry, ${escapeHtml(c.coupleName)} — something went wrong while building your ${escapeHtml(c.packageName)} wedding vault.`) +
      bodyParagraph(`Our team has been notified and is on it. If you'd like an update, just reply to this email or reach us at <a href="mailto:${escapeHtml(c.supportEmail)}" style="color:#B76E79;">${escapeHtml(c.supportEmail)}</a>.`),
  );
  const text = textBody([
    `We hit a snag building your vault, ${c.coupleName}.`,
    `Something went wrong while building your ${c.packageName} wedding vault.`,
    `Our team has been notified. Reach us at ${c.supportEmail} for an update.`,
    data.buildInfo ? `Reference: ${data.buildInfo}` : "",
  ]);
  return { subject, html, text };
}

function supportNotification(data: EmailTemplateData): RenderedEmail {
  const c = defaults(data);
  const subject = data.buildInfo
    ? `Support notification: ${c.coupleName}`
    : "Support notification";
  const html = layout(
    subject,
    bodyParagraph(`A support notification was generated for <strong>${escapeHtml(c.coupleName)}</strong>.`) +
      bodyParagraph(data.buildInfo ? `Details: ${escapeHtml(String(data.buildInfo))}` : "") +
      bodyParagraph(data.buildJobId ? `Build job: <code>${escapeHtml(data.buildJobId)}</code>` : ""),
  );
  const text = textBody([
    `Support notification for ${c.coupleName}.`,
    data.buildInfo ? `Details: ${String(data.buildInfo)}` : "",
    data.buildJobId ? `Build job: ${data.buildJobId}` : "",
  ]);
  return { subject, html, text };
}

// ── Registry + renderer ────────────────────────────────────────────────────────

const RENDERERS: Record<EmailTemplateKey, (data: EmailTemplateData) => RenderedEmail> = {
  payment_success: paymentSuccess,
  build_started: buildStarted,
  vault_ready: vaultReady,
  qr_ready: qrReady,
  qr_card: qrCard,
  reminder_upload: reminderUpload,
  download_reminder: downloadReminder,
  upload_expiry_warning: uploadExpiryWarning,
  download_expiry_warning: downloadExpiryWarning,
  upload_closed: uploadClosed,
  download_closed: downloadClosed,
  build_failure: buildFailure,
  support_notification: supportNotification,
};

/**
 * Renders an email for a template key/type. Throws for unknown types so a
 * typo'd key never silently produces a blank email.
 */
export function renderEmail(
  type: string,
  data: EmailTemplateData = {},
): RenderedEmail {
  const renderer = RENDERERS[type as EmailTemplateKey];
  if (!renderer) {
    throw new Error(`Unknown email template type: ${type}`);
  }
  return renderer(data);
}