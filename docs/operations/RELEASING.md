# Operations — Releasing

End-to-end runbook for cutting a release and deploying to production.

## Versioning convention

We follow [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`) with
a `v` prefix:

| Change type | Bump | Example |
|---|---|---|
| Breaking schema/API change | MAJOR | `v1.0.0` → `v2.0.0` |
| New feature / non-breaking schema addition | MINOR | `v1.0.0` → `v1.1.0` |
| Bug fix, dependency update, infra-only | PATCH | `v1.0.0` → `v1.0.1` |

`package.json` version is the source of truth; tag it when you cut.

## How a release is cut

1. Ensure `main` is green (CI run is passing).
2. Bump `version` in `package.json`.
3. Commit: `git commit -am "release: vX.Y.Z"`.
4. Tag: `git tag vX.Y.Z`.
5. Push: `git push origin main --tags`.

The tag push triggers `.github/workflows/release.yml`.

## What the pipeline does

```
tag push (v*.*.*)
  │
  ├── 1. Gate job
  │     ├─ typecheck (tsc --noEmit)
  │     ├─ lint (eslint)
  │     └─ tests (vitest run, 537/537, Postgres 16 service container)
  │     └── blocks publish on failure
  │
  ├── 2. Build & publish job
  │     ├─ docker/setup-buildx-action
  │     ├─ docker/login-action → ghcr.io (GITHUB_TOKEN, packages:write)
  │     ├─ docker/metadata-action → semver + sha-<short> + latest
  │     └─ docker/build-push-action → linux/amd64, GHA layer cache
  │
  └── 3. Deploy job (manual-approval gated)
        ├─ environment: production (GitHub Environment protection rules)
        ├─ SSH to deploy host → scripts/deploy/remote-deploy.sh
        ├─ Post-deploy health check (GET / and /api/admin/health)
        └─ Skips cleanly when deploy secrets are absent
```

## GHCR image naming & tags

| Tag pattern | Example | Meaning |
|---|---|---|
| `v1.2.3` | `ghcr.io/whyisthissohard113/vow-vault:v1.2.3` | Semantic version |
| `v1.2` | `ghcr.io/whyisthissohard113/vow-vault:v1.2` | Latest patch in minor |
| `sha-<7>` | `ghcr.io/whyisthissohard113/vow-vault:sha-abc1234` | Exact commit |
| `latest` | `ghcr.io/whyisthissohard113/vow-vault:latest` | Latest build on main |

The image is always `linux/amd64`. The `latest` tag is updated on every tag push
(`startsWith(github.ref, 'refs/tags/v')`). Manual `workflow_dispatch` runs must
name an existing `v*` tag via the required `tag` input; the semver tags then
collide with the tag's own semver rules only for the dispatched ref, so manual
runs publish the `sha-<short>` and the input's module tag, not `latest`.

## Deploy secrets

The deploy job SSHes into the production host. Set these as **GitHub Actions
secrets** (Settings → Secrets and variables → Actions):

| Secret | Required | Default | Purpose |
|---|---|---|---|
| `DEPLOY_HOST` | yes | — | SSH hostname or IP of the production server |
| `DEPLOY_USER` | yes | — | SSH username |
| `DEPLOY_SSH_KEY` | yes | — | Private SSH key (ed25519 or RSA) |
| `DEPLOY_KNOWN_HOSTS` | yes | — | The host's SSH public key line (`ssh-keyscan <host>` output). Used to pin the host key; deploys refuse to run without it |
| `DEPLOY_PATH` | yes | — | Absolute path to the repo checkout on the host (e.g. `/srv/wmv`) |
| `DEPLOY_PORT` | no | `22` | SSH port |
| `APP_URL` | no | — | Public origin for post-deploy health checks (e.g. `https://weddingmemoryvault.app`) |
| `HEALTHCHECK_AUTH` | no | — | `user:pass` for the authenticated `GET /api/admin/health` probe ("Basic" credentials as accepted by the admin health route) |

### How to grant a host

1. Create a dedicated deploy user on the host:
   ```bash
   sudo adduser --disabled-password --gecos "" deploy
   sudo usermod -aG docker deploy
   ```
2. Place the **public** half of the SSH key in `~deploy/.ssh/authorized_keys`.
3. Capture the host's public key for `DEPLOY_KNOWN_HOSTS`:
   ```bash
   ssh-keyscan <host>   # paste its `ssh-ed25519 ...` / `ssh-rsa ...` line
   ```
   Read it back with `ssh-keygen -F <host>` a day later to confirm you are still
   seeing the same host key (fingerprint should not change).
4. Ensure the host has Docker, Docker Compose v2, and the repo checked out at
   `DEPLOY_PATH`.
5. Create `.env.prod` at `DEPLOY_PATH/.env.prod` with real values (see
   [DEPLOYMENT.md](./DEPLOYMENT.md) §2 for the full variable list).
6. Add the secrets above to GitHub Actions.
7. Create the `production` environment in GitHub (Settings → Environments) and
   add protection rules (required reviewers, wait timer, etc.) to gate deploys.

When no secrets are configured, the deploy job skips cleanly — it does not fail
the release pipeline.

## Deploy sequence (what `remote-deploy.sh` does)

1. **Pull** the pinned image tag from GHCR.
2. **Migrate** — one-shot `docker compose run --rm migrate` applies any pending
   Drizzle migrations. Idempotent: re-running is a no-op when the schema is
   current.
3. **Start** app + 3 workers with `docker compose up -d --remove-orphans
   --force-recreate`. Old containers are replaced; named volumes (Postgres data,
   MinIO data) are preserved.
4. **Health check** — polls `GET http://127.0.0.1:3000/` up to 10 times (5s
   intervals) until the app responds 200.

The script is idempotent and retry-safe. Migrations are tracked by Drizzle's
`__drizzle_migrations` table; re-running against an up-to-date schema is a
verified no-op.

## Post-deploy verification

After the pipeline completes:

1. **Automated** — the deploy job's health check verifies `GET /` (hard failure
   if it never returns 200) and, when `HEALTHCHECK_AUTH` is set,
   `GET /api/admin/health` (advisory) from the GitHub runner after deploy.
