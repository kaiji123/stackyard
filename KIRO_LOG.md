# Kiro log

Running notes for the Kiro write-up. Add screenshots under `docs/kiro/`.

## Nov 12
- Steering already in `.kiro/steering/` (product, tech, structure, testing). Plan saved as `PLAN.md`.
- Scaffolded TypeScript strict + Vitest + fast-check, MIT license.
- Specs written for `stack-data-model` and `action-engine`; `/core` implemented from them.
- Hook: "Core property tests on save".

### Bugs found by property-based testing
1. **addCard did not clamp nested objects** (property 8). Shrunk to an empty stack plus one
   `addCard` with an object at x=620, w=200. Fix: clamp in `addCard`. Regression test added.
2. **Static graph mis-modelled chained moves** (property 7). Counterexample: one click with `prev, prev`
   on c5 produced edge c5->c4, but play rests on c3. Fix: simulate actions in order over a set of
   positions. Regression test added.
3. Test-side mistakes also surfaced (no-op commands and undo; transient cards), which sharpened the
   spec wording ("rests on", no-op returns the same reference).

### Specs vs vibe coding
- Specs for `/core`: requirements became properties almost 1:1.

## Nov 12 (later): player + export
- Player is ~3 KB gzipped (budget 30 KB). Export uses a strict CSP with the player's sha256.
- PBT bug 4: a stack title containing U+0000 came back from the exported HTML as U+FFFD in `<title>`
  (HTML parsers rewrite NUL). Stack data was safe (JSON-escaped); fix strips control chars from `<title>` only.

## Nov 12 (evening): editor + e2e
- Editor built (vanilla TS), run with `npm run dev` -> http://localhost:5173.
- Playwright found: stage flashed unscaled on every re-render (fixed), autosave status overwrote
  the "Imported" message (fixed). Offline `file://` export plays the whole escape room with 0 requests.
- Playwright run through its test runner; MCP-driven version still to try.
