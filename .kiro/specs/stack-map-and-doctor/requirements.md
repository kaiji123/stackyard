# Requirements: stack map and doctor

## R1 Map
1. THE SYSTEM SHALL draw cards as nodes and card-to-card links as arrows, laid out by distance from the start card.
2. WHEN a card cannot be reached from the start THE SYSTEM SHALL colour it red; WHEN it has no way out THE SYSTEM SHALL colour it amber.
3. WHEN the user clicks a node THE SYSTEM SHALL open that card for editing.

## R2 Graph analysis
1. THE SYSTEM SHALL follow each click's actions in order, exploring both branches of an `if`.
2. THE SYSTEM SHALL treat `back` as "stay" because it depends on history.
3. Every card the player can really reach SHALL be statically reachable (soundness), and without conditions or hiding the two sets SHALL be equal.

## R3 Doctor rules
THE SYSTEM SHALL report: unreachable cards, dangling targets, buttons with no action, images with no data, flags checked but never set, items checked but never added, dead ends (info), and **text boxes that overlap while visible together**.

## R4 Findings are actionable
WHEN the user clicks a finding THE SYSTEM SHALL select the card and object it names.

## Properties
- P3 nothing dangles silently. P7 graph agrees with play. Overlap: reports every overlap visible at start; reports nothing when no rectangles intersect.
