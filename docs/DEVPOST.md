# Stackyard: Devpost submission

**Stack index cards. Link them. Share one file that runs forever.**

## Inspiration

In the late '80s, card-stack tools like HyperCard let anyone make software. You put text, pictures and buttons on
index cards, linked them together, and you'd built a game, a lesson or a story. A generation of teachers and kids
made things that way.

Then the platforms died, and everything people had made died with them. The idea wasn't the problem. Lock-in was.
For Kiroween's **Resurrection** category, we wanted to bring that idea back and fix what killed it: **what you make
should outlive the tool that made it.**

## What it does

Stackyard is a no-code card-stack maker that runs in the browser.

- **Build:** put text, pictures and buttons on 800×600 cards, then drag, resize and layer them, with full undo and redo.
- **Add logic without code:** actions are picked from dropdowns: go to a card, show or hide something, set a flag,
  add an item, and *"if you have the key, open the door, otherwise say it's locked."*
- **Draw and animate:** a built-in pixel painter with frame-by-frame animation saves animated GIFs, and any object
  can float, bob, flicker or swing.
- **Check your work:** a **stack map** shows how cards connect, and a **stack doctor** flags unreachable cards,
  dead ends, buttons that do nothing, and text that overlaps.
- **Share one file:** export produces a **single self-contained HTML file** that runs offline in any browser, on
  any phone, tablet or laptop, with no app, account or internet. That file is also the save file: import it to
  keep editing.

It comes with five example stacks you can play from the gallery: a 16-card **Haunted House escape room**, a
**branching ghost story** with five endings, a **pumpkin-carving tutorial** with a quiz, **The Midnight Train**
(17 cards with a trading puzzle), and **The Halloween Bestiary**, a 24-card searchable wiki.

## How we built it

- **TypeScript and Vite, no framework.** A pure `/core` (data model, commands with undo, action engine, graph
  analysis, migrations) is shared by the editor and the player.
- **Actions are data, not code.** There's no scripting language, no `eval` and no `innerHTML`, so the engine just
  reads JSON.
- **A tiny player (about 3 KB gzipped)** is embedded in every export. Exported files use a strict security policy
  (`default-src 'none'`, with the script allowed only by its hash) and make **zero network requests**.
- **Built with Kiro, spec-first for the risky parts:**
  - **Steering** files for product rules (including trademark rules), tech, structure, testing and design.
  - **Five specs** (data model, action engine, card editor, HTML export/import, stack map and doctor) with
    requirements written in Kiro's structured EARS format. Many requirements became a property test almost word
    for word.
  - **Six hooks:** property tests on save, a schema-migration check, the player's 30 KB size budget, template
    validation, an export smoke test, and a hook that updates the write-up.
  - **Vibe coding** for UI polish, the haunted skin and template content, locked in afterwards with tests.
- **Testing:** 179 unit and property tests (fast-check) plus Playwright end-to-end tests on Chromium, Firefox,
  WebKit and emulated iPhone and Pixel phones. The tests open exported files offline and play stacks through to
  the ending.
- **All art is original,** drawn from code in one shared 22-colour palette, with our own GIF and PNG encoders.
  No stock or third-party assets.
- **Other tools:** the first set of pixel art in `media/` and some hands-on QA were done with Claude Code.

## Challenges we ran into

- **Making one HTML file safe.** User text ends up inside an HTML page. A property test generated hostile titles
  and found that a NUL character in a title came back changed in the exported page. We now strip control
  characters from the page title, while the JSON-escaped stack data stays exact.
- **The stack map disagreed with real play.** A property test compared the map's idea of which cards are
  reachable with what the player actually reaches. It found a chained "previous, then if…else previous" case the
  map got wrong. We fixed it by simulating actions in order.
- **Losing people's work.** Hands-on testing showed that importing a file or picking a template silently replaced
  the current stack. Replacing now asks first and can be undone, and a property test checks that undo restores
  the old stack exactly.
- **GIFs that "didn't move."** Our animation test said every GIF was still, but screenshots showed them moving.
  Browsers only paint a GIF's first frame to a canvas. Switching to screenshot comparison fixed the test, and it
  immediately caught a real bug where autosave restarted animations.
- **Pixel art that reads at 32 pixels.** The kitsune's nine tails looked like wings, then a moth, before they read
  as tails.

## Accomplishments that we're proud of

- **Exported stacks really do run offline,** with no network requests and a strict security policy. Tests prove
  it on three browser engines and emulated phones.
- **About 3 KB** of player code inside every file.
- **Property tests found real bugs** that hand-written tests missed: layout clamping, graph reachability and title
  escaping. Each now has a regression test.
- **Upgrade safety:** the file format is versioned (now v4), and every upgrade step is tested to never lose data
  and to be safe to run twice.
- **Accessibility built in:** keyboard play with focus management, a live region announcing card changes, alt
  text, reduced-motion support and accessible dialogs.
- **Five complete, playable example stacks,** all with original art.

## What we learned

- **Specs pay off for the parts that must not break.** EARS requirements turned straight into properties, and
  property tests found bugs we'd never have thought to write tests for.
- **Test what the user sees.** Several "passing" tests were checking the wrong thing (GIFs on canvas, dialogs that
  hadn't opened yet). Screenshots and hands-on testing kept us honest.
- **Constraints help.** Ruling out a scripting language, accounts and a cloud backend kept the scope small enough
  to make the core trustworthy.

## What's next for Stackyard

- Testing on real iOS and Android devices, beyond the emulated phones.
- Drawing links on the stack map, drag-to-reorder cards, a sound action, and a "no winning path" check in the
  stack doctor.
- Optional **template likes** in the editor, with exported files still never contacting anything.
- An opt-in community gallery for sharing stacks, designed with moderation in mind for young makers.
- "Draft me a stack": AI help to rough out a story's cards, which you then edit by hand.

---

*Stackyard is inspired by the 1987 card-stack tools like HyperCard. It is not affiliated with or endorsed by Apple.*
