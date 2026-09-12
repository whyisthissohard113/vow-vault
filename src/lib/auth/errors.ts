/**
 * Auth-specific error classes.
 *
 * These extend NextAuth's base `AuthError` / `CredentialsSignin`
 * so that NextAuth correctly surfaces error codes to clients.
 */

import { AuthError, CredentialsSignin } from "@auth/core/errors";

// ── Generic Auth Errors ─────────────────────────────────────────────────────

export class UnauthorizedError extends AuthError {
  message = "Unauthorized";
  code = "unauthorized";
}

export class ForbiddenError extends AuthError {
  message = "Forbidden";
  code = "forbidden";
}

export class TenantMismatchError extends AuthError {
  message = "Tenant mismatch: you do not have access to this organization";
  code = "tenant_mismatch";
}

// ── Credentials Errors ──────────────────────────────────────────────────────

export class InvalidCredentialsError extends CredentialsSignin {
  message = "Invalid email or password";
  code = "invalid_credentials";
}

export class AccountSuspendedError extends CredentialsSignin {
  message = "This account has been suspended";
  code = "account_suspended";
}

export class AccountDeactivatedError extends CredentialsSignin {
  message = "This account has been deactivated";
  code = "account_deactivated";
}

export class EmailAlreadyExistsError extends AuthError {
  message = "An account with this email already exists";
  code = "email_already_exists";
}

export class InvalidRegistrationError extends AuthError {
  message = "Invalid registration data";
  code = "invalid_registration";
}

// ── Guest Session Errors ────────────────────────────────────────────────────

export class GuestTokenExpiredError extends AuthError {
  message = "Guest session has expired";
  code = "guest_token_expired";
}

export class GuestTokenRevokedError extends AuthError {
  message = "Guest session has been revoked";
  code = "guest_token_revoked";
}

export class GuestUploadLimitError extends AuthError {
  message = "Guest upload limit reached";
  code = "guest_upload_limit";
}

export class GuestTokenInvalidError extends AuthError {
  message = "Invalid guest token";
  code = "guest_token_invalid";
}

export class RateLimitError extends AuthError {
  message = "Too many requests; please try again later";
  code = "rate_limit";

  constructor(message = "Too many requests; please try again later") {
    super(message);
    this.message = message;
  }
}

// ── Role / Permission Errors ────────────────────────────────────────────────

export class InsufficientPermissionsError extends AuthError {
  message = "Insufficient permissions";
  code = "insufficient_permissions";
}

export class PrivilegeEscalationError extends AuthError {
  message = "Cannot assign a role higher than your own";
  code = "privilege_escalation";
}

// ── Resource Errors ─────────────────────────────────────────────────────────────

export class NotFoundError extends AuthError {
  code = "not_found";

  constructor(resource: string) {
    super(`${resource} not found`);
    this.message = `${resource} not found`;
  }
}

// ── Media / Storage Errors ──────────────────────────────────────────────────────

export class MediaValidationError extends AuthError {
  code = "media_validation";

  constructor(message = "Invalid media request") {
    super(message);
    this.message = message;
  }
}

export class MediaMimeRejectedError extends MediaValidationError {
  code = "media_mime_rejected";

  constructor(message = "Media type is not supported") {
    super(message);
    this.message = message;
  }
}

export class MediaSignatureRejectedError extends MediaValidationError {
  code = "media_signature_rejected";

  constructor(message = "File content does not match the declared media type") {
    super(message);
    this.message = message;
  }
}

export class MediaSizeExceededError extends MediaValidationError {
  code = "media_size_exceeded";

  constructor(message = "File exceeds the allowed size limit") {
    super(message);
    this.message = message;
  }
}

export class DuplicateMediaError extends MediaValidationError {
  code = "duplicate_media";

  constructor(message = "A media item with identical content already exists") {
    super(message);
    this.message = message;
  }
}

// ── QR / Generated Assets Errors ───────────────────────────────────────────

export class QrGenerationError extends AuthError {
  code = "qr_generation";
  constructor(message = "QR image generation failed") {
    super(message);
    this.message = message;
  }
}

export class QrCardGenerationError extends AuthError {
  code = "qr_card_generation";
  constructor(message = "QR card generation failed") {
    super(message);
    this.message = message;
  }
}

export class QrCodeNotFoundError extends NotFoundError {
  constructor(resource = "QR code") {
    super(resource);
  }
}

export class QrCodeRevokedError extends AuthError {
  code = "qr_code_revoked";
  constructor(message = "QR code has been revoked") {
    super(message);
    this.message = message;
  }
}

export class QrCodeExpiredError extends AuthError {
  code = "qr_code_expired";
  constructor(message = "QR code has expired") {
    super(message);
    this.message = message;
  }
}
