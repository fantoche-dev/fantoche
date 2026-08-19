# P2 good-first issue drafts

These are ready to copy into GitHub after the P2 gate. Each is deliberately
small, has a fixture path, and avoids changing the document format.

## Add a compatible A–H/X viseme sheet

**Why:** The lipsync track format is reusable, but the repository currently
ships one deliberately plain teaching mouth sheet.

**Scope:** Add nine SVG files with the same `viewBox`, one for each of
`A B C D E F G H X`, under a new fixture directory. Add a short README with a
rendered contact sheet and run `fantoche lipsync preview` against the committed
PT-BR sample track.

**Acceptance:** all nine files pass `readMouthSheet`; the preview document
validates; a Linux golden pins the contact sheet; artwork provenance and license
are recorded. No schema or viseme-letter changes.

## Add corner pivot presets

**Why:** `center`, edge-center, and top/bottom presets cover the reference cast,
but rectangular props often hinge at a corner.

**Scope:** Add `top-left`, `top-right`, `bottom-left`, and `bottom-right` to the
character pivot preset enum and the importer’s preset resolver.

**Acceptance:** schema and JSON Schema agree; one importer test covers every new
preset; one FK test rotates a child around a corner; the authoring guide lists
the presets. Explicit `[x, y]` pivots remain unchanged.

## Add three poses to a reference character

**Why:** The teacher and bird prove different FK topologies, but their pose
libraries are intentionally minimal.

**Scope:** Add three useful named poses to either reference character, such as
`think`, `celebrate`, and `point-left`. Include a `rest` route for every slot
the new poses touch.

**Acceptance:** `fantoche character check` stays clean; a small document
word-anchors all three poses; Linux goldens pin the middle of each transition;
depth returns to its rest value after any front/back swap.

## Add a language-specific viseme-map fixture

**Why:** ADR 0007 showed that mapping and timing fail differently. More language
fixtures let the re-spike improve a map without pretending it is already an
automatic engine.

**Scope:** Add one short, licensed recording plus exact transcript and expected
grapheme/viseme cases for a language not already covered. Keep the work inside
the dev-time adapter and test fixtures.

**Acceptance:** the recording and license are committed; transcript tokens
match the audio; tests cover at least one language-specific digraph, one rounded
vowel, one bilabial, and one measured pause; PT-BR and EN fixtures remain
unchanged. This issue does not alter ADR 0007 or claim production quality.
