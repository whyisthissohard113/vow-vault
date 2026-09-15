# Worker Handoff — 2026-09-15

## Worker
DevOps / Release

## Task
Phase 15 production-readiness packaging and CI/CD: make `next build` a verified
deliverable, add a GitHub Actions CI pipeline, Docker packaging for the Next.js
app + workers (standalone output), production compose wiring, Postgres backup
tooling + runbooks, and a deployment doc — all infra-only, no shared backend
contract changes.

## Status
COMPLETE

## Completed
1. **Local production build verified.** `npm run build` now passes with
   `output: "standalone"` (added to `next.config.ts`). Route table confirmed:
   only `/`, `/about`, `/examples/*`, `/faq`, `/pricing`, `/_not-found` are
   static; every DB/session route is dynamic.
2. **Discovered + fixed the CI/Docker build blocker.** `next build` (Next 16 /
   Turbopack) evaluates module-level imports of EVERY route during page-data
   collection, and `src/lib/db/index.ts` throws at import when `DATABASE_URL`
   is missing — verified live in Docker (fails at `/api/auth/register`). A
   throwaway, never-connected `DATABASE_URL` satisfies the guard (postgres-js
   constructs its client lazily; no query at build time). The CI `build` job and
   the Docker `builder` stage both supply it. No `.env`, no secrets required.
3. **`.github/workflows/ci.yml`** — 3 jobs, `ubuntu-latest`, Node 22, `npm ci`,
   no secrets, `workflow_dispatch` + push/PR on `main`, concurrency group:
   - `checks`: `npm run typecheck` + `npm run lint`.
   - `tests`: `postgres:16` service container (wmv/wmv/wedding_memory_vault,
     `pg_isready` health), `DATABASE_URL` set, `npm run db:migrate`, then
     `npx vitest run` (clean DB each run).
   - `build`: `npm run build` with a documented throwaway `DATABASE_URL`.
   Artifact upload intentionally skipped to stay <10 min (Docker build is
   reproducible at deploy time).
4. **`Dockerfile`** — multi-stage `node:22-alpine`:
   `deps` (`npm ci`) → `builder` (`npm run build` with throwaway DB URL) →
   `runtime` (`npm ci --omit=dev`, copies `.next/standalone` + `.next/static` +
   `public` + `src` + `drizzle` + dropbox configs, non-root `wmv` user).
   One image selects role via command: `node server.js` (app),
   `node_modules/.bin/tsx src/server/services/<role>-worker.entry.ts` (workers),
   `npm run db:migrate` (one-shot). Sharp (Linux/musl), tsx, drizzle-kit, dotenv
   all present in the runtime. Healthcheck = `GET /` (no DB dependency); the
   authenticated `/api/admin/health` is documented as the richer operator probe.
5. **`.dockerignore`** — excludes `node_modules`, `.next`, `.env*`, `docs`,
   VCS/editor cruft, tsbuildinfo. `.env*` never enters the build context, so no
   secret can be traced into a standalone artifact.
6. **`docker-compose.prod.yml`** — self-contained prod stack (postgres, minio,
   redis, `minio-init`, one-shot `migrate`, `app`, 3 workers). Non-secret
   defaults via `${VAR:-default}`; real secrets via `--env-file .env.prod`.
   `app`/workers `depends_on` migrate with `service_completed_successfully`
   (migrate-then-start enforced). MinIO healthcheck self-creates its `mc`
   alias. Validated with `docker compose config`.
7. **Backups** — `scripts/backup/postgres-backup.sh` (POSIX bash,
   `set -euo pipefail`): `pg_dump -Fc` to dated file, PGDMP magic verification,
   `RETENTION_DAYS` pruning, optional S3/R2 upload via `mc` or `aws`
   (`BACKUP_UPLOAD_TOOL=mc|aws`); upload failure exit 2 keeps the local dump.
   `docs/operations/BACKUPS.md`: restore with `pg_restore`, MinIO/R2
   snapshotting (`mc mirror`, bucket versioning/replication), verification
   cadence table, DR order.
8. **`docs/operations/DEPLOYMENT.md`** — env var table (from `.env.example` +
   infra additions: `NEXT_PUBLIC_APP_URL`, `PORT`/`HOSTNAME`, `BACKUP_*`),
   migrate-then-start sequence, running the 3 workers, PayFast webhook +
   `APP_URL` requirements, simulator disable rule for production, build/run
   image commands, deploy verification, CI/CD notes.
9. **`.env.example`** — added `NEXT_PUBLIC_APP_URL` (code already reads it in
   server modules for public URL construction; `.env.example` previously only
   documented `APP_URL`). Noted in DECISIONS + this handoff.
10. **`package.json`** — moved `tsx`, `dotenv`, `drizzle-kit` from
    `devDependencies` to `dependencies` (runtime image needs them for
    workers/env-loading/migrations). `package-lock.json` regenerated via
    `npm install`; `npm ci` verified inside the Docker deps stage (node 22).
11. **Env template hygiene** — discovered `.env.example` had been gitignored by
    the `.env*` pattern all along (never tracked — earlier phases' `.env.example`
    updates never landed in git). Added `!.env.example` to `.gitignore` so the
    documented template (now including `NEXT_PUBLIC_APP_URL`) becomes real and
    tracked. Local `.env` remains ignored.

