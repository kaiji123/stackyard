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

1. **`addCard` did not clamp nested objects** (property 8). fast-check shrank it to an empty one-card stack
   plus a single `addCard` command; failure: `expected 620 to be less than or equal to 600` (seed `-277998493`).
   ```
   [{"schemaVersion":1,"title":"","start":"c1","cards":[{"id":"c1","name":"","objects":[]}], ...},
    [{"kind":2,"a":0,"b":29,"text":"","bool":false,"bad":true}]]
   ```
   Fixed in `addCard`; regression test added.
2. **Static graph mis-modelled chained moves** (property 7, seed `-180906131`). A start card c5 whose button runs
   `[{"type":"prev"},{"type":"if","cond":{"flag":"hasKey"},"then":[],"else":[{"type":"prev"}]}]` is played to c3,
   but the old graph only drew c5→c4, so a card the player reached was "unreachable". Fixed by simulating
   actions in order over a set of positions; regression test `chained relative moves…`.
3. **NUL in a stack title** (property 2). Shrunk to `title: "\u0000\u0007"`; the exported page's `<title>` read
   back as `"\ufffd\u0007"` (HTML parsers rewrite NUL). Stack data was safe (JSON-escaped); fixed by stripping
   control characters (and U+2028/2029) from `<title>` only.
4. **`window.matchMedia` missing in jsdom**: the player crashed. Fixed with a feature check; the player must not
   assume browser APIs.
5. **Overlapping text in our own Haunted House template.** The new text-overlap check found "Too dark to see
   anything." and "You found a rusty key!" at the same position, both showable in one play-through. Fixed the
   template (separate positions, and the dark message is hidden once the key is found).
6. **Overlap check missed unlinked cards** (it only started from the start card). Authors need the warning while
   building a card, so it now explores from every card.
7. Playwright found two UX bugs: the canvas flashed unscaled on every re-render, and the autosave status
   overwrote the "Imported…" message. Both fixed.
8. **Round 2 review, found by hands-on testing and then locked in by tests:**
   - Import, template pick and "new" silently replaced the user's work and autosave overwrote it. Now: confirm
     dialog (with "export a copy first"), replace is one undo step, old stack kept as "Previous". Property:
     `replaceStack` then `undo` returns exactly the old history.
   - Deleting a card left the stack broken with no help. New `retargetLinks` command + delete dialog that lists
     the links, predicts the damage and can redirect them. Property: redirect then delete never dangles.
   - Player lost keyboard focus after navigation and the card was a tab stop. Fixed (focus into the new card,
     live region, tabindex -1); e2e Tab/Enter/Tab test on three engines.
   - `alert`/`confirm` replaced with one accessible modal. Writing the test for "focus stays inside the dialog"
     showed native `showModal` lets Tab escape to the browser UI; added an explicit Tab trap.
   - Titles in CJK/Arabic downloaded as `stack.html`; now `幽霊の家.html`. Property test over arbitrary titles.
   - Size meter was a formula; now the measured size of the real file (test compares with the downloaded bytes).
9. Test-side mistakes that sharpened the specs: undo of a no-op command, transient cards during a multi-step
   click ("rests on"), and "alternative" texts that really can be shown together.

## Round 3: pixel art in the product

- `media/README.md` listed six limits of the pipeline; five were fixed and one (per-card background) is open.
  Two needed a **schema bump to v3** (text `tone`, image `crisp`) with a real v2→v3 migration; the property test
  rebuilds genuine v2 documents (fields stripped), migrates, validates and checks idempotency, and also checks
  the migration never overwrites values a document already has.
- Upload policy is a pure function (`shouldKeepOriginal`, `reencodeType`) with property tests; e2e proves a GIF
  is stored byte-for-byte, a big noisy PNG becomes WebP (Chromium/Firefox) or PNG (WebKit, which cannot write
  WebP) and keeps its transparent corner.
- Templates are generated from `media/` by `scripts/make-templates.mjs` and loaded lazily (one chunk each).
  Template tests now also require alt text, crisp pixel art, full-card pictures on the bottom layer, and no dark
  text over them. Screenshots of every card were reviewed by eye before accepting the layout.
- Test-side mistakes this round: a "noise" image that was periodic and compressed to 22 KB (so it never
  exceeded the keep threshold), and asserting on a list that disappears when empty.
- **Animated GIFs were not used at first**, only the README banner; the user noticed nothing moved. Now three
  template cards and two editor spots use them. The first animation test drew the `<img>` onto a canvas and
  compared frames; it reported "still" for every GIF in every browser. Screenshots showed the GIFs *were*
  moving: browsers always paint a GIF's first frame to a canvas. The test now compares element screenshots,
  and it caught a real bug: a background save re-rendered the editor and restarted the animation.
- **`candle-flicker` was not wired into any stack** (only the editor's empty card). It has a solid dark
  background and is delta-encoded (frame 0 full, then small flame patches where colour 0 means "unchanged"),
  so flipping a transparency bit would leave dark squares or smear the flame. Wrote a small GIF codec
  (`scripts/gif.ts`) and derived a transparent copy. Checks: a fast-check round trip over random animations,
  an LZW table-reset test, Chromium, Firefox and WebKit decode frame 0 byte-identical to our decoder, and a
  side-by-side frame sheet. The sheet caught dark specks inside the flame (background pockets that the
  border flood fill kept), fixed with an explicit "all" mode. The candle now sits on the Study desk,
  covering the painted one; an e2e test checks it animates and that its corners show the wall.
- Design decision: `image-rendering: pixelated` is a per-image flag rather than global, because nearest-neighbour
  scaling makes downscaled photos look jagged.

## Round 4: longer stacks and a way to pick them

- The examples were too short (5, 6 and 6 cards). Now 9, 10 and 12: the escape room chains four locks (light,
  note, key, the ghost) plus a detour; the ghost story has five endings gated by an item and a promise; the
  tutorial gained tools, a bonus step and a quiz whose results card records each answer.
- New template tests play every example by breadth-first search over real play states and require that
  every card is reachable that way (stronger than the map's static reachability), and that each lock really
  needs its key. A shared `ESCAPE_ROUTE` keeps five e2e files in step with the generator.
- The cut-off text check caught the torn note overflowing its box; a new test caught hidden buttons that
  shared a slot with visible ones, which looked garbled in the editor.
- Choosing another stack used to mean the "New from…" dropdown, which also replaces your work. The new gallery
  plays any example full screen as a "guest" stack and leaves your own untouched. WebKit showed that Safari
  does not focus clicked buttons, so focus-return falls back to the button instead of `<body>`.

## Round 5: stories, not just puzzles

- All three examples are now 16 cards. The escape room and the ghost story tell one shared story (Eleanor
  Ashby, locked out in 1910, and her father's ghost) from two sides. New beats are story pages on the plain
  index card (letters, a diary, graves) and clickable labels on scenes ("» Look closer"), so the extra cards
  add story without new art. The tutorial follows Jack the pumpkin, with a 4th quiz question and a certificate.
- A test now requires at least 16 cards per example. The play-every-card search, lock tests and ending tests
  were extended to the new routes; the e2e route and card counts come from one helper or from the files.
- Found on the way: the new "Look closer" label was 8 px too short for its text (cut-off check), and a test
  locator for "The Hall" matched a second card name.

## Round 6: new art for the story

- 13 new pictures drawn in code (`scripts/art/`, `npm run art`): six backgrounds (foyer, portrait close-up,
  open cellar, clearing, dawn house, fog road), Eleanor as her own sprite, diary, letter, gravestone and
  lantern sprites, and two pumpkin pictures. Before drawing, the original media were measured: 4 px blocks
  for backgrounds, 16 px for sprites, 12 px for pumpkins, and one shared 22-colour palette. The toolkit can
  only paint with that palette.
- Tests: the new PNG codec round-trips random bitmaps; every art file must be up to date, the right size,
  palette-only, hard-edged, and opaque (backgrounds) or see-through at the corners (sprites). That test
  caught see-through pixels inside the foyer's padlock on its first run.
- Every piece was reviewed on a contact sheet next to the originals and fixed where it looked wrong
  (a hard-edged moon, a square "glow" that read as noise, fog too faint to read as fog).
- Placement: Eleanor's sprite sits exactly over the small ghost painted into the graveyard, so the
  ghost you saw all along is her.

## Round 7: a new flagship stack, "The Midnight Train"

- 17 cards with its own story and cast (a conductor, an old lady, a boy, a dog), a four-step trade chain where
  each item unlocks the next, two endings, and story pages for every character.
- 22 new media files drawn in code for it: 11 backgrounds, 4 characters at twice the detail of the older
  sprites, 5 items, and 2 animations made with our own GIF encoder (steam; a parallax window view, cut from
  32 to 16 frames to halve it to 150 KB).
- Review by eye found: a rebuilt bridge (the first arches were unreadable), lamp halos that merged into blobs,
  a timetable drawn in front of the arriving train, two titles sitting on the art, a headlamp lost in the
  vignette, and Pip's eyebrows making him look angry instead of worried.
- The art test caught see-through pixels in the birdcage on a background, and showed its own per-pixel
  assertions timed out on the big animation (now counted, then asserted once).
- New tests: the trade chain in the engine (nothing works out of order), the whole stack played to the happy
  ending in an exported file offline on three browser engines, and both animations really moving.

## Round 8: search in the "Play a stack" gallery

- Search box over the stacks: every word must match the start of a word in the title, description, tags or any
  card (so "dog" finds the Midnight Train and says it was found on "The Luggage Van"). Pure, property-tested
  matcher in `src/editor/search.ts`. Esc clears before it closes; Enter goes to the first Play.
- The first screenshot showed the field white with pale text (the search input missed the dark input style)
  and two results stretching to half the dialog each; both fixed, and a contrast test now guards the field.
- Also fixed from the user's screenshot: an untitled stack showed as empty quotes, and the pumpkin blurb said
  "three-question quiz" after the quiz grew to four.

## Round 9: a wiki stack, "The Halloween Bestiary"

- 24 cards: cover, contents, A to Z, four chapters and 17 articles. Articles share one layout (chapter and
  position, title, portrait, summary, a four-line fact box, see-also, back/next/contents), generated from one
  data table so they stay consistent. Facts limited to well-established folklore and natural history.
- 18 new media files: 17 portraits (one animated) and a cover. The kitsune took four tries: at 32 px, nine
  tails first read as wings, then as a moth; a fan of separate wedges with rounded white tips finally read as tails.
- Tests: every article is in exactly one chapter and in the A to Z, links back to its chapter and the
  contents, has the same parts, and "Next" loops through each chapter visiting every article once. A new
  check across ALL stacks: every button label fits its button (the first screenshots showed two wrapping).
- The search hint now prefers a card named after the word: "kitsune" said "found on A to Z" because the
  index mentions every creature first.

## Round 10: draw on the card

- A pixel painter in the editor (✎ Draw): sprites or a whole-card background traced over the card, tools,
  brush sizes, mirror, palette, undo/redo, mouse/touch/keyboard. ✎ Edit drawing reopens any pixel art: it
  finds the block size (the same run-length GCD used to measure the original media) and shrinks it back, so
  the template's 256 px ghost opens as the 16×16 it was drawn as.
- No schema change: drawings are ordinary PNG pictures. One new core command, `replaceAsset`, with a property
  test (pure, undoable, never adds an asset, ignores unknown ids including `__proto__`).
- Pure pixel ops (fill, lines, boxes, brushes, mirror, block size) are property-tested against simple
  reference versions. A test keeps the drawing palette identical to the art scripts' palette.
- Found on the way: the tracing layer was pushed to the bottom-right by the player's own stage styles
  (screenshot); my test for "centre column mirrors" expected two cells instead of one; and "The Cellar" in a
  test matched the Torn Note's thumbnail ("the cellar key"). Native confirm() for switching sizes was replaced
  by click-twice, keeping the no-native-dialogs rule.

## Round 11: animation

- Frame-by-frame animation in the drawing tool: frames strip, onion skin, speed, live preview, [ and ] to step
  frames. More than one frame saves as an animated GIF with our own encoder (moved from scripts/ to
  src/export/gif.ts so the editor can use it; scripts re-export it). "Edit drawing" decodes GIFs frame by frame
  with one shared block size, so the template's candle opens as 8 frames of 16×16.
- Movement for any object: schema v4 adds `motion` (still, float, bob, wiggle, pulse, swing, spin, flicker), with
  a v3→v4 migration and property tests (fills "none", validates, idempotent; a v1 stack migrates to v4; an
  unknown motion is rejected). CSS-only in the player (+0.1 KB); still on the editing canvas so it can be dragged;
  off under prefers-reduced-motion (tested in an exported file). Some template objects now move.
- Testing lesson: Playwright waits for an element to be "stable" before an element screenshot, which a looping
  CSS animation never is, so the animation check now screenshots the page area around it.
- Test-side mistakes: the frame count included the dropdowns' <option>s; the candle's real grid is 16×16 in
  15 px blocks, not 60×60.

## Testing notes

- WebKit on macOS does not Tab onto buttons by default (Safari setting), so the WebKit keyboard tests use
  Option+Tab. Two of our own tests were racy (Escape pressed before a dialog had opened; fonts checked before
  loading started) and were fixed rather than retried.

## Timeline

- **Nov 12:** steering, scaffold, `/core` with properties 3, 4, 6, 8; player + export with properties 1, 2, 5, 7;
  editor, templates, stack map, doctor; Playwright e2e on Chromium.
- **Nov 13 (round 12):** 2:45 demo video in `demo/`: real app footage recorded by a scripted Playwright run
  (lossless DevTools screencast, then H.264), composed and rendered with HyperFrames. No music or voice.
- **Nov 12 (round 11):** animated drawings (GIF) and no-code movement for any object (schema v4).
- **Nov 12 (round 10):** drawing tool for sprites and backgrounds, with editing of existing pixel art.
- **Nov 12 (round 9):** "The Halloween Bestiary" wiki, 24 cards, 18 new media files.
- **Nov 12 (round 8):** search in the "Play a stack" gallery.
- **Nov 12 (round 7):** "The Midnight Train", 17 cards, 22 new media files including two animations.
- **Nov 12 (round 6):** 13 new story pictures drawn in code, wired into all three stacks.
- **Nov 12 (round 5):** 16 cards per example, shared Eleanor storyline, story pages and clickable labels.
- **Nov 12 (round 4):** longer examples (9/10/12 cards), "Play a stack" gallery, 161 e2e tests.
- **Nov 12 (round 3):** pixel art in the templates, schema v3 (tone, crisp), upload policy, README banner, 126 e2e tests.
- **Nov 12 (round 2):** safe replace/import, delete-card dialog, app modals, player focus management, exact size meter, Unicode file names, tricky-title export tests, 99 e2e tests.
- **Nov 12 (later):** schema v2 (haunted skin) with a real v1→v2 migration; OFL fonts embedded in editor and exports;
  About dialog with the MIT license; quick start and empty states; phone layout; Firefox and WebKit plus emulated
  iPhone 13 and Pixel 7 runs; all hooks, specs 3–5; text-overlap and cut-off checks; README and Pages workflow.

## Not done yet

- Real-device runs (iOS Safari, Android Chrome); see `docs/TESTING.md`.
- Link mode on the map, drag-to-reorder cards, sound action, "no winning path" doctor rule.
- Screenshots for the write-up; one recorded Playwright MCP session.
- Demo video: rendered locally (`npm run demo:render`); still to upload to YouTube. Devpost text, blog post.
