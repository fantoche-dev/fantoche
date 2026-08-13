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
spoken; WhisperX is given it verbatim, so a word that differs from the recording
is a misalignment the spike will blame on the tool.

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

Read each `.txt` at a normal narration pace, in one take, in a quiet room.
Record however you like, then normalise the container and rate — that part has
to be exact:

```bash
ffmpeg -i take.m4a -ar 16000 -ac 1 -c:a pcm_s16le packages/e2e/lipsync/pt-br-01.wav
```

Or record straight to the target format (list your inputs first; the device
index is machine-specific):

```bash
ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep -A5 audio
ffmpeg -f avfoundation -i ":0" -t 10 -ar 16000 -ac 1 -c:a pcm_s16le take.wav
```

Verify before committing — both must report 16000 Hz, 1 channel, ~8 s:

```bash
for f in packages/e2e/lipsync/*.wav; do
  ffprobe -v error -show_entries stream=sample_rate,channels \
    -show_entries format=duration -of default=noprint_wrappers=1 "$f"
done
```

Then record the provenance below: whose voice, recorded when, on what.

**Provenance.** Not yet recorded — see above. Once they exist: recorded by
Daniel Nichiata, original speech, licensed under the repo's MIT licence.

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
