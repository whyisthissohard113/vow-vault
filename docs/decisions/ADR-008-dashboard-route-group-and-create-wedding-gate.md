# ADR-008 — Route group naming + POST /api/weddings gate

Date: 2026-09-11 · Status: accepted

## Context
The `(dashboard)` route group keeps the Next.js path segment `dashboard` in the URL while allowing a `layout.tsx` wrapper that calls `requireTenant()` and builds a permission-filtered nav. Without a route group, nesting `dashboard/` under the same directory would collide with the path segment.

The wedding wizard creates the dossier (wedding row + settings) via `POST /api/weddings`. The spec originally called for gating this behind `MANAGE_WEDDING`. The wizard is used by wedding-company staff with only `CREATE_WEDDING`; allowing them to create the initial draft while reserving build/manage/entitlement-gating to `MANAGE_WEDDING` owners is the correct RBAC split.

## Decision
1. Use a `(dashboard)` route group so Next URLs read `/dashboard`, `/dashboard/weddings`, etc. while a shared `(dashboard)/layout.tsx` enforces `auth()` + `requireTenant()` and builds the permissioned nav.
2. `POST /api/weddings` is gated by `Permission.CREATE_WEDDING` (not `MANAGE_WEDDING`).
3. `PATCH /api/weddings/[id]`, `POST /api/build`, and all mutation routes behind the build pipeline remain gated by `Permission.MANAGE_WEDDING`.

## Consequences
- RBAC is not changed; the Permission enum and `hasPermission` function remain the source of truth.
- The wizard can create a draft, then the staff member's browser redirects to the wedding detail page where build/entitlement buttons are hidden behind MANAGE_WEDDING.
- This deviation is logged here so future API contract reviews don't treat it as a spec regression.