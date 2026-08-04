# Architecture Study — Fantoche (working title)

> Status: **design phase** — no product code yet. This document records what we
> verified by reading the Revideo source (shallow clone of `midrender/revideo`,
> formerly `redotvideo/revideo`, Aug 2026) and the architectural decisions that
> follow from it. Companion
> decision records live in `adr/`.

## 1. What the Revideo base actually gives us (verified in code)

Monorepo (npm workspaces, Node >= 22.12), MIT license preserved from
Motion Canvas ("Copyright (c) 2022 motion-canvas").

| Package | Role | Verdict for us |
|---|---|---|
| `core` | Time model, signals, playback, `Renderer`, exporters (incl. in-browser WASM mp4 encoder) | Keep (fork base) |
| `2d` | Scene graph: `Node`, `Shape`, `Layout` (flexbox), `Txt`, `Latex`, `Code`, `SVG`, `Path`, `Img`, `Video`, `Audio`, even `Rive` embed | Keep; add character layer on top |
| `renderer` | Server-side `renderVideo()` / `renderPartialVideo()`: spawns N × (headless Chromium + Vite server), slices frame ranges, ffmpeg concat + audio merge | Keep |
| `ffmpeg` | Audio extraction/mixing, image-stream encoding, concat/merge helpers | Keep |
| `player`, `player-react` | Embeddable seekable player | Keep |
| `ui` | Dev editor (scrub/preview-centric) | Rebuild into authoring GUI (staged) |
| `vite-plugin`, `cli`, `create`, `template`, `examples`, `e2e`, `docs` | Dev loop & scaffolding | Keep |
| `telemetry` | Phones home (`sendEvent(RenderStarted)` in `renderer/server/render-video.ts`) | **Strip in fork** — community trust default |

### 1.1 The time model is deterministic *replay*, not addressable state

`core/src/app/PlaybackManager.ts` — `seek(frame)`:

- Seeking backward (or across scenes) calls `scene.reset()` and then steps
  `next()` **frame by frame** until the target (`while (this.frame < frame) …`).
- Scene state is whatever the generator coroutines produced up to frame *k*.
  There is no way to evaluate "state at t" without executing 0…t.

Consequences we measured against our goals:

1. **Random access is O(t)** — fine for playback, hostile to GUI editing
   (every scrub/edit re-simulates) and to direct manipulation.
2. **Parallel rendering replays the prefix**: `renderer/client/render.ts`
   computes each worker's frame slice, then `renderer.render(range)` must
   replay generators from 0 to the slice start inside each worker. Works, but
   only because simulation-without-paint is cheap.
3. **Animation has no stable identity.** "What happens at second 12" is an
   emergent property of code execution — nothing a GUI or an LLM can address,
   diff, or patch. This, more than syntax, is why a GUI never emerged upstream.

This is the single strongest argument for the declarative-document pivot (§3.1).

### 1.2 Rendering is imperatively welded to Canvas2D

- 34 files in `2d/src/lib` reference `CanvasRenderingContext2D`.
- `Node` exposes `render(ctx)` / `draw(ctx)` / `cacheCanvas()` /
  `setupDrawFromCache(ctx)`; subclasses draw imperatively (paths, filters,
  masks, cache canvases). Text (`Txt`, `Latex`, `Code`) leans on browser text
  measurement/rasterization.
- `core` touches canvas contexts in `Stage.ts`, `getContext.ts`, scenes.

So "swap Canvas2D for ThorVG" is not a renderer module swap; it is either
(a) a **Canvas2D-compatible facade** over another backend (the ctx API is the
de-facto IR), or (b) a new **display-list IR** emitted by nodes. See §3.2.

### 1.3 Render/export pipeline (working, worth keeping)

Per worker: page renders frames → exporter encodes (default
`@fantoche/core/wasm`, an in-browser mp4 encoder; alternative streams images to
ffmpeg) → per-worker `visuals.*` + `audio.wav` → server concatenates and
merges via ffmpeg. Deployment guides exist (Docker/serverless). This is the
"boring infra" that longform needs and that Motion Canvas never had — the core
reason to fork Revideo rather than Motion Canvas itself.

## 2. Layering target

```
authoring surfaces          GUI editor   ·   agents (LLM/MCP)   ·   hand-written JSON   ·   code
                                  \             |                    |                  /
source of truth      ────────►  document (versioned JSON, schema-validated)   ◄─ escape hatch:
                                        │                                        "code blocks"
compiler             ────────►  timeline IR (tracks, anchors, pose keys)         (generators with
                                        │                                         declared duration)
evaluator            ────────►  state(t)  — PURE function, O(1) seek
                                        │
runtime              ────────►  scene graph (@fantoche 2d nodes, kept)
                                        │
render backend seam  ────────►  Canvas2D (default)  |  ThorVG-WASM (gated)
                                        │
export               ────────►  wasm mp4 / ffmpeg image stream → concat/merge
```

