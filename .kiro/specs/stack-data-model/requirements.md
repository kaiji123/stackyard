# Requirements: stack data model

A `Stack` is one versioned JSON document: the single source of truth for editor, player and export.

## R1 Structure
1. THE SYSTEM SHALL represent a stack as `schemaVersion`, `title`, `start`, ordered `cards`, and `assets`.
2. WHEN a document is validated THE SYSTEM SHALL reject it unless it has at least one card, unique card and object ids, and a `start` that names an existing card.
3. WHEN validating arbitrary JSON THE SYSTEM SHALL return errors and never throw.

## R2 Stable ids
1. THE SYSTEM SHALL address cards and objects only by id, never by position, so links survive reordering and renaming.
2. WHEN a command would introduce a duplicate id THE SYSTEM SHALL leave the stack unchanged.

## R3 Editing (commands)
1. WHEN a command is applied THE SYSTEM SHALL return a new stack and leave its input unchanged.
2. WHEN a command is invalid (unknown id, duplicate id, deleting the last card) THE SYSTEM SHALL return the same stack reference.
3. WHEN the user deletes a card THE SYSTEM SHALL remove every action that targets it, and move `start` if needed.
4. WHEN the user deletes an object THE SYSTEM SHALL remove every show/hide action that targets it.
5. WHEN any command places an object THE SYSTEM SHALL keep it inside the 800x600 canvas.
6. WHEN the user undoes a change THE SYSTEM SHALL restore exactly the previous stack; redo SHALL restore the undone one.

## R4 Migrations
1. WHEN a document has an older `schemaVersion` THE SYSTEM SHALL apply migrations in order to reach the current version.
2. WHEN a document is already current THE SYSTEM SHALL return it unchanged (idempotent).
3. WHEN a document is newer than the app, or has no migration path, THE SYSTEM SHALL return an error.
4. IF the schema changes THEN `SCHEMA_VERSION` SHALL be bumped and a migration added in `src/core/migrate.ts`.

## Properties (tests/core)
- P3 referential integrity, P4 undo is an inverse, P6 migrations idempotent, P8 layout stays in canvas.
