# syntax=docker/dockerfile:1
# -----------------------------------------------------------------------------
# Wedding Memory Vault — production image
#
# One image, three roles (select via the container command / compose):
#   1. Next.js app     ->  CMD ["node", "server.js"]           (standalone server)
#   2. Background      ->  node_modules/.bin/tsx src/server/services/<role>-worker.entry.ts
#      workers            (build-worker | media-worker | email-worker)
#   3. Migrations      ->  npm run db:migrate                  (one-shot, then exit)
#
# The Next.js standalone folder (.next/standalone) is produced INSIDE this
# Linux builder stage. Never copy a Windows-built `.next/standalone` into the
# image: Windows output tracing can embed drive-letter paths that break the
# Linux bundle. (Building on Windows for a local smoke test is fine — the image
# is still assembled inside Linux containers.)
# -----------------------------------------------------------------------------

FROM node:22-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# --- deps: full install (devDependencies included) for compiling the app -----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: compile the Next.js app (emits .next/standalone) ---------------
FROM base AS builder
# next build evaluates module-level imports of EVERY route during page-data
# collection, and the db client (src/lib/db) throws at import when DATABASE_URL
# is missing. This is a throwaway placeholder that is never connected to —
# matching the CI build job. Provide a real value only if your build needs it;
# it is never baked into the runtime image.
ARG DATABASE_URL=postgresql://wmv:wmv@localhost:5432/docker_build_placeholder
ENV DATABASE_URL=${DATABASE_URL}
COPY --from=deps /app/node_modules ./node_modules
# .dockerignore keeps node_modules, .next, .env*, docs and git out of the context
COPY . .
RUN npm run build

# --- runtime: production-only dependencies -----------------------------------
FROM base AS runtime
ENV NODE_ENV=production
# --omit=dev keeps sharp (with its Linux/musl binaries), tsx (workers),
# drizzle-kit (migrate), dotenv and all app runtime deps — no dev/tooling bloat.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Standalone Next.js server (minimal traced node_modules + server.js)
COPY --from=builder /app/.next/standalone ./
# Static assets + public files that the standalone server serves
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Assets used by the one-shot migrate service and the worker entrypoints:
#  - src/ + tsconfig.json  -> tsx worker entrypoints (they import src, use @/ paths)
#  - drizzle/ + drizzle.config.ts -> npm run db:migrate
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
# next.config.ts is kept for reference/custom-server parity checks
COPY --from=builder /app/next.config.ts ./next.config.ts

# Run as a non-root user. The server needs write access for runtime caches.
RUN addgroup -S wmv && adduser -S wmv -G wmv \
    && chown -R wmv:wmv /app
USER wmv

# Standalone server listening contract (same defaults `next start` uses)
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Liveness: GET / is a static prerendered page and needs no DB/session.
# The authenticated /api/admin/health endpoint is the richer operator health
# surface (DB, migrations, workers) for external probes.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]