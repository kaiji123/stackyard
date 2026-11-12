# Design: stack map and doctor

- `core/graph.ts`: `edges` simulates a click over a SET of possible positions, so `prev, prev` moves two cards; intermediate cards are not edges. `reachable` is BFS. `dangling` finds missing goto/show/hide targets.
- `core/overlap.ts`: `staticTextOverlaps` (any two intersecting text boxes) and `liveTextOverlaps` (BFS over real play states, seeded from every card so unlinked cards are checked; capped at 3000 states).
- `core/doctor.ts`: `diagnose(stack)` returns `Issue[]` (severity, code, message, card, object). Pure.
- `editor/map.ts`: SVG, text via `textContent`. `editor/inspector.ts` lists issues.

## Findings from property tests
- Relative moves must be applied in order (see action-engine).
- Overlap detection first seeded only the start card, so overlaps on cards still being built were missed. It now seeds every card.
- Our own Haunted House template had overlapping messages in the Study; the check found it and the template was fixed.
