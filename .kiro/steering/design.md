---
inclusion: fileMatch
fileMatchPattern: ["src/editor/**", "src/player/**", "templates/**", "scripts/make-templates.mjs"]
---
# Design rules

- Retro pixel look, our own: Silkscreen for chrome and buttons, VT323 for body text (both OFL, embedded as
  data URIs; never load fonts from a network). No Apple trade dress.
- **Text must never overlap other text.** The doctor reports text boxes that can be visible together and
  overlap; the editor outlines them in red. Templates are held to a stricter rule in `tests/templates.test.ts`:
  no two text boxes overlap at all, so every card is clean in the edit view too. Text must also fit its box
  (the editor outlines cut-off text in orange).
- Phones are first-class: below 900px the editor is one column with Cards / Edit object tabs. Tap targets
  stay at least 36px on touch devices.
- Respect `prefers-reduced-motion`: the haunted flicker and ghost trail switch off.
- Every control has an accessible name; dialogs use `<dialog>`.
- The product name in UI is "Stackyard". Never put the old tools' trademarked names in UI strings.
