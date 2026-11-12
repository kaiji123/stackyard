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

Three templates are built in: **Haunted House Escape Room**, **Choose-your-path Ghost Story** and
**Tutorial: How to Carve a Pumpkin**. Open exported examples directly (no server, no internet needed):

- [`examples/haunted-house.html`](examples/haunted-house.html)
- [`examples/ghost-story.html`](examples/ghost-story.html)
- [`examples/pumpkin-tutorial.html`](examples/pumpkin-tutorial.html)

## Features

- Cards with a thumbnail strip: add, rename, duplicate, delete, reorder
- Text, image and button objects on an 800×600 canvas that scales to any screen; drag, resize, z-order, undo/redo
- No-code actions from dropdowns: go to card / next / previous / back, show / hide, set flag, add item, **if flag/item then … else …**
- Play mode, a **stack map** of cards and links, and a **stack doctor** that flags unreachable cards, dead buttons,
  flags nothing sets, and **text that overlaps other text**
- Autosave in the browser (IndexedDB); export to and import from one HTML file
- Retro pixel look with embedded OFL fonts and an optional **haunted skin** (flicker, ghost trail)
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
templates    the three template stacks (JSON)
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
the app and in exported files. Runtime code has no third-party dependencies in the player; development uses
TypeScript, Vite, Vitest, fast-check, jsdom and Playwright.
