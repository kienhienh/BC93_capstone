# Code organization and delivery workflow

This repository follows the final-project criteria in
`23-09-2025-02-37-39-[cybersoft]-du-an-cuoi-khoa-bcfe.pdf` and the accepted
feature-oriented architecture in `docs/adr/0001-feature-oriented-frontend-architecture.md`.

## Source layout

```text
src/
  app/                 Application composition and runtime configuration
  features/            Vertical business modules
    <feature>/
      capability.ts    Feature-owned interface and domain view models
      context.ts        React access to the injected capability
      controller.ts     Server-state workflow
      provider.tsx      Capability provider
      screen-model.ts   Pure presentation and URL-state rules
      view.tsx          Feature-owned reusable UI
      routes.tsx        Route orchestration
      public.ts         Interface available to screens and other features
      wiring.ts         Interface available to the composition root
  infrastructure/      Cybersoft, browser, and deterministic test adapters
  components/          UI shared by at least two features
  pages/               Legacy route screens awaiting feature migration
  test/                Cross-feature test harness and deterministic server
```

Keep journey-specific code in its feature. Move code to `components/` or a
shared type only after two features use the same invariant. Screens import a
feature through `public.ts`; application composition imports through
`wiring.ts`. Cybersoft DTOs and transport details stay in `infrastructure/`.

## Clean-code rules

- Use camelCase for variables and functions, PascalCase for React components,
  classes, and exported model types, and kebab-case for feature folders.
- Give each function one observable responsibility. Extract pure rules from
  route JSX into `screen-model.ts` when they can be tested through routed
  behavior.
- Prefer a small feature interface with behavior hidden behind it. Do not add
  pass-through repositories or generic abstractions without a production and
  test adapter.
- Delete unused variables, parameters, imports, comments, and obsolete code.
  Do not keep commented-out code; Git preserves history.
- Explain only non-obvious business decisions. Avoid comments that repeat the
  code.
- Keep API validation and DTO-to-domain mapping at the infrastructure adapter.
- Keep URL state canonical for shareable screens. The URL owns filters, sort,
  and pagination when Back, Forward, or refresh must restore the view.
- Keep responsive styles with the owning feature when they are not shared.

## Task and GitHub workflow

GitHub Issues is the source of truth for task ownership and acceptance
criteria.

1. Start from an assigned issue with explicit acceptance criteria and design
   references.
2. Create a branch named `issue-<number>-<short-name>` from the current
   integration branch.
3. Implement one coherent feature slice. Keep unrelated user changes out of
   the commit.
4. Add deterministic tests at the same interface used by callers. Cover API
   mapping separately at the adapter seam.
5. Run all required gates:

   ```powershell
   npm.cmd run typecheck
   npm.cmd run lint
   npm.cmd run lint:architecture
   npm.cmd test
   npm.cmd run test:coverage
   npm.cmd run build
   git diff --check
   ```

6. Mark an acceptance criterion complete only after its implementation and
   verification pass.
7. Open a pull request linked with `Closes #<issue>` and include responsive
   evidence for 375 px, 768 px, and 1440 px when UI changes.

## Final-project delivery checklist

- Wireframes or Figma cover all required business screens.
- Color, typography, layout, validation, search, and interaction states are
  consistent with the approved design.
- The application works at phone, tablet, and desktop breakpoints.
- Required Fiverr workflows use the documented Cybersoft endpoints.
- GitHub contains source code, issue/task history, and reviewed pull requests.
- The production deployment URL and a recorded demo URL are attached to the
  project handoff.
- Optional extensions remain aligned with the marketplace domain and pass the
  same quality gates as required functionality.

## Incremental migration policy

`src/pages/` and `src/services/api.ts` contain legacy flows. Migrate them one
business journey at a time into `src/features/`; do not perform a repository-
wide move without acceptance tests. A migrated route must no longer import the
legacy transport module, and obsolete files should be deleted only after no
route or test references them.
