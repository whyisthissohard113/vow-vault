# Worker Handoff — 2026-09-15 Frontend (Marketing Redesign)

**Worker:** Frontend / SaaS UI
**Date:** 2026-09-15
**Scope:** Complete rewrite of the public marketing site into the premium
"Vow Vault" brand experience. Frontend-only; **no server, API, DB,
entitlement, lifecycle or public-vault contract changed.**

## Summary

The marketing site was rebuilt end-to-end on the new token system and content
architecture planned in the prior session, then wired into every public route
and verified with typecheck, lint and a production build.

## What shipped

### Design system & primitives
- `src/styles/tokens.css` — full Vow Vault token set (brand charcoal, champagne
  gold accent, ivory/blush/surface/in/ muted, motion, elevation, radius) with
  legacy aliases preserved for dashboard/auth/public vault.
- `src/app/globals.css` — Tailwind v4 `@theme inline` mapping, containers,
  `.card-soft`, `.reveal` animation classes, focus-visible, reduced-motion
  override. CSS `@import` of tokens uses a **relative path** (Turbopack cannot
  resolve `@/` aliases inside CSS — build blocker found & fixed).
- UI primitives delivered earlier: `Accordion`, `Dialog`, `Tabs`, `Carousel`,
  `Tooltip`, `SectionHeading`, `Reveal`, `useReducedMotion`, token-based
  `Button` (+`accent` variant). Added `IconPlay`, `IconMinus` to the icon set.

### Wedding demo components (`src/components/wedding/`)
`demo-artwork.tsx` (10 SVG motifs), `qr-preview.tsx` (decorative QR),
`guest-upload.tsx` (simulated upload), `wedding-gallery.tsx` (5 functional
tabs + Download All), `live-slideshow.tsx` (play/pause/fullscreen, reduced
motion aware), `digital-guestbook.tsx`, `digital-album.tsx` (spreads +
cover/back), `flipbook.tsx` (3D page-flip, swipe, keyboard). All demo-only,
all local.

### Marketing components (`src/components/marketing/`)
`site-header`, `site-footer` (content-driven), `hero` (+`HeroVisual`),
`trust-bar` (placeholder-flagged), `how-it-works`, `product-demo`
(interactive 5-view tour), `before-during-after` (lifecycle), `features`
(10), `pricing-card` + `pricing`, `comparison` (window days sourced from
canonical packages), `examples` (6 themed cards), `testimonials`
(demo-flagged carousel), `faq-section` + rewritten `faq-accordion`,
`example-tier` (content-driven tier showcases), `final-cta`,
`wedding-company-cta`.

### Content layer (`src/content/`)
`site`, `navigation`, `stats`, `features`, `packages` (canonical-sourced),
`faqs` (15, product-accurate), `testimonials` (demo-flagged), `examples`
(6 demo weddings + tier showcases), `howItWorks`.

### Pages
`/` (home), `/how-it-works`, `/features`, `/packages`, `/examples` +
`/examples/[themeId]` (6 SSG themes) + tier pages (silver/gold/platinum,
rewritten to content layer), `/faq`, `/about`, `/contact` (+demo form),
`/for-wedding-companies`, `/privacy`, `/terms`, `/cookies` (placeholders),
`sitemap.ts`, `robots.ts`. Legacy `/pricing` now redirects to `/packages`.

## Verification
- `npm run typecheck` → 0 errors
- `npm run lint` → 0 problems
- `npm run build` → ✓ 69 pages; auth, dashboard, `/w/[slug]`, all `api/**`
  routes preserved and still compiled.

## Notes / follow-ups
- No `.env` change; build loads the existing local `.env` (gitignored).
- `contact` page form is demo-only (renders success state, sends nothing) —
  wire a real endpoint when the contact API is built.
- Testimonials and trust-bar numbers are fictional and visibly flagged.
- `/pricing` route retained as a redirect for old links; sitemap/robots omit it.
- Follow-up workstreams: real `/examples` photos when real media exists;
  marketing contact endpoint; admin-launch checklist for privacy/terms/cookies.