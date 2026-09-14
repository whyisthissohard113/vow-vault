# Worker Status

| Worker | Status | Current Task | Blocker |
|---|---|---|---|
| Orchestrator | COMPLETE | Phase 13 lifecycle integration shipped: `src/server/lifecycle/__tests__/lifecycle-engine.test.ts` (33 tests) · guest upload/download gates via status policy · PATCH `/api/weddings/[id]` status route (CAS through engine, whitelist 409s, deadline recalc) · contract refinements recorded in DECISIONS.md (org-scoped `runLifecycleSweep`, same-status noop guard, UTC-EOD deadline instants) · dev stack (Postgres/MinIO/Redis) up, migrations `0000`–`0003` applied · full suite 518/518 · tsc 0 · lint 0 | — |
| Architect | READY | — | — |
| Database | COMPLETE | PostgreSQL + Drizzle schema (37 tables), migrations `0000`–`0003` applied & verified. `0003_hot_butterfly.sql`: added `guest_sessions_vault_status_idx (vault_id, status)` and dropped redundant `guest_sessions_vault_idx` for the Phase 13 lifecycle engine | — |
| Auth/RBAC/Tenancy | COMPLETE | NextAuth v5 + RBAC (8 roles, 15 permissions) + tenant isolation + guest sessions + auth guards + 99 tests passing | — |
| Entitlements | COMPLETE | Feature defs (21), packages (3), expiry calc (JNB), guards, 123 tests passing | — |
| Builder | COMPLETE | Build engine (15 steps), idempotent, retryable, observable · Phase 13 integration: all weddings.status writes now go through `transitionWeddingStatus` (draft→building, building→active, build_completed event) — no raw status updates, no regressions on rebuild; build-engine suite 18/18, tsc 0, lint 0 | — |
| Frontend | COMPLETE | Phase 9: all 13 dashboard areas + wedding creation flow verified; dashboard + marketing pages committed · tsc 0 errors · full suite 334/334 green | — |
| Public Vault | COMPLETE | Guest flow committed and e2e-verified live (guest-session → upload init → MinIO PUT → complete → media-worker processed → gallery render → owner+guest download) | — |
| Media/Storage | COMPLETE | S3/R2 abstraction (SigV4 presigned PUT/GET), media service (MIME+signature+size+entitlement validation, safe keys, sha256 dedupe), async processing worker (thumbnails, variants, content hash), dual-mode staff/guest API, tenant isolation, 47 tests; `media:dev` entrypoint added and worker verified live against MinIO | — |
| QR/Generated Assets | COMPLETE | QR service (public-URL payloads, opaque publicId, generation/styled/revoke/expire/resolve), card generator (PNG via sharp+SVG), asset generation stubs, 5 API routes, build-engine steps 11+12 wired, 33 tests passing | — |
| Payments | READY | Next: payments/payment_events tables exist; implement PayFast + webhooks | — |
| Email/Automation | COMPLETE | Phase 11: idempotent email queue + worker + SMTP/console providers, 13 templates (XSS-escaped), delivery webhook, support notifications, build-engine email hooks · migration 0002 applied · `email:dev` entrypoint. Phase 13: lifecycle sweep refactored onto the shared engine (`src/server/lifecycle/engine.ts`) — `scanLifecycleAutomation` runs `runLifecycleSweep` first, mirrors `upload_closed`/`download_only` transitions into emails, then evaluates reminders only for active/upload_closed (ADR-011) · email suite 15/15 · tsc 0 · lint 0 | — |
| Marketing | READY | — | — |
| Admin | COMPLETE | Platform admin backend (ADR-010): 2625-line admin-service + 27 guarded API routes + route helpers · reads VIEW_PLATFORM_ANALYTICS / writes MANAGE_PLATFORM · audit-every-mutation + safe no-op protocol · 104 integration tests (UUID family 55555555, lifecycle-inert fixtures) · 4 count-query search bugs fixed by orchestrator · full suite 485/485 · tsc 0 · lint 0 | — |
| QA/Security | READY | — | — |
| DevOps | READY | Next: CI/CD, migrations on deploy, backups | — |