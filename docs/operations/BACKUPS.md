# Operations — Backups

Practical backup + restore + verification runbook for Wedding Memory Vault.

## What to back up

| Layer | What | Tool |
|---|---|---|
| Database | Everything that matters: users, tenants, orders, payments, weddings, vaults, media metadata, queue/email jobs, audit logs | `scripts/backup/postgres-backup.sh` (pg_dump) |
| Object storage | Original media + generated variants + QR card PDFs | MinIO/R2 bucket snapshot (mc mirror or bucket replication) |
| Env/config | `.env.prod` values and PayFast/SMTP/S3 credential maps | Secret manager of choice (GitHub Secrets, Vault, your cloud secret store) — never git, never the image |

Redis is currently reserved for the future queue layer and holds **no durable data** — nothing to back up.

## Database backups

### Create a dump

```bash
DATABASE_URL=postgresql://wmv:wmv@localhost:5432/wedding_memory_vault \
  BACKUP_DIR=/var/backups/wmv \
  ./scripts/backup/postgres-backup.sh
```

This produces a dated custom-format dump (`wmv-<UTC timestamp>.dump`) in
`BACKUP_DIR`, verifies the `PGDMP` magic header, and deletes files older than
`RETENTION_DAYS` (default 14).

- **Use a direct connection**, not a connection-pooled URL. Poolers are built
  for short-lived app queries and can drop or hang a long pg_dump session.
- Custom format (`pg_dump -Fc`) is required for the `pg_restore` workflow below,
  supports `--jobs` parallelism on restore, and compresses by default.

### Push dumps to object storage (S3 / MinIO / Cloudflare R2)

Via MinIO Client (`mc`):

```bash
mc alias set r2 https://<acct>.r2.cloudflarestorage.com <access-key> <secret-key>
DATABASE_URL=... BACKUP_DIR=/var/backups/wmv \
  BACKUP_UPLOAD_TOOL=mc BACKUP_MC_ALIAS=r2 BACKUP_S3_BUCKET=wmv-backups \
  ./scripts/backup/postgres-backup.sh
```

Via the AWS CLI against an S3-compatible endpoint:

```bash
AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
  AWS_ENDPOINT_URL=https://<acct>.r2.cloudflarestorage.com \
  DATABASE_URL=... BACKUP_DIR=/var/backups/wmv \
  BACKUP_UPLOAD_TOOL=aws BACKUP_S3_BUCKET=wmv-backups \
  ./scripts/backup/postgres-backup.sh
```

Upload failure exits `2` but keeps the local dump so a later run can push it.

### Schedule

Example cron (02:00 UTC daily, 16 GB-class DBs take seconds–minutes):

```cron
0 2 * * *  cd /srv/wmv && DATABASE_URL=... BACKUP_DIR=/var/backups/wmv ./scripts/backup/postgres-backup.sh
```

Retention is per-host (`find -mtime`). For offsite retention, bucket lifecycle
rules on the `wmv-backups` bucket are the source of truth — set e.g. 30-day
object expiry there and longer local retention, or vice versa.

## Restore

Restore into a target database (empty or pre-created):

```bash
# create the empty target (one time)
createdb "$TARGET_DB_URL_DB"
pg_restore --no-owner --no-privileges \
  --dbname=postgresql://wmv:wmv@localhost:5432/wedding_memory_vault \
  /var/backups/wmv/wmv-20260915T020000Z.dump
```

Notes:

- Operators own the `users`/`organizations` rows; `--no-owner`/`--no-privileges`
  is deliberate so roles need not exist on the target.
- Dumps are whole-database. There is no per-tenant export yet.
- Test the restore path **before** you need it: restore a recent dump into a
  scratch database, boot the app against it, and spot-check a vault + order.

## Object storage snapshotting

Media is signed and served from the object store. Backup strategy:

1. **Incremental snapshot** the bucket daily with `mc mirror`:

   ```bash
   mc mirror --overwrite --remove play/prod/memories backups/memories
   ```

   `mc mirror --remove` makes the backup copy an exact replica (deleted
   objects are mirrored as deleted). For immutable, versioned history use
   bucket versioning + replication instead.

2. **R2** (recommended for production): enable bucket **versioning** and, if
   you have a second account, **bucket replication**. R2 dumps media cheaply
   and versioning protects against deletion/overwrite.
3. **MinIO hosted drives**: snapshot the `wmv_prod_minio` volume; or simply run
   `mc mirror` off-box to a second MinIO/R2/S3 location (that also constitutes
   the offsite copy).
4. **Lifecycle**: expire corrupted/old versions per policy. The `/api/admin/
   storage` surface reports bucket totals for capacity planning.

## Verification cadence

| Check | Cadence | Pass criteria |
|---|---|---|
| `postgres-backup.sh` exit 0 in logs | daily | Dump file exists, PGDMP magic verified by script |
| Manual spot restore | weekly | `pg_restore` into scratch DB completes; `select count(*)` on `orders`, `weddings`, `media` matches source |
| Offsite object present | weekly | `mc ls r2/wmv-backups/postgres/` lists today's+recent dumps; `mc stat` size > 0 |
| Media snapshot present | weekly | `mc ls` the mirror target; compare object count with `/api/admin/storage` |
| Restore drills (failover test) | monthly | Boot app+workers from the restored scratch DB for one day |

Add a `BACKUP_*` block to `.env.prod` (documented in DEPLOYMENT.md) and wire a
separate `backup` one-shot service or host cron — do not run backups inside the
app container (pg_dump client + locking are not something the app image needs).

## Disaster-recovery order

1. Restore Postgres from the newest good dump.
2. Restore object storage (point app at existing data, or `mc mirror` back).
3. Boot `migrate` (no-op when schema is already current), then `app` + workers.
4. Verify with a public vault URL and `GET /api/admin/health` (authenticated).