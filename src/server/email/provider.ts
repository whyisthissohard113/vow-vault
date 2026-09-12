/**
 * Email provider abstraction.
 *
 * Keep the transactional email layer provider-neutral (mirrors the payment and
 * storage client patterns). `ConsoleEmailProvider` is the dev/test default;
 * `SmtpEmailProvider` wraps nodemailer and is selected automatically when
 * `EMAIL_SMTP_HOST` is configured. Callers may inject a provider for tests/DI.
 *
 * Never log credentials or secrets (email addresses of recipients are logged
 * by the console provider only in dev).
 */

import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";

// ── Contracts ──────────────────────────────────────────────────────────────────

export interface EmailMessage {
  toEmail: string;
  toName?: string;
  fromEmail?: string;
  fromName?: string;
  subject: string;
  html?: string;
  text?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ messageId: string }>;
}

export const DEFAULT_FROM_EMAIL = "noreply@weddingmemoryvault.app";

// ── Console provider (dev default) ─────────────────────────────────────────────

/**
 * Logs the message and returns a synthetic message id. Never sends anything.
 */
export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<{ messageId: string }> {
    const messageId = `console-${randomUUID()}`;
    // Dev-only output. No credentials or secrets are ever logged; the text
    // body is included to make local development useful.
    console.log(
      `[Email][Console] messageId=${messageId} to=${message.toName ? `${message.toName} <${message.toEmail}>` : message.toEmail} ` +
        `from=${message.fromName ? `${message.fromName} <${message.fromEmail ?? DEFAULT_FROM_EMAIL}>` : (message.fromEmail ?? DEFAULT_FROM_EMAIL)} ` +
        `subject=${JSON.stringify(message.subject)}`,
    );
    if (message.text) console.log(`[Email][Console] text=${JSON.stringify(message.text)}`);
    return { messageId };
  }
}

// ── SMTP provider (nodemailer) ─────────────────────────────────────────────────

export interface SmtpEmailProviderConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  fromEmail: string;
  fromName?: string;
}

/**
 * Sends via an SMTP relay using nodemailer. Credentials come from environment
 * variables (EMAIL_SMTP_USER / EMAIL_SMTP_PASS); they are never logged.
 */
export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: SmtpEmailProviderConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      // Port 465 implies implicit TLS; 587 uses STARTTLS.
      secure: config.port === 465,
      auth:
        config.user && config.pass
          ? { user: config.user, pass: config.pass }
          : undefined,
    });
  }

  async send(message: EmailMessage): Promise<{ messageId: string }> {
    const fromName = message.fromName ?? this.config.fromName;
    const fromEmail = message.fromEmail ?? this.config.fromEmail;
    const info = await this.transporter.sendMail({
      from: fromName ? `"${sanitizeHeader(fromName)}" <${fromEmail}>` : fromEmail,
      to: message.toName
        ? `"${sanitizeHeader(message.toName)}" <${message.toEmail}>`
        : message.toEmail,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return { messageId: info.messageId || `smtp-${randomUUID()}` };
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Returns the configured provider:
 * - an explicitly injected provider (tests/DI) wins,
 * - otherwise SMTP when EMAIL_SMTP_HOST is set,
 * - otherwise the console provider (local development / tests).
 */
export function createEmailProvider(provider?: EmailProvider): EmailProvider {
  if (provider) return provider;

  const host = process.env.EMAIL_SMTP_HOST;
  if (host) {
    return new SmtpEmailProvider({
      host,
      port: Number(process.env.EMAIL_SMTP_PORT ?? 587),
      user: process.env.EMAIL_SMTP_USER || undefined,
      pass: process.env.EMAIL_SMTP_PASS || undefined,
      fromEmail: process.env.EMAIL_FROM ?? DEFAULT_FROM_EMAIL,
      fromName: process.env.EMAIL_FROM_NAME || undefined,
    });
  }

  return new ConsoleEmailProvider();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Strips CR/LF and unescapes quotes so attacker-controlled names cannot inject headers. */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n"]/g, "").replace(/\\/g, "");
}