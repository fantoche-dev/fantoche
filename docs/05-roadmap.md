# Roadmap — phases and gates (no dates)

> Each phase has an explicit **gate**: verifiable criteria that must pass
> before the next phase starts. Riskiest assumptions are spiked earliest.
> Scope guardrails live in `02-vision.md` §4.

## P0 — Fork & foundation

- Fork `midrender/revideo` with full history; add `upstream` remote.
- Rename npm scope; single rename, then stable. Strip `@revideo/telemetry`
  and `sendEvent` calls.
- CI: build + unit tests green on Linux/macOS; compat job renders one known
  Motion Canvas project and one known Revideo project (golden frames).
- Repo hygiene: MIT, CODE_OF_CONDUCT, CONTRIBUTING, issue templates, ADR dir
  (these docs), public roadmap.
- **Gate:** clean clone → `npm install` → render the template project to mp4
  on a fresh machine, no telemetry traffic, compat goldens pass.

## P1 — Document format v0 + compiler

- JSON schema (zod → generated types → published JSON Schema), `version`
  field + migration scaffold from day 1.
- Compiler: document → timeline IR → evaluator `state(t)` driving the
  existing scene graph. Code-block escape hatch (generator with declared
  duration) working.
- CLI: `render doc.json` headless; deterministic output.
- Golden-frame test corpus for committed documents.
- Explainer elements are first-class in the document from v0: `Code` (with
  highlight/diff animations), `Latex`, `SVG`/paths/arrows, layouts — anchored
  to narration exactly like everything else (no character required).
- **Gate:** a non-trivial doc (text, shapes, images, a Code node with an
  animated highlight, an embedded code block) renders identically via player
  scrub and headless export; seek is O(1) (measured, no generator replay for
  document scenes).

## P2 — Characters, narration, lipsync

- `character.json` format: rig (named FK groups/slots), poses, art slots
  (SVG import). 2–3 reference characters built by us.
- Narration track: audio + transcript + word timestamps (WhisperX-class
  local pipeline; ElevenLabs timestamps as alternate source); anchor
  resolution (`intro.word:binária`, `intro.end+0.3`).
- Lipsync spike — **explicitly gated on Portuguese quality** (ADR 0004):
  Rhubarb (phonetic mode) vs WhisperX-phoneme→viseme mapping; pick by
  blind comparison on PT-BR and EN samples.
- **Gate:** the north-star demo (vision §5) end-to-end in ugly-but-working
  form, in Portuguese, offline.

## P3 — Editor v0

- Timeline + inspector over the document (edit times, poses, anchors; live
  preview); undo/redo as document patches; save round-trips losslessly.
- No art authoring yet; property editing only.
- **Gate:** a non-programmer completes the north-star demo without touching
  JSON or code (observed user test, n≥3).

## P4 — Renderer decision + Lottie

- Implement the RenderBackend seam (typed subset of ctx ops); Canvas2D
  backend ships as default.
- ThorVG-WASM backend spike against ADR 0003 gates (parity corpus, text
  story, size/perf, Lottie import fidelity).
- Lottie import (via ThorVG) regardless of backend decision; Lottie export
  investigated (MC community demand #1050).
- **Gate:** documented go/no-go on ThorVG promotion with measurements; if go,
  browserless-export prototype (native ThorVG, no Chromium) benchmarked.

## P5 — Agent layer + launch

- MCP server: create/patch/validate documents, render previews, list cast
  library; agent-authoring guide with schema.
- Cast library site + docs site (examples-first), migration guide from
  Motion Canvas/Revideo.
- Explainer scene templates alongside the cast library: code-walkthrough,
  diagram build-up, side-by-side comparison — insertable presets are what
  make the editor "light and practical" for the primary audience.
- Launch sequence: (1) friendly heads-up to canvas-commons + MC Discord —
  ally posture, not landgrab; (2) Show HN with the north-star demo video;
  (3) educator communities (Manim/3b1b-adjacent, where "From Manim to
  Motion Canvas" already has an audience).
- **Gate:** an external person and an external agent each produce a talking-
  character video without our help; three external contributors merged.

## Testing strategy (cross-phase)

- **Golden frames** everywhere: document corpus rendered per-commit,
  per-backend, compared with per-suite tolerances — this is what makes the
  renderer seam and the ThorVG gate honest.
- Property tests on the document format (parse/serialize round-trip,
  migration idempotence, evaluator purity: same doc + same t ⇒ same state).
- Lipsync/alignment fixtures: committed audio samples with expected viseme
  and word-timing windows (PT-BR and EN).
- Compat suite: pinned MC + Revideo projects must keep rendering.

## Open-source hygiene checklist (P0 unless noted)

- [ ] MIT license, correct attribution chain (motion-canvas → revideo → us)
- [ ] CODE_OF_CONDUCT, CONTRIBUTING with a contribution ladder
      (cast/characters · docs · TS · C++)
- [ ] Issue/PR templates; good-first-issue seeding (P1+)
- [ ] ADRs public (this directory); roadmap public; decisions in the open
- [ ] No telemetry, ever, in the OSS packages
- [ ] Release automation (changesets or equivalent) (P1)
- [ ] Docs site with runnable examples (P2+); cast library gallery (P5)
- [ ] Discord (or Zulip) once there is something to discuss (P2+)
