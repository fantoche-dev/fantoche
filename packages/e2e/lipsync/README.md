# Lipsync spike fixtures

Inputs for the P2 lipsync spike (plan Tasks 3–7): two spoken clips and a
nine-mouth viseme sheet, used to render the same sentence through both candidate
aligners and score them side by side.

Everything here is **dev-time only**. Alignment is a cacheable derived asset
(ADR 0004): a viseme track is produced once, committed as plain JSON, and read
at render time. Nothing in this directory is a render-time dependency, and
neither Rhubarb nor WhisperX is ever installed to render a video.

## Audio

Two clips, one per language, **mono 16 kHz PCM WAV** — the format both candidate
tools want, and small enough to commit (~250 KB for 8 s).

| File                    | Language | Role                                       |
| ----------------------- | -------- | ------------------------------------------ |
| `pt-br-01.wav` + `.txt` | PT-BR    | the gate: the language P2 is judged on     |
| `en-01.wav` + `.txt`    | EN       | the control: the language both tools claim |

The sentences are not arbitrary. Each carries bilabials (`p`/`b`/`m`), rounded
vowels (`o`/`u`) and labiodentals (`f`/`v`) — the shapes a bad viseme mapping
gets wrong in a way a viewer can see — and each runs ~8 s, because drift over 8
s is one of the four scored axes. The `.txt` holds the transcript exactly as
spoken and is force-aligned verbatim; ASR is deliberately not allowed to alter
the sentence before the gate.

### Current state: the WAVs are not here yet

`scratch/pt-br-01.wav` and `scratch/en-01.wav` are machine-generated stand-ins
(macOS `say`, voices Luciana and Samantha, rate 150, resampled to mono 16 kHz).
They exist so the adapters in Tasks 4 and 5 can be written and tested against
real tool output before anyone records anything, and they are **git-ignored on
purpose**, for two independent reasons:

1. **Licence.** This repo is MIT. Apple's macOS licence does not clearly grant
   redistribution of audio synthesised by the system voices, and audio is
   awkward to remove from git history later. Everything committed here has to be
   ours.
2. **Measurement.** TTS is cleaner and far more evenly paced than speech. Both
   engines score better on it than they will on the narration of the north-star
   demo (Task 21), and — the real problem — they do not benefit equally:
   WhisperX is an ASR model trained on human speech, Rhubarb's phonetic mode is
   acoustic analysis. A gate passed on synthetic audio would not be evidence
   about the gate's actual question.

So the stand-ins are fine for building the adapters and wrong for scoring them.
**Task 7 must be scored on real recordings**, committed as `pt-br-01.wav` and
`en-01.wav` in this directory, replacing nothing (the stand-ins were never
tracked).

### Recording the real clips

**Say exactly what the `.txt` says.** WhisperX is handed the transcript and
force-aligns it verbatim — it is not allowed to re-transcribe. An improvised
word has no audio to land on, so the misalignment it causes gets scored against
arm B rather than against the take.

**One take, no edits.** A splice is a discontinuity in the audio, and jitter is
one of the four scored axes; an editing artefact would be scored as the
aligner's instability.

**Both clips under identical conditions** — same mic, same distance, same room,
same processing. PT-BR is the gate and EN is the control, so any difference in
the recordings shows up as a difference between languages that is not about
language.

**Quiet room, and no noise reduction afterwards.** Rhubarb's phonetic mode is
acoustic analysis and WhisperX is a trained model; background noise and
denoising artefacts do not cost the two arms the same, which turns room tone
into a thumb on the scale.

**Narration pace, ~8 s.** These are 17 and 22 words, so about 130 wpm — the pace
of explaining something, not of talking. Drift over 8 s is a scored axis, so a 4
s clip cannot answer it.

**Keep the trailing silence under ~0.4 s.** This one is not stylistic. A preview
document lasts until its last cue plus 0.5 s, and `lipsync compare` muxes with
`-shortest`: while the audio is the shorter stream, both sides get clamped to
the same length. Let the audio run past it and each side is instead clamped to
its _own_ last cue, so the two videos end at different times — the arms would be
scored over different windows.

Record with headroom and convert afterwards; recording straight at 16 kHz gives
the mic preamp no room:

```bash
# List inputs first — the device index is machine-specific.
ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep -A5 audio
ffmpeg -f avfoundation -i ":0" -ar 48000 -ac 1 -t 15 -c:a pcm_s16le take-pt.wav
```

