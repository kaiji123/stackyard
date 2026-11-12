# Requirements: action engine

Actions are plain JSON interpreted by `src/core/engine.ts`. They are never compiled to code.

## R1 Action set
THE SYSTEM SHALL support: `goto`, `next`, `prev`, `back`, `show`, `hide`, `setFlag`, `addItem`, and `if` (condition on a flag or an item, `then`/`else` lists of simple actions, one level of nesting).

## R2 Execution
1. WHEN an object is clicked and visible THE SYSTEM SHALL run its actions in order.
2. WHEN `goto` names a missing card THE SYSTEM SHALL ignore it.
3. WHEN `next`/`prev` is at the end/start of the stack THE SYSTEM SHALL stay on the card.
4. WHEN `back` is run and history is empty THE SYSTEM SHALL stay on the card.
5. WHEN `show`/`hide` runs THE SYSTEM SHALL override the object's initial visibility for the rest of play.
6. WHEN an `if` runs THE SYSTEM SHALL evaluate its condition against the current flags/items and run exactly one branch.
7. THE SYSTEM SHALL never throw, never loop forever, and never mutate the stack or the previous state.

## R3 Graph analysis
1. THE SYSTEM SHALL compute card-to-card edges by following each click's actions in order, exploring both branches of an `if`.
2. THE SYSTEM SHALL report cards unreachable from `start`.
3. THE SYSTEM SHALL report every goto/show/hide whose target does not exist.

## Properties
- P5 a random walk of clicks never throws or lands on a missing card.
- P7 every card play can reach is statically reachable; with no conditions or hiding the two sets are equal.
