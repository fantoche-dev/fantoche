# ADR 0006 — Flat slots: transform hierarchy ≠ render hierarchy

- Status: **accepted**
- Date: 2026-08-18 (decision taken at P2 plan time, 2026-08-12; recorded at
  Part B start)

## Context

Cut-out characters need **depth swaps** — an arm rendering behind the torso
in one pose and in front of it in the next. An FK scene graph cannot express
that: in the runtime, `zIndex` only sorts **among siblings**
(`packages/2d/src/lib/components/Node.ts:520-524`, a stable sort), so a
child can never render behind its own parent. The two escapes both fail:
runtime reparenting mutates the scene graph between frames, breaking
`state(t)` purity and O(1) seek (ADR 0005); duplicating art per depth
arrangement multiplies assets and still cannot animate a swap.

The design review (`docs/p2-design-notes.md` §2) identified this before
implementation, together with two adjacent facts: the runtime's SVG parser
flattens `<g>` groups and discards their ids, so binding to a group through
the live node tree is impossible without 2d surgery; and pose evaluation
must stay a pure function of `t` (ADR 0005).

## Decision

**Separate the transform hierarchy from the render hierarchy.**

- Every slot of a character is a **flat sibling** node under the character
  root — one ordinary `svg` element per slot, no nesting.
- The FK chain (`parent` relations in `character.json`) lives only in the
  rig data. The **pose evaluator** composes it per frame — pure 2×3 matrix
  composition in topological order — and writes world transforms onto the
  flat nodes. Interpolation happens on *joint* parameters, never on
  composed world transforms (a lerped world matrix moves a limb along a
  chord, not an arc).
- `depth` is an ordinary **pose parameter** mapped to `zIndex`, always
  interpolated with **hold** semantics: a discrete swap exactly at the
  keyframe, never eased through fractional stacking states. The P1
  evaluator already has hold interpolation, so this costs no new mechanism.

```jsonc
"poses": {
  "arm-front": {"arm-l.rotation": -30, "arm-l.depth": 10},
  "arm-back":  {"arm-l.rotation": 140, "arm-l.depth": -10}
}
```

## Consequences

- **Pivots must be resolved at import time** (plan Decision 3): a flat
  sibling rotates about its own local origin, so the importer re-centres
  each slot's sub-SVG on its pivot — after which rotation is just
  `rotation` on an ordinary node, with no per-frame compensation.
- **Joint scale must be uniform** (plan Decision 5): non-uniform scale
  composed down an FK chain produces shear, which cannot be decomposed back
  into the node's `x/y/rotation/scale` signals. The character schema
  enforces a scalar.
- The evaluator gains one new stage, **bounded O(slots)** (~20 matrix
  multiplies per character), independent of document length — O(1) seek
  survives.
- Draw order becomes poseable state, which an FK render hierarchy could
  never express — this is the payoff the reference character's golden must
  pin (an arm crossing from behind the torso to in front at a keyframe).
- The render path needs **no new node type**: slots are `svg` elements the
  runtime already builds; only the evaluator and compiler learn about rigs.
- Architecture §5 open question 2 (slot/attachment model vs plain group
  tree) is answered: a flat slot model with an explicit binding table, not
  a group tree.