## Files changed
- `.gitignore` (modified) — `!.env.example` so the env template is tracked.
- `next.config.ts` (modified) — `output: "standalone"` + comment.
- `package.json` / `package-lock.json` (modified) — tsx/dotenv/drizzle-kit → dependencies.
- `.env.example` (new to git; extended with `NEXT_PUBLIC_APP_URL`).
- `.github/workflows/ci.yml` (new).
- `Dockerfile` (new).
- `.dockerignore` (new).
- `docker-compose.prod.yml` (new).
- `scripts/backup/postgres-backup.sh` (new).
- `docs/operations/BACKUPS.md` (new).
- `docs/operations/DEPLOYMENT.md` (new).
- `docs/DECISIONS.md`, `docs/WORKER_STATUS.md` (updated).
- This handoff.

## Database changes
- None. No schema or migration changes; `0000`–`0003` unchanged.

## API/contracts changed
- None of the shared backend contracts (auth/tenant/entitlements/payment/
  billing/lifecycle) were touched. Infra-level changes only:
  - `next.config.ts` `output: "standalone"` (build artifact shape).
  - Production tooling deps (`tsx`/`dotenv`/`drizzle-kit`) now in `dependencies`.
  - New documented env var `NEXT_PUBLIC_APP_URL` (already read by server code;
    `.env.example` now documents it).
  - CI/docker build-time requirement: throwaway `DATABASE_URL` for `next build`.

## Tests
- `npx tsc --noEmit` → 0 errors.
- `npm run lint` → 0 warnings.
- `npx vitest run` → **537 passed** (21 files) against the local dev Postgres.
- `npm run build` → succeeds (standalone output; route table: 8 static, 45 dynamic).
- `docker build -t wmv:phase15 .` → succeeds; image verified:
  - `docker run --rm wmv:phase15 ls /app/server.js` ≈ standalone server present.
  - tsx v4.23.13 + sharp (vips 8.18.6) + drizzle migrations present in image.
  - Smoke: container boots, `GET /` → HTTP 200 (full homepage HTML).
  - `npm run db:migrate` in container against a FRESH throwaway DB →
    "[✓] migrations applied successfully!" and 37 tables created (then dropped).
  - `build-worker.entry.ts` in container prints "[BuildWorker] Starting build
    worker..." (tsx + `@/` alias + DB connection verified inside the image).

## Environment changes
- `.env` deliberately untouched (gitignored, local secrets stay local).
- `.env.example`: `NEXT_PUBLIC_APP_URL` documented.
- Runtime image roles documented in Dockerfile + `DEPLOYMENT.md` §4/§7.

## Known issues
- `npm audit` reports 10 vulnerabilities in the full tree / 8 in prod deps
  (4 moderate, 4 high each — pre-existing, not introduced here). No
  `--force` fix applied because it proposes breaking major-bump changes.
  Adjudicate in a security-review phase.
- Docker build is slow (~10–15 min first run; ~7 min typecheck inside the
  Linux builder — no layer cache on the runner yet). Node 22 + full `tsc` in
  `next build`. Acceptable; CI stays <10 min for the non-Docker jobs and the
  deploy pipeline can cache layers.
- `FILE-MANIFEST.txt` was not updated (it appears to be an incomplete,
  stale snapshot — CI/workflows/handoffs from earlier phases aren't listed
  either). Flagged for the orchestrator; left untouched to avoid conflicting
  with the tooling that maintains it.
- Pre-existing: `.env.example` was gitignored (`.env*`) so no env template was
  actually tracked by the repo. Fixed in this phase (`!.env.example`); once
  committed, the template becomes real.
- `next/font/google` (Fraunces/Geist/Geist_Mono) is fetched at build time —
  Docker/CI builders need outbound network to download the fonts (they do
  today). A fully air-gapped build would require vendored fonts.
- The dev `vitest.config.ts` env hardcodes the localhost DB URL, so local test
  runs keep using the dev Docker Postgres even without a `.env` — unchanged.
- Compose embeds minio/redis for single-host deployments; managed RDS/R2
  deployments should override the vars and remove those services (documented
  in `DEPLOYMENT.md` §2 and file header).

## Next worker
- Orchestrator/follow-up: run the CI pipeline on the repo (`workflow_dispatch`)
  once this lands — the 3 jobs are designed to be green with no secrets; then
  decide whether to add a release/deploy workflow (build image, push to a
  registry, migrate + rolling restart) since this phase deliberately stops at
  packaging.
- Infra follow-ups tracked for later phases: real PayFast `test`/`live`
  integration runbook, Redis/BullMQ queue adoption (workers currently poll the
  DB), object-storage bucket lifecycle/versioning policy, and the
  npm-audit adjudication above.

## Decision required
- None blocking. Infra-level decisions (standalone output, build-time
  `DATABASE_URL`, prod-dep moves, `NEXT_PUBLIC_APP_URL`, simulator disable
  rule) are recorded in `docs/DECISIONS.md` under Phase 15.