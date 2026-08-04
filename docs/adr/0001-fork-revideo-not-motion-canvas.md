# ADR 0001 — Fork Revideo (with history), not Motion Canvas, not from scratch

- Status: **proposed** (design phase)
- Date: 2026-08-04

## Decision

Base the project on a full-history fork of `midrender/revideo` (formerly
`redotvideo/revideo`; org renamed July 2026), keeping an `upstream` remote for
cherry-picks. Re-scope packages to our npm org at P0.

## Why Revideo over Motion Canvas

Revideo already solved the longform infra Motion Canvas lacks, verified in
source: server-side `renderVideo()`/`renderPartialVideo()` with N parallel
(headless Chromium + Vite) workers and ffmpeg concat/merge; audio pipeline
(extraction, mixing, silent-track fill); in-browser WASM mp4 exporter;
`@fantoche/player-react`; deployment guides. All MIT. Node ≥ 22 toolchain.

## Why not from scratch

The scene graph, signal system, flexbox layout, and component library
(`Txt`, `Latex`, `Code`, `SVG`, `Path`, `Video`, `Audio`, `Rive`) represent
years of work and are exactly the parts worth keeping. Our differentiators
layer *above* them (document → evaluator) or *beside* them (render backend).

## Amendments at fork time (P0)

1. **Remove `@fantoche/telemetry`** (PostHog-based, opt-out via
   `DISABLE_TELEMETRY=true`) and the `sendEvent` calls
   (`renderer/server/render-video.ts`) — no phone-home in a community fork.
2. Keep generator scenes running untouched (compat CI job renders a known
   Motion Canvas project + a known Revideo project every release).

## Risks

- Upstream divergence: mitigated by cherry-pick discipline while phases 0–1
  mostly add new packages instead of rewriting existing ones.
- Fork fatigue/rename churn: single rename at P0, then stable.