The Revideo runtime survives *below* the evaluator: the document compiles down
to node-graph mutations per frame. Legacy generator scenes keep working beside
document scenes — that is the Motion Canvas compatibility story and the
community wedge.

## 3. The five differentiators, pressure-tested

### 3.1 D1 — Declarative document as source of truth ✅ (the pivot; do first)

**Design:** versioned JSON with a strict schema (zod → generated types →
published JSON Schema). Human- and LLM-friendly conventions: named entities,
relative times, anchors instead of absolute frames. Sketch:

```jsonc
{
  "version": "0.1",
  "meta": { "fps": 30, "size": [1920, 1080] },
  "assets": { "voice": { "type": "audio", "src": "narration.wav", "align": "narration.align.json" } },
  "cast": { "ana": { "character": "@fantoche/cast-teacher", "skin": { "hair": "#4a2e19" } } },
  "narration": {
    "audio": "voice",
    "segments": [
      { "id": "intro", "text": "Hoje vamos entender busca binária" }
    ]
  },
  "timeline": [
    { "at": "intro.start", "target": "ana", "pose": "wave", "dur": 0.5 },
    { "at": "intro.word:binária", "target": "ana", "gesture": "point-right" },
    { "track": "lipsync", "target": "ana.mouth", "from": "voice", "auto": true },
    { "at": "intro.end+0.3", "code": "./flourish.tsx#confetti", "dur": 1.2 }
  ]
}
```

**Why it unlocks everything at once:** O(1) seek (pure evaluation) → real GUI
scrubbing/undo (undo = inverse document patch); true parallel render without
prefix replay; agents author/patch a schema-validated file; format is
diffable/versionable. **Rule from day 1:** `version` field + migration
functions; golden-frame tests pin rendering of committed documents.

**Escape hatch:** a timeline item can reference a generator export ("code
block") with declared duration — code-first users lose nothing.

### 3.2 D2 — ThorVG-WASM renderer ⚠️ (real, but do NOT put on the critical path)

Honest reading of the coupling (§1.2): this is deep surgery with initially
invisible user value — *except* Lottie interop, which is a product feature.

**Decision:** introduce the **backend seam first** (typed subset of the ctx
operations the nodes actually use), keep Canvas2D as default backend, and run
ThorVG as a parallel spike with explicit gate criteria before committing:

- visual parity on the golden-frame corpus (tolerance defined per suite);
- text story for `Txt`/`Latex`/`Code` (ThorVG text shaping is the known risk);
- WASM size and per-frame throughput vs Canvas2D;
- Lottie import fidelity on a fixed corpus.

C++ contribution surface stays real (ThorVG upstream + the facade), without
betting the product's momentum on it. Full analysis in `adr/0003`.

### 3.3 D3 — Narration-anchored timeline ✅ (the "anyone can" unlock)

The narration track (audio + transcript + word-level timestamps) is the spine
of the document; events anchor to `segment.word` marks. Retiming narration
retimes the animation. Sources of timestamps: forced alignment
(whisper-family, offline/local-first) for recorded audio; TTS timepoints when
the voice is generated. Lipsync: phoneme → viseme track generated from audio
(Rhubarb-style), rendered by the character's mouth slot. Tool choices pinned
after research lands in `01-research.md`.

### 3.4 D4 — Pose layer as pure function of t ✅ (simpler than Rive, on purpose)

Character = **rig** (named FK groups/slots; IK later) + **poses** (named
parameter sets) + easing. `state(t) = interpolate(pose keys ≤ t)` — pure,
addressable, GUI-editable. Key simplification: output is *video*, not an
interactive runtime, so **no state machines in v1** — the timeline is the only
driver. That deletes the hardest concept non-animators face in Rive/Spine.
Characters are documents too (`character.json`: rig + poses + art slots) →
shareable template ecosystem ("cast library"), which is the actual
"anyone can do it" mechanism: most users pick a character, they don't rig one.

### 3.5 D5 — Authoring GUI ✅ (staged; editing = document patches)

Because the GUI edits the document (not code), each stage is small:
v0 timeline + inspector (tweak times/poses/anchors, live preview);
v1 pose editor (drag handles → pose params);
v2 full authoring (draw/import art, rig binding).
The existing `player`/`vite-plugin` infra carries preview; the `ui` package is
scrub-centric and gets progressively replaced rather than patched.

## 4. Compatibility & upstream strategy

- Fork Revideo **with git history**; keep `upstream` remote for cherry-picks
  while phases 0–1 touch mostly new packages.
- Motion Canvas / Revideo projects must keep rendering (generator scenes are
  first-class runtime citizens) — migration guide + compat CI job.
- Strip `telemetry` at P0.

## 5. Open questions (tracked, not blocking)

1. Authoring surface: strict JSON vs JSON5/YAML front-end that compiles to JSON.
2. Character format details: slot/attachment model (Spine-like) vs plain group tree.
3. Camera/scene model in the document (multi-scene, transitions).
4. Plugin API for custom node types and effects.
5. Name and npm scope (`fantoche` free on npm as of 2026-08-04; org availability unverified).
