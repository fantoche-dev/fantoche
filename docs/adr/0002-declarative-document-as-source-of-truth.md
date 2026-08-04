# ADR 0002 — Declarative document as source of truth; generators become an escape hatch

- Status: **proposed** (design phase)
- Date: 2026-08-04

## Context

In Motion Canvas/Revideo the animation *is* the execution of generator
coroutines. Verified consequences (`core/src/app/PlaybackManager.ts:83-109`):
seeking backward resets the scene and re-steps frame by frame; state at time t
is only reachable by replaying 0…t; parallel render workers replay their
prefix; "what happens at t" has no stable identity a GUI or an LLM can
address, diff, or patch.

## Decision

A versioned, schema-validated JSON document is the single source of truth.
A compiler lowers it to a timeline IR whose evaluation is a **pure function
state(t)** driving the (kept) Revideo scene graph. Generator code remains
supported as an explicitly-bounded timeline item ("code block" with declared
duration) — an escape hatch, not the interface.

## Consequences

- O(1) seek → responsive scrubbing, direct manipulation, cheap parallel render.
- GUI editing = document patches; undo/redo = inverse patches.
- Agent authoring: LLMs write/patch a schema-validated file; validation errors
  are actionable; render → screenshot closes the feedback loop.
- Format is diffable, reviewable, and migratable (`version` + migration
  functions from day 1; golden-frame tests pin semantics).
- Cost: two execution models coexist (document scenes + legacy generator
  scenes). Accepted — it is the Motion Canvas compatibility story.

## Rejected alternatives

- **Code-first with better ergonomics** (upstream's path): keeps the GUI and
  agent layers structurally impossible (no addressable state).
- **Scene serialization of generator output** (bake replay into keyframes):
  loses intent (anchors, poses), produces unreadable documents.
