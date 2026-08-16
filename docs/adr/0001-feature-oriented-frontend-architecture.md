---
status: accepted
---

# Use feature-oriented frontend modules behind a Cybersoft adapter

The frontend is organized as vertical feature modules with small public interfaces, while authentication is owned by a dedicated Session module and all Cybersoft transport terminology, response validation, and domain mapping remain behind an injected adapter seam. Feature controllers own server-state workflows through TanStack Query and expose canonical view models, normalized failures, and legal domain actions; this was chosen over a single application-wide `Marketplace` module and a broad generic repository because it provides stronger locality without introducing a monolith or enterprise-style abstraction overhead.

## Consequences

- Screens do not import Axios, browser storage, Cybersoft DTOs, or feature implementation files.
- Production HTTP adapters and deterministic test adapters satisfy feature-owned capability ports and are selected at the application composition root.
- Shared domain/application types are extracted only when at least two features share the same invariant; journey-specific models remain inside their feature.
- Import rules and tests through feature public interfaces enforce the seams during incremental migration from the legacy structure.