Then trim the silence off both ends and convert to what the tools want, in one
pass (repeat for `en-01`):

```bash
ffmpeg -i take-pt.wav \
  -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,\
areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse" \
  -ar 16000 -ac 1 -c:a pcm_s16le packages/e2e/lipsync/pt-br-01.wav
```

Verify before committing — 16000 Hz, 1 channel, ~8 s:

```bash
for f in packages/e2e/lipsync/*.wav; do
  ffprobe -v error -show_entries stream=sample_rate,channels \
    -show_entries format=duration -of default=noprint_wrappers=1 "$f"
done
```

And check the level: `max_volume` should sit a little under 0 dB. At 0.0 dB the
take is clipped, and clipping is distortion both arms have to guess through.

```bash
ffmpeg -i packages/e2e/lipsync/pt-br-01.wav -af volumedetect -f null - 2>&1 \
  | grep -E "max_volume|mean_volume"
```

Then record the provenance below: whose voice, recorded when, on what.

**Provenance.** Not yet recorded — see above. Once they exist: recorded by
Daniel Nichiata, original speech, licensed under the repo's MIT licence.

## Local spike tools

Both tools live under ignored `scratch/tools/`; only their captured JSON is
committed. The versions used to build the adapters are Rhubarb 1.14.0 and
WhisperX 3.8.6.

On macOS, install Rhubarb's official release locally (the published binary is
x86_64, so Apple Silicon needs Rosetta):

```bash
LIPSYNC_SCRATCH=packages/e2e/lipsync/scratch
mkdir -p "$LIPSYNC_SCRATCH/tools/rhubarb"
curl -fL \
  https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.14.0/Rhubarb-Lip-Sync-1.14.0-macOS.zip \
  -o "$LIPSYNC_SCRATCH/tools/rhubarb.zip"
ditto -x -k "$LIPSYNC_SCRATCH/tools/rhubarb.zip" \
  "$LIPSYNC_SCRATCH/tools/rhubarb"
export RHUBARB_BIN="$PWD/$LIPSYNC_SCRATCH/tools/rhubarb/Rhubarb-Lip-Sync-1.14.0-macOS/rhubarb"
```

Install WhisperX in its own Python 3.13 environment. Models download into the
ignored cache on the first alignment:

```bash
LIPSYNC_SCRATCH=packages/e2e/lipsync/scratch
uv venv --python 3.13 "$LIPSYNC_SCRATCH/tools/whisperx-venv"
uv pip install \
  --python "$LIPSYNC_SCRATCH/tools/whisperx-venv/bin/python" \
  whisperx==3.8.6
export WHISPERX_PYTHON="$PWD/$LIPSYNC_SCRATCH/tools/whisperx-venv/bin/python"
export WHISPERX_MODEL_DIR="$PWD/$LIPSYNC_SCRATCH/tools/whisperx-models"
```

The wrapper uses WhisperX's alignment model directly: the known transcript is
the input, not a fresh ASR guess. Produce both candidate tracks like this
(repeat with `en-01` and `--language en` for the control):

```bash
npm run build -w packages/cli

"$RHUBARB_BIN" --version
node packages/cli/dist/index.js lipsync rhubarb \
  "$LIPSYNC_SCRATCH/pt-br-01.wav" --language pt-BR \
  --out "$LIPSYNC_SCRATCH/rhubarb-pt-br.viseme.json"

"$WHISPERX_PYTHON" scripts/align.py \
  "$LIPSYNC_SCRATCH/pt-br-01.wav" \
  --transcript packages/e2e/lipsync/pt-br-01.txt --language pt-BR \
  --model-dir "$WHISPERX_MODEL_DIR" \
  --out "$LIPSYNC_SCRATCH/whisperx-pt-br.alignment.json"
node packages/cli/dist/index.js lipsync whisperx \
  "$LIPSYNC_SCRATCH/whisperx-pt-br.alignment.json" \
  --audio "$LIPSYNC_SCRATCH/pt-br-01.wav" --language pt-BR \
  --out "$LIPSYNC_SCRATCH/whisperx-pt-br.viseme.json"
```

