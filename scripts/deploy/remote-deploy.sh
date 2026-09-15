#!/bin/sh
# remote-deploy.sh — on-host deploy script for Wedding Memory Vault.
#
# Called by the GitHub Actions deploy job via SSH. Pulls the pinned image tag,
# runs one-shot migrations, then starts app + workers. Idempotent: re-running
# is safe because Drizzle tracks applied migrations.
#
# Usage:
#   ./remote-deploy.sh <image-tag>
#
# Example:
#   ./remote-deploy.sh sha-abc1234
#   ./remote-deploy.sh v1.2.3
#
# Environment:
#   WMV_COMPOSE_FILE  — path to docker-compose.prod.yml (default: docker-compose.prod.yml)
#   WMV_ENV_FILE      — path to .env.prod (default: .env.prod)
#   WMV_IMAGE         — override image name; defaults to ghcr.io/whyisthissohard113/vow-vault
#
# Exit codes: 0 success, 1 fatal error (image pull, migrate, or health check failed).
#
set -eu

IMAGE_TAG="${1:?Usage: $0 <image-tag>}"
COMPOSE_FILE="${WMV_COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${WMV_ENV_FILE:-.env.prod}"
IMAGE_BASE="${WMV_IMAGE:-ghcr.io/whyisthissohard113/vow-vault}"
FULL_IMAGE="${IMAGE_BASE}:${IMAGE_TAG}"

export WMV_IMAGE="${FULL_IMAGE}"

log() { printf '%s\n' "[deploy $(date -u +%H:%M:%S)] $*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# ── 1. Pull the pinned image ────────────────────────────────────────────────
log "Pulling ${FULL_IMAGE}"
i=0
max_retries=3
until docker pull "${FULL_IMAGE}"; do
  i=$((i + 1))
  if [ "$i" -ge "$max_retries" ]; then
    die "Image pull failed after ${max_retries} attempts"
  fi
  log "Pull failed — retrying in 10s (${i}/${max_retries})"
  sleep 10
done
log "Pull complete"

# ── 2. Run one-shot migrations ──────────────────────────────────────────────
log "Running migrations..."
i=0
until docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" run --rm migrate; do
  i=$((i + 1))
  if [ "$i" -ge "$max_retries" ]; then
    die "Migrations failed after ${max_retries} attempts"
  fi
  log "Migrate failed — retrying in 10s (${i}/${max_retries})"
  sleep 10
done
log "Migrations complete"

# ── 3. Start app + workers (rolling update, remove orphans) ─────────────────
log "Starting app + workers..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" \
  up -d --remove-orphans --force-recreate \
  app build-worker media-worker email-worker
log "Services started"

# ── 4. Wait for app health ──────────────────────────────────────────────────
log "Waiting for app health..."
for i in $(seq 1 10); do
  if wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1; then
    log "App healthy after ${i} attempt(s)"
    log "Deploy complete (${FULL_IMAGE})"
    exit 0
  fi
  log "Health check attempt ${i} failed — retrying in 5s"
  sleep 5
done

die "App did not become healthy within 50s — check 'docker compose logs app'"
