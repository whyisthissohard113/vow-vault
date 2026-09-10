# WEDDING MEMORY VAULT SaaS — MASTER SPECIFICATION

## Product
Premium multi-tenant B2B2C wedding memory vault SaaS.
Flow: wedding company → package → couple/wedding details → assets → template → payment verification → Build Engine → vault → QR → QR card for Platinum → email → guest uploads → processing/display → upload closes → download closes → archive/retention.

## Packages
**Silver — R599 one-time:** basic setup, custom QR, names/dates, guest photo upload, optional colour, no video/slideshow/flipbook/QR card; upload +48h from wedding date; download +7 calendar days; email support.

**Gold — R799 one-time:** Silver + unlimited-photo entitlement, banner, video, slideshow; upload +7 calendar days; download +30 calendar days; priority support.

**Platinum — R1099 one-time:** Gold + intro, digital flipbook, custom QR design cards; upload +7 calendar days; download +90 calendar days; priority support.

Unlimited is a commercial entitlement; retain technical/fair-use controls.

## Expiry
Deadlines are calculated only from the scheduled wedding date, never payment/build/first upload. Business timezone `Africa/Johannesburg`; persist UTC timestamps. Use exclusive end timestamps. Recalculate and audit future wedding-date changes. Lifecycle: DRAFT → BUILDING → ACTIVE → UPLOAD_CLOSED → DOWNLOAD_ONLY → EXPIRED → ARCHIVED → DELETION_PENDING → DELETED.

## Stack
Next.js App Router, TypeScript strict, Tailwind, shadcn/ui, Framer Motion, React Hook Form, Zod, PostgreSQL, Drizzle, Redis + BullMQ/equivalent, S3/R2, QR library, transactional email, payment abstraction, Playwright, Docker, CI/CD.

## Roles
PLATFORM_ADMIN, PLATFORM_SUPPORT, WEDDING_COMPANY_OWNER, WEDDING_COMPANY_ADMIN, WEDDING_COMPANY_STAFF, COUPLE_OWNER, COUPLE_MEMBER, GUEST. Guests do not need full accounts.

## Data
users, organizations, organization_members, customers, products, product_features, product_feature_values, orders, order_items, payments, payment_events, weddings, wedding_settings, vaults, vault_access, guest_sessions, memories, media, media_variants, media_processing_jobs, templates, template_fields, template_versions, qr_codes, qr_designs, slideshows, slideshow_items, flipbooks, flipbook_pages, build_jobs, build_job_steps, expiry_rules, lifecycle_events, email_jobs, email_events, notifications, audit_logs.

## Payments
One-time ZAR purchases via PayFast and Peach Payments. Keep provider-neutral interface for future Paystack/Ozow and SaaS subscriptions. Provide createCheckout, verifyPayment, handleWebhook, refundPayment, getPayment equivalents. Cryptographically verify webhooks, make them idempotent, uniquely store provider event IDs, never activate from browser redirect alone.

## Build Engine
Dedicated `WeddingBuildEngine`: validate → verify payment/entitlement → create vault → apply template → public URL → expiry → entitled gallery/slideshow/flipbook → QR → Platinum QR card → publish → email job → audit. Async, retryable, observable, idempotent; repeated builds must not duplicate production vaults.

## Guest media
QR → landing → select media → upload → progress → success. Temporary scoped guest sessions/tokens; MIME/signature and size validation; rate limiting; object storage; safe object keys; malware scan if feasible; signed URLs; async processing; optional content-hash duplicate detection; never expose storage credentials/internal IDs.

## Vault
Stable route such as `/w/[slug]`, default `noindex`. Silver: names/date, colour, QR, photo gallery/upload. Gold adds banner/video/slideshow. Platinum adds intro/flipbook/QR card. Do not render features outside entitlement.

## QR
Encode only stable public destination/opaque public ID. No private data. QR remains valid across design changes. Platinum supports PNG/PDF QR cards.

## Email
Async transactional abstraction for payment success, vault ready, QR/card, reminders, expiry warning and build failure. Track retries/delivery.

## Marketing
Routes `/`, `/about`, `/pricing`, `/examples`, `/examples/silver`, `/examples/gold`, `/examples/platinum`, `/faq`, `/contact`, `/login`, `/register`. Premium, elegant, editorial, emotional, modern, mobile-first; real interactive demos.

## Security
Server auth/authorization, tenant isolation, secure sessions/cookies, rate limiting, upload validation, signed storage URLs, secure guest tokens, verified/idempotent webhooks, audit logs, no secrets client-side/logs, no public writable storage, POPIA-aware privacy controls, no unsupported legal-compliance claims.

## Testing
Unit: entitlements, expiry/timezone boundaries, permissions, money, build state machine. Integration: tenant isolation, wedding/build/media/payment webhooks/email/lifecycle. E2E: all three packages, expiry, cross-tenant denial, webhook replay, denied expired access. Security: IDOR, privilege escalation, guest-token abuse, malicious files, webhook replay, expiry bypass, rate-limit bypass.
