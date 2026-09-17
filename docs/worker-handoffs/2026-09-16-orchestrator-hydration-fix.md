# Handoff — Orchestrator: Fix SSR/client hydration mismatch in DemoArtwork

**Date:** 2026-09-16
**Worker:** orchestrator
**Scope:** `src/components/wedding/demo-artwork.tsx` (marketing demo artwork)

## Reported problem

Two symptoms surfaced in one session:

1. `ERR_CONNECTION_REFUSED (-102)` on `http://localhost:3000/` — no dev server
   (or an orphaned one) was listening on port 3000. Root cause was operational,
   not code: the app simply wasn't running for the browser. Started a clean,
   detached `npm run dev` (PID recorded in temp, logs in `%TEMP%\wmw-dev-*.log`);
   `/` and `/examples/*` serve 200.
2. React **hydration mismatch** once the page loaded:

   > A tree hydrated but some attributes of the server rendered HTML didn't
   > match the client properties.

   Only diff: a `<line>` in the "sparklers" motif rendered
   `y2="85.91412011995155"` server-side vs `y2={85.91412011995156}` client-side
   (same 1-ulp difference across multiple rays).

## Root cause

`demo-artwork.tsx` "sparklers" computed ray endpoints at render time:

```ts
const angle = (i / 12) * Math.PI * 2;
const x2 = 200 + Math.cos(angle) * 74; // etc.
```

The angle is not an exact multiple of `PI / 6` in IEEE-754, so
`Math.sin`/`Math.cos` return engine-dependent approximations that differ by an
ulp between Node's V8 (SSR) and the browser's V8 (hydration). The numeric SVG
attributes serialize to different strings → React cannot hydrate.

## Fix

Replaced the runtime trig with a precomputed 12-ray coordinate table
(`SPARKLER_RAYS`, decimal literals). Decimal literals parse to the same
double and serialize to the same string in every engine, so SSR HTML is
bit-identical to the client render. Geometry is unchanged within ±3e-5 viewBox
units (visually identical at 400×300).

Audited the rest of the codebase for the same class of bug:

- `live-slideshow.tsx`, `guest-upload.tsx` — `Math.random()` only inside
  effects/handlers (client-only). Safe.
- `site-footer.tsx` `new Date().getFullYear()` — deterministic within a year.
  Safe.
- No other render-time FP geometry found.

## Verification

- `npm run typecheck` → 0 errors
- `npm run lint` → 0 errors
- `npm run build` → full production build succeeds (static + SSG + dynamic routes)
- Live dev server: `/` and `/examples/classic-romance` return 200; served HTML
  contains **0** ulp-sensitive values and **4** deterministic `85.9141` values
  (the previously mismatching coordinates)

## Caveat

Full DB-backed vitest suite (537 tests) could not run in this environment:
no PostgreSQL on `localhost:5432` and Docker Desktop is unavailable. This is a
pre-existing environment limitation, unrelated to the fix (the change is
presentational and covered by tsc/lint/build plus live HTML inspection). To run
the suite locally: `docker compose up postgres -d`, then `npm run test`.

## Files touched

- `src/components/wedding/demo-artwork.tsx` (the fix)
- `docs/WORKER_STATUS.md` (status update)
- this handoff