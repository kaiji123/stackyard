# Stackyard: Kiroween 2026 Plan

*Stack: TypeScript + Vite, no framework for the player. Built in Kiro. Deadline: **Fri Dec 4, 2026, 2:00 PM Pacific** (10:00 PM GMT). Kiro credit requests close **Dec 1, 12:00 PM PT**. Written Nov 12, about 22 days left.*

Stackyard is inspired by the 1987 card-stack tools like HyperCard. It is not affiliated with or endorsed by Apple.

## Verdict on the idea

A very strong fit for the **Resurrection** category: a card-stack authoring tool is the textbook dead technology. The story: "it died from platform lock-in, so the rebirth exports a single HTML file that runs anywhere."

Main risks:
1. **Scope.** An authoring tool can grow forever. The MVP is cut hard so the demo stack is polished.
2. **The name.** "HyperCard" is an Apple trademark. Don't ship under that name.
3. **Looking like a toy.** Show three real uses (escape room, story, tutorial) and the exported file opening on a phone in airplane mode.

## Rules that shape the plan (Kiroween 2026)

- **Categories:** Resurrection, Frankenstein, Skeleton Crew, Costume Contest. **Enter Resurrection.** A spooky "haunted index card" skin helps Design.
- **Prizes:** 1st $30K, 2nd $20K, 3rd $10K; $5K per category; Best Startup $10K; Best Demo $1K; Best Student Project $1.5K; Bonus Blog and Social Blitz prizes (enter both).
- **Judging:** Stage 1 pass/fail. Stage 2 is five criteria at 20% each: Potential Impact, Technological Implementation, Design, Innovation/Idea, Presentation. Best Demo = top Presentation score in the top 10% overall.
- **Must submit:**
  - Public GitHub repo with an open source license shown in About.
  - `/.kiro` at the repo root, committed (not gitignored). Missing it risks disqualification.
  - Working app URL (GitHub Pages is enough).
  - Text description.
  - Demo video under 3 minutes, public on YouTube, no third-party trademarks or copyrighted music.
  - Write-up of how Kiro was used: specs vs vibe coding, hooks, steering, MCP, property-based testing, powers, agents. *"Insufficient use of Kiro will result in disqualification."*
- **Originality:** new project built during the submission period (Oct 30 to Dec 4). Libraries and starters are fine; disclose any other existing code. Must not violate third-party rights.
- **Eligibility:** teams of up to 3. Some countries are excluded (including Australia, Brazil, Italy, Philippines, UAE, Quebec). Check the rules page.

## Naming and trademark

**Don't use "HyperCard" as product name, logo, repo name or video title.**

Safe: a factual line such as *"inspired by the 1987 card-stack tools like HyperCard"* in the write-up and README. Never write "Apple's HyperCard reborn" or imply endorsement.

Also avoid:
- Apple's trade dress: Chicago/Geneva fonts, 1-bit Mac OS window chrome, the browse-hand cursor, original tool palette icons.
- The terms *HyperTalk* and *Home stack*.
- Bundled classic stacks or original artwork.

Build our own retro look: chunky pixel style, own icons, OFL fonts (*Silkscreen*, *VT323*, *Press Start 2P*).

**Name: Stackyard** (a graveyard for stacks: "Dead software, dug back up"). Alternatives: Revenant Cards, Deckromancy, Cardcrypt. Avoid "Cardstock" (existing project). Check GitHub, npm and domains.

Tagline: *"Stack index cards. Link them. Share one file that runs forever."*

## Scope

### MVP (must ship)
1. **Stack and cards:** create, rename, reorder, duplicate, delete cards, with a thumbnail strip.
2. **Three object types:** **text** (size, bold, align), **image** (upload or paste, stored inline), **button**. Drag, resize, z-order on a fixed logical canvas (800x600) that scales to fit any screen.
3. **No-code actions** for buttons and also clickable images/text, an ordered list built from dropdowns:
   - Go to card X / next / previous / back
   - Show / hide object
   - Set flag / add item to inventory
   - If flag/item then A else B (one level of nesting is enough)
   - Play sound (stretch)
4. **Link mode:** draw an arrow from a button to a card. **Stack map** view (node graph) that flags dead ends and unreachable cards.
5. **Play mode in the editor:** one toggle to play from card 1.
6. **Export to a single HTML file**, plus **import** from that same HTML.
7. **Autosave** to IndexedDB, with **undo/redo**.
8. **Three template stacks:** Haunted House Escape Room (hero demo), Choose-your-path Ghost Story, Tutorial: How to Carve a Pumpkin.

### Stretch (priority order)
1. **Stack doctor:** unreachable cards, buttons with no action, flags checked but never set, escape rooms with no exit.
2. Transitions (dissolve, wipe) and a sound action.
3. Haunted skin toggle (flicker, ghost cursor trail).
4. Accessibility: keyboard navigation in the player, alt text, screen-reader-friendly buttons.
5. PWA install for the editor.

### Cut
Accounts, cloud sync, collaboration, a scripting language, marketplaces, AI generation. (Leave "AI, draft me a stack" for a "what's next" slide.)

## Architecture

```
/src
  /core        pure TS, no DOM: schema, types, actions engine, graph analysis, migrations
  /editor      editor UI (vanilla TS)
  /player      tiny runtime that renders a stack and runs actions (< 30 KB min+gz)
  /export      HTML builder + importer
/templates     JSON stacks for the 3 templates
/tests         Vitest unit + fast-check property tests, Playwright e2e on exported files
/.kiro         specs, hooks, steering (committed)
```

- **One source of truth:** a versioned `Stack` JSON document: `schemaVersion`, cards, objects, actions, assets, start card. Editor and player both use `/core`.
- **Actions are data, not code.** `{type:"goto", card:"c3"}` or `{type:"if", cond:{flag:"hasKey"}, then:[...], else:[...]}`. No `eval`.
- **Stable IDs** for cards and objects so links survive reordering and renames.
- **State:** command pattern (each edit is reversible), giving undo/redo and property-testability.
- **Scaling:** fixed logical coordinates with CSS `transform: scale()`.

## Single-file HTML export

```html
<!doctype html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'sha256-...'; media-src data:">
<title>{stack title}</title><style>/* player CSS */</style></head>
<body><div id="stack"></div>
<script type="application/json" id="stack-data">{...stack JSON, "<" escaped as \u003c...}</script>
<script>/* player runtime, inlined */</script>
</body></html>
```

- Images and sounds become `data:` URIs. Downscale on import (longest side 1600px, WebP/JPEG 0.85). File-size meter with a soft warning at 10 MB.
- **Escaping:** user text only via `textContent`. The JSON block escapes `<`, `>`, `&`, U+2028/2029. Strict CSP with script hash.
- **Round trip:** the importer reads `#stack-data`; the exported file *is* the save file.
- **Offline everywhere:** no network requests, no CDN fonts, no ES module imports.
- **Save progress (optional):** flags and current card in `localStorage`, in try/catch.
- **Test matrix:** `file://` in Chrome, Firefox, Safari, iOS Safari (Files app), Android Chrome, all in airplane mode. Automate desktop with Playwright.

## Using Kiro (pass/fail, make it visible)

Keep a running `KIRO_LOG.md` with screenshots.

### Steering (`.kiro/steering/`)
`product.md`, `tech.md`, `structure.md`, `testing.md`.

### Specs (`.kiro/specs/`), each with requirements, design, tasks
1. `stack-data-model`: schema, IDs, migrations.
2. `action-engine`: action types and interpretation.
3. `card-editor`: canvas, objects, selection, drag/resize, undo.
4. `html-export-import`: builder, escaping, CSP, round trip, asset compression.
5. `stack-map-and-doctor`: graph view and lint rules.

Requirements in EARS style (e.g. *WHEN the user deletes a card THE SYSTEM SHALL remove or flag every action that targets it*).

**Vibe coding vs specs:** specs for `/core` and export; vibe coding for UI polish, haunted skin, template content.

### Property-based testing (fast-check + Vitest)
Generators: random valid stacks, random edit sequences, nasty strings (`</script>`, `<img onerror>`, emoji, RTL, U+2028). Properties:
1. **Export round trip:** `import(export(s))` deep-equals `s`.
2. **No script injection:** exported HTML parsed in a DOM has exactly the expected `<script>` elements; text renders as text.
3. **Referential integrity:** after any edit sequence, every `goto` and show/hide target exists or is flagged by the doctor.
4. **Undo is an inverse:** `undo(apply(cmd, s))` equals `s`; undo then redo of any sequence returns the same state.
5. **The player never crashes:** a random walk of clicks never throws and never lands on a missing card.
6. **Migrations are idempotent.**
7. **Graph analysis agrees with play:** doctor-reachable cards equal BFS-reachable cards in the player.
8. **The layout scales:** object positions stay within the canvas after any resize or scale.

Record the bugs PBT finds in `KIRO_LOG.md`.

### Hooks (`.kiro/hooks/`)
- On save in `src/core/**`: run related property tests, report failures with the seed.
- On save of `schema.ts`: check a migration exists for the bumped `schemaVersion`, regenerate `docs/schema.md`.
- On save in `src/player/**`: rebuild the player, fail if over the size budget.
- On save in `templates/*.json`: validate against the schema and run the stack doctor.
- Manual "Export smoke test": export each template and open with Playwright over `file://`.
- Manual "Update write-up": update `KIRO_LOG.md` from spec/task progress.

### MCP and extras
- Playwright MCP server so Kiro can open exported files and click through them.
- Powers / custom agents (e.g. a "stack doctor reviewer"): mention if used.

## Timeline (Nov 12 to Dec 4)

| Date | Goal |
|---|---|
| **Nov 12** | Register on Devpost, request Kiro credits (closes Dec 1). Pick the name. Public repo with MIT license, `/.kiro/steering`, "hello" page on GitHub Pages. |
| Nov 13-14 | **Specs 1-2:** data model and action engine, fast-check generators, properties 1, 3, 4, 6. `/core` fully tested before any UI. |
| Nov 15-16 | **Player plus export (spec 4).** Hand-written JSON stack to one HTML file, open on a phone in airplane mode. Riskiest part, prove it first. Properties 2 and 5. |
| **Nov 17** | **Decision point:** if export and player are solid, continue; else cut stack map and sounds. |
| Nov 18-21 | **Editor (spec 3):** card strip, canvas, objects, drag/resize, undo/redo, action editor, play mode, IndexedDB autosave, import. |
| Nov 22-23 | **Stack map plus doctor (spec 5).** Property 7. Hooks finalized. |
| Nov 24-26 | **Templates**, built in our own editor. Fix whatever hurts. |
| Nov 27-28 | **Design pass:** pixel look, haunted skin, onboarding, empty states, mobile check, accessibility. |
| **Nov 29** | **Feature freeze.** Cross-browser `file://` matrix. |
| Nov 30 | Record and edit video. |
| Dec 1 | Kiro write-up, README, Devpost description. **Credit deadline noon PT.** |
| Dec 2 | Blog and social posts. Final deploy. Verify `/.kiro`, license in About, public video. |
| **Dec 3** | **Submit.** Dec 4 is buffer (hard deadline 2 PM PT). |

## Demo video (under 3 minutes, aim for 2:45)

1. **0:00-0:15 hook:** phone in airplane mode opens a single `.html` file; a creepy escape room plays. "This whole game is one file, made in 10 minutes without code."
2. **0:15-0:35 resurrection story:** late-'80s card-stack tools died from platform lock-in. Own retro animation; no Apple screenshots, logos, or trademark title cards.
3. **0:35-1:35 build live, sped up:** card, image, button, "if has key, go to Exit, else show 'It's locked'". Play mode. Stack map.
4. **1:35-2:00 export:** open on desktop, phone, tablet. Re-import.
5. **2:00-2:35 Kiro:** spec, hook firing on save, fast-check failure shrinking to `</script>` and getting fixed.
6. **2:35-2:45 close:** other two templates, tagline. Royalty-free or self-made music only.

## Submission checklist

- [ ] Public GitHub repo, MIT license shown in About
- [ ] `/.kiro` at the root with specs, hooks, steering, **not gitignored**
- [ ] Live editor URL (GitHub Pages), plus 3 exported example `.html` files linked from the README
- [ ] Video under 3 minutes, public on YouTube, no trademarks or copyrighted music
- [ ] Devpost text: problem, solution, category = **Resurrection**, how to run it, pre-existing code disclosed (libraries only)
- [ ] Kiro write-up: steering, specs vs vibe coding, hooks, PBT with real bugs found, MCP, powers/agents
- [ ] Bonus Blog post and social posts
- [ ] Check student eligibility (Best Student Project $1.5K)
- [ ] Submit by Dec 3, before the hard deadline of Dec 4, 2:00 PM PT

## How it maps to judging (20% each)

- **Potential Impact:** teachers, kids, escape-room makers; a file you own forever; works offline on cheap devices.
- **Technological Implementation:** pure core, data-driven action engine, secure single-file export with CSP, 8 property tests.
- **Design:** original retro skin, stack map, 30-second onboarding.
- **Innovation/Idea:** fixes the thing that killed the original (lock-in).
- **Presentation:** airplane-mode phone hook and live building.

*Sources: kiroween.devpost.com, kiroween.devpost.com/rules, Kiro blog "This is Kiroween (2025)". The rules page was only partly readable; re-check the excluded-countries list and the IP section.*

---

## Implementation status

Tracked in `KIRO_LOG.md` and `.kiro/specs/*/tasks.md`.

- [x] Steering (5 files), scaffold, PLAN.md, README, MIT license shown in the About dialog
- [x] `/core`: model, commands + undo, action engine, graph, doctor, migrations (schema v2), text-overlap check
- [x] Player (~3 KB gz) + single-file export/import with strict CSP; OFL pixel fonts embedded
- [x] Editor: strip, canvas, inspector, no-code actions, play, stack map, doctor, autosave, import/export, images
- [x] Haunted skin, quick start, empty states, phone layout
- [x] 3 templates (escape room winnable in a test; no overlapping text anywhere)
- [x] Playwright e2e on Chromium, Firefox, WebKit and emulated iPhone 13 / Pixel 7
- [x] Hooks: core tests, schema/migration, player size, templates, export smoke (manual), write-up (manual)
- [x] Specs 1-5, Playwright MCP config, GitHub Pages workflow, examples/
- [ ] Real-device checks (iOS Safari, Android Chrome): docs/TESTING.md
- [ ] Link mode, drag-to-reorder cards, sound action
- [ ] Push to GitHub, enable Pages, set license in About, demo video, Devpost text, blog post
