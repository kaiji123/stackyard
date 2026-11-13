# Requirements: HTML export and import

## R1 Single file
1. WHEN the user exports THE SYSTEM SHALL produce ONE HTML file containing the player, styles, fonts and the stack data, and nothing else.
2. THE file SHALL make zero network requests, use no ES module imports, and run over `file://` while offline.
3. THE file SHALL embed the Silkscreen and VT323 fonts as data URIs so the look needs no installed fonts.

## R2 Safety
1. THE file SHALL carry a CSP with `default-src 'none'` and `script-src` allowed only by the sha256 of the player script.
2. User text SHALL only ever be set with `textContent`; the data block SHALL escape `<`, `>`, `&`, U+2028 and U+2029.
3. WHEN any user text contains `</script>`, markup or control characters THE SYSTEM SHALL still export exactly the expected script elements.

## R3 Round trip
1. WHEN an exported file is imported THE SYSTEM SHALL restore a stack equal to the original (minus unused assets).
2. WHEN a file is not a stack, is damaged, is newer than the app or fails validation THE SYSTEM SHALL explain why and keep the current stack.
3. WHEN a file is an older schema version THE SYSTEM SHALL migrate it.

## R2b Pictures
WHEN a stack has pictures THE SYSTEM SHALL embed them as data URIs with their original bytes preserved for kept PNG/GIF, and the player SHALL draw `crisp` images with `image-rendering: pixelated` and text tones with the same CSS in the editor and in exports.

## R3b File names and accessibility of the player
1. THE downloaded file name SHALL come from the title, keeping letters and digits of every script and removing only characters file systems reject; "stack" only when nothing usable remains.
2. WHEN the player changes card THE SYSTEM SHALL move focus into the new card (first interactive object, else the card), and announce the card name in a polite live region.
3. THE Tab key SHALL visit only clickable objects. The card itself and static text SHALL NOT be tab stops.

## R4 Size
THE SYSTEM SHALL show the measured size of the real export file and warn above 10 MB. The player SHALL stay under 30 KB min+gzip.

## R5 Skin
WHEN the stack uses the haunted skin THE player SHALL flicker and show a ghost trail, unless the viewer prefers reduced motion.

## Properties
- P1 export round trip. P2 no script injection. Smoke: every template exported and played offline in Chromium, Firefox and WebKit.
