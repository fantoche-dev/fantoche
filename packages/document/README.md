# @fantoche-dev/document

The versioned JSON document format that is Fantoche's source of truth (ADR
0002), with its compiler and pure evaluator. A document describes a video
declaratively — elements, a timeline with narration anchors, named easings — and
the runtime evaluates `state(t)` in O(1): no generator replay, real scrubbing,
cheap parallel rendering.

```jsonc
{
  "version": "0.1",
  "meta": {"fps": 30, "size": [1920, 1080], "background": "#0d0d12"},
  "narration": {
    "segments": [
      {
        "id": "intro",
        "text": "Hoje vamos entender busca binária",
        "start": 0.5,
        "dur": 3.2,
        "words": [{"text": "binária", "start": 3.1}],
      },
    ],
  },
  "elements": [
    {
      "id": "title",
      "type": "text",
      "props": {
        "text": "Busca binária",
        "fontSize": 64,
        "fill": "#fff",
        "opacity": 0,
      },
    },
    {
      "id": "snippet",
      "type": "code",
      "props": {"code": "while (lo < hi) { … }", "fontSize": 24},
    },
  ],
  "timeline": [
    {
      "at": "intro.start",
      "target": "title",
      "tween": {"opacity": {"to": 1}},
      "dur": 0.5,
    },
    {
      "at": "intro.word:binária",
      "target": "snippet",
      "select": {"lines": [0, 0]},
      "dur": 0.4,
    },
    {
      "at": "intro.end+0.5",
      "block": {"src": "./flourish.tsx#confetti", "dur": 1.2},
    },
  ],
}
```

## Rendering

```sh
fantoche render doc.json            # headless → output/doc.mp4
```

or programmatically:

```ts
import {makeDocumentProject} from '@fantoche-dev/document/scene';
export default makeDocumentProject(doc);
```

## Package layout

| Entry                              | Contents                                                         | Environment                                   |
| ---------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| `@fantoche-dev/document`           | schema, validation, migration, compiler (document → timeline IR) | node + browser, dependency-free of the engine |
| `@fantoche-dev/document/evaluator` | pure `evaluateFrame(ir, frame)` / `evaluate(ir, seconds)`        | needs `@fantoche-dev/core` (bundler or CJS)   |
| `@fantoche-dev/document/scene`     | `DocumentScene`, `makeDocumentScene`, `makeDocumentProject`      | browser (drives `@fantoche-dev/2d`)           |

The published JSON Schema lives at
[`schema/document-0.1.schema.json`](./schema/document-0.1.schema.json) — point
editors and agent validators at it. A test pins it to the zod schema.

## Format contract (v0.1)

- **Anchors**: `seg.start`, `seg.end`, `seg.word:<word>`, each with an optional
  `+`/`-` seconds offset. Word timings are explicit in v0 (auto-alignment
  arrives with the narration pipeline, P2). A word that itself ends in
  `+/-<digits>` cannot be expressed — the compiler warns when it strips an
  offset from a word anchor.
- **Easings**: 31 named, pure functions (`linear`, `easeInOutCubic`, …,
  `easeOutElastic`). No springs — they are iterative, not closed-form, and
  cannot live behind a pure `state(t)`.
- **Elements**: `text`, `rect`, `circle`, `line`, `path`, `polygon`, `image`,
  `svg` (inline markup only in v0), `latex` (renders via MathJax,
  transforms/opacity animate; the TeX itself hard-swaps), `code`, `layout`
  (flexbox; children are layout-positioned, everything else is absolute).
- **Timeline items**: `set` (jump), `tween` (`to`/optional `from`, `dur`,
  `easing`), code `select`/`edit` (0-based lines, end-exclusive columns, `null`
  = to-the-end), and `block` — see below. Overlapping animations of the same
  prop, edits of the same code element, or block windows are compile errors, not
  last-wins.
- Animated prop names are compile-checked against a per-element allow-list; a
  typo'd or non-animatable prop is an error with a `/timeline/N` path.

## The code-block escape hatch

A `block` references a generator export with a **declared duration** — the
code-first door (ADR 0002) for anything the format cannot say yet:

```ts
export function* confetti(container: Node): ThreadGenerator {
  // build nodes under `container`; one yield = one frame
}
```

Contract and limitations (v0):

- The generator receives a container `Node` parented to the view; its nodes are
  disposed when the window exits.
- Stepping mirrors generator scenes: one baseline step on window entry, then one
  per frame; promise/promisable yields are awaited and fed back and do **not**
  advance frames.
- Seeking into or backward within a window replays the generator from the window
  start — replay cost is bounded by the **block's** duration, never the
  document's.
- Blocks must be deterministic (no randomness, no wall-clock) or scrub-vs-export
  identity breaks — this is the author's responsibility.
- Time-based tweens (`yield* tween(…)`) inside blocks are driven by the playback
  clock; frame-stepped logic is the reliable v0 idiom.

## What is deliberately NOT in v0

- Springs (see easings above).
- `video` / `audio` elements — their play model is wall-clock-driven;
  frame-exact document control is a v0.2 design item.
- `icon` (hits a CDN at render time — offline-first violation).
- svg asset files (`props.src`) — inline markup only for now.
- Narration **audio** playback/muxing — the narration track today provides
  timing anchors; audio wiring lands with the narration pipeline.
- Code syntax highlighting configuration — code renders unhighlighted (set
  `props.fill` for the token color) until a `language`/highlighter prop is
  designed.

## Versioning

`version` is required. `migrateDocument()` walks registered migrations to the
current format and errors actionably on unknown versions; goldens in
`packages/e2e/documents` pin rendering semantics per commit.
