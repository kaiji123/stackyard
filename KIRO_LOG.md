# Kiro log

What Kiro did on this project, kept honest and current. Screenshots live in `docs/kiro/` (add as you go).
Run the manual "Update write-up" hook to refresh it.

## Kiro features used

| Feature | How it is used here |
|---|---|
| **Steering** | `.kiro/steering/`: `product` (vision, non-goals, trademark rules), `tech` (strict TS, no eval/innerHTML, size budget, CSP), `structure` (core stays pure), `testing` (every core change gets a property test; seeds printed, never hard-coded), `design` (pixel fonts, no overlapping text, phones, reduced motion). `testing` and `design` load only for matching files. |
| **Specs** | `.kiro/specs/`: `stack-data-model`, `action-engine`, `card-editor`, `html-export-import`, `stack-map-and-doctor`, each with requirements (EARS), design and tasks. |
| **Hooks** | `.kiro/hooks/`: core property tests on save; schema change needs a migration (regenerates `docs/schema.md`); player 30 KB budget; templates validated on save; manual export smoke test; manual write-up update. |
| **MCP** | `.kiro/settings/mcp.json` configures the Playwright MCP server (pinned version). Configured, not yet used for a recorded session; add a note here when it is. |
| **Property-based testing** | fast-check + Vitest, shared generators in `tests/arbitraries.ts`. |

## Specs vs vibe coding

- **Specs** for `/core`, export and the doctor: each EARS sentence became a property or an e2e assertion
  almost one-to-one (for example "WHEN the user deletes a card THE SYSTEM SHALL remove every action that
  targets it" became the referential-integrity property).
- **Vibe coding** for UI polish, the haunted skin, copy and template content: quick to iterate, and then
  locked in with e2e tests and the template tests afterwards.

## Bugs found by tests (with what they taught)

1. **`addCard` did not clamp nested objects** (property 8). Shrunk to an empty stack plus one `addCard`
   with an object at x=620, w=200. Fixed in `addCard`; regression test added.
2. **Static graph mis-modelled chained moves** (property 7). One click with `prev, prev` on c5 produced the
   edge c5→c4 while play rests on c3. Fixed by simulating actions in order over a set of positions.
3. **NUL in a stack title** came back as U+FFFD in the exported `<title>` (HTML parsers rewrite NUL). Stack
   data was safe (JSON-escaped); fixed by stripping control characters from `<title>` only.
4. **`window.matchMedia` missing in jsdom**: the player crashed. Fixed with a feature check; the player must not
   assume browser APIs.
5. **Overlapping text in our own Haunted House template.** The new text-overlap check found "Too dark to see
   anything." and "You found a rusty key!" at the same position, both showable in one play-through. Fixed the
   template (separate positions, and the dark message is hidden once the key is found).
6. **Overlap check missed unlinked cards** (it only started from the start card). Authors need the warning while
   building a card, so it now explores from every card.
7. Playwright found two UX bugs: the canvas flashed unscaled on every re-render, and the autosave status
   overwrote the "Imported…" message. Both fixed.
8. Test-side mistakes that sharpened the specs: undo of a no-op command, transient cards during a multi-step
   click ("rests on"), and "alternative" texts that really can be shown together.

## Timeline

- **Nov 12:** steering, scaffold, `/core` with properties 3, 4, 6, 8; player + export with properties 1, 2, 5, 7;
  editor, templates, stack map, doctor; Playwright e2e on Chromium.
- **Nov 12 (later):** schema v2 (haunted skin) with a real v1→v2 migration; OFL fonts embedded in editor and exports;
  About dialog with the MIT license; quick start and empty states; phone layout; Firefox and WebKit plus emulated
  iPhone 13 and Pixel 7 runs; all hooks, specs 3–5; text-overlap and cut-off checks; README and Pages workflow.

## Not done yet

- Real-device runs (iOS Safari, Android Chrome); see `docs/TESTING.md`.
- Link mode on the map, drag-to-reorder cards, sound action, "no winning path" doctor rule.
- Screenshots for the write-up; one recorded Playwright MCP session.
- Demo video, Devpost text, blog post.
