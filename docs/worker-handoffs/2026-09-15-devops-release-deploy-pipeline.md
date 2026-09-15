# Worker handoff — DevOps: Release / Deploy pipeline (2026-09-15)

## Scope

Built the release/deploy pipeline that Phase 15 deliberately left open
(`.github/workflows/ci.yml` handles CI only; DEPLOYMENT.md §9 points to a
deploy pipeline backed by the Dockerfile + compose files).

## Deliverables

| File | Purpose |
|---|---|
| `.github/workflows/release.yml` | Tag-triggered (`v*.*.*`) + `workflow_dispatch` (optional `tag` input) pipeline. Gate job (typecheck + lint + full vitest suite vs Postgres 16), build-and-push to GHCR via `GITHUB_TOKEN` (`packages: write`), manual-approval deploy job to `production` environment. |
| `scripts/deploy/remote-deploy.sh` | On-host deploy script (POSIX sh, `set -eu`): pull pinned image → one-shot `migrate` run → `up -d` app+workers → app health wait. Idempotent; migrations tracked by Drizzle. |
| `docs/operations/RELEASING.md` | Versioning/tagging convention, release cutting, pipeline walkthrough, GHCR image naming, deploy secret list + host-granting, deploy sequence, post-deploy verification, rollback via re-deploying previous `sha-<short>` tag. |
| `docker-compose.prod.yml` | Changed `build:` → `image: ${WMV_IMAGE:-wmv:latest}` for app/workers/migrate. No other contract/secret handling changed. |
| `docs/DECISIONS.md` | Dated entry recording the WMV_IMAGE compose override + release pipeline decisions. |
| `docs/WORKER_STATUS.md` | DevOps row updated to Phase 16 / IN PROGRESS. |

## Key implementation notes

- **Gate**: mirrors `ci.yml` exactly (Postgres 16 service container, `npm ci`,
  `npm run db:migrate`, then `npx vitest run`). The suite is serialized via
  `fileParallelism: false` in `vitest.config.ts` — no config change needed.
- **Build**: `docker/setup-buildx-action@v3` + `docker/login-action@v3` (GHCR;
  password = `GITHUB_TOKEN`) + `docker/metadata-action@v5` (semver, `sha-<7>`,
  `latest` on main) + `docker/build-push-action@v6` (`linux/amd64`,
  `cache-from`/`cache-to: type=gha`). Throwaway build-time `DATABASE_URL`
  placeholder matching ci.yml/Dockerfile.
- **Deploy**: runs only for a tag ref (`startsWith(github.ref, 'refs/tags/v')`),
  gated by the `production` GitHub Environment (manual approval on the
  environment, not an action-level `environment` secret block). Skips cleanly
  when deploy secrets are missing — the repo currently has no host. Secrets:
  `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`,
  `DEPLOY_PORT` (default 22), `APP_URL` (health-check origin).
- **Health check** is advisory (`exit 0` after retries) — the deploy itself
  completed; the remote script already waited for app health locally.

## Verification performed

None of the TS executors were touched (pure workflow/script/docs change), but
standard verification commands were run:

- `npx tsc --noEmit` → 0 errors
- `npm run lint` → clean
- `npx vitest run` → 537/537 (run alone; no concurrent vitest)
- New/edited YAML (release.yml, docker-compose.prod.yml) parsed via
  `npx yaml-lint` (docker-compose.prod.yml) and `node` yaml parse for
  release.yml.
- `scripts/deploy/remote-deploy.sh` syntax-checked with `sh -n`.

## Assumptions

- The repo currently has no production host: the deploy job will skip cleanly
  in every run until `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_SSH_KEY`/`DEPLOY_PATH`
  secrets are configured.
- The deploy host must have Docker + Docker Compose v2, the repo checked out at
  `DEPLOY_PATH`, and a real `.env.prod` in place (see RELEASING.md).
- `docker build` smoke was not re-run locally in this phase (the Dockerfile was
  untouched since Phase 15's verified build); a full local gate (tsc/lint/tests)
  was still executed.
- Post-deploy health checks are run from the GitHub runner against `APP_URL`
  and are advisory (do not fail the pipeline).

## Follow-ups

- Provision a host and set the deploy secrets to turn on the deploy job.
- Verify the first tag push end-to-end (GHCR permissions need `packages: write`
  on the repository/org).
- Consider a scheduled backup reminder (BACKUPS.md cadence) once a host exists.