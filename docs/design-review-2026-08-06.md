# Design review — text engine, authoring DX, O(1) semantics, retiming

> External design critique of `03-architecture.md` (2026-08-06), reviewed
> against the P1 implementation. Two points were already handled, one
> mis-stated our behavior, one is a real gap with a solution that preserves
> the architecture. Recorded here so the P2/P4 plans inherit the decisions.

## 1. The text engine is the real ThorVG risk (confirms ADR 0003)

The coupling that matters for a non-Canvas2D backend is not path drawing —
it is text shaping and measurement, which the engine currently delegates to
Chromium (`measureText`, line breaking, system fonts). Reaching parity in
WASM means shipping FreeType + HarfBuzz + FontConfig.

**Precision from the P1 code:** `Latex` is NOT canvas text — it extends
`Img` and renders MathJax → SVG → data URI, i.e. an image blit under any
backend. Real shaping exposure is `Txt` and `Code` (the latter uses
`measureText` for cursor metrics) — two nodes, not three.

**Decision:** unchanged from ADR 0003 — Canvas2D stays the default backend,
ThorVG stays a gated parallel spike. Narrow the ADR 0003 text gate to
`Txt` + `Code`, and treat "keep browser text for those two under any
backend" as an acceptable outcome of the spike, not a failure.

## 2. Code-first authoring: the mechanism exists; the ergonomics don't

Critique: forcing hand-authors into a rigid JSON denies the code-first
audience the loops/functions/abstractions they came for.

**Already true in code:** `makeDocumentScene(name, document: unknown)`
takes any object — not a file path. A `.ts` module that computes a document
programmatically and exports it works today, unchanged. Legacy generator
scenes also still render beside document scenes, so a fully code-first
project loses nothing.

**Real gap:** writing document object literals by hand is verbose. The fix
is NOT a second source format (the GUI and agents depend on the document
being the serializable truth) but a **typed authoring DSL** that produces
the document:

```ts
const doc = document({fps: 30, size: [1920, 1080]});
doc.at('intro.start').tween(title, {opacity: 1}, 0.5);
for (const [i, step] of steps.entries()) {
  doc.at(`intro.word:${step.word}`).set(bullets[i], {opacity: 1});
}
export default doc.build();
```

TypeScript then gives autocomplete, refactoring and compile-time errors on
anchors/props. **Roadmap item (P2-adjacent, small):** `@fantoche-dev/document`
gains a `builder` subpath; the compiler and format are untouched.

## 3. O(1) with escape-hatch blocks — correcting the claim

Critique stated that a code block forces simulation "from frame 0 to t".

**Not what the runtime does.** `BlockHost` replays from the **window
start** (`localFrames = frame - block.t0F`), and block duration is declared
in the document. Replay cost is bounded by the BLOCK's duration and is
**constant with respect to document length** — verified by the
seek-equals-sweep and backward-seek tests, and documented in the package
README.

**Residual risk worth handling:** a block with a very long declared duration
(e.g. 60s) has that duration as its worst-case replay. **Decision:** the
compiler warns above a threshold (~5s) recommending the author split the
block; document the "blocks are the one non-pure corner, keep them short"
rule in the authoring guide.

## 4. Narration retiming vs. pose transitions (the real gap)

Critique: if re-recorded narration moves an anchor into the middle of a
pose transition, fixed-duration lerps produce truncated, jerky motion —
proposing spring dynamics with momentum preservation.

The diagnosis is right; iterative springs are not an option (they are the
reason springs are excluded from v0 — they cannot live behind a pure
`state(t)`, see `easings.ts`). Three measures give the same UX without
breaking O(1):

**(a) Closed-form springs with compile-time momentum resolution.** A damped
harmonic oscillator has an analytic solution — critically damped:
`x(t) = target + ((x₀ − target) + (v₀ + ω(x₀ − target))·t)·e^(−ωt)` —
evaluable at any `t` in O(1). The only chain dependency is `v₀`, the
entry velocity, which equals the analytic derivative of the previous
segment at its end. Because the compiler already **forbids overlapping
animations on the same prop**, the per-(target, prop) segment chain is
well-ordered: the compiler walks it once and bakes `v₀` into each key.
Evaluation stays pure and O(log keys). This is how `spring` re-enters the
format without becoming iterative.

**(b) Retiming that breaks fails loudly.** If recompressed narration makes
two gestures overlap on the same prop, that is already a `CompileError`
naming both timeline items — the author gets a diagnostic, not a spastic
arm in the exported video.

**(c) Adaptive durations.** `dur: {fit: true}` (fill the space up to the
next anchor) or `dur: {value, min}` (compress, floor at min) so a shortened
window compresses the gesture instead of colliding. Compile-time, so it
stays declarative.

Also already available today: closed-form overshoot (`easeOutBack`,
`easeOutElastic`) gives springy character without any of the above — a P1
bug that was clipping exactly that overshoot is fixed.

**P2 plan implications:** the pose evaluator specifies (a) from the start
(entry-velocity baking is a compiler pass, cheap to add before poses have
users); (c) lands with the narration timeline; (b) needs only a targeted
error message mentioning retiming as the likely cause.
