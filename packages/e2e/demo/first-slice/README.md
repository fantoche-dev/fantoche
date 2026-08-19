# First vertical-slice demo (plan Task 23)

The smallest document where every P2 mechanism carries weight: the teacher posed
from word anchors, its mouth hold-switched from a hand-written viseme track
(`engine: "manual"` — the ADR 0007 shipping path), narration audible in the
render.

```bash
node packages/cli/dist/index.js render packages/e2e/demo/first-slice/demo.json \
  --out first-slice.mp4
```

## Stand-in status

`narration.wav` is currently the committed PT-BR gate recording
(`packages/e2e/lipsync/pt-br-01.wav`). The plan accepts it for wiring; **Task 23
is not done until Daniel's real 10–15 s narration replaces it.** The swap
procedure:

1. Record per the Part A guide (`packages/e2e/lipsync/README.md`), commit wav +
   verbatim transcript here.
2. Re-author `narration.segments` (texts + windows), run
   `fantoche narration align` — it refuses windows that don't contain their
   aligned words, naming the minimal window.
3. Re-author `mouth.viseme.json` against the new audio (criteria below).
4. Re-render, re-verify the probe beats, regenerate goldens on CI.

## Mouth-track authoring criteria

Budgeted by the Task 7 axes — rubric level 3 ("usable") is the bar:

- **Pressed `A` at every bilabial onset** (p/b/m), on the consonant's instant,
  not after it.
- **Rounded `E`/`F` on o/u vowels**; teeth shapes are not rounding.
- **`X` only at measured pauses.** Verify speech end with a silence map of the
  audio (`silencedetect`), **never with the alignment's word `dur`** — forced
  alignment stretches word tails across pauses (the demo's "binária" carries a
  1.3 s aligned dur over ~0.8 s of actual speech). Cutting to rest while speech
  continues is the "tail swallowed by an early rest" error the spike catalogued;
  audit every segment-final word for it.
- **No 1-frame shapes**: minimum cue spacing of 3 frames at the document's fps
  (0.1 s at 30 fps).

## What the goldens pin

Beyond first + mid frame, `rendering.test.ts` probes deterministic beats: frame
24 (0.8 s, pressed A on "pessoal"), 108 (3.6 s, open C in "binária", wave +
crossed arm), 216 (7.2 s, pressed A on "meio", arm still in front), 285 (9.5 s,
back at rest, arm behind again). CI also renders this document through the
standalone CLI path and asserts an AAC audio stream.
