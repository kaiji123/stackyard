---
inclusion: always
---
# Project structure

```
src/core     pure TS, no DOM: types, validation, ids, commands (undo), engine, graph, doctor, migrations
src/editor   editor UI (vanilla TS)
src/player   tiny runtime that renders a stack and runs actions via src/core/engine
src/export   single-file HTML builder + importer
templates    JSON stacks for the 3 templates
tests        Vitest unit + fast-check property tests (tests/core mirrors src/core)
.kiro        specs, hooks, steering (committed; never gitignore)
```

Rules:
- `src/core` must not reference `window`, `document`, or any DOM type. It is imported by both the
  editor and the player so play mode and exported files behave identically.
- `src/player` may import only from `src/core`.
- Shared fast-check generators live in `tests/arbitraries.ts`.
