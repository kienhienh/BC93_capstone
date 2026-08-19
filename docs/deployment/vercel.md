# Vercel deployment configuration

Repository-owned configuration and documentation for reproducible Vercel
Preview and Production deployments (issue #40). Everything here is
declared in-repo and verified in CI without a live Vercel account or the
live Cybersoft backend. Credentialed provisioning of the actual Vercel
project is issue #41 — see [Handoff to human-owned tickets](#handoff-to-human-owned-tickets).

## Build and output configuration

`vercel.json` (repository root):

```json
{
  "framework": "vite",
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- **Node 22.x** is pinned via `engines.node` in `package.json`, matching
  the version CI uses (`.github/workflows/ci.yml`).
- **`npm ci`** installs strictly from `package-lock.json` — reproducible,
  never a floating resolve.
- **`npm run build`** runs `tsc -b && vite build`, so a type error fails
  the deployment the same way it fails CI.
- **`dist`** is Vite's default output directory (`vite.config.ts` does
  not override it).
- **SPA rewrite.** The app uses `react-router-dom`'s `BrowserRouter`
  (`src/main.tsx`), so canonical deep links like `/services/:serviceId`
  or `/admin/services` are not real files on disk. Vercel serves a
  matching static file first (JS/CSS under `/assets`, `favicon.svg`,
  `icons.svg`) and only falls back to the catch-all rewrite when no
  static file matches, which returns `index.html` and lets the client
  router take over.

`scripts/check-deploy-config.mjs` (run as `npm run check:deploy`, wired
into the CI `static-gates` job after `npm run build`) validates this
configuration against a real build: it checks `vercel.json`'s shape, then
serves `dist/` locally with the same "static file, else `index.html`"
precedence Vercel applies and fetches a representative set of canonical
deep links (`/`, `/services`, `/services/:id`, `/services/:id/hire`,
`/categories/:id`, `/hired-services`, `/profile`, `/login`, `/register`,
`/admin/services`) plus every local asset `dist/index.html` references.
Nothing in this check calls the live Cybersoft API.

## Environment variables

The client reads two variables, validated identically in every
environment by `src/app/runtime-config.ts` (Zod schema: `VITE_API_BASE_URL`
must be an absolute `http(s)://` URL, `VITE_CYBERSOFT_TOKEN` must be a
non-empty string). If validation fails, the app renders a configuration
error screen instead of a broken UI — the same behavior in Local,
Preview, and Production.

| Variable | Purpose | Non-sensitive example |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL the Cybersoft adapter calls | `https://fiverrnew.cybersoft.edu.vn/api` |
| `VITE_CYBERSOFT_TOKEN` | Project token required by the Cybersoft API | `replace-with-your-project-token` |

| Environment | Where values live | Notes |
|---|---|---|
| Local | `.env` (git-ignored; copy from `.env.example`) | Never committed. |
| Preview | Vercel Project Settings → Environment Variables, scoped to Preview | Set during account provisioning (#41), not in this repository. |
| Production | Vercel Project Settings → Environment Variables, scoped to Production | Set during account provisioning (#41), not in this repository. May point at a different Cybersoft token than Preview. |

Because both variables are `VITE_`-prefixed, Vite inlines them into the
client bundle at build time — they are visible to anyone who loads the
app, by design (the Cybersoft token is a project token, not a user
secret). No `VITE_`-prefixed variable may hold a real user credential.

## Preview and Production environments

One Git-connected Vercel project serves both environments from this
repository:

- **Preview** — every pull request and every non-`main` branch push
  builds a Preview deployment with its own URL, using the Preview-scoped
  environment variables above.
- **Production** — pushes to `main` build Production, using the
  Production-scoped environment variables above.

This is Vercel's default Git-integration behavior; #41 confirms it is
configured exactly this way against the real account and records the
resulting Preview/Production URLs.

## Handoff to human-owned tickets

This ticket is repository configuration and documentation only. It does
not touch a live Vercel account, enter secrets, promote Production, or
run against the live shared backend. The remaining work is intentionally
scoped to `ready-for-human` tickets that need authenticated account
access or physical/assistive-technology hardware:

- **#41 — Configure the Vercel project and scoped environments.**
  Credentialed provisioning of the real Git-connected project, Preview
  and Production environment variable entry, and the first real Preview
  deployment.
- **#42 — Run the controlled live Cybersoft smoke.** Human-observed,
  deny-by-default live-integration verification.
- **#43 — Verify physical devices, browsers, and NVDA.** Manual
  cross-browser, keyboard, screen-reader, and physical-device evidence.
- **#44 — Promote Production with a proven rollback target.** Final
  promotion, rollback-target recording, and read-only Production smoke.

See `docs/release/release-checklist.md` for how these fit into one
release.
