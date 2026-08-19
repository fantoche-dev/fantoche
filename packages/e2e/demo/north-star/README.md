# North-star demo

A 90.5-second English lesson on binary search — the primary north-star demo
(vision §5) since the 2026-08-19 English-first content decision. The document
combines the reference teacher rig, word-anchored poses, a 15-item diagram, an
animated code walkthrough, a manually corrected mouth track, and narration
audio. The matched PT-BR version lives in `../north-star-pt-br/` as the
second-language control.

## Provisional test voice

`narration.wav` is a test stand-in generated on 2026-08-19 with `edge-tts` 7.2.8
and `en-US-AvaNeural` at `+8%` rate, from the exact committed `narration.txt`.
It was converted to 16 kHz mono PCM before local WhisperX alignment. This is
intentionally **not** the final public-release narration or its
license/provenance evidence; replace it with an owned human or licensed Azure
recording before declaring the manual Task 21 gate final.

The authoring-only generation was:

```sh
uvx --from edge-tts==7.2.8 edge-tts \
  --file narration.txt \
  --voice en-US-AvaNeural \
  --rate=+8% \
  --write-media narration.mp3

ffmpeg -i narration.mp3 -ar 16000 -ac 1 -c:a pcm_s16le narration.wav
```

The TTS call needs the network. The committed WAV, document, character sidecar,
and viseme track do not.

> **Known defect (content-quality §2.1).** The WAV is 16 kHz mono — the format
> WhisperX needs — and the document also renders it as the `voice` asset, so the
> exported MP4 carries telephone-bandwidth audio. The fix is a 48 kHz master
> with a derived 16 kHz alignment copy; it lands with the narration replacement
> above and invalidates the mouth track and render hash.

## Alignment and mouth review

`fantoche narration align` placed all 250 transcript tokens across 12 short
segments with the English WhisperX model. The untouched adapter output is
preserved as `mouth.auto.viseme.json` as re-spike evidence:

- 889 cues;
- all 59 aligned `p`, `b`, and `m` characters already evaluate to pressed A;
- but 632 cue intervals are shorter than 0.100 s.

English improves automatic bilabial closure over the PT-BR draft (59/59 vs
87/108), but not jitter. The committed auto track is the spike-era map's output;
the contextual English rules added to the matcher on 2026-08-19 (digraphs,
double letters, silent letters) regenerate it as 835 cues with the 59/59
closures intact and ~11% fewer sub-0.100 s intervals — better drafts, same
conclusion: the minimum-hold layer, not the map, is the re-spike target. The
shipped `mouth.viseme.json` is the manual review of the draft against the ADR
0007 mistake catalogue:

- 403 held cues at 30 fps;
- minimum gap 0.100 s (no one-frame mouth shapes);
- all 59 aligned `p`, `b`, and `m` characters evaluate to pressed A;
- all 63 X cues lie in measured pauses; no synthetic rest was added.

The track is marked `engine: "manual"` because the generated draft is not the
shipped result: its short shapes were removed and pauses were retained only from
alignment evidence.

## Render

```sh
fantoche render demo.json --out north-star.mp4 --workers 4
fantoche render demo.json --out north-star-offline.mp4 --workers 4 --offline
```

When replacing the narration, keep `narration.txt` authoritative, run alignment
again, reset every segment window to the measured word span, and re-author the
mouth track before updating these figures.
