# Operations — Deployment

Production deployment runbook for Wedding Memory Vault (Next.js 16 standalone +
PostgreSQL + MinIO/R2 object storage + Redis + 3 background workers).

## 1. Architecture at a glance

```
                        ┌──────────────────────────────────────────────┐
                        │  One image (multi-stage Dockerfile)          │
   public traffic ───▶  │  app            node server.js               │
                        │  build-worker   tsx build-worker.entry.ts    │
                        │  media-worker   tsx media-worker.entry.ts    │
                        │  email-worker   tsx email-worker.entry.ts    │
                        │  migrate        npm run db:migrate (one-shot)│
                        └──────────────────────────────────────────────┘
                              │ DATABASE_URL          │ S3_*
                              ▼                        ▼
                         PostgreSQL 16            MinIO / Cloudflare R2
                          (migrations                (media objects,
                           via drizzle)              presigned URLs)
```

The app image serves the Next.js app via the **standalone** server
(`output: "standalone"` → `.next/standalone/server.js`) and runs the workers
with `tsx`. `docker-compose.prod.yml` wires the whole stack with placeholders;
real secrets come from a deploy `.env.prod` file or your secret store.

## 2. Environment variables

All variables come from the environment / `.env.prod` — never hardcoded in the
image, CI or scripts. Values below match `.env.example`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | **yes** | — | Postgres connection string (use a direct, non-pooled URL for migrate/backup; a pooled URL is fine for the app). The db client throws at import if unset. |
| `NEXTAUTH_SECRET` | **yes (prod)** | — | NextAuth cookie-signing secret; 64 chars random. |
| `NEXTAUTH_URL` | no | `APP_URL` | NextAuth origin. |
| `APP_URL` | **yes (prod)** | `http://localhost:3000` | Public origin for PayFast checkout redirects, email template links, webhook URLs. |
| `NEXT_PUBLIC_APP_URL` | no | `APP_URL` | Public origin for self-constructed public URLs (QR payloads, build-engine destinations, public vault links, email links) in server modules. Keep identical to `APP_URL` in prod. |
| `EMAIL_SMTP_HOST` | no | empty → console | SMTP host. Empty = console provider (logs instead of sending) — safe default, not for real customer email. |
| `EMAIL_SMTP_PORT` / `EMAIL_SMTP_USER` / `EMAIL_SMTP_PASS` | no | `587` / empty / empty | SMTP auth. |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | no | `noreply@weddingmemoryvault.app` | Default sender (only ever used for resolved addresses). |
| `EMAIL_WEBHOOK_SECRET` | no | empty | Signs the email delivery webhook (`POST /api/webhooks/email`). Set in prod. |
| `S3_ENDPOINT` | **yes if using storage** | `http://localhost:9000` | S3-compatible endpoint (`https://<acct>.r2.cloudflarestorage.com` for R2). |
| `S3_REGION` | no | `us-east-1` | Region used in SigV4 signatures. |
| `S3_BUCKET` | **yes if using storage** | `wmv-dev` | Bucket for original media + variants. |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | **yes if using storage** | — | Storage credentials — **never expose client-side**; media is served via short-lived presigned URLs. |
| `S3_FORCE_PATH_STYLE` | no | `true` | `true` for MinIO path-style; `false` for R2/a real S3. |
| `REDIS_URL` | no | `redis://localhost:6379` | Reserved for the future BullMQ queue layer. |
| `PAYFAST_MERCHANT_ID` / `PAYFAST_MERCHANT_KEY` / `PAYFAST_PASSPHRASE` | in live/test | empty | PayFast credentials. |
| `PAYFAST_MODE` | no | `simulated` | `simulated` \| `test` \| `live`. **Production must be `test` or `live`** — see §6. |
| `PAYFAST_NOTIFY_URL` | in live/test | `APP_URL/api/webhooks/payments/payfast` | Must be a **public HTTPS URL** PayFast can reach. |
| `PAYFAST_VALIDATE_URL` / `PAYFAST_ITN_URL` | no | PayFast defaults | Overrides for gateway sandbox/alternate endpoints. |
| `PORT` / `HOSTNAME` | no | `3000` / `0.0.0.0` | Standalone server listener (container only). |
| `NEXT_TELEMETRY_DISABLED` | no | `1` (in image) | Next telemetry off. |
| `BACKUP_DIR` / `RETENTION_DAYS` / `BACKUP_*` | no | `/var/backups/wmv` / `14` | Backup script knobs (see BACKUPS.md). |

