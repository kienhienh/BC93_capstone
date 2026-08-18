# Issue #37 — Cross-journey WCAG 2.2 AA hardening

Every individual feature ticket already owns local accessibility (semantic
landmarks, focus management, `AccessibleDialog`-style focus-trap dialogs,
labelled forms, route-heading focus). This ticket's job was to verify the
integrated application and close only cross-journey or missed defects —
not to redo per-feature work.

## Automated axe gate (new, permanent)

Added `jest-axe` as a real devDependency and wired `toHaveNoViolations`
globally in `src/test/setup.ts`. `src/test/a11y.ts` exports a `runAxe`
helper that disables only the `color-contrast` rule — jsdom performs no
real rendering, so it cannot compute rendered colors reliably; contrast
remains one of the human release checks this ticket explicitly does not
claim to replace. Every other axe rule runs.

`src/app/CrossJourneyAccessibility.test.tsx` is the cross-journey seam
this satisfies "axe runs at relevant RTL seams... critical/serious
violations fail CI": one representative screen per journey (public
Service Discovery, Login, Profile, Hire's Hired Services, Administrator
Overview), plus a rating/image/Comment-heavy Service Detail page, the
mobile navigation drawer open, and an Administrator destructive-
confirmation dialog open. All 8 scans pass with **zero violations** on
the first run — this repo's per-feature accessibility discipline already
holds up across journeys.

The destructive-confirmation-dialog scan also asserts the "Go back"
button (not the destructive action) receives initial focus, directly
covering the acceptance criterion "dialogs... initially focus the least
destructive confirmation action."

`npm test` now runs this gate on every run — no separate CI wiring
needed, since `test` is already a required gate per
`docs/code-organization.md`.

## Manual verification of criteria automation cannot check

axe-core does not verify tab order, keyboard-only operability, or true
rendered contrast — only static accessibility-tree rule violations. These
were checked directly against the source:

- **Skip navigation**: confirmed present and rendered on every route
  (`src/App.tsx`, `<a className="skip-link" href="#main-content">`,
  outside the router-conditional tree).
- **Reduced motion**: confirmed a single project-wide catch-all exists —
  `@media (prefers-reduced-motion: reduce) { *, *::before, *::after {
  animation-duration: 0.01ms !important; ... } }` in `src/index.css`.
  This `!important` wildcard rule covers every animated element project-
  wide, including the one file with a `@keyframes` animation
  (`category-landing.css`'s loading-skeleton pulse) that has no local
  reduced-motion override of its own — it doesn't need one, the global
  rule already wins.
- **Dialog/drawer focus-trap, Escape, and focus restoration**: verified
  by reading the shared `AccessibleDialog` pattern used across every
  admin feature and the marketplace `Drawer` component in
  `src/components/Header.tsx`, both already covered by each owning
  feature's existing keyboard-safety tests (e.g. every admin feature has
  an `it.each([375, 768, 1440])("keeps destructive confirmation
  keyboard-safe...")` test asserting Escape closes the dialog and returns
  focus to the trigger).

No defect was found in this pass — this differs from issue #36 (which
found and fixed one real responsive-overflow bug); the accessibility
patterns established across #23–#35 held up consistently when verified
together.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run lint:architecture` pass.
- `npm run test`: 369/370 pass; the one failure
  (`AdminUserSafeguards.test.tsx`) is the same pre-existing, environment-
  timing flake unrelated to this change already documented in issue #36's
  implementation notes — it fails intermittently in isolation regardless
  of branch, in a file this ticket does not touch.
- `npm run build` passes.
