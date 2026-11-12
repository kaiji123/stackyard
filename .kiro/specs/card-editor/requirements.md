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

## R4 Actions (no code)
1. WHEN an object is selected THE SYSTEM SHALL show an ordered action list built only from dropdowns and short name fields.
2. THE SYSTEM SHALL support one level of `if` with then/else lists.

## R5 Modes and persistence
1. THE SYSTEM SHALL provide Edit, Map and Play modes; Play SHALL run the same engine as exported files.
2. THE SYSTEM SHALL autosave to IndexedDB, restore on reload, and offer undo/redo (Ctrl/Cmd+Z, Shift+Z, Y).
3. WHEN first run THE SYSTEM SHALL show a quick start; WHEN a card is empty THE SYSTEM SHALL explain how to add objects.

## R6 Phones and accessibility
1. WHEN the viewport is 900 px or narrower THE SYSTEM SHALL use one column with Cards and Edit object tabs, so every inspector function stays reachable.
2. WHEN a coarse pointer is used THE SYSTEM SHALL enlarge resize handles and tap targets.
3. THE SYSTEM SHALL name every control, use `<dialog>` for dialogs, and honour `prefers-reduced-motion`.

## R7 About
THE SYSTEM SHALL provide an About dialog showing the MIT license, the OFL font credits and, when known, the repository link.

## Properties
- P8 layout stays in canvas (core). Undo is an inverse (core). E2E: drag + undo, add/rename/undo/redo, overlap warning appears and clears.