Arm B is an explicitly **orthographic approximation**, not a phoneme model. Its
PT-BR rules are frozen before blind scoring and differ from the English control:
accented vowels stay distinct during matching, `o` and `u` use different rounded
mouths, isolated `h` is silent, `r/rr` do not reuse the English rounded mouth,
and longest-match handles `ch`, `lh`, `nh`, `rr`, `ss`, silent `u` in common
`que/qui` and `gue/gui` spellings, plus vowel + coda `m/n` nasalisation. These
rules reduce known false mouth movements; they do not turn Portuguese spelling
into phonemic evidence. Changing them after watching a comparison invalidates
its score and requires a fresh blind run.

These ignored TTS stand-ins prove the pipeline, but remain invalid gate input.
Once the human recordings exist, write the comparison and finish the score
sheets before opening `key.json`:

```bash
node packages/cli/dist/index.js lipsync compare \
  "$LIPSYNC_SCRATCH/rhubarb-pt-br.viseme.json" \
  "$LIPSYNC_SCRATCH/whisperx-pt-br.viseme.json" \
  --mouths packages/e2e/lipsync/mouth \
  --audio "$LIPSYNC_SCRATCH/pt-br-01.wav" \
  --out "$LIPSYNC_SCRATCH/compare-pt-br"
```

The compare command refuses to render if either arm would lose a cue to frame
rounding. A scoreable run therefore reports only that frame collapse is zero in
both arms; per-side cue density remains inside `key.json` until scoring ends.

## Mouth sheet (`mouth/`)

Nine SVGs, one per viseme in the Preston Blair set Rhubarb also emits, which is
the alphabet `VISEMES` in `@fantoche-dev/document` defines:

| File    | Sounds         | Drawing                                       |
| ------- | -------------- | --------------------------------------------- |
| `A.svg` | P, B, M        | closed under pressure — thick lips, flat seam |
| `B.svg` | K, S, T, EE    | barely open, teeth clenched                   |
| `C.svg` | EH, AE         | open and wide, teeth showing                  |
| `D.svg` | AA             | wide open, teeth and tongue                   |
| `E.svg` | AO, ER         | rounded and mid-sized                         |
| `F.svg` | UW, OW, W      | puckered — thick ring, small hole             |
| `G.svg` | F, V           | upper teeth biting the lower lip              |
| `H.svg` | L              | open, tongue tip raised                       |
| `X.svg` | rest / silence | closed and relaxed — thin, wider than `A`     |

**These are a discrimination test, not art.** What they owe the spike is that a
viewer can tell them apart in a single frame at speed: if `A` and `X` read the
same, "did it close on the bilabial?" becomes unanswerable and the scored axis
collapses. Hence the pairs drawn deliberately far apart — `A` vs `X` (pressed vs
relaxed), `C` vs `E` vs `F` (open vs rounded vs puckered), `B` vs `G` (teeth
clenched vs teeth on lip). They carry no letter labels: the reviewer is judging
whether the mouth looks right, and a legend would tell them the answer.

**The canvas is a contract.** All nine share one `viewBox` (`0 0 320 200`) and
one origin, because the preview stacks them as nine `svg` elements and switches
`opacity` — a mouth drawn on a different canvas would jump when it took over.
The preview canvas defaults to 480×320, which these sit inside with a margin.

```bash
# All nine must print the same viewBox.
node -e "const fs=require('fs');for(const v of 'ABCDEFGHX'){const s=fs.readFileSync(\`packages/e2e/lipsync/mouth/\${v}.svg\`,'utf8');console.log(v, /viewBox=\"([^\"]+)\"/.exec(s)?.[1]);}"
```

`fantoche lipsync preview` enforces both halves of this before it writes
anything: each file must be an `<svg>` with a canvas and at least one tag the
runtime actually draws, and the nine must agree on that canvas. A sheet made of
elements the parser ignores — `<text>`, most obviously — renders an empty frame,
and an empty frame scored blind reads as the aligner's failure rather than the
sheet's.

**Provenance.** Drawn for this repo — plain SVG primitives, no traced or
imported artwork, no third-party asset. Licensed under the repo's MIT licence.

## Using them

```bash
fantoche lipsync preview <track.json> \
  --mouths packages/e2e/lipsync/mouth \
  --out preview.doc.json --render
```

The output is an ordinary document: nine stacked mouths whose `opacity` is
hold-switched one cue at a time. That is the point of the spike's shape — it
renders through the pipeline P1 already shipped, with no new element type, no
new prop and no runtime change.
