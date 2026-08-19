# Release checklist

What must be true before a commit is promoted to Production, and where
each piece of evidence comes from. This is the repository-owned
definition (issue #40); it does not itself perform any credentialed or
physical-device step — those are the `ready-for-human` tickets linked
below, all children of #18.

A release is ready to promote (#44) only when every row below is
satisfied for the exact commit being promoted.

## 1. Required CI (automated, this repository)

The `static-gates` and `e2e` jobs in `.github/workflows/ci.yml` must be
green on the commit:

- `npm run typecheck`
- `npm run lint` and `npm run lint:architecture`
- `npm run test:coverage` (statement/branch/function/line thresholds in
  `vite.config.ts`)
- `npm run build`
- `npm run check:budgets` — route/asset performance budgets (#38)
- `npm run check:deploy` — Vercel deployment configuration validation
  (#40, `scripts/check-deploy-config.mjs`)
- `npx playwright test` — deterministic cross-journey evidence across
  mobile/tablet/desktop viewports, including the WCAG 2.2 AA axe gate
  (#37, #39)

No release-blocking step in this list depends on a live backend or a
credentialed account — all are reproducible from a clean checkout.

## 2. Preview review

- A Preview deployment for the exact commit exists and canonical deep
  links / static assets load directly (not just via client-side
  navigation). Provisioning the real Preview environment and confirming
  this is **#41**.

## 3. Responsive, accessibility, and performance evidence

- Automated: cross-journey responsive hardening (#36), the WCAG 2.2 AA
  axe gate (#37), and performance budgets (#38) — all enforced in CI
  above.
- Manual: physical-device, cross-browser, zoom/reflow, and NVDA
  verification that automation cannot certify — **#43**.

## 4. Browser journeys

- Automated: Chromium journeys across three viewports in CI (#39).
- Manual: current Firefox and WebKit/Safari-compatible coverage of the
  same core journeys — **#43**.

## 5. Live-integration evidence

- One controlled, human-observed live Cybersoft smoke (read-only
  discovery plus one atomic Comment and one atomic Hire, with immediate
  cleanup) against the Preview deployment — **#42**.

## 6. Read-only Production smoke

- After promotion, a manual read-only check of Home, discovery, Service
  Detail, Login rendering, and guarded route behavior directly against
  Production, with no live mutation — **#44**.

## 7. Known rollback target

- Before promoting, record the currently-live Production commit/
  deployment as the rollback target, so a bad promotion can be reverted
  to a known-good state without guessing — **#44**. A rollback is never
  treated as the final fix; it must be followed by a code correction on
  a new commit.

## 8. Immutable release evidence

- Once promoted, cut an annotated Git tag on the exact promoted commit
  (e.g. `git tag -a v0.1.0 -m "..."`) and push it. Tags in this
  repository are never force-moved once pushed — a re-release gets a new
  tag, not a rewritten one.
- Release evidence (Preview/Production URLs, source commit, environment
  names, redacted configuration confirmation, observer, date, and the
  links above) is recorded per the pattern in `docs/evidence/` and must
  contain no real credentials, User tokens, or live-smoke ledger detail
  — see `docs/deployment/vercel.md` for what may and may not be
  committed.

## Handoff summary

| Step | Owner | Ticket |
|---|---|---|
| CI (typecheck/lint/tests/coverage/budgets/deploy-config/e2e) | Agent, automated | this repository's CI |
| Vercel project + scoped environments | Human | #41 |
| Live Cybersoft smoke | Human | #42 |
| Physical device / browser / NVDA | Human | #43 |
| Production promotion, rollback target, read-only smoke | Human | #44 |
