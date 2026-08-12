# Issue 19 baseline record

Recorded on 2026-08-12 before the Service preview migration.

## Verification

- `npm run build`: passed.
- `npm run lint`: passed.
- Current branch: `develop`.
- The reverted Hire implementation is absent at `e6637c7` and was not used as a baseline.

## Preserved owner work

- `CONTEXT.md`: tracked domain-language additions.
- `src/services/api.ts`: tracked byte-order-mark-only delta before migration.
- `docs/adr/0001-feature-oriented-frontend-architecture.md`: untracked accepted architecture decision.
- `docs/research/user-role-model.md`: untracked API/domain research.
- `fiverr-wireframe.bmpr`: untracked design artifact.
- `swagger-API.json`: untracked captured API contract.

These artifacts were kept in place. Issue 19 implementation does not replace or discard their content.

## Runtime configuration

Production startup requires `VITE_API_BASE_URL` and `VITE_CYBERSOFT_TOKEN`. Copy
`.env.example` to a Git-ignored local environment file and replace the placeholder token.
Vite client configuration is visible to browser users; the Cybersoft project token is not a
User session credential and no real value is committed.
