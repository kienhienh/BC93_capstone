# Issue #38 — Meet route, asset, and request performance budgets

## Baseline

Before this ticket, only the Administrator area was route-split
(`const AdminArea = lazy(() => import("./app/admin-area"))` in
`src/App.tsx`). Every other journey — Discovery, Service Detail,
Authentication, Hire/Hired Services, Profile — was bundled eagerly into
the main chunk, which measured **147.60 KiB gzip**: already within a few
KiB of the 150 KiB budget meant for a *single* representative route.

## Route-level code splitting

`src/App.tsx` now lazy-loads every route group except Shell and Home,
matching the pattern already established for Admin:

```ts
const ServiceDiscoveryRoute = lazy(() =>
  import("./features/service-discovery/routes").then((m) => ({ default: m.ServiceDiscoveryRoute })),
);
```

...and similarly for `CategoryLandingRoute`, `ServiceDetailRoute`,
`HireConfirmationRoute`, `HiredServicesRoute`, `ProfileRoute`,
`LoginRoute`, `RegisterRoute`. All routes share one `<Suspense
fallback={<RouteLoading />}>` boundary around the `<Routes>` table (Admin
keeps its own nested `Suspense`/`AdminLoading`, unchanged). `RouteLoading`
follows the existing `AdminLoading` shape: a focusable, `aria-busy`
`<main id="main-content">` with a `role="status"` message, so the
skip-link target and screen-reader announcement stay stable during the
loading window.

**Bypassing `public.ts` for the lazy import target.** Two route files
(`authentication/routes.tsx`, `taxonomy/routes.tsx`) were still reachable
through a *static* import path — their owning `public.ts` re-exported the
route component alongside a hook (`useSession`, `useTaxonomy`) that
`Header.tsx`/`Home.tsx` import eagerly. Rollup correctly flagged this:

```
[INEFFECTIVE_DYNAMIC_IMPORT] src/features/authentication/routes.tsx is
dynamically imported by src/App.tsx but also statically imported by
src/features/authentication/public.ts, dynamic import will not move
module into another chunk.
```

Since nothing outside `App.tsx` consumed `LoginRoute`/`RegisterRoute`/
`CategoryLandingRoute` from `public.ts`, those exports were removed from
`authentication/public.ts` and `taxonomy/public.ts`, and `App.tsx` now
imports the route files directly. This is the only case in the codebase
where the "screens import via `public.ts`" convention was intentionally
bypassed, and only for the lazy-loaded route component itself — the
hooks/other exports still go through `public.ts` as usual.

## Result

```
npm run build
```

| Chunk | Before | After |
|---|---|---|
| Main (`index-*.js`) | 147.60 KiB gzip | **111.33 KiB gzip** |
| Admin (`admin-area-*.js`) | 42.15 KiB gzip | 42.27 KiB gzip (unchanged) |

Each newly-split route now costs an additional **2–8 KiB gzip** JS beyond
the shared shell (`useQuery`/`QueryClientProvider`/router chunks are
shared and paid for once). No `INEFFECTIVE_DYNAMIC_IMPORT` warnings
remain.

## Budget-check script

`scripts/check-bundle-budgets.mjs` (new) reads `dist/.vite/manifest.json`
(`build.manifest: true` added to `vite.config.ts`) to compute, per route,
exactly what a browser must additionally fetch beyond the eager shell —
the transitive closure of each lazy route's *static* imports, minus
whatever the shell's own closure already covers. Run via `npm run
check:budgets` after `npm run build`; it fails (non-zero exit) if any
route's own JS exceeds 150 KiB gzip (warns at 120 KiB), any route's own
CSS exceeds 50 KiB gzip, or any raster image in `dist/assets` exceeds 250
KiB. This is a real, hard gate — not a report — so a future regression
that pushes a route back over budget breaks the build script the same
way `tsc`/`eslint` do.

Current results:

```
== Initial (Shell + Home) payload ==
  WARN JS: 132.08 KiB (budget 150 KiB, warn 120 KiB)
  OK   CSS: 5.17 KiB (budget 50 KiB)

