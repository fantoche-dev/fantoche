# Vision — Fantoche (working title)

> One-liner: **anyone — or any agent — can make a vector character explain
> something on video.** Open source, open format, local-first, video-first.

## 1. Why now (all facts sourced in `01-research.md`)

Four independent clocks aligned in 2025–2026:

1. **The base became free.** Revideo — the MIT fork of Motion Canvas that
   solved longform infra (parallel headless render, audio, React player,
   render API) — was abandoned by its YC team, who pivoted to a closed product
   (Midrender). No community fork exists. The window is open.
2. **The lineage community is semi-orphaned and asking for exactly our
   differentiators.** Motion Canvas: frozen since Feb 2025, 18.9k stars,
   2.7k-member Discord; top demands = GUI editing, Lottie export, MCP/LLM
   integration, headless render. One small ally-shaped fork (canvas-commons)
   continues the same-API path.
3. **The market intersection is empty.** No tool combines non-animator
   character UX (Character Animator — frozen by Adobe), unencumbered video
   export (Rive paywalled all exports in Oct 2025), an open text-editable
   format (Lottie — no character semantics), and active development (every
   OSS candidate is dormant, underfunded, or not character-oriented).
4. **The enabling tech matured.** ThorVG v1.x ships an official TS/WASM paint
   API (0.87 MB) with near-complete Lottie support and a native-export path;
   WhisperX-class alignment gives word timestamps locally; ElevenLabs TTS
   returns character-level timing; viseme lipsync is a solved technique.

## 2. Who it's for

| Audience | Today they use | What we give them |
|---|---|---|
| **Educators & explainer creators** (primary; includes us — AlgoMotion) | Vyond ($588–2,000/yr + ~8–10h per 2-min video), Character Animator (frozen), HeyGen (raster talking heads) | A talking, gesturing vector presenter from narration audio, in minutes, free, offline |
| **Developers** (contributor base: MC/Revideo lineage) | Motion Canvas/Revideo generators | Same runtime + code escape hatch, plus a document layer their tools can generate |
| **Agents (LLMs)** | Lottie MCP (icons only), Remotion (code) | The first open, schema-validated document format *with character semantics* — bones, poses, visemes, narration anchors |

The nuance research forced on us: the MC community does **not** ask for
characters — they are our *contributors and infrastructure lineage*, not the
demand source. Demand comes from the creator/educator side currently priced
or skilled out of every option. We serve the second with the trust of the
first.

## 3. What it is — five pillars (ADRs 0001–0005)

**The video is the product; the character is an element.** The deliverable is
a narrated educational/explainer video — animated code blocks, diagrams,
LaTeX, layouts — with the character as an optional first-class presenter
figure on top. The document, narration timeline, and editor operate on *all*
elements equally; a zero-character video is a first-class use case. The
character layer is the differentiator no competitor has, not a prerequisite.

1. **A document, not a script** — versioned JSON as source of truth;
   generators demoted to escape hatch. Unlocks GUI, agents, O(1) seek,
   browserless render. (ADR 0002)
2. **Characters as data** — rig + named poses + interpolation as a pure
   function of time; characters are shareable documents; a template "cast
   library" means most users never rig anything. No state machines: output is
   video, time is the only driver. (ADR 0005)
3. **Narration is the timeline** — word-anchored events, auto-lipsync,
   retiming that follows the voice. The Character Animator insight, rebuilt
   open and local-first. (ADR 0004)
4. **Open rendering with an endgame** — Canvas2D today behind a backend seam;
   ThorVG-WASM gated behind parity tests, buying Lottie interop and
   eventually **browserless native export**. (ADR 0003)
5. **Agent-native from day 1** — MCP server + schema + render-to-screenshot
   feedback loop. Every competitor bolts AI onto a closed editor; we are the
   open format an agent can actually author.

## 4. What it is NOT (scope discipline — the anti-Inochi2D plan)

- **Not an interactive runtime.** No state machines, no game/app export in
  v1. Rive owns that; competing there means inheriting their complexity.
- **Not a same-API Motion Canvas continuation.** canvas-commons does that;
  we link to them, cherry-pick from upstream, and stay allies. We are a
  different product on a shared lineage.
- **Not generic AI motion graphics.** That is Midrender's (closed) business,
  built on this same engine. Our wedge is characters + narration + openness.
- **Not photoreal avatars.** HeyGen/Synthesia own raster talking heads.
  Stylized vector characters are a feature, not a limitation.
- **Not a drawing app** (initially). Art comes in as SVG/Lottie/layered
  imports; authoring art in-app is post-v1.

## 5. North-star demo (the acceptance test for v1)

> A teacher with zero animation experience records 90 seconds of narration,
> picks a character from the cast library, drops both into the editor, and
> in under 10 minutes exports a 1080p video where the character talks in
> sync (lipsync), gestures at the words she chose, and points at a diagram —
> **and the same result is reproducible by an LLM writing the document
> directly.** Works offline. Works in Portuguese.

"Works in Portuguese" is load-bearing: it forces the language-aware lipsync
path (ADR 0004 caveat) and keeps us honest about "anyone".

## 6. Positioning

| | Fantoche | Rive | Character Animator | Vyond | canvas-commons |
|---|---|---|---|---|---|
| Authoring | GUI + JSON + code + agents | proprietary editor | desktop app | SaaS | code |
| Format | open JSON w/ character semantics | .riv (binary, editor-locked) | proprietary | proprietary | code |
| Video export | free, core feature | paywalled, timeline-only | yes | per-seat SaaS | yes |
| Lipsync/narration | native spine | no | yes (frozen) | limited | no |
| Offline | yes | no | yes | no | yes |
| License | MIT | MIT runtimes only | — | — | MIT |

## 7. Sustainability (facing the Inochi2D lesson head-on)

The one serious OSS 2D-puppet project stalled for lack of funding. Our
mitigations: (a) founder-market fit — we build the tool our own videos need,
so development continues even at zero adoption; (b) scope small enough for
one or two maintainers (the base is forked, not built); (c) the cast-library
ecosystem creates natural contribution surface (characters are data, and
character artists don't need to write C++ or TS); (d) optional paid hosted
rendering can fund the project later without ever paywalling the format —
the Rive backlash is the cautionary tale of what never to do.
