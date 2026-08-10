# Domain Docs

How engineering skills should consume this repository's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repository root.
- `docs/adr/` for decisions that touch the area about to be changed.

If one of these locations does not exist, proceed silently. Domain-modeling skills create documents lazily when terms or decisions are resolved.

## File structure

This is a single-context repository:

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept, use the term defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If a needed concept is absent, reconsider whether it belongs to the domain or note the gap for `/domain-modeling`.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly instead of silently overriding it.
