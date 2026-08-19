# Test fixtures — provenance

`rhubarb-scratch-01.json` and `whisperx-scratch-01.json` are **stand-in
captures**, not the ADR 0007 gate clips.

They were recorded from a scratch TTS take during the Part A spike and were
originally named after the gate clip (`pt-br-01`), which made them read as the
scored PT-BR sample they are not — the whisperx capture still contains a ghost
phrase the aligner emitted and the real take never had.

They are kept because they exercise the parsers against realistic tool output.
Nothing in `docs/lipsync-spike-results.md` or ADR 0007 was measured on them; the
scored clips live in `packages/e2e/lipsync/`.
