# ADR 0007 — Lipsync engine: neither arm ships; gate at risk, manual authoring is the fallback

- Status: **accepted**
- Date: 2026-08-18

## Context

ADR 0004 made lipsync a load-bearing promise (voice → phonemes → visemes,
locally) and flagged Portuguese quality as an explicit P2 spike gate rather
than an assumption. The spike compared the two candidate engines blind on a
human PT-BR recording (the gate) and a matched EN recording (the control):
Rhubarb 1.14.0 in language-independent phonetic mode, and WhisperX 3.8.6
forced alignment through our frozen grapheme→viseme map. Protocol, scores
and the mid-spike transcript correction are recorded in
[lipsync-spike-results.md](../lipsync-spike-results.md).

The plan's decision rule offered three outcomes: adopt Rhubarb, adopt
WhisperX, or — if neither reaches 3/5 on PT-BR — record the gate as at risk
and fall back to manual viseme authoring. "Reaches 3/5" is read as
**every axis ≥3**, not the mean: a mouth that jitters constantly or never
closes on p/b/m is not "usable on average".

## Decision

**Neither engine ships as the automatic PT-BR lipsync engine. The P2 gate
is at risk, and P2 ships manual viseme authoring as the fallback** — the
viseme track format is engine-agnostic by design and already supports
hand-written cues, so the north-star demo's mouth track is authored (or
hand-corrected) rather than generated.

The scores that force this (PT-BR, round 2; 1–5 per axis):

| Axis          | Rhubarb | WhisperX |
| ------------- | ------- | -------- |
| p/b/m closure | 3       | **2**    |
| o/u rounding  | **2**   | 3        |
| Jitter        | 4       | **2**    |
| Drift         | 5       | 4        |

Two findings sharpen the re-spike beyond the plan's wording:

1. **The failure is not Portuguese-specific.** The EN control fails the
   same bar with the same signatures (Rhubarb: precise pressed closures,
   zero drift, but no rest shape and weak rounding; WhisperX: perfect
   rests and solid word timing, but no pressed closure at all and 1-frame
   jitter). A "real PT-BR phoneme model" alone would not have passed the
   gate — the viseme *mapping/timing* layer is where both arms lose.
2. **The failures are complementary.** Each arm is strong exactly where the
   other is weak. The re-spike target is therefore phoneme-level timing
   (not per-grapheme even splits) feeding a map that produces pressed A on
   bilabials *and* X at rests, with a minimum-hold rule against 1-frame
   shapes — judged against Rhubarb's closure precision and WhisperX's rest
   placement as the two benchmarks the spike established.

## Consequences

- **Do not silently proceed** — this is the outcome ADR 0004 gated on, and
  it changes P2's shape at the Task 7 checkpoint: the demo's lipsync is
  authored, not automatic, and automatic lipsync moves to a re-spike with
  its own gate.
- **Part D (narration) is unaffected in its use of forced alignment.** The
  at-risk verdict is about viseme generation; WhisperX's word-level
  placement was solid in both languages (22/22, drift 4), so the narration
  spine of ADR 0004 — word-anchored events — still stands on WhisperX-class
  alignment.
- Both adapters and the compare/blind tooling stay: they are the harness
  the re-spike will be scored in, and the results doc's per-arm findings
  are its requirements list.
- ADR 0004's Portuguese caveat is resolved in the negative for v1:
  lipsync-quality-in-Portuguese was not an assumption, and measuring it is
  what kept a not-good-enough engine out of the product's first demo.

## Addendum — 2026-08-19 English-first content decision

Later the same week, content became English-first (vision §5): the English
north-star demo is now primary and the PT-BR document is the second-language
control (`packages/e2e/demo/north-star-pt-br/`). This does not revise the
decision above. The English north-star run confirmed the finding that framed
it: the English grapheme path reaches all 59 aligned bilabial closures
automatically, but 632 of its 889 cue intervals are under 0.100 s — closure
improves, jitter does not, so manual authoring still ships and the re-spike
target (timing/minimum-hold layer, language-independent) is unchanged.

## Addendum — 2026-08-19 timing layer built and measured (Part F, step 1)

The re-spike target this ADR named — "a minimum-hold/timing layer,
language-independent" — now exists as `fantoche lipsync hold`. It is a
weighted selection over a draft's own cues: it never moves, merges or invents
one, it only drops cues that cannot clear the floor, and survivors keep their
aligned times.

Measured on the English north-star draft, floor 0.100 s:

| Track | Cues | Sub-0.100 s | Word-level closures | Measured rests |
| --- | --- | --- | --- | --- |
| Automatic draft | 889 | 598 | 48/48 | 63 |
| Draft + hold layer | 470 | **0** | **48/48** | **63** |
| Manual, shipped | 403 | 0 | 48/48 | 63 |

Two findings shaped the implementation, and both were caught by measurement
rather than by review:

1. **Survivors must keep their own times.** The first version collapsed each
   too-short run into its start time and lost 5 of 48 closures — a winning
   `A` slid backwards out of the word it belonged to. Keeping original times
   makes the choice a weighted selection, not a greedy scan.
2. **Rests rank with closures.** §2.2 names exactly two hard rules — closure
   on `p`/`b`/`m`, and `X` only where alignment measured a pause. Ranking
   rests below neutral shapes kept only 35 of 63 measured pauses; ranking
   them level with `A` keeps all 63 and all 48 closures.

**This does not supersede the decision above.** The bar is ≥3 on every PT-BR
axis under blind human scoring on the committed clips, through the Task
25-hardened harness. What is established is that the mechanical
preconditions — no one-frame shapes, no lost closure, no lost or invented
rest — are now reachable automatically from a raw draft, on the axis
(jitter) where both arms failed. Closure and rounding still have to be
*seen*. Until that scoring runs, manual authoring remains the shipping path
and this ADR stands.
