# Wedding Memory Vault — OpenCode Project Instructions

Build a production-grade, multi-tenant B2B2C Wedding Memory Vault SaaS. Read `docs/MASTER_SPEC.md` and `docs/ARCHITECTURE.md` before meaningful work.

## Non-negotiable rules
- TypeScript strict mode; validate external input.
- Authorization and tenant isolation are server-side.
- Payment activation is server-authoritative; verify/idempotently process webhooks.
- Background jobs must be retryable and idempotent.
- Store timestamps in UTC; calculate wedding-date business deadlines in `Africa/Johannesburg`.
- Enforce upload/download expiry server-side.
- Never expose storage credentials or private/internal IDs to guests.
- Never silently change shared contracts; record material changes in `docs/DECISIONS.md`.
- “Unlimited” means entitlement, not removal of technical/fair-use safeguards.
- Run tests, typecheck and lint; inspect the diff before completion.

## Worker protocol
Inspect repo → identify dependencies → checklist → implement in domain → test → review diff → update docs → create `docs/worker-handoffs/YYYY-MM-DD-<worker>-<task>.md` → update `docs/WORKER_STATUS.md`.
