#!/usr/bin/env bash
#
# postgres-backup.sh — pg_dump a Wedding Memory Vault Postgres database to a
# dated file, prune files older than the retention window, and optionally push
# the dump to S3-compatible object storage (MinIO, Cloudflare R2, AWS S3).
#
# POSIX bash, run anywhere pg_dump is available (host, cron, GitHub Actions, an
# ops bastion). All knobs come from environment variables with safe defaults.
#
# Usage:
#   DATABASE_URL=postgresql://wmv:wmv@localhost:5432/wedding_memory_vault \
#     BACKUP_DIR=/var/backups/wmv \
#     RETENTION_DAYS=14 \
#     ./scripts/backup/postgres-backup.sh
#
# Optional object-storage upload (choose one tool; both default to off):
#   # via MinIO Client (mc)
#   BACKUP_MC_ALIAS=local BACKUP_S3_BUCKET=wmv-backups BACKUP_S3_PREFIX=postgres \
#     ./scripts/backup/postgres-backup.sh
#   # via aws cli (S3-compatible endpoints)
#   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_ENDPOINT_URL=... \
#     BACKUP_S3_BUCKET=wmv-backups BACKUP_S3_PREFIX=postgres \
#     BACKUP_UPLOAD_TOOL=aws \
#     ./scripts/backup/postgres-backup.sh
#
# Exit codes: 0 success, 1 dump/retention failure, 2 upload failure (dump is
# kept locally when upload fails, so a later retry can push it).
#
set -euo pipefail

# ── Configuration (env vars with sensible defaults) ───────────────────────────
DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required (e.g. postgresql://user:pass@host:5432/db)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/wmv}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
PGDUMP_BIN="${PGDUMP_BIN:-pg_dump}"
UPLOAD_TOOL="${BACKUP_UPLOAD_TOOL:-}"                 # "" | "mc" | "aws"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
S3_PREFIX="${BACKUP_S3_PREFIX:-postgres}"
S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-}"
MC_ALIAS="${BACKUP_MC_ALIAS:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
# One logical "database" label used in the filename when DATABASE_URL is pooled.
DB_LABEL="${BACKUP_DB_LABEL:-wmv}"

# ── Derived values ─────────────────────────────────────────────────────────────
TS="$(date -u +%Y%m%dT%H%M%SZ)"
STAMP="$(date -u +%Y-%m-%d)"
DUMP_FILE="${BACKUP_DIR}/${DB_LABEL}-${TS}.dump"
MAGIC="pg_dump (PostgreSQL)"

log()  { printf '%s\n' "[backup $(date -u +%H:%M:%S)] $*"; }
die()  { log "ERROR: $*" >&2; exit 1; }

# ── Preflight ─────────────────────────────────────────────────────────────────
command -v "${PGDUMP_BIN}" >/dev/null 2>&1 \
  || die "pg_dump not found (install postgresql-client or set PGDUMP_BIN)"
mkdir -p "${BACKUP_DIR}"

if [[ -n "${UPLOAD_TOOL}" && -z "${S3_BUCKET}" ]]; then
  die "UPLOAD_TOOL=${UPLOAD_TOOL} set but BACKUP_S3_BUCKET is empty"
fi

# ── Dump (custom format: compressed, restorable with pg_restore) ──────────────
log "Dumping ${DATABASE_URL} -> ${DUMP_FILE}"
"${PGDUMP_BIN}" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="${DUMP_FILE}" \
  "${DATABASE_URL}"

# Sanity check: the file must be a real pg_dump archive, not a 0-byte or error
# stream. pg_dump custom format starts with "PGDMP".
if ! head -c 5 "${DUMP_FILE}" | grep -q "PGDMP"; then
  rm -f "${DUMP_FILE}"
  die "dump failed: ${DUMP_FILE} is not a pg_dump archive"
fi

DUMP_BYTES="$(wc -c < "${DUMP_FILE}" | tr -d ' ')"
log "Dump OK: ${DUMP_FILE} (${DUMP_BYTES} bytes)"

# ── Retention: prune older dumps in BACKUP_DIR ────────────────────────────────
if [[ "${RETENTION_DAYS}" =~ ^[0-9]+$ ]] && [[ "${RETENTION_DAYS}" -gt 0 ]]; then
  log "Pruning ${BACKUP_DIR} dumps older than ${RETENTION_DAYS} days"
  find "${BACKUP_DIR}" -maxdepth 1 -type f -name "${DB_LABEL}-*.dump" \
    -mtime "+${RETENTION_DAYS}" -print -delete
else
  log "Retention disabled (RETENTION_DAYS=${RETENTION_DAYS:-unset})"
fi

# ── Optional object-storage upload ────────────────────────────────────────────
if [[ -n "${UPLOAD_TOOL}" ]]; then
  case "${UPLOAD_TOOL}" in
    mc)
      [[ -n "${MC_ALIAS}" ]] || die "BACKUP_MC_ALIAS is required when UPLOAD_TOOL=mc"
      command -v mc >/dev/null 2>&1 || die "mc (MinIO Client) not found"
      log "Uploading to mc alias '${MC_ALIAS}' bucket '${S3_BUCKET}'"
      mc cp "${DUMP_FILE}" "${MC_ALIAS}/${S3_BUCKET}/${S3_PREFIX}/${TS}.dump" \
        || { log "WARNING: upload failed; dump kept locally at ${DUMP_FILE}"; exit 2; }
      ;;
    aws)
      command -v aws >/dev/null 2>&1 || die "aws cli not found"
      if [[ -n "${AWS_ENDPOINT_URL:-}" ]]; then
        log "Uploading via aws to bucket '${S3_BUCKET}' endpoint '${AWS_ENDPOINT_URL}'"
        aws s3 cp "${DUMP_FILE}" "s3://${S3_BUCKET}/${S3_PREFIX}/${TS}.dump" \
          --endpoint-url "${AWS_ENDPOINT_URL}" --region "${AWS_REGION}" \
          || { log "WARNING: upload failed; dump kept locally at ${DUMP_FILE}"; exit 2; }
      else
        log "Uploading via aws to bucket '${S3_BUCKET}' (default endpoint)"
        aws s3 cp "${DUMP_FILE}" "s3://${S3_BUCKET}/${S3_PREFIX}/${TS}.dump" \
          --region "${AWS_REGION}" \
          || { log "WARNING: upload failed; dump kept locally at ${DUMP_FILE}"; exit 2; }
      fi
      ;;
    *)
      die "BACKUP_UPLOAD_TOOL must be 'mc', 'aws' or empty (got '${UPLOAD_TOOL}')"
      ;;
  esac
fi

log "Backup complete (rolled on ${STAMP})."