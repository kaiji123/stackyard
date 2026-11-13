# Requirements: card editor

## R1 Cards
1. WHEN the user adds, duplicates, deletes or reorders a card THE SYSTEM SHALL show it in the thumbnail strip and keep the same card selected where possible.
2. WHEN the user deletes a card THE SYSTEM SHALL remove every action that targets it, and SHALL NOT delete the last card.
3. WHEN the user marks a card as the start card THE SYSTEM SHALL play from it.

## R2 Objects
1. THE SYSTEM SHALL offer text (size, bold, align), image (upload, paste, drop) and button objects on an 800x600 logical canvas that scales to fit any screen.
2. WHEN the user drags or resizes an object THE SYSTEM SHALL keep it inside the canvas and record ONE undo step per gesture.
3. WHEN the user adds a picture THE SYSTEM SHALL downscale it (longest side 1600 px) and recompress it, and adding the asset plus its image object SHALL be one undo step.
4. THE SYSTEM SHALL support z-order changes (front, forward, backward, back) and keyboard nudging (arrows, Shift for 10 px) and Delete.

## R3 Readable text
1. WHEN two text boxes can be visible at the same time and overlap THE SYSTEM SHALL outline both in red on the canvas and list the problem in the stack doctor.
2. WHEN text does not fit its box THE SYSTEM SHALL outline it as cut off.
3. WHEN two texts overlap only because they are alternatives that are never shown together THE SYSTEM SHALL NOT warn.
4. THE built-in templates SHALL have no overlapping text boxes at all.

## R3b Pictures and readable text
1. WHEN the user adds a PNG or GIF of at most 256 KB and 1600 px THE SYSTEM SHALL store the original bytes unchanged, so animated GIFs keep animating and pixel edges stay exact.
2. WHEN a picture is re-encoded THE SYSTEM SHALL use WebP, or PNG if WebP is unavailable, and SHALL NOT use JPEG (it loses transparency).
3. THE SYSTEM SHALL let each image be drawn with hard pixel edges (`crisp`), on by default for kept PNG/GIF and off for re-encoded pictures.
4. THE SYSTEM SHALL let each text use a style: dark ink, light with a shadow, or light on a dark panel.
5. WHEN dark text sits on a picture THE SYSTEM SHALL hint, in the stack doctor, to use the light or panel style.
6. THE templates SHALL give every picture alt text, put full-card pictures on the bottom layer, and never put dark text over them.

## R3c Drawing
1. THE SYSTEM SHALL let the user draw a picture in the app: a 16×16 or 32×32 sprite, or a 200×150 background for the whole card.
2. WHEN drawing a background THE SYSTEM SHALL show the current card faintly underneath, to trace and line things up.
3. THE drawing tool SHALL offer pen, eraser, fill, line, box, colour picker, brush sizes 1/2/4/8, left-right mirror, its own undo/redo, and the shared palette plus any colour.
4. WHEN the user adds a drawing THE SYSTEM SHALL store it as a PNG at drawing size, place a sprite in the middle of the card or a background at 0,0 800×600 on the bottom layer, draw it with crisp pixels, and do it as ONE undo step.
5. WHEN the user edits a picture THE SYSTEM SHALL find the size of its big pixels and open it at its real grid size (so a 256 px sprite drawn in 16 px blocks opens as 16×16), and refuse pictures larger than 256×200 big pixels with an explanation.
6. THE drawing tool SHALL work with a mouse, touch, and the keyboard (arrows move a cursor, Space paints, line and box take two presses), and SHALL ask twice before Esc or a size change throws a drawing away.

