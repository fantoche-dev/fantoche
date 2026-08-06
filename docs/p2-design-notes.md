# P2 design notes — character import, rigging, draw order

> Pre-P2 design review (2026-08-06, Daniel + Claude). These notes feed
> ADR 0006 and the P2 plan; they amend the sketch in `03-architecture.md`
> §3.4 and answer open question 2 of §5.

## Context

P2's character model (ADR 0005): rig = named FK groups/slots over imported
SVG art; poses = named parameter sets; `state(t)` pure. Three practical
failure modes were identified in review before implementation.

## 1. Name conventions WILL break in users' hands

Real-world exports produce mangled ids (`Group_123_copy`, `path4112`,
`arm_x5F_l`) and accidental nesting.

**Decisions:**

- The SVG is never hand-edited: slot→element binding lives in a mapping
  table in `character.json`. Broken ids are fixed by remapping, not by
  re-exporting art.
- `fantoche character check` reports bound/missing/orphaned slots with
  fuzzy suggestions; `fantoche character bind` (interactive CLI) writes the
  mapping — no hand-edited JSON in any workflow. Both are P2 scope.
- A **visual binder** (click element in preview → assign slot) moves INTO
  editor v0 scope (P3), not v1 — the hit-testing infrastructure
  (`inspectPosition`) already exists in the runtime.
- Re-imports of updated art are diffed by `character check` against the
  existing binding (renames surface immediately).

## 2. Draw order must be poseable — and it forces flat siblings

Cut-out characters need depth swaps (arm in front of torso vs behind) that
FK hierarchy cannot express: the runtime's `zIndex` sorts among siblings,
and a child can never render behind its parent. Runtime reparenting would
break `state(t)` purity.

**Decision (ADR 0006 core):** separate the transform hierarchy from the
render hierarchy.

- All slots are FLAT SIBLINGS under the character root node.
- The FK chain (`parent` relations in the rig) is computed by the pose
  evaluator — pure matrix composition — and applied to the flat nodes.
- `slot.depth` becomes an ordinary pose parameter mapped to `zIndex`,
  interpolated with **hold** semantics (discrete swap at the keyframe —
  never eased). The P1 evaluator already has hold interpolation.

```jsonc
"poses": {
  "arm-front": {"arm-l.rotation": -30, "arm-l.depth": 10},
  "arm-back":  {"arm-l.rotation": 140, "arm-l.depth": -10}
}
```

## 3. Pivots: solve in the art tool first, gizmo second

SVG has no native articulation points; raw `pivot: [x, y]` numbers mean
eyeballing coordinates through re-renders.

**Decisions:**

- **P2 (no editor needed): pivot markers in the SVG.** The artist places a
  point on a hidden layer (`id="pivot-arm-l"`, or `data-fantoche-pivot` on
  the group); the importer extracts the coordinate and strips the marker.
  Pivots are positioned visually in Figma/Illustrator/Inkscape — the
  artist's own tool is the gizmo.
- Defaults by bbox preset (`top-center`, `bottom-center`, `center`, …)
  cover most limbs with zero configuration.
- `fantoche character preview --pose <name>` renders test frames for a fast
  CLI iteration loop (O(1) seek makes this cheap).
- Numeric `pivot: [x, y]` in `character.json` remains as the explicit
  override/fallback, not the primary workflow.
- **P3 editor v0** (moved up from v1 alongside the visual binder): a pivot
  gizmo — drag a crosshair over the live preview, writing the same
  `[x, y]`.

## Consequences for P3 scope

Editor v0 was "timeline + inspector" (architecture §3.5). It now
additionally owns the two smallest rig tools: the visual binder (§1) and
the pivot gizmo (§3). Both edit single values in the character document
against an O(1)-seek preview; neither is art authoring.
