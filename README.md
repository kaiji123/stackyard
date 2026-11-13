![Stackyard: pixel-art banner](media/gifs/stackyard-banner.gif)

# Stackyard

**Stack index cards. Link them. Share one file that runs forever.**

Stackyard is a no-code card-stack maker. Put text, pictures and buttons on index cards, link the cards
together with dropdown actions, and export the result as **one self-contained HTML file** that runs offline in any
browser. The exported file is also the save file: import it back to keep editing.

Stackyard is inspired by the 1987 card-stack tools like HyperCard. Those tools died of platform lock-in;
Stackyard's answer is a single HTML file you own. It is not affiliated with or endorsed by Apple.

> Built for Kiroween 2026, category **Resurrection**: bringing a dead technology back with modern tools.

## What you can make

- **Teachers:** interactive lessons and quizzes.
- **Kids:** first games and stories.
- **Escape-room and puzzle makers:** flags and an inventory, no code.

Five example stacks are built in, and **▦ Stacks** in the toolbar plays any of them full screen without touching
your own work (or makes an editable copy):

- **Wiki: The Halloween Bestiary** (24 cards): a field guide to 17 Halloween creatures in four chapters (Spirits,
  The Undead, Magic Folk, Real Animals) with an A-to-Z index. Every article has a portrait, a summary, a fact box,
  "see also" links and next/back navigation: a wiki built from cards and links, with no code.
- **The Midnight Train** (17 cards): on Halloween a ghost train calls at Platform 13. Help Mortimer the conductor,
  Mrs. Pell, Pip and Biscuit the dog, trade your way to a ticket, and get home before the last stop. All of its
  art, including the animated steam and the moving view from the window, was drawn for it in code.
- **Haunted House Escape Room** (16 cards): a dare, a locked house and the story of Eleanor Ashby, told through a
  portrait, her diary, a torn note and the graves. Four locks (light, note, key, the ghost) and two ways out.
- **Choose-your-path Ghost Story** (16 cards): Eleanor's side of the story. A warning, a letter and her past;
  five endings, decided by whether you carry a light and keep your promise.
- **Tutorial: How to Carve a Pumpkin** (16 cards): Jack the pumpkin's Halloween, in eight illustrated steps, a
  four-question quiz with results, and a certificate.

 Open exported examples directly (no server, no internet needed):

- [`examples/haunted-house.html`](examples/haunted-house.html)
- [`examples/ghost-story.html`](examples/ghost-story.html)
- [`examples/pumpkin-tutorial.html`](examples/pumpkin-tutorial.html)
- [`examples/midnight-train.html`](examples/midnight-train.html)
- [`examples/bestiary.html`](examples/bestiary.html)

## Features

- Cards with a thumbnail strip: add, rename, duplicate, delete, reorder
- Text, image and button objects on an 800×600 canvas that scales to any screen; drag, resize, z-order, undo/redo
- No-code actions from dropdowns: go to card / next / previous / back, show / hide, set flag, add item, **if flag/item then … else …**
- Play mode, a **stack map** of cards and links, and a **stack doctor** that flags unreachable cards, dead buttons,
  flags nothing sets, and **text that overlaps other text**
- **Draw your own pictures** right on the card: sprites (16×16, 32×32) or a whole background, traced over the card,
  with pen, eraser, fill, line, box, colour picker, brush sizes, mirror, and the app's own palette. Works with a
  mouse, a finger or the keyboard. "Edit drawing" reopens a drawing, or any pixel art, to touch it up
- **Animate**: add frames to a drawing (with onion skin, speed and a live preview) to make an animated GIF that
  plays everywhere; or give any object a **movement** from a list (float, bob, wiggle, pulse, swing, spin,
  flicker). Movement switches off for people who prefer reduced motion
- Autosave in the browser (IndexedDB); export to and import from one HTML file
- Retro pixel look with embedded OFL fonts and an optional **haunted skin** (flicker, ghost trail)
- Pictures stay crisp: small PNG/GIF uploads are kept byte-for-byte (animated GIFs keep animating), pixel art is drawn
  with hard edges, and text can sit on a dark panel so it stays readable on any picture
- Works on phones and tablets (Cards / Edit object tabs)

## Run it

Needs Node 20+.

```sh
npm install
npm run dev          # editor at http://localhost:5173
```

Other commands:

```sh
npm test             # unit + property-based tests (fast-check)
npm run e2e          # Playwright: Chromium, Firefox, WebKit, emulated iPhone and Pixel
npm run check        # typecheck, schema/migration check, player size budget, tests
npm run build        # production editor build in dist/ (deployable to GitHub Pages)
npx playwright install chromium firefox webkit   # once, before npm run e2e
```

## How it is built

```
src/core     pure TypeScript, no DOM: model, validation, commands + undo, action engine, graph, doctor, migrations
src/player   tiny runtime (~3 KB gzip) that renders a stack; shared by play mode and exported files
src/export   single-file HTML builder + importer
src/editor   editor UI (vanilla TypeScript, no framework)
templates    the three template stacks (JSON, generated by scripts/make-templates.mjs from media/)
media        original pixel art (backgrounds, sprites, pumpkin steps, GIFs), same MIT license
tests        Vitest + fast-check, Playwright e2e
.kiro        specs, hooks, steering, MCP config
```

- Actions are plain JSON interpreted by the engine. There is no scripting language, no `eval`, no `innerHTML`.
- Exported files use a strict CSP (`default-src 'none'`, script allowed only by its sha256), make no network
  requests, and use no module imports.
- Stack documents are versioned; schema changes bump `schemaVersion` and add a migration
  ([`docs/schema.md`](docs/schema.md)).
- Property-based tests cover export round trips, script injection, referential integrity, undo, migrations,
  graph-vs-play agreement and layout. See [`docs/TESTING.md`](docs/TESTING.md).

## Built with Kiro

Specs for the data model, action engine, editor, export and map/doctor live in [`.kiro/specs`](.kiro/specs);
hooks in [`.kiro/hooks`](.kiro/hooks); steering in [`.kiro/steering`](.kiro/steering). The running log of what Kiro did,
including bugs found by property tests, is [`KIRO_LOG.md`](KIRO_LOG.md). The plan is [`PLAN.md`](PLAN.md).

## License

[MIT](LICENSE). The fonts Silkscreen and VT323 are licensed under the SIL Open Font License 1.1 and are embedded in
the app and in exported files. The pixel art in `media/` was drawn from code for this project (see
[`media/README.md`](media/README.md)). Runtime code has no third-party dependencies in the player; development uses
TypeScript, Vite, Vitest, fast-check, jsdom and Playwright.
