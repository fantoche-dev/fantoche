# ADR 0004 — Narration is the spine of the timeline

- Status: **proposed** (design phase)
- Date: 2026-08-04

## Context

Target user #1 is a narrated-video creator (educational/explainer). In every
existing tool the workflow is "animate, then fit narration" or vice versa,
with manual re-timing whenever the script changes. The tools that made
character animation accessible to non-animators (Adobe Character Animator)
did it by deriving animation *from the performance* (voice → lipsync).

## Decision

The narration track — audio + transcript + word-level timestamps — is a
first-class document object and the primary coordinate system of the timeline:

- events anchor to narration marks (`intro.word:binária`, `intro.end+0.3`)
  instead of absolute frames;
- retiming/replacing narration re-times anchored animation automatically;
- a lipsync track (audio → phonemes → visemes) drives character mouth slots
  automatically ("auto": true), locally/offline;
- timestamps come from forced alignment for recorded audio (WhisperX-class
  tooling is the current standard), or TTS timepoints for generated voices
  (ElevenLabs returns character-level timestamps; OpenAI TTS returns none).
  Details and sources in `01-research.md` §3.3; picks are revisited as the
  ecosystem moves.

⚠️ Portuguese caveat (project's first audience is PT-BR): Rhubarb's accurate
recognizer is English-only; its language-independent mode is weaker. Viable
route: derive visemes from language-aware phoneme alignment (WhisperX) with
our own phoneme→viseme map. Treat lipsync-quality-in-Portuguese as an explicit
P2 spike gate, not an assumption.

Absolute-time anchors remain valid (silent videos, music-driven pieces).

## Consequences

- The "10-minute talking presenter" flow becomes structurally possible:
  drop in audio → transcript aligns → character talks; user adds gestures at
  words.
- The document format must treat alignment data as a cacheable derived asset
  (deterministic given audio + transcript + tool version).
- Offline-first constraint: alignment and lipsync must run locally; cloud TTS
  is optional input, never a dependency.
