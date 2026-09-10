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

// ── Role / Permission Errors ────────────────────────────────────────────────

export class InsufficientPermissionsError extends AuthError {
  message = "Insufficient permissions";
  code = "insufficient_permissions";
}

export class PrivilegeEscalationError extends AuthError {
  message = "Cannot assign a role higher than your own";
  code = "privilege_escalation";
}
