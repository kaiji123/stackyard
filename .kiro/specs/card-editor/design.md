# Design: card editor

- Vanilla TS, no framework. `h()`/`s()` in `dom.ts` build elements; strings only become text nodes or attributes (never parsed as markup).
- `app.ts` owns state (`History`, selected card/object, mode) and gives the UI modules a small `Ctx` (`ctx.ts`): `dispatch(cmd)`, `batch(cmds)`, selection, mode. All edits go through core commands, so undo/redo and invariants come from `/core`.
- `stage.ts`: objects are drawn by the player's `renderObject`, so the editor and the player cannot drift. Drag/resize use window-level pointer listeners and write the DOM directly during the gesture, then dispatch one `updateObject` on release. `scale` is module-level so a gesture survives re-renders; a new stage starts at the last scale to avoid a flash.
- Text warnings: overlap from `core/overlap.liveTextOverlaps` (pure, explores real clicks); cut-off from `scrollHeight > clientHeight`, re-checked after `document.fonts.ready`.
- Phones: CSS grid with `data-tab` switching between the strip and the inspector; selecting an object jumps to the inspector tab.
- Autosave: debounced 500 ms to IndexedDB; save state is shown separately from action messages.

## Decision: re-render everything on change
Stacks are small, and a full re-render keeps state and DOM in sync with no diffing code. Inputs commit on `change`, so re-rendering never steals focus mid-typing.