## R3d Animation
1. THE drawing tool SHALL let the user add, duplicate, reorder and delete frames (up to 24), show the previous frame faintly (onion skin), choose a speed (2–12 frames a second), and preview the animation.
2. WHEN a drawing has more than one frame THE SYSTEM SHALL save it as a looping animated GIF; one frame stays a PNG. Undo inside the tool SHALL cover frame changes.
3. WHEN the user edits an animated GIF THE SYSTEM SHALL open every frame at its real grid size and keep its speed.
4. THE SYSTEM SHALL let any object have a movement chosen from a list: still, float, bob, wiggle, pulse, swing, spin, flicker (schema v4, with a migration). Movement SHALL play in Play mode and exported files, stay still on the editing canvas (marked with ↻), and switch off for reduced motion.

## R4 Actions (no code)
1. WHEN an object is selected THE SYSTEM SHALL show an ordered action list built only from dropdowns and short name fields.
2. THE SYSTEM SHALL support one level of `if` with then/else lists.

## R1b Safe replace and delete
1. WHEN the user imports a file, picks a template or starts a new stack over existing work THE SYSTEM SHALL ask first, naming what will be replaced, and offer "Export a copy, then replace".
2. WHEN a stack is replaced THE SYSTEM SHALL do it as ONE undo step AND keep the old stack as "Previous" in the browser, so undo or "Previous" brings it back, even after a reload.
3. WHEN a file cannot be imported THE SYSTEM SHALL explain why in the app's own dialog and change nothing.
4. WHEN the user deletes a card THE SYSTEM SHALL list the buttons that lead to it, predict what will break (buttons that do nothing, cards that become unreachable), and offer to send those links to another card instead of removing them.
5. THE SYSTEM SHALL NOT use the browser's alert, confirm or prompt. Dialogs SHALL keep Tab inside themselves, close on Esc, and put initial focus on Cancel for risky actions.

## R5 Modes and persistence
1. THE SYSTEM SHALL provide Edit, Map and Play modes; Play SHALL run the same engine as exported files.
2. THE SYSTEM SHALL autosave to IndexedDB, restore on reload, and offer undo/redo (Ctrl/Cmd+Z, Shift+Z, Y).
3. WHEN first run THE SYSTEM SHALL show a quick start; WHEN a card is empty THE SYSTEM SHALL explain how to add objects.

## R6 Phones and accessibility
1. WHEN the viewport is 900 px or narrower THE SYSTEM SHALL use one column with Cards and Edit object tabs, so every inspector function stays reachable.
2. WHEN a coarse pointer is used THE SYSTEM SHALL enlarge resize handles and tap targets.
3. THE SYSTEM SHALL name every control, use `<dialog>` for dialogs, and honour `prefers-reduced-motion`.

## R6b Example stacks
1. THE SYSTEM SHALL offer a "Play a stack" gallery from the toolbar and the first-run welcome, showing each example's first card, title, card count and a one-line description.
2. WHEN the user plays an example from the gallery THE SYSTEM SHALL play it full screen WITHOUT replacing or changing the user's own stack, and Esc SHALL return to the editor unchanged.
3. WHEN the user chooses "Edit a copy" THE SYSTEM SHALL ask before replacing the current stack (R1b).
3b. THE gallery SHALL have a search box. WHEN the user types THE SYSTEM SHALL show only stacks where every word matches the start of a word in the title, description, tags, or any card's text (ignoring case, accents and punctuation), say how many match, and name the card when the match is only inside the stack. Esc SHALL clear the search before it closes the gallery; Enter SHALL move to the first result's Play button. On touch devices the box SHALL NOT take focus on open.
4. Every card of every example SHALL be reachable by actually playing it (not only on the map).
5. Each example SHALL have at least 16 cards and tell a story, not only a puzzle or a list of steps.
6. The Midnight Train SHALL use only art made for it, with every lock depending on the item before it.

## R7 About
THE SYSTEM SHALL provide an About dialog showing the MIT license, the OFL font credits and, when known, the repository link.

## Properties
- Replace is undoable and redoable; redirecting links then deleting never dangles (core, `retargetLinks`, `replaceStack`). P8 layout stays in canvas (core). Undo is an inverse (core). E2E: drag + undo, add/rename/undo/redo, overlap warning appears and clears.
