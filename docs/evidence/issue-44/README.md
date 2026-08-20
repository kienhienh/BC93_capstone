# Issue #44 Production promotion evidence

Evidence for promoting the approved release candidate to Vercel
Production and verifying it without mutating live application data.

## Status summary

Production is live and the approved capstone-scope checks passed. The
repository owner explicitly accepted one release-process deviation: a
known-good immutable rollback target was not recorded before the current
Production deployment. This document does not relabel that deviation as a
retrospective pass or weaken the rollback requirement for future releases.

| # | Acceptance criterion | Status |
|---|---|---|
| 1 | Approved source commit and prerequisite evidence | **PASS** |
| 2 | Rollback target recorded before promotion | **PROCESS DEVIATION / EXCEPTION ACCEPTED** — not retrospectively PASS |
| 3 | Configured Vercel promotion workflow | **PASS** |
| 4 | Production static assets and canonical deep links | **PASS** |
| 5 | Manual read-only Production smoke | **PASS** |
| 6 | Production release metadata and rollback record | **Done for the approved capstone scope** — verified release metadata is recorded; rollback timing/metadata limitation is covered by the explicit exception |
| 7 | Rollback execution policy | **PASS / NOT INVOKED** |

Issue #44 is ready for owner review and closure under the linked capstone
exception. The original rollback acceptance criterion remains unsatisfied
historically.

## Production deployment

- **Environment**: Production
- **Status**: Ready / Current
- **Stable public Production URL**:
  https://bc-93-capstone-28rk.vercel.app/
- **Deployment-specific URL**:
  https://bc-93-capstone-28rk-8bgt4p9yh-kienhienh-7980s-projects.vercel.app/
  (Vercel Authentication protects the deployment-specific URL; the stable
  Production domain above was verified publicly without a Vercel session.)
- **Vercel dashboard deployment**:
  https://vercel.com/kienhienh-7980s-projects/bc-93-capstone-28rk/6nNRWdottPeuVLETSPmoZ2gGwG56
- **Deployment identifier shown by Vercel**:
  `6nNRWdottPeuVLETSPmoZ2gGwG56`
- **Source branch**: `develop`
- **Source commit**:
  `cbf6ee76319edabbe75295b567a618e1bba5a487`
- **Commit subject**:
  `Merge pull request #106 from kienhienh/issue-43-manual-verification-evidence`
- **Deployment creator**: `kienhienh`
- **Deployment created at**:
  `2026-08-20T16:31:51+07:00`
- **UTC equivalent**: `2026-08-20T09:31:51Z`
- **Timestamp source**: Vercel Deployment Details

## Production workflow verification

Vercel Environments shows that the Production environment tracks
`develop`, the Preview environment tracks all unassigned Git branches,
and the project is connected to `kienhienh/BC93_capstone` through the
GitHub integration.

