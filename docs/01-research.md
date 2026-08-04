# Research — verified facts (2026-08-04)

> Method: four parallel research passes (Revideo state, Motion Canvas
> community, rendering/narration tech, product landscape) + direct source
> reading of the Revideo monorepo. Every claim below was checked against a
> primary source on 2026-08-04. Confidence marks: ✅ confirmed · ≈ likely · ? unclear.

## 1. Revideo — the proposed fork base

**Headline: the base is sound (MIT, real infra), the project is effectively
unmaintained, and no community successor exists. The fork window is open.**

- ✅ Repo moved: `redotvideo/revideo` → **`midrender/revideo`** (GitHub org
  renamed July 2026; old URL 301-redirects). 3,955 stars, ~202 forks, not
  archived. <https://github.com/midrender/revideo>
- ✅ **MIT everywhere**: LICENSE (still "Copyright (c) 2022 motion-canvas"),
  GitHub API, and npm `@revideo/*` all MIT.
- ✅ **Activity**: zero commits June 2025 → June 2026; a 19-commit burst
  July 9–15 2026 (rebrand plumbing, npm OIDC, one headless-render fix), all by
  one maintainer; nothing since. Release 0.10.4 (2025-02-24) → 0.11.0
  (2026-07-10): a ~16.5-month gap.
- ✅ **Support is dead in practice**: post-revival issues #398/#399/#401 have
  zero maintainer replies; community PR #400 (Windows path fix) unmerged.
  A user comment on #373 (2026-06-16): "They abandoned this project."
