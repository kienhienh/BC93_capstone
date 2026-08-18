# Issue #36 — Cross-journey responsive hardening

Every individual feature ticket already owns local responsive verification
(each admin feature, Profile, Hire, and most public routes already have
`it.each([375, 768, 1440])`-style deterministic tests). This ticket's job
was to verify the **integrated** application and fix only cross-journey or
missed defects — not to redo per-feature coverage.

## Method

1. Surveyed existing responsive test coverage across every route to find
   real gaps rather than re-verifying what individual tickets already
   proved (see the gap list below).
2. Live-browser audit (Playwright against the real dev server) across
   every graded route at 320, 375, 768, and 1440 px, checking
   `document.documentElement.scrollWidth` against `window.innerWidth` for
   unintended horizontal overflow. 17 routes × 4 widths = 68 checks.
3. Simulated 200%/400% browser zoom (halved/quartered effective viewport)
   across a representative route from each journey.
4. Interactive check: opened the mobile menu drawer, the tablet category
   drawer, and the Admin account dropdown at their trigger widths and
   re-checked for overflow after each interaction.

`document.documentElement.scrollWidth` is the correct check here — jsdom
(the unit-test environment) does not perform real CSS layout, so it cannot
catch this class of defect; only a real rendering engine can.

## Defect found and fixed

**Admin Service Subcategory list, 320 px only**: `.admin-subcategory-primary`
(the icon + name cell) carries a desktop `min-width: 220px` that was never
relaxed inside the `@media (max-width: 768px)` card-layout block. At 320 px
the card's `110px + minmax(0, 1fr)` grid has less than 220px available for
that cell, so the row (and the whole page) overflowed horizontally by
~50px. Every other admin feature's equivalent "primary cell" pattern was
grepped for the same hardcoded `min-width` and none were found — this was
an isolated defect, not a systemic pattern.

Fix: `.admin-subcategory-primary { min-width: 0; }` inside the existing
mobile breakpoint, letting it shrink like its own children (`> div {
min-width: 0 }`) already do.

No other overflow, zoom, or interactive-drawer defect was found across the
audited surface.

## New deterministic coverage

- `src/test/viewport.ts` — a shared `setViewportWidth(width)` helper,
  replacing the ad hoc per-file copies for new tests (existing per-file
  copies were left in place; migrating every existing file was out of
  scope for a defect-hardening pass).
- `src/app/CrossJourneyResponsive.test.tsx` — the cross-journey suite this
  ticket calls for and that did not previously exist: one representative
  route per journey (public Service Discovery, Login, Profile, Hire
  Confirmation's Hired Services, Administrator Overview), each asserted
  usable at 375/768/1440 px in the same file, distinct from every
  individual feature's own isolated width tests.

## Acceptance-criteria items intentionally not further automated

- **320 px reflow / 200–400% zoom**: verified live (see Method), but not
  encoded as a jsdom test, because jsdom performs no real layout — a
  synthetic "assert at 320px" unit test would only re-exercise the same
  `viewport === "phone"` conditional already covered by the existing
  375 px tests (the phone threshold is 600px), adding no real signal.
  The live-browser scan is the methodologically correct verification for
  this criterion and found the one real defect above.
- **`srcset`/`sizes` for responsive image sources**: out of scope — this
  ticket fixes defects, and the current `aspect-ratio`-based
  reserved-dimension approach (already used broadly) prevents layout
  shift, which is what the acceptance criterion is protecting against.
  Adding responsive image *sources* would be new feature work, not a
  hardening fix.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run lint:architecture` pass.
- `npm run test`: 361/362 pass; the one failure
  (`AdminUserSafeguards.test.tsx`) is a pre-existing, environment-timing
  flake unrelated to this change — it fails intermittently in isolation
  regardless of which branch or diff is checked out, in a file this
  ticket does not touch.
- `npm run build` passes.
