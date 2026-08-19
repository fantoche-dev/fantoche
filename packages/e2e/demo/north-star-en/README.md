# North-star English control

An English-text, English-voice control of the north-star demo. It keeps the same
character, diagram, code beats, and 12-block structure as the PT-BR version so
language/voice is the variable under test.

The provisional audio uses Edge TTS 7.2.8, `en-US-AvaNeural`, at `+8%` rate. The
exact 250-word transcript produces a 90.480 s mono PCM WAV and aligns 250/250
tokens with the English WhisperX model.

```sh
uvx --from edge-tts==7.2.8 edge-tts \
  --file narration.txt \
  --voice en-US-AvaNeural \
  --rate=+8% \
  --write-media narration.mp3
```

## What the control showed

The untouched WhisperX adapter output is preserved as `mouth.auto.viseme.json`:

- 889 cues;
- all 59 aligned `p`, `b`, and `m` characters evaluate to A;
- 632 cue intervals are shorter than 0.100 s.

English therefore improves automatic bilabial closure in this sample, but it
does not solve jitter. The reviewed `mouth.viseme.json` applies the same
three-frame hold rule as the PT-BR demo:

- 403 cues;
- minimum interval 0.100 s;
- 59/59 bilabials still evaluate to A;
- 63 measured X rests remain.

Local comparison renders:

```sh
fantoche render demo.json --out north-star-en-smooth.mp4 --offline

# To render the raw arm, temporarily point the `mouth` asset at
# `mouth.auto.viseme.json`.
```

This is a diagnostic control, not a replacement for the roadmap's Portuguese P2
gate.
