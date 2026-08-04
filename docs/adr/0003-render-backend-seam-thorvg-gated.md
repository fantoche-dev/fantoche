# ADR 0003 — Render backend seam first; Canvas2D stays default; ThorVG-WASM behind a gate

- Status: **proposed** (design phase)
- Date: 2026-08-04

## Context

Rendering is imperatively welded to `CanvasRenderingContext2D`: 34 files in
`2d/src/lib` reference it; `Node.render/draw/cacheCanvas/setupDrawFromCache`
draw directly into contexts; text nodes (`Txt`, `Latex`, `Code`) depend on
browser text measurement/rasterization. "Swap the renderer" is deep surgery,
not a module replacement. Meanwhile ThorVG (v1.1, MIT, Samsung+LottieFiles
backed) now ships **`@thorvg/webcanvas`** — an official TypeScript npm paint
API (~0.87 MB WASM, SW/WebGL/WebGPU) — so building our paint tree from JS is a
supported path, and the same C++ engine compiles natively, opening a
**browserless deterministic export** endgame (today's pipeline needs headless
Chromium + ~8–10 GB RAM per worker). The known risk is text: no bidi/RTL/
complex shaping, no HarfBuzz (thorvg#3397) — acceptable for PT/EN, and the
concrete upstream C++ contribution opening (see `01-research.md` §3).

## Decision

1. Define a **RenderBackend seam**: a typed subset of the context operations
   the nodes actually use (path ops, transforms, fills/strokes, clips, filters,
   image blits, text runs). Canvas2D implements it trivially and remains the
   default backend.
2. Build the ThorVG-WASM backend as a **parallel spike**, promoted only if it
   passes explicit gates:
   - visual parity on the golden-frame corpus (per-suite tolerances);
   - a credible text story for `Txt`/`Latex`/`Code`;
   - WASM size and per-frame throughput acceptable vs Canvas2D;
   - Lottie import fidelity on a fixed corpus.
3. Lottie **import** may ship via ThorVG even while Canvas2D remains the
   default preview backend (import ≠ preview path).
4. If the gates pass, the promotion prize is not just parity — it is
   **exporting without a browser**: pure evaluator + native ThorVG turns
   `renderVideo()` from "N Chromiums × 8–10 GB" into a plain native process.

## Consequences

- Product momentum (document, poses, narration, GUI) never blocks on renderer
  work; renderer work gains an objective finish line.
- The seam doubles as the display-list IR if we later outgrow the ctx-shaped
  interface.

## Rejected alternatives

- **Big-bang ThorVG rewrite**: months of invisible work, text regressions,
  momentum death — the classic fork-killer.
- **CanvasKit/Skia-WASM as default**: binary size and maintenance posture make
  it a worse default than the browser's own Canvas2D (details in research).