== Per-route additional payload (beyond the eager shell) ==
  admin-area.tsx:            42.08 KiB JS / 6.69 KiB CSS
  service-discovery/routes:   2.82 KiB JS / 1.17 KiB CSS
  taxonomy/routes:             1.92 KiB JS / 1.50 KiB CSS
  service-detail/routes:       5.51 KiB JS / 2.75 KiB CSS
  hire-confirmation/routes:    3.23 KiB JS / 1.26 KiB CSS
  hired-services-route:        2.62 KiB JS / 1.26 KiB CSS
  profile/routes:              8.04 KiB JS / 2.59 KiB CSS
  authentication/routes:       3.48 KiB JS

== Raster image assets ==
  OK   hero image: 80.84 KiB (budget 250 KiB)
```

Every route is comfortably under budget. The one **WARN** is the eager
shell itself (132 KiB, over the 120 KiB warn line but under the 150 KiB
hard budget) — it's `react`, `react-dom`, `react-router-dom`,
`@tanstack/react-query`'s core, and `Header`/`Footer`, which every route
needs regardless of splitting. Reducing it further would mean either
swapping a dependency or deferring React Query's provider mount, both of
which are out of scope for a hardening ticket — flagged here as a real,
honest number rather than hidden.

## Image loading attributes

Reviewed every `<img>` in the codebase against the acceptance criteria
(reserved dimensions, lazy loading below the fold, async decoding, eager
+ `fetchPriority="high"` for the LCP candidate per route):

- **Home hero image** (`src/pages/Home.tsx`) — the LCP candidate on `/`.
  Already had `width`/`height`; added `loading="eager" decoding="async"
  fetchPriority="high"`.
- **Service Detail primary image** (`src/features/service-detail/routes.tsx`)
  — the LCP candidate on `/services/:id`. Same treatment.
- Below-the-fold avatars and card thumbnails across Service Discovery
  cards, Service Detail seller/comment avatars, header account menus,
  Profile identity, Admin Category group thumbnails, and Admin Service
  image previews — added `loading="lazy" decoding="async"` (or just
  `decoding="async"` for small above-the-fold avatars in the header/
  Profile that shouldn't defer).
- Service Discovery and Admin Category group images already relied on
  CSS `aspect-ratio` for reserved dimensions (confirmed, no `width`/
  `height` attributes needed there).

## Test fixes required by lazy loading

Route-level `Suspense` means the first render after `renderTestApplication`
now shows the `RouteLoading` fallback, not the routed content — tests
that queried synchronously (`screen.getByRole`) immediately after
rendering or navigating into a newly-lazy route needed to await the
content instead (`await screen.findByRole(...)`), the pattern already
used everywhere else in the suite for the *initial* route heading. Fixed:

- `Authentication.test.tsx` — every test's first form-field query after
  `renderTestApplication("/register" | "/login")`.
- `Session.test.tsx` — two tests reaching `/login` (one needed to become
  `async` since it wasn't previously).
- `ServiceDetail.test.tsx` — the Login-redirect test's first field query
  after navigating away from Service Detail.
- `HeaderAdminMenu.test.tsx` — the Escape-closes-dropdown test now waits
  for the routed Service Discovery heading before interacting; the
  heading's own mount-time `.focus()` effect could otherwise fire *after*
  the trigger button already received focus back from Escape, stealing
  it in a genuine (if narrow) race exposed by the route now mounting
  asynchronously.

No other route's tests needed changes — everywhere else already awaited
the initial route heading as a matter of existing convention.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run lint:architecture` pass.
- `npm run test`: **370/370 pass** (confirmed on an isolated run with no
  concurrent Node processes; concurrent test runs during triage produced
  misleading CPU-contention timeouts in unrelated Admin safeguard suites
  — not a regression, resolved by re-running clean).
- `npm run build` passes with no `INEFFECTIVE_DYNAMIC_IMPORT` warnings.
- `npm run check:budgets` passes (see table above).

## Out of scope / manual checks

- **Deterministic request-count tests, loading-skeleton dimensional
  stability, refetch-preserves-content** — already covered by each
  feature's existing test suite; this ticket didn't find a gap requiring
  new cross-journey coverage beyond the lazy-loading fixes above.
- **Lighthouse release-candidate procedure** (3 mobile runs + median) is
  a human/manual release check against the live API, not automatable in
  this repo's CI — matches the same reasoning already applied to
  color-contrast in issue #37 and the 320px/zoom live-browser audit in
  issue #36. Full Playwright CI infra remains issue #39's job.
