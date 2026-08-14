import * as fs from 'fs';
import {describe, expect, test} from 'vitest';
import {
  EN_VISEME_MAP,
  PT_VISEME_MAP,
  graphemeToViseme,
} from '../lipsync/viseme-map';
import {
  SILENCE_SECONDS,
  charAlignmentToVisemes,
  normaliseWhisperXOutput,
} from '../lipsync/whisperx';

describe('WhisperX grapheme map', () => {
  test('maps the discriminating PT and EN mouth families', () => {
    for (const char of ['m', 'b', 'p']) expect(PT_VISEME_MAP[char]).toBe('A');
    for (const char of ['o', 'u']) expect(PT_VISEME_MAP[char]).toBe('F');
    for (const char of ['f', 'v']) expect(PT_VISEME_MAP[char]).toBe('G');
    expect(EN_VISEME_MAP.w).toBe('F');
    expect(graphemeToViseme('ã', 'pt-BR')).toBe('D');
    expect(graphemeToViseme(',', 'pt')).toBeUndefined();
  });
});

describe('WhisperX adapter', () => {
  test('collapses runs and inserts rest for gaps of at least 120ms', () => {
    const track = charAlignmentToVisemes(
      {
        words: [],
        chars: [
          {char: 'm', start: 0, end: 0.05},
          {char: 'b', start: 0.05, end: 0.1},
          {char: 'o', start: 0.1 + SILENCE_SECONDS, end: 0.3},
          {char: 'u', start: 0.3, end: 0.35},
          {char: 'f', start: 0.5, end: 0.55},
        ],
      },
      {language: 'pt', audio: 'x.wav'},
    );
    expect(track.cues).toEqual([
      {t: 0, viseme: 'A'},
      {t: 0.1, viseme: 'X'},
      {t: 0.22, viseme: 'F'},
      {t: 0.35, viseme: 'X'},
      {t: 0.5, viseme: 'G'},
      {t: 0.55, viseme: 'X'},
    ]);
  });

  test('converts captured PT-BR output into a valid track', async () => {
    const raw = JSON.parse(
      fs.readFileSync(
        new URL('./fixtures/whisperx-pt-br-01.json', import.meta.url),
        'utf8',
      ),
    );
    const alignment = normaliseWhisperXOutput(raw);
    const track = charAlignmentToVisemes(alignment, {
      language: 'pt',
      audio: 'pt-br-01.wav',
    });
    expect(alignment.words.length).toBeGreaterThan(10);
    expect(alignment.chars.length).toBeGreaterThan(50);
    expect(track.cues.length).toBeGreaterThan(20);
    expect(track.engine).toBe('whisperx');
    const {visemeTrackSchema} = await import('@fantoche-dev/document');
    expect(visemeTrackSchema.safeParse(track).success).toBe(true);
  });

  test('normalises raw segment output and drops untimed punctuation', () => {
    expect(
      normaliseWhisperXOutput({
        segments: [
          {
            words: [{word: 'Bom', start: 0.1, end: 0.3}],
            chars: [{char: ' '}, {char: 'B', start: 0.1, end: 0.2}],
          },
        ],
      }),
    ).toEqual({
      words: [{text: 'Bom', start: 0.1, end: 0.3}],
      chars: [{char: 'B', start: 0.1, end: 0.2}],
    });
  });
});
