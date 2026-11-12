# Testing

## Automated

| Command | What it runs |
|---|---|
| `npm test` | Vitest: unit + fast-check property tests for `/core`, export/import (jsdom), templates |
| `npm run e2e` | Playwright on Chromium, Firefox, WebKit, plus emulated iPhone 13 and Pixel 7 |
| `npm run smoke` | Export every template, open it over `file://` while offline |
| `npm run examples` | Same, and refreshes the files in `examples/` |
| `npm run check` | typecheck, schema doc + migration check, player size budget, unit tests |

The emulated phones check layout and touch, but they are **not real devices**. Safari on iOS and Chrome on
Android differ in file handling, fonts and viewport behaviour, so do the checklist below before shipping.

## Real-device checklist (manual)

Use `examples/haunted-house.html`.

- [ ] iPhone, Safari: AirDrop or save the file to Files, switch on airplane mode, open it from Files. Play the whole game. Rotate the phone.
- [ ] Android, Chrome: copy the file to the phone, switch on airplane mode, open it from the Files app. Play the whole game.
- [ ] iPad / tablet: same, then open the live editor and make a card with the Cards / Edit object tabs.
- [ ] Desktop Firefox and Safari: open the file by double-clicking (`file://`).
- [ ] Fonts look pixelated (Silkscreen buttons, VT323 text), not plain monospace.
- [ ] Haunted skin: flicker visible, ghost trail follows the finger or pointer.
- [ ] No text overlaps or is cut off on any card.

Record results (device, OS/browser version, pass/fail) here:

| Date | Device | OS / browser | Result |
|---|---|---|---|
| | | | |
