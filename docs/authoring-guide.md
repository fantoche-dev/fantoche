# Authoring with characters and narration

Fantoche treats the document, character rigs, aligned words, and viseme tracks
as source-controlled inputs. Alignment and import tools run while authoring;
rendering only reads the resulting files and therefore stays offline and
deterministic.

## 1. Prepare a character

Keep the source SVG and the generated files together:

```text
teacher/
  teacher.svg
  character.json
  teacher.art.json
```

Start with the importer, repair bindings if the SVG ids changed, and finish
with the check:

```sh
fantoche character import teacher/teacher.svg teacher/character.json
fantoche character bind teacher/character.json
fantoche character check teacher/character.json
```

`character.json` is the human-owned rig: slot bindings, parent links, pivots,
rest depth, poses, and the A–H/X mouth mapping. The `*.art.json` sidecar is a
generated render asset. Re-run `character import` after editing the SVG; never
hand-edit the sidecar.

Pose keys use `<slot>.<parameter>`, for example:

```json
{
  "poses": {
    "point": {"arm-r.rotation": -95, "arm-r.depth": 10},
    "rest": {"arm-r.rotation": 0, "arm-r.depth": -5}
  }
}
```

Depth changes are discrete. A pose can move an arm from behind the torso to in
front of the face without reparenting the SVG.

## 2. Write narration in short blocks

Use one segment per sentence or visual beat. A useful segment is normally
about 5–10 seconds: short enough to retime locally, but long enough to avoid a
wall of ids.

The segment text is the transcript authority. Record or synthesize exactly
those words, in that order. Do not "fix" punctuation or wording in the audio
without changing the document too; the aligner deliberately refuses missing,
extra, or reordered tokens.

```json
{
  "narration": {
    "audio": "voice",
    "segments": [
      {
        "id": "first_middle",
        "text": "We look directly at the middle.",
        "start": 12.4,
        "dur": 2.1
      }
    ]
  }
}
```

Record natural speech with a little clean silence at the end. Then align the
known transcript locally:

```sh
fantoche narration align demo.json \
  --audio narration.wav \
  --language en-US \
  --python .venv-whisperx/bin/python \
  --model-dir .cache/whisperx
```

The command adds absolute `words[]` timings while preserving the document's
formatting and unrelated keys. If a word falls outside its segment window, it
prints the minimum measured window instead of silently moving author timing.

## 3. Anchor visuals to spoken words

Prefer semantic anchors over guessed seconds:

```json
{
  "at": "first_middle.word:middle",
  "target": "pointer",
  "tween": {"x": {"to": 400}},
  "dur": {"value": 0.65, "min": 0.3},
  "easing": "spring"
}
```

Available references are `<segment>.start`, `<segment>.end`, and
`<segment>.word:<word>`, optionally followed by an offset such as `+0.2`.
Anchor words are normalized for case and edge punctuation. Choose a word that
occurs once in the segment; repeated matches compile with a warning and use the
first occurrence.

For ordinary tweens and poses, an adaptive duration keeps the authored tempo
when narration moves:

- `{"fit": true}` fills the space until the next event on that property.
- `{"value": 0.6, "min": 0.25}` prefers 0.6 seconds but shrinks when the next
  anchored event arrives sooner.
- A number such as `0.6` remains a fixed duration.

Use `spring` for scalar motion and pose parameters. It is closed-form and
seekable; `scale` vectors and structural code transitions should use a named
tween easing such as `easeOutBack`.

## 4. Add and correct mouth animation

Both draft generators write the same viseme-track format:

```sh
fantoche lipsync rhubarb narration.wav --language en-US --out mouth.viseme.json

fantoche lipsync whisperx alignment.json \
  --audio narration.wav \
  --language en-US \
  --out mouth.viseme.json
```

Reference the track as a `lipsync` asset and add one held timeline item:

```json
{
  "assets": {
    "mouth": {"type": "lipsync", "src": "mouth.viseme.json"}
  },
  "timeline": [{"target": "ana", "lipsync": "mouth"}]
}
```

Generated cues are a draft. Review them at the document frame rate and correct
the committed track by hand. For the current teacher mouth sheet:

- use X only where the audio contains a measured pause;
- make every /p/, /b/, and /m/ closure visibly reach A;
- favor E/F for rounded vowels;
- remove one-frame shapes and keep a cue visible for at least three frames
  unless the audio clearly demands a faster transition.

## 5. Compose, render, and verify

Declare a character asset, then place one or more cast members independently:

```json
{
  "assets": {
    "teacher": {
      "type": "character",
      "src": "../../characters/teacher/character.json"
    }
  },
  "cast": {
    "ana": {"character": "teacher", "x": -700, "y": 190, "scale": 1.7}
  }
}
```

Keep visual beats aligned with narration blocks: introduce the diagram, make
one comparison at a time, then move to code or a summary. Too many simultaneous
motions make both teaching and later retiming harder.

Render from the document and inspect the resulting streams:

```sh
fantoche render demo.json --out north-star.mp4
ffprobe -v error -show_entries stream=codec_type,codec_name north-star.mp4
```

The render path resolves character sidecars and viseme tracks before bundling.
It never runs SVG import, WhisperX, Rhubarb, or a speech service. With the same
document and committed assets, rendering with networking disabled must produce
the same bytes.

See `packages/e2e/demo/north-star/` for the complete English binary-search
lesson, `packages/e2e/demo/north-star-pt-br/` for its second-language control,
and `packages/e2e/demo/first-slice/` for the smallest end-to-end example.

## 6. Before you publish

A document that compiles is not yet a video worth watching.
[content-quality.md](content-quality.md) covers the three separate things that
decide that: the platform policies a narrated character video can trip, the
measurable technical floor (audio, lipsync, legibility, timing), and the craft
rubric the north-star demo is the worked example of. Its pre-publish checklist
is the short version.
