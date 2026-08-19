# BC93 Capstone — Fiverr Marketplace

React + TypeScript + Vite implementation of the Cybersoft Fiverr final project.
The source is organized by business feature so API transport, route behavior,
validation, responsive UI, and tests remain separated and maintainable.

## Main journeys

- Home marketplace and Service taxonomy
- Service discovery, search, filtering, sorting, and pagination
- Service detail and Comments
- Login, registration, Session, and exact `ADMIN` route protection
- Current User Profile and avatar upload
- Hire confirmation and Hired Services
- Administrator dashboard with User, Service, and Service Category management safeguards

## Source organization

```text
src/
  app/                 Application composition and runtime configuration
  features/            Business features and route behavior
  infrastructure/      Cybersoft, browser, and deterministic test adapters
  components/          UI shared across features
  pages/               Legacy route screens awaiting incremental migration
  test/                Shared Vitest/MSW test infrastructure
```

Complex features may use their own `components/` and `routes/` folders so one
route file does not grow into a multi-purpose module. See
`docs/code-organization.md` for the complete architecture rules.

## Requirements

- Node.js 22+
- npm

## Install and run

```bash
npm ci
npm run dev
```

## Quality gates

Before a pull request or final handoff, run:

```bash
npm run typecheck
npm run lint
npm run lint:architecture
npx vitest run --reporter=verbose --no-file-parallelism
npm run test:coverage
npm run build
```

## Runtime configuration

Production configuration is validated by `src/app/runtime-config.ts`.
Configure the environment values required by the Cybersoft adapter rather than
hard-coding API credentials into source files.

## Deployment and release

Repository-owned Vercel deployment configuration is `vercel.json`, validated
by `npm run check:deploy`. See `docs/deployment/vercel.md` for the full
configuration and environment variable reference, and
`docs/release/release-checklist.md` for what must be true before a
Production promotion.

## Project references

- `CONTEXT.md` — domain language and business terminology
- `swagger-API.json` — Cybersoft API contract reference
- `fiverr-wireframe.bmpr` — Balsamiq design source
- `docs/code-organization.md` — architecture and clean-code rules
- `docs/adr/` — architecture decision records
- `docs/refactoring/clean-code-reorganization.md` — latest organization pass
- `docs/deployment/vercel.md` — Vercel deployment configuration
- `docs/release/release-checklist.md` — release evidence checklist
- `23-09-2025-02-37-39-[cybersoft]-du-an-cuoi-khoa-bcfe.pdf` — final-project criteria
