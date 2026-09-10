# Architecture

Keep domain boundaries: auth/identity, organizations/tenancy, products/entitlements, weddings, builder, vault, media/storage, QR/assets, payments, email/automation, admin.

Use application services rather than coupling UI directly to persistence. Durable jobs cover build, media processing, generated assets, email, lifecycle/archive/deletion. Jobs need idempotency keys, retries and observable state.

Public wedding routes expose only intentionally public data. Guest upload is temporary/scoped. Entitlements are the source of truth; UI hiding is never authorization.
