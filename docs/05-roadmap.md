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
  form, in Portuguese, offline. *(Passed as written — evidence below. The
  same-day English-first decision then promoted the English version to
  primary north-star demo; see the addendum after the table.)*

### P2 gate evidence — 2026-08-19

**Status: technical pass with a provisional test voice.** Every runtime and
offline clause below is measured. The committed `pt-BR-FranciscaNeural` Edge
TTS WAV remains a preview stand-in; public-release sign-off still requires an
owned human recording or licensed Azure asset and a re-aligned manual mouth
track. That replacement does not block P3 code.

| Clause | Evidence |
| --- | --- |
| Character format and 2–3 references | `character.json` carries slots, FK parents, pivots, rest depth, poses, and A–H/X bindings. `teacher` and `bird` are two committed references with different FK topologies; both pass `character import → bind → check`. |
| Narration and word anchors | The north-star transcript has 241 tokens in 12 segments. Local WhisperX forced alignment placed all 241/241 with absolute document times; the compiler reports zero anchor warnings. |
| PT-BR lipsync decision | ADR 0007 records that neither automatic arm reached ≥3 on every PT-BR axis. Rhubarb scored closure/rounding/jitter/drift = 3/2/4/5; WhisperX = 2/3/2/4. The shipping path is manual: 455 reviewed cues, all 108 aligned bilabials on A, 40 measured rests, minimum hold 0.100 s. |
| North-star, Portuguese, offline | The 1920×1080 render is 91.665 s with H.264 video and AAC audio. Normal and `fantoche render --offline` outputs are byte-identical: SHA-256 `735adb2c9dc9089d94cf15e85aae740b9623b01f49a174a6769ea263b67fb328` (re-measured after the 2026-08-19 label-collision fix; the gate-day hash was `57495526…`). |
| O(1) seek with rigs | Five local runs over the same three-slot FK state measured a median 0.020 ms/seek for the 4 s rig and 0.016 ms/seek for a 600 s rig with 300 extra pose events. The test asserts the long document remains below both 20 ms and the short-run tolerance. |

### English-first addendum — 2026-08-19

Content is **English-first**: launch material, authoring examples, and the
primary north-star demo are English. Portuguese does not leave the project —
it becomes the second-language control that keeps the lipsync path
language-aware (vision §5, ADR 0004 caveat). Concretely,
`packages/e2e/demo/north-star/` is now the English lesson and
`packages/e2e/demo/north-star-pt-br/` the matched PT-BR control (the document
the table above was measured on; those rows remain its evidence).

English north-star evidence, measured 2026-08-19 with the same method:

| Clause | Evidence |
| --- | --- |
| Narration and word anchors | 250-token English transcript in 12 segments; local WhisperX English forced alignment placed 250/250 with absolute document times; the compiler reports zero anchor warnings. |
| EN lipsync | The untouched adapter draft has 889 cues with all 59 aligned bilabials on A but 632 intervals under 0.100 s — better closure than the PT-BR draft (87/108), same jitter. The shipped track is the manual review: 403 cues, minimum hold 0.100 s, 59/59 closures on A, 63 measured rests (ADR 0007 rules). |
| North-star, English, offline | The 1920×1080 render is 90.565 s with H.264 video and AAC audio. Normal and `fantoche render --offline` outputs are byte-identical: SHA-256 `72f401a3007e30f4f09fb1e40bb2d7711482e4f492a7bd3890fe59e4854e047e`. |

Author workflow: [authoring-guide.md](authoring-guide.md). Ready-to-file
contributor work: [P2 good-first issue drafts](good-first-issues-p2.md).

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

Audited against the tree 2026-08-19; every box below was verified, not
assumed.

- [x] MIT license, correct attribution chain (motion-canvas → revideo → us) —
      `LICENSE` carries all three copyrights; `README.md` states the chain and
      preserves the upstream README at `docs/UPSTREAM-REVIDEO-README.md`
- [x] CODE_OF_CONDUCT, CONTRIBUTING with a contribution ladder
      (cast/characters · docs · TS · C++)
- [x] Issue/PR templates; good-first-issue seeding (P1+) —
      `.github/ISSUE_TEMPLATE`, `.github/PULL_REQUEST_TEMPLATE.md`, and
      [P2 drafts](good-first-issues-p2.md)
- [x] ADRs public (this directory); roadmap public; decisions in the open
- [x] No telemetry, ever, in the OSS packages — enforced by CI's
      `no-telemetry` guard, not only by policy
- [x] Release automation (P1) — `lerna publish` on conventional commits, npm
      OIDC trusted publishing, and a guard that fails the release when the
      scaffolder's template pins drift from `lerna.json`
- [ ] Docs site with runnable examples (P2+); cast library gallery (P5) — see
      the docs-site audit below
- [ ] Discord (or Zulip) once there is something to discuss (P2+)

### Docs-site audit — 2026-08-19

`packages/docs` is still Revideo's own documentation, verbatim: 535
occurrences of the upstream name, an index that opens "Welcome to Revideo!"
and states *Revideo's* fork attribution rather than ours, and 21 asset URLs
pointing at upstream's S3 bucket. It is `--ignore`d in every CI job and in
the publish workflow, so it is neither built, tested nor released.

**The rebranding sweep recorded in the P2 hygiene queue is deliberately not
run.** A find-and-replace over that tree would break the 21 upstream asset
URLs, leave the pages documenting someone else's API under our name, and
rewrite an attribution statement that is correct as upstream's and wrong as
ours. The attribution that matters is at the repo root, and it is correct.

The docs site is P5 work ("docs site, examples-first"), and it is a rewrite,
not a rename. Until then it stays unbuilt and unpublished — which is the
honest state for inherited content we have not adopted.