- **Production Branch Tracking**: `develop`
- **Connected Git repository**: `kienhienh/BC93_capstone`
- **Git provider**: GitHub
- **Mechanism**: automatic Git-triggered Production deployment
- **Trigger**: PR
  [#106](https://github.com/kienhienh/BC93_capstone/pull/106) was merged
  into the configured Production branch
- **Git merge timestamp**: `2026-08-20T09:31:48Z`
  (`2026-08-20T16:31:48+07:00`)
- **Vercel deployment timestamp**: `2026-08-20T09:31:51Z`
- **Separate manual promoter**: Not applicable
- **Deployment creator shown by Vercel**: `kienhienh`
- **Protected controls bypassed**: No bypass was reported or used

The Production deployment was created three seconds after the approved
PR was merged into `develop`, corroborating the configured automatic Git
deployment mechanism.

## Prerequisite release evidence

- [Issue #42](https://github.com/kienhienh/BC93_capstone/issues/42) —
  controlled live smoke: closed/completed.
- [Issue #43](https://github.com/kienhienh/BC93_capstone/issues/43) —
  manual browser, physical-device, keyboard, zoom/reflow, text-spacing,
  target-size, reduced-motion, and approved accessibility-scope evidence:
  closed/completed.
- [PR #106](https://github.com/kienhienh/BC93_capstone/pull/106) — merged
  the issue #43 evidence into the exact Production source commit.
- CI, Playwright, and Vercel checks associated with the approved change
  passed before the Production evidence was finalized.

Issue #43 records Microsoft Edge 151.0.4129.93 on desktop and Safari on
a physical iPhone XR running iOS 17.4.1. Firefox/Gecko and NVDA were
explicitly waived for the capstone report, so this release does not claim
complete cross-browser compatibility, screen-reader conformance, or full
WCAG conformance. The recorded 414 x 896 CSS-pixel iPhone XR viewport is
the nominal portrait device viewport; a live Safari layout viewport was
not independently measured.

## Manual Production smoke

- **Observer**: `kienhienh`
- **Browser**: Microsoft Edge 151.0.4129.93, Official Build, 64-bit
- **Date**: 2026-08-20
- **Mode**: read-only; no Production mutation was performed

| Check | Direct URL | Result | Observation |
|---|---|---|---|
| Home | `https://bc-93-capstone-28rk.vercel.app/` | **PASS** | Header, page content, and footer rendered without a blocking application error. |
| Service Discovery | `https://bc-93-capstone-28rk.vercel.app/services` | **PASS** | Public service browsing rendered without a blocking route error. |
| Service Detail | `https://bc-93-capstone-28rk.vercel.app/services/1` | **PASS** | A valid Service rendered through the canonical dynamic route. |
| Login | `https://bc-93-capstone-28rk.vercel.app/login` | **PASS** | The Login form rendered without recording credentials in evidence. |
| Profile guard | `https://bc-93-capstone-28rk.vercel.app/profile` | **PASS** | A Visitor was redirected to `/login?returnTo=%2Fprofile`; protected Profile data did not render. |

Service ID `1` was valid when observed. This evidence preserves the
actual representative ID tested and does not claim that the live record
will exist permanently.

No Comment creation, Hire action, Profile update, Administrator CRUD,
deletion, credential disclosure, or other live Production mutation was
performed.

## Canonical deep links and static assets

Direct requests to `/`, `/services`, `/login`, and `/profile` returned
HTTP 200 from the stable public Production domain without redirecting to
Vercel Authentication. The manual browser session also opened
`/services/1` directly and verified the client-side Profile guard.

Read-only HTTP verification recorded HTTP 200 for every representative
application and CDN asset referenced by the Production document:

| Asset | Type | HTTP status |
|---|---|---:|
| `/assets/index-B2gWbqZe.js` | Application JavaScript | 200 |
| `/assets/QueryClientProvider-DdfO9GlR.js` | Application JavaScript | 200 |
| `/assets/useQuery-mdCampVC.js` | Application JavaScript | 200 |
| `/assets/index-CoL31fLT.css` | Application CSS | 200 |
| Bootstrap 5.3.8 CSS | CDN CSS | 200 |
| Bootstrap 5.3.8 bundle | CDN JavaScript | 200 |
| Bootstrap Icons 1.11.3 | CDN CSS | 200 |

No tested application JavaScript or stylesheet returned HTTP 404.

## Rollback process deviation

A known-good immutable rollback target was not recorded before the
current Production deployment. Identifying a candidate afterward cannot
retroactively satisfy that sequencing requirement.

- **Decision**:
  `PROCESS DEVIATION / EXCEPTION ACCEPTED — NOT RETROSPECTIVELY PASS`
- **Approver**: `kienhienh` — repository owner/admin
- **GitHub-recorded approval timestamp**:
  `2026-08-20T10:24:19Z` (`2026-08-20T17:24:19+07:00`)
- **Approval record**:
  https://github.com/kienhienh/BC93_capstone/issues/44#issuecomment-5354618973
- **Scope**: capstone-report release evidence only

The exception does not redefine the normal release process. Every future
Production promotion must record and verify the currently-live immutable
Production deployment before promoting a new candidate.

### Operational rollback candidate identified after promotion

A previous Production entry immediately preceding the current `cbf6ee7`
release remains visible in Vercel as `Redeploy of GMSXGYhnG`.

- **Environment**: Production
- **Visible Vercel reference**: `Redeploy of GMSXGYhnG`
- **Timing**: identified after the current Production deployment
- **Purpose**: operational rollback candidate only
- **Exact deployment ID, immutable URL, and source commit**: not captured
- **Treatment**: incomplete retrospective metadata; no value was inferred
  or fabricated

This candidate does not convert the original rollback acceptance
criterion to PASS.

### Known-good baseline for the next release

The current verified Production deployment is the baseline that must be
recorded before the next Production promotion:

- **Deployment identifier**: `6nNRWdottPeuVLETSPmoZ2gGwG56`
- **Deployment-specific URL**:
  https://bc-93-capstone-28rk-8bgt4p9yh-kienhienh-7980s-projects.vercel.app/
- **Stable Production URL**:
  https://bc-93-capstone-28rk.vercel.app/
- **Source commit**:
  `cbf6ee76319edabbe75295b567a618e1bba5a487`
- **Verification**: read-only smoke, canonical deep links, and static
  assets passed

## Rollback execution policy

Rollback was not required during this verification. If it becomes
necessary:

1. record the failed Production deployment and reason;
2. record the exact rollback deployment ID, immutable URL, and source
   commit;
3. restore and verify the selected known-good deployment;
4. create or follow a code correction;
5. do not treat rollback itself as the permanent fix.

## Release decision

Production promotion and read-only verification passed for the approved
capstone scope. The rollback-before-promotion criterion remains an
explicit, owner-approved process exception rather than a PASS.
