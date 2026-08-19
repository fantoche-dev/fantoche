# North-star demo

A 91.6-second PT-BR lesson on binary search. The document combines the reference
teacher rig, word-anchored poses, a 15-item diagram, an animated code
walkthrough, a manually corrected mouth track, and narration audio.

## Provisional test voice

`narration.wav` is a test stand-in generated on 2026-08-19 with `edge-tts` 7.2.8
and `pt-BR-FranciscaNeural`, from the exact committed `narration.txt`. It was
converted to 16 kHz mono PCM before local WhisperX alignment. This is
intentionally **not** the final public-release narration or its
license/provenance evidence; replace it with an owned human or licensed Azure
recording before declaring the manual Task 21 gate final.

The authoring-only generation was:

```sh
uvx --from edge-tts==7.2.8 edge-tts \
  --file narration.txt \
  --voice pt-BR-FranciscaNeural \
  --write-media narration.mp3

ffmpeg -i narration.mp3 -ar 16000 -ac 1 -c:a pcm_s16le narration.wav
```

The TTS call needs the network. The committed WAV, document, character sidecar,
and viseme track do not.

## Alignment and mouth review

`fantoche narration align` placed all 241 transcript tokens across 12 short
segments. The WhisperX character track was then manually corrected against the
ADR 0007 mistake catalogue:

- 455 held cues at 30 fps;
- minimum gap 0.100 s (no one-frame mouth shapes);
- all 108 aligned `p`, `b`, and `m` characters evaluate to pressed A;
- all 40 X cues lie in measured pauses; no synthetic rest was added.

The track is marked `engine: "manual"` because the generated 957-cue draft is
not the shipped result: its short shapes were removed, bilabial closures were
inserted/reviewed, and pauses were retained only from alignment evidence.

## Render

```sh
fantoche render demo.json --out north-star.mp4 --workers 4
fantoche render demo.json --out north-star-offline.mp4 --workers 4 --offline
```

The checked render is 1920×1080 H.264 with AAC audio and 91.665 seconds of
container duration. On the same machine, normal and `--offline` renders are
byte-identical.

When replacing the narration, keep `narration.txt` authoritative, run alignment
again, reset every segment window to the measured word span, and re-author the
mouth track before updating these figures.
