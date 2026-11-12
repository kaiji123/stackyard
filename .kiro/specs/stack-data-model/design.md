# Design: stack data model

- `src/core/types.ts`: readonly types. Array order of `card.objects` is z-order.
- Ids are strings. `ids.ts` allocates `c1`, `o1`, ... deterministically from the used set (pure).
- Object ids are unique across the whole stack, so show/hide need no card qualifier.
- `validate.ts`: hand-written structural validator over `unknown` (no `any`, no dependencies).
  Dangling action targets are not validation errors; `graph.dangling()` reports them (doctor).
- `commands.ts`: `applyCommand(stack, cmd) -> stack`, total and pure. Delete commands rewrite
  actions so nothing dangles. `History` stores structural-sharing snapshots (`past/present/future`),
  which makes undo an exact inverse by construction.
- `migrate.ts`: `MIGRATIONS[from]` upgrades N to N+1. `migrate(doc, table?, target?)` is injectable for tests.
- `layout.ts`: `clampRect` and `fitScale` for the fixed 800x600 logical canvas.

## Decision: snapshots instead of inverse commands
Inverse commands need per-command bookkeeping and can drift. Snapshots share structure, so cost is
small for card-sized documents, and property 4 holds trivially. Revisit if stacks get very large.
