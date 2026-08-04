# ADR 0005 — Pose layer is a pure function of t; no state machines in v1

- Status: **proposed** (design phase)
- Date: 2026-08-04

## Context

Rive/Spine target *interactive* runtimes (games, apps), so they need state
machines, blend trees, and event graphs — the single steepest concept
non-animators face in those tools. Our v1 output is **video**: time is the
only input.

## Decision

- Character = rig (named FK groups/slots) + named poses (parameter sets).
- Animation = pose keys and gesture events on the (narration-anchored)
  timeline; `state(t) = interpolate(keys ≤ t)` — pure, addressable, O(1).
- No state machines, no blend trees, no input events in v1. Characters ship
  as documents (`character.json`: rig + poses + art slots), enabling a
  template "cast library" — most users pick a character rather than rig one.
- IK, physics/secondary motion, and any interactive-runtime story are
  explicitly post-v1 and must not leak complexity into the v1 format.

## Consequences

- Massive UX simplification vs Rive/Spine — the actual "anyone can" bet.
- Deterministic renders and trivially testable evaluation.
- Risk accepted: power animators may find v1 limiting; the code-block escape
  hatch (ADR 0002) and post-v1 roadmap absorb that pressure.