- ✅ **The pivot**: YC S23 company (Haven Technologies, Inc.; Haven → Revideo →
  **Midrender**). Official page "The next chapter of Revideo"
  (<https://midrender.com/revideo>): the team "now primarily works on
  Midrender"; engine work continues inside Midrender but "recent changes have
  not yet been upstreamed to the open-source repository."
- ✅ **Midrender is competitive intel**: "AI motion graphics you can still edit
  by hand" — AI agent + visual timeline editor on the Revideo engine, MCP/CLI
  for Claude Code/Cursor. They validated our architectural thesis
  (document-editable engine + GUI + agents) — commercially and closed.
- ✅ **Community**: Discord ~878 members; npm ~7.5k weekly downloads of
  `@revideo/core`; Show HN 2024 got 298 points; no marquee users.
- ✅ **No active fork**: highest-starred fork has 1 star; most-recent forks are
  0 commits ahead. Nobody has claimed the successor role.
- ✅ **Telemetry**: PostHog-based render-count telemetry, `DISABLE_TELEMETRY=true`
  to opt out → we strip it at P0 (ADR 0001).
- ✅ **Infra facts** (docs + source): `renderVideo({workers: N})` = N ×
  (headless Chromium via Puppeteer + Vite server), contiguous 1/N time slices;
  `renderPartialVideo({workerId, numWorkers})` for cross-machine (Lambda guide,
  "significantly faster cold starts"); returns separate audio + mute video,
  stitched with `concatenateMedia` + `mergeAudioWithVideo`; ~8–10 GB RAM per
  render job recommended; default exporter is the in-browser WASM mp4 encoder.

### 1.1 Source-level findings (our own reading of the monorepo)

- ✅ Seek = **replay**: `core/src/app/PlaybackManager.ts:83-109` — backward
  seek resets the scene and steps generators frame-by-frame to the target.
  State at t is only reachable by executing 0…t (full analysis:
  `03-architecture.md` §1.1).
- ✅ Canvas2D weld: 34 files in `2d/src/lib` reference
  `CanvasRenderingContext2D`; nodes draw imperatively (§1.2).
- ✅ Rich node set already present: `Txt`, `Latex`, `Code`, `SVG`, `Path`,
  `Img`, `Video`, `Audio`, `Layout` (flexbox), and a `Rive` embed component.
- ✅ Worker slicing is client-side: `renderer/client/render.ts` computes the
  worker's frame range and calls `renderer.render(range)` → prefix replay
  inside each worker.

## 2. Motion Canvas — the semi-orphaned community

**Headline: not archived but effectively frozen since Feb 2025; a credible
but tiny community fork (canvas-commons) already exists; the community's
top demands overlap three of our differentiators — and notably do NOT include
character rigging.**

- ✅ Status: not archived; MIT; 18,888 stars; last substantive commit
  **2025-02-16**; last stable release v3.17.2 (2024-12-14). The only 2026
  activity: the author reappeared once (2026-07-02) to fix the docs domain
  after **motioncanvas.io was sniped by a squatter** (NXDOMAIN Feb 2026 →
  re-registered by a third party May 2026; new official domain is
  hyphenated `motion-canvas.io`).
- ✅ No formal step-back announcement exists anywhere public. The author
  (aarthificial) went quiet mid-2024 (last YouTube upload 2024-05-14);
  proposed MIT→GPL for sustainability in Mar 2024 then shelved it
  (discussion #1015); left "Is the repo dead?" (#1221, Dec 2025, 10
  reactions) unanswered. 18 commits by him in `elevenlabs/packages`
  (Apr–May 2025) — employment there ≈ likely, unconfirmed. Community verdict
  (PolyMeilex, #1221): "I would say it is dead. But surprisingly it's still
  the best tool around IMO."
- ✅ Community size: Discord 2,718 members (~560 online); npm
  `@motion-canvas/core` ~18.2k downloads/month — still 38× the fork's.
  Users: small/mid tech-explainer channels (`#MadeWithMotionCanvas`); a
  "From Manim to Motion Canvas" educator tutorial series exists (slama.dev).
- ✅ **canvas-commons** — the community successor fork: created 2025-07-20 by
  **hhenrichsen** (a maintainer of the original MC org), active (last push
  2026-07-30), 215 stars, same API re-scoped to `@canvas-commons/*`, adds an
  ffmpeg exporter, hosts the archived MC docs. Traction: npm only since
  May 2026, **483 downloads/month**, Discord **133 members**. Credible,
  under-scaled, and *scope-conservative* (continuation, not reinvention).
- ✅ What the community asks for (top-voted issues):
  - headless/server rendering (#415, #188, #488) → **Revideo already solved this**;
  - presentation mode (#213 — single most-reacted, 41 reactions);
  - **GUI editing**: editable signals from the UI (#170, 14 reactions),
    undo/redo (#371), color-picker (#910) → *our D5*;
  - embedding docs (#247) and a **Lottie exporter** (#1050 — proposed by the
    author himself) → *our D2/ThorVG angle*;
  - **MCP/LLM integration** — a 2025–26 theme: "Motion Canvas MCP"
    (discussion #1210), Show HN "Agent skills for generating structured
    visuals with MotionCanvas" (2026-03) → *our agent layer*;
  - 3D (discussion #1011).
- ✅ **No significant demand for character/rigging features** in MC
  issues/discussions. Implication recorded in `02-vision.md`: the MC/Revideo
  developer community is our *contributor base and infrastructure lineage*;
  the *demand* for characters comes from a different audience (educators and
  creators currently priced into Vyond/Character Animator/HeyGen — §4).
- Sentiment: **semi-orphaned** — stable tool, no owner engagement, gravity
  still with the frozen original; consolidation into canvas-commons is real
  but incomplete. Strategy note: canvas-commons is a potential **ally**
  (shared lineage, complementary scope), not a rival to displace.

## 3. Rendering & narration technology

**Headline: ThorVG is viable now — v1.0 (2026-01) / v1.1 (2026-07), MIT, and
`@thorvg/webcanvas` is an official TypeScript npm paint API (not just a Lottie
player). Its text stack is the real limitation. For narration: WhisperX for
alignment, ElevenLabs for TTS timestamps, Rhubarb for lipsync — with a
Portuguese-language caveat.**

### 3.1 ThorVG

- ✅ v1.1.0 (2026-07-22); v1.0.0 (2026-01-31) was a generational rewrite. MIT.
  Backed by Samsung + LottieFiles; production users: Godot (SVG importer),
  LVGL, the official dotLottie web players, LottieCreator.
  <https://github.com/thorvg/thorvg>
- ✅ **`@thorvg/webcanvas` 1.1.0** (npm, 2026-07-21): official TS API for
  programmatic shapes/paths/gradients, hierarchical scenes, text, SW/WebGL/
  WebGPU backends, threaded build. WASM ≈ **0.87 MB** uncompressed (vs
  CanvasKit's 6.8–7.7 MB). Building our paint tree from JS is the supported
  path — no Lottie detour needed. <https://github.com/thorvg/thorvg.web>
- ✅ Lottie support is near-complete (it is LottieFiles' production renderer);
  expressions experimental. SVG = Tiny profile (not full 1.1/2.0).
- ✅ **Text gaps** (tracked in thorvg#3397, unassigned): no bidi/RTL, no
  complex-script shaping, no WOFF2, emoji undocumented. Latin scripts (PT/EN)
  are fine. No HarfBuzz. **This is the concrete C++ contribution opening.**
- ✅ Same engine compiles native → **browserless deterministic export** becomes
  possible (today's Revideo pipeline needs headless Chromium + ~8–10 GB RAM
  per worker). Structurally sound; end-to-end parity unverified in the wild. ≈
- ✅ Healthy upstream: 190 commits May–Aug 2026, ~99 contributors, welcoming
  CONTRIBUTING.md.

### 3.2 Alternatives (condensed)

| | ThorVG-WASM | CanvasKit | rive-runtime | vello | Canvas2D |
|---|---|---|---|---|---|
| License | MIT | BSD-3 | MIT | Apache/MIT | — |
| WASM size | **0.87 MB** | 6.8–7.7 MB | build-your-own | build-your-own | 0 |
| Official JS paint API | **yes** | yes | no (.riv playback only) | no | native |
| Text shaping/RTL | no (#3397) | yes (ICU+HarfBuzz) | Rive-internal | via Parley (Rust) | browser-quality |
| Same-engine headless export | yes | yes | GPU-only | yes (cpu) | **no** |

- CanvasKit: maintained (Flutter web default), but 8–11× the size.
- rive-renderer: folded into `rive-app/rive-runtime` (MIT); no standalone JS
  paint API; GPU-only — would mean maintaining our own C++ bindings.
- vello: "web is not currently a primary target", API unstable, no JS bindings.
- Canvas2D baseline gaps: `ctx.filter` absent in Safari stable; no path
  booleans; no mesh gradients; cross-engine determinism structurally
  unachievable (mitigated today because Revideo previews *and* exports in
  Chromium).

### 3.3 Narration & lipsync

- ✅ **WhisperX** (BSD-2, active, last commit 2026-07): Whisper + VAD + wav2vec2
  forced alignment — de-facto standard for word timestamps. Python/local;
  not browser-feasible. whisper.cpp has official WASM but word timestamps are
  experimental quality. MFA active (v3.4.1, 2026-07); gentle dormant.
- ✅ **ElevenLabs TTS returns character-level timestamps**
  (`…/with-timestamps`), explicitly marketed for lipsync — best TTS source of
  timing. **OpenAI TTS returns none.** Google TTS only via self-inserted SSML
  `<mark>`s (buggy per forum reports).
- ✅ **Rhubarb Lip Sync** (MIT, v1.14.0, slow-but-alive): audio → timed mouth
  shapes (6+3 Hanna-Barbera visemes). CLI, C++. ⚠️ Default recognizer
  (PocketSphinx) is **English-only**; the language-independent "phonetic" mode
  is weaker — matters for Portuguese narration. Only third-party WASM ports
  exist (unproven). Alternative route: derive visemes from WhisperX phoneme
  alignment (language-aware) and map phoneme→viseme ourselves.

## 4. Product landscape & the gap

**Headline: as of Aug 2026 no tool — commercial or OSS — combines (a)
non-animator UX for a talking vector character synced to narration, (b)
unencumbered video export, (c) an open text-editable format, and (d) active
development. Every player fails at least one.**

### 4.1 Commercial incumbents

- ✅ **Rive**: editor is proprietary SaaS, no offline authoring. **Oct 2025:
  all exports (.riv, video, embeds) moved behind the paywall** — "Free to
  create. $9 to ship." Video export is paid-only and renders the linear
  timeline only (state machines don't render to video) — Rive is
  interactive-runtime-first. Open: `rive-runtime` (MIT) + documented-but-binary
  .riv format. Jan 2026: in-editor AI coding agent (Luau). HN (2026-03):
  subscription-only authoring called "very unappealing"; format "obscure
  without their IDE".
- ✅ **Spine**: $69–$379 perpetual, but **mandatory $2,499+/yr Enterprise above
  $500k revenue**; runtime licensing tied to editor seats; games niche; real
  rigging skills required.
- ✅ **Live2D**: subscription + separate SDK publication/royalty licensing;
  VTuber industry standard (~half the VTuber market); commissioned rigging
  alone runs $100–800+ — the opposite of "anyone".
- ✅ **Adobe Character Animator** — *the UX benchmark* (webcam puppeteering,
  **auto-lipsync from mic audio**, keyboard triggers, auto-rig from named PSD
  layers; free Starter tier): **de facto maintenance mode** — the Jan 2026
  release ships "no new features"; users publicly ask if it's shelved.
- ✅ **Adobe Animate shock (Feb 2026)**: Adobe announced discontinuation
  (2026-02-02), reversed after ~48h of backlash + stock drop into indefinite
  "maintenance mode". Lesson the market learned: closed animation tools can
  vanish. HN "Building a new Flash" thread (2026-03, 100+ comments): explicit
  demand for an open successor ("We can't trust closed source software for
  content creation tools").
- ✅ **Vyond** = the educator/explainer incumbent: $588–$2,000/yr/seat, plus
  reported ~8–10h of labor per 2-min explainer.

### 4.2 Web motion tools

✅ None of the survivors does rigged characters: Jitter (UI motion; 720p
watermarked free tier), Lottielab (reviews: character work "will feel
limited"), Linearity Move (beginner keyframes, Mac/iPad). **Fable
(fable.app) shut down 2024-11-15.**

### 4.3 Open source

✅ Fragmented, none character-first, none web-based: Synfig (alive-slow;
documented UX/crash complaints), OpenToonz (raster ink-and-paint lineage),
Pencil2D (frame-by-frame, tiny), **Wick dormant**, **enve abandoned** →
Friction (most active, After-Effects-like, 1.0-RC), Glaxnimate (KDE app
0.6.0, keyframe vector, no rigs). **Inochi2D** (the OSS Live2D alternative,
BSD-2) announced possible indefinite hiatus for lack of funding — the one
serious OSS 2D-puppet project couldn't sustain itself. veadotube mini
(closed, name-your-price) proves huge low-end appetite for zero-skill avatar
puppeteering.

### 4.4 AI angle

- ✅ Talking-head AI video (HeyGen ~$24–99/mo, Synthesia) = raster photoreal
  output; no vector, no editable document, no stylized rigs.
- ✅ "LLM authors the animation" already exists — but only for code/UI motion:
  official **Lottie Creator MCP** (LottieFiles), Remotion LLM docs + MCP,
  Rive's AI agent. **Lottie is now a Linux Foundation open standard**
  (v1.0 spec, 2024; IANA-registered `.lot`) with prompt-to-Lottie research
  activity — proving demand + feasibility of LLM-authored animation JSON.
  **But Lottie has no character semantics** (no bones, visemes, narration
  sync) and all AI-on-Lottie tooling targets icons/loaders/micro-interactions.

### 4.5 The gap, distilled

| Requirement | Who has it | Who doesn't |
|---|---|---|
| Non-animator talking-character UX | Character Animator (frozen) | everyone else |
| Free/unencumbered video export | OSS motion tools | Rive (paywalled), Jitter/Lottielab (watermarked) |
| Open, text-editable format | Lottie (no characters) | Rive (.riv binary, editor-locked) |
| Character semantics in an open format | **nobody** | — |
| Active, funded development | Rive, LottieFiles | every OSS candidate |

The intersection is empty. That intersection is this project's target.
