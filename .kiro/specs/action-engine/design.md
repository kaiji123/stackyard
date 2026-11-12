# Design: action engine

- `PlayState` = `{card, flags, items, visibility, history}`, plain JSON, so the player can persist it.
- `runActions(stack, state, actions) -> state`; `click(stack, state, objectId)`. No loops exist in the
  action language, so termination is structural.
- History is capped at `MAX_HISTORY` (100).
- `graph.edges()` simulates a click over a *set* of possible positions, so `prev, prev` is two steps and
  `if` unions both branches. Intermediate cards are not edges (the player never rests there).
- `back` is dynamic; static analysis treats it as "stay". Tests compare play and graph without `back`.

## Findings from property tests
- The first graph model computed `prev`/`next` relative to the owning card, which was wrong for chained
  moves. Fixed by the sequential model above (see `tests/core/regressions.test.ts`).
