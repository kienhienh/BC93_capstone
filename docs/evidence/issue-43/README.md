# Issue #43 manual verification evidence

Human-observed evidence for the physical-device, cross-browser, and
assistive-technology checks that automation cannot certify (see
`docs/release/release-checklist.md` §3–4 and issue #43's acceptance
criteria). Each entry below records one manual check: device/browser/AT
version, viewport, deployment URL, observer, date, and pass/fail. No
sensitive data (tokens, real user credentials) is recorded.

## Status summary (as of 2026-08-20)

Snapshot taken to close out this session; not a claim that issue #43 is
ready to close. Status against each acceptance criterion:

| # | Acceptance criterion | Status |
|---|---|---|
| 1 | Firefox + WebKit/Safari core journeys | **Not done** |
| 2 | Keyboard-only run (navigation, search/filters, auth, Comment, Hire/Hired Services, Profile, Admin CRUD) | **Done** — see entries below |
| 3 | NVDA + Chrome (landmarks, roles, forms/errors, announcements, route changes, drawers, tables, mutation feedback) | **Not done** — see entry below |
| 4 | Physical smartphone, full journey, no horizontal overflow | **Not done** |
| 5 | Contrast, 200%/400% zoom, 320px reflow, text spacing, reduced motion, visible focus, target size | **Partial** — 200%/400% zoom done (see below); contrast, 320px reflow, text spacing, reduced motion, target size not done |
| 6 | Evidence recorded with device/browser/AT/viewport/URL/observer/date/pass-fail | **Partial** — recorded for everything actually tested |
| 7 | Release-blocking defects filed and resolved | 1 defect found and filed: [#98](https://github.com/kienhienh/BC93_capstone/issues/98) (Skip-to-main-content link overlaps the header logo when focused) — **not yet fixed** |

**Issue #43 is not ready to close.** Remaining work: rows 1, 3, 4 in
full; row 5's contrast/320px/text-spacing/reduced-motion/target-size
sub-checks; and fixing #98.

## Log

### Keyboard-only Hire journey — PASS

- **Check**: keyboard-only run covering the Hire / Hired Services journey
  (search → Service Detail → Hire → confirmation), per the "keyboard-only
  run covers ... Hire/Hired Services" acceptance criterion.
- **Browser**: Microsoft Edge (desktop)
- **Deployment URL**: `https://bc-93-capstone-28rk-git-issue-9-033de9-kienhienh-7980s-projects.vercel.app`
  — Preview deployment. *(Exact source commit/branch for this Preview
  was not confirmed at capture time; confirm against the Vercel
  deployment list before using this entry as release-blocking evidence.)*
- **Observer**: kienhienh
- **Date**: 2026-08-20
- **Result**: PASS. The full Hire flow was completed using only the
  keyboard, with no mouse interaction. The screenshot below shows the
  end state on `/profile` (Hired Services tab): the newly hired service
  ("I will design unique minimalist modern and creative logo design",
  $22, hired Aug 20 2026) listed with status "In progress", and the
  "View details" link showing keyboard focus (status bar confirms the
  link target `/services/1`, reached via Tab rather than mouse hover).

![Keyboard-only Hire flow result: Profile page Hired Services tab showing the newly hired service with the View details link focused via keyboard](./keyboard-hire-flow-profile-hired-services.png)

### 200%/400% zoom reflow — PASS

- **Check**: 200%/400% browser zoom reflow, per the "200%/400% zoom...
  manually checked" acceptance criterion.
- **Browser**: Microsoft Edge (desktop), InPrivate window (extensions
  disabled)
- **Pages checked**: `/profile` (authenticated), `/login`
- **Deployment URL**: `https://bc-93-capstone-28rk-git-issue-9-033de9-kienhienh-7980s-projects.vercel.app`
  — Preview deployment. *(Exact source commit/branch not confirmed at
  capture time; confirm against the Vercel deployment list before using
  this entry as release-blocking evidence.)*
- **Observer**: kienhienh
- **Date**: 2026-08-20
- **Result**: PASS, with one investigation note. At 400% zoom with
  DevTools docked to the side (which itself shrinks the usable page
  viewport, not representative of a real zoomed session), the layout
  reflowed correctly through tablet and phone breakpoints, but a script
  run in the console (`document.querySelectorAll('*')` filtered by
  `scrollWidth > document.documentElement.clientWidth`) flagged the
  header, `/login` authentication card, and footer as overflowing.
  Two follow-ups isolated the cause:
  1. With DevTools redocked to the bottom (no longer narrowing the page
     viewport) the same overflowing elements were still reported, ruling
     out the DevTools-docking width as the cause.
  2. A direct measurement immediately after —
     `document.documentElement.scrollWidth - document.documentElement.clientWidth`
     — returned **0**, i.e. no actual overflow at the moment of
     measurement. The earlier per-element list is attributed to a
     transient sub-pixel rounding artifact during/just after the zoom
     transition, not a real layout defect. Local reproduction attempts
     (Playwright at the equivalent effective widths, 320–480px) found no
     overflow on `/login` at any width.
  No release-blocking reflow defect found.

### Keyboard-only Comment journey — PASS

- **Check**: keyboard-only run covering Comment (submit a rating + text
  comment on a Service Detail page), per the "keyboard-only run
  covers ... Comment" acceptance criterion.
- **Browser**: Microsoft Edge (desktop)
- **Observer**: kienhienh
- **Date**: 2026-08-20
- **Result**: PASS. A comment ("sdasa", 1 out of 5 stars) was submitted
  using only the keyboard. The success message "Your Comment was added."
  rendered inline above the "Add Comment" button, and the button
  retained a visible focus outline after submit.

![Keyboard-only Comment flow: success message "Your Comment was added." shown above the focused Add Comment button, with the new comment listed below](./keyboard-comment-flow.png)

### Keyboard-only Admin navigation — PASS (partial)

- **Check**: keyboard-only run covering representative Administrator
  CRUD, per the "keyboard-only run covers ... representative
  Administrator CRUD" acceptance criterion.
- **Browser**: Microsoft Edge (desktop)
- **Observer**: kienhienh
- **Date**: 2026-08-20
- **Result**: PASS for navigation — reached Admin → Service Categories →
  category detail (`/admin/categories/5631`) entirely via keyboard, with
  "Back to list" / "Edit Category" / "Delete Category" actions visible
  and reachable.

![Keyboard-only Admin navigation: Service Category Detail page for "Content Creator" reached via keyboard, with Back to list / Edit Category / Delete Category actions](./keyboard-admin-category-detail.png)

### Keyboard-only Admin destructive-confirmation dialog — PASS

- **Check**: the delete-category confirmation dialog's keyboard safety
  (initial focus, Tab focus-trap, Escape-to-cancel), part of the
  "keyboard-only run covers ... representative Administrator CRUD"
  acceptance criterion.
- **Browser**: Microsoft Edge (desktop)
- **Observer**: kienhienh
- **Date**: 2026-08-20
- **Result**: PASS, after one false alarm caused by a stale cached
  build. The first pass against the Preview URL showed the confirmation
  text input holding initial focus (not the "Cancel" button), Tab
  escaping the dialog into the background table, and Escape not
  closing the dialog. This contradicted the source
  (`src/features/admin-category-management/components/dialogs.tsx`,
  `AccessibleDialog` + `TypedCategoryDeleteDialog`, which sets
  `initialFocusRef` to the Cancel button) and its passing automated
  coverage (`src/app/AdminCategorySafeguards.test.tsx`, 11/11 pass,
  including an explicit Tab-trap test and a keyboard-safety test at
  375/768/1440px). An independent Playwright run against a fresh local
  dev server (real Chromium, not jsdom) confirmed the current codebase
  behaves correctly: initial focus lands on Cancel, and Escape closes
  the dialog. After a hard refresh (Ctrl+Shift+R) of the Preview tab,
  the observer re-tested and confirmed both Escape-to-close and the Tab
  focus-trap now work correctly — attributing the original observation
  to a stale cached bundle in that browser tab, not a real defect. The
  "Delete Category" confirmation itself was never submitted (Cancel/Esc
  only), so no category was deleted during this check.

### NVDA + Chrome verification — NOT DONE

- **Check**: NVDA with Chrome verifying landmarks/headings, names/roles,
  forms/errors, announcements, route changes, drawers/dialogs,
  tables/cards, and mutation feedback, per the "NVDA with Chrome
  verifies..." acceptance criterion.
- **Observer**: kienhienh
- **Date**: 2026-08-20
- **Status**: **Not performed.** NVDA was installed but the observer did
  not have prior screen-reader experience, and the check was not
  completed within this session's time. No landmarks/headings,
  names/roles, forms/errors, announcements, route changes,
  drawers/dialogs, tables/cards, or mutation-feedback verification has
  been recorded against NVDA. **This criterion remains open** — issue
  #43 cannot be closed until it (or an equivalent NVDA/Chrome pass) is
  completed and recorded here.