2. **Manual** — spot-check:
   - Public vault URL (`/w/<slug>`)
   - Guest upload flow
   - PayFast sandbox checkout round-trip
   - `docker compose logs app` — no error stack traces
3. **Admin** — `GET /api/admin/health` (authenticated) reports
   `{ database: ok, migrations: ..., workers: [...] }`.

## Rollback procedure

Rollback is re-deploying the previous known-good image tag:

1. Identify the previous tag:
   ```bash
   ghcr.io/whyisthissohard113/vow-vault:sha-<previous-short>
   # or a specific version tag: v1.2.2
   ```
2. Re-run the deploy script on the host:
   ```bash
   cd /srv/wmv
   ./remote-deploy.sh sha-<previous-short>
   ```
3. Verify health.

The image tags are immutable in GHCR — the previous image is always available.
Migrations are forward-only; if a rollback requires a schema revert, create a
reverse migration and deploy it as a new release first.

## Docker Compose image override (`WMV_IMAGE`)

`docker-compose.prod.yml` uses `image: ${WMV_IMAGE:-wmv:latest}` for all
application services. This means:

- **Local development**: `docker build -t wmv:latest . && docker compose -f
  docker-compose.prod.yml up -d` — the default `wmv:latest` image is used.
- **Production deploy**: `WMV_IMAGE=ghcr.io/.../vow-vault:sha-abc1234 docker
  compose -f docker-compose.prod.yml --env-file .env.prod up -d` — the pinned
  image is pulled from GHCR.
- **Rollback**: set `WMV_IMAGE` to the previous tag.

The `remote-deploy.sh` script handles this automatically — it sets `WMV_IMAGE`
based on the tag argument.

## Related documents

- [DEPLOYMENT.md](./DEPLOYMENT.md) — architecture, environment variables, DB
  migrate-then-start, PayFast webhook requirements, simulator disable rule
- [BACKUPS.md](./BACKUPS.md) — database backup/restore, object storage
  snapshotting, disaster recovery