## 3. DB migrate-then-start sequence

Run migrations **before** pointing live traffic at a new app version:

```bash
# one-shot: applies ./drizzle/0000-0003 and records them in __drizzle_migrations
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm migrate
# then start the stack
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

`docker-compose.prod.yml` also expresses this ordering natively: `app` and the
workers `depends_on` the `migrate` service with
`condition: service_completed_successfully`, so a plain `up -d` migrates first
and never starts an app on an un-migrated schema.

Standalone (no compose): migrate with `npm run db:migrate` before `npm start`
(`node .next/standalone/server.js`).

## 4. Running workers

Each worker is a separate process polling the database for jobs (idempotent and
retryable by design):

```bash
node_modules/.bin/tsx src/server/services/build-worker.entry.ts   # vault builds
node_modules/.bin/tsx src/server/services/media-worker.entry.ts   # media processing
node_modules/.bin/tsx src/server/services/email-worker.entry.ts   # transactional email + lifecycle sweeps
```

In compose: `build-worker`, `media-worker`, `email-worker` services declare the
same image with different commands. Run at least one of each. Multiple replicas
are safe (jobs claim rows with CAS) but unnecessary at small scale.

Need `DATABASE_URL` (+ `S3_*` for media-worker, `EMAIL_SMTP_*` for email-worker)
in the worker environment, exactly as in §2.

## 5. PayFast webhook + APP_URL requirements

- The PayFast Instant Transaction Notification (ITN) must reach
  `POST {APP_URL}/api/webhooks/payments/payfast` — set `PAYFAST_NOTIFY_URL` to
  the **public HTTPS** URL when registering with PayFast. Nothing may sit
  between PayFast and the app that rewrites or authenticates the body; the app
  verifies the MD5 signature and amount itself.
- `APP_URL` must be the same public origin used in checkout `return_url` /
  `cancel_url`, so `/purchase/return|cancel?reference=...` land correctly.
- Webhook replay is safe (unique `provider_event_id` anchor + CAS activation);
  PayFast retries for non-permanent failures are fine.

## 6. Simulator disable rule (MUST follow in production)

`PAYFAST_MODE=simulated` redirects checkout to the **in-app simulator**
(`POST /api/payments/simulate/<paymentId>`) and skips PayFast server-side
validation. The simulator route is hard-disabled (404) under
`NODE_ENV=production`, but do not rely on that alone:

1. Set `PAYFAST_MODE=test` (PayFast sandbox) or `=live` with real credentials.
2. Set `NODE_ENV=production` in every container (the compose `x-wmv-env` anchor
   does this).
3. Set `PAYFAST_NOTIFY_URL`, `APP_URL`, `NEXTAUTH_SECRET` and `EMAIL_WEBHOOK_SECRET`
   to real public values in the deploy `.env.prod`.

The simulator exists only for local onboarding flows; it must never accept real
orders. A `PAYFAST_MODE=simulated` stack is not production.

## 7. Build & run the image

```bash
docker build -t wmv:latest .

# app
docker run --rm -p 3000:3000 --env-file .env.prod wmv:latest
# workers (same image, different command)
docker run --rm --env-file .env.prod wmv:latest node_modules/.bin/tsx src/server/services/build-worker.entry.ts
# migrate
docker run --rm --env-file .env.prod wmv:latest npm run db:migrate
```

> **Platform caveat:** the standalone folder is generated inside the Linux
> Docker builder stage. Do **not** copy a `node_modules`/`.next/standalone`
> produced on Windows into the image — Windows tracing can embed drive-letter
> paths that break the Linux bundle. Always build the image with Docker (Linux
> containers).

## 8. Verification after deploy

```bash
curl -fsS http://<host>:3000/                          # landing page 200
curl -fsS -u <admin> http://<host>:3000/api/admin/health
# -> { database: ok, migrations, workers: [...], queues }
```

Spot-check a public vault URL (`/w/<slug>`), a guest upload, and a PayFast
sandbox checkout round-trip on a test wedding. See BACKUPS.md for the restore
verification cadence.

## 9. CI/CD

`.github/workflows/ci.yml` runs typecheck + lint, the full 537-test suite
against a throwaway Postgres, and `next build` on every push/PR to `main`
(manual `workflow_dispatch` available). It needs **no secrets**. Image
building/deploying is intentionally left to a deploy pipeline of your choice;
the Dockerfile + compose files here are that pipeline's contract.