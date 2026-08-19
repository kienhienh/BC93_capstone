# Issue #40 — Reproducible Vercel deployment and release evidence

Repository-owned configuration and documentation only. No credentialed
Vercel account action, secret entry, Production promotion, live
shared-backend mutation, or physical-device/NVDA check — those are
handed to `ready-for-human` tickets #41–#44 (all children of #18).

## What was added

- **`vercel.json`** — pins `installCommand: npm ci`, `buildCommand: npm
  run build`, `outputDirectory: dist`, `framework: vite`, and a catch-all
  SPA rewrite (`/(.*) -> /index.html`) so canonical deep links like
  `/services/:serviceId` resolve on a hard reload. Static files under
  `dist` (JS/CSS chunks, `favicon.svg`, `icons.svg`) are matched before
  the rewrite, since the app uses `react-router-dom`'s `BrowserRouter`.
- **`package.json` `engines.node: "22.x"`** — pins the Vercel build image
  to the same Node version CI already uses.
- **`scripts/check-deploy-config.mjs`** (`npm run check:deploy`) — a real
  gate, not a report. Validates `vercel.json`'s shape, then serves a
  built `dist/` locally with the same "static file, else `index.html`"
  precedence Vercel applies, and fetches ten representative canonical
  deep links (static, single dynamic param, nested dynamic param, and
  the Administrator wildcard area) plus every local asset
  `dist/index.html` references. No live Cybersoft API call — it only
  needs a local `npm run build` output. Wired into
  `.github/workflows/ci.yml`'s `static-gates` job right after
  `check:budgets`.
- **`docs/deployment/vercel.md`** — the build/output/rewrite
  configuration, a Local/Preview/Production environment variable
  reference for `VITE_API_BASE_URL`/`VITE_CYBERSOFT_TOKEN` with
  non-sensitive examples (validated identically everywhere by the
  existing `src/app/runtime-config.ts` Zod schema), the
  Preview-for-PRs/Production-for-main model, and an explicit handoff to
  #41–#44.
- **`docs/release/release-checklist.md`** — what must be true before a
  Production promotion: required CI, Preview review, responsive/
  accessibility/performance evidence, browser journeys, live-integration
  evidence, read-only Production smoke, a known rollback target, and
  immutable tag evidence — each row naming whether it's this
  repository's CI or a specific human ticket.
- `README.md` links both new docs under a new "Deployment and release"
  section.

## Why a local static server, not `vercel dev`

`vercel dev` requires a linked, credentialed Vercel project — out of
scope per this ticket's exclusions and blocked on #41. Replicating
Vercel's documented static-file-first / rewrite-fallback precedence with
a plain `node:http` server over the real `dist/` build gives the same
correctness signal (does this exact rewrite config resolve deep links
and assets correctly?) without any account dependency, and runs in CI on
every PR.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run lint:architecture` pass.
- `npm run test:coverage`: all suites pass; coverage 82.65% statements /
  75.95% branches / 83.63% functions / 86.91% lines (thresholds: 80/75/80/80).
- `npm run build` passes.
- `npm run check:budgets` passes (unchanged from #38).
- `npm run check:deploy` passes — all 5 `vercel.json` shape checks, all
  10 deep links, all local assets resolve correctly. Manually verified
  the script also fails correctly (non-zero exit, no crash) when
  `outputDirectory` is deliberately mismatched.

## Out of scope / handed to human tickets

- Real Vercel project creation, Git connection, and Preview/Production
  environment variable entry — **#41**.
- Live Cybersoft smoke against a real deployment — **#42**.
- Physical device, cross-browser, and NVDA verification — **#43**.
- Production promotion, rollback-target recording, and read-only
  Production smoke — **#44**.
