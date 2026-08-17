# Clean-code reorganization

This pass reorganizes existing code without changing the intended business behavior.
It follows the final-project clean-code criteria: clear folders, small focused functions,
removal of unused code, and separation of long files into independent modules.

## Changes

- Split `features/admin-user-management/routes.tsx` into focused route, component,
  form-model, safeguard, and route-utility modules.
- Extract the Administrator account dropdown from the shared Header into
  `components/AdminAccountMenu.tsx`.
- Extract Service Detail comment submission UI into
  `features/service-detail/components/comment-form.tsx`.
- Remove unused template/legacy-only files that had no imports or runtime references:
  `FreelancerProfile.tsx`, `HeroBanner.tsx`, unused React/Vite/hero SVG/PNG assets,
  `public/icons.svg`, and the empty `tmp/` directory.
- Keep active legacy routes (`/jobs`, `/checkout`, `/orders`) until their migration is
  covered by acceptance tests.
- Keep all tests for code that remains active.

## Verification

Run the normal full gate after installing dependencies:

```bash
npm ci
npm run typecheck
npm run lint
npm run lint:architecture
npx vitest run --reporter=verbose --no-file-parallelism
npm run test:coverage
npm run build
```
