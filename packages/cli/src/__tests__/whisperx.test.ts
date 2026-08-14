import * as fs from 'fs';
import {describe, expect, test} from 'vitest';
import {
  EN_VISEME_MAP,
  PT_VISEME_MAP,
  graphemeToViseme,
  matchGraphemeToViseme,
} from '../lipsync/viseme-map';
import {
  SILENCE_SECONDS,
  charAlignmentToVisemes,
  normaliseWhisperXOutput,
} from '../lipsync/whisperx';

describe('WhisperX grapheme map', () => {
  test('keeps the PT gate distinct from the English control', () => {
    expect(PT_VISEME_MAP).not.toEqual(EN_VISEME_MAP);
    for (const char of ['m', 'b', 'p']) expect(PT_VISEME_MAP[char]).toBe('A');
    expect(PT_VISEME_MAP.o).toBe('E');
    expect(PT_VISEME_MAP.u).toBe('F');
    for (const char of ['f', 'v']) expect(PT_VISEME_MAP[char]).toBe('G');
    expect(EN_VISEME_MAP.w).toBe('F');
    expect(graphemeToViseme('ã', 'pt-BR')).toBe('D');
    expect(graphemeToViseme('r', 'pt-BR')).toBe('B');
    expect(graphemeToViseme('h', 'pt-BR')).toBeUndefined();
    expect(graphemeToViseme(',', 'pt')).toBeUndefined();
  });

  test('longest-matches PT digraphs, silent u and nasal spellings', () => {
    expect(matchGraphemeToViseme([...'que'], 0, 'pt-BR')).toEqual({
      consumed: 2,
      viseme: 'B',
    });
    expect(matchGraphemeToViseme([...'olho'], 1, 'pt-BR')).toEqual({
      consumed: 2,
      viseme: 'H',
    });
    expect(matchGraphemeToViseme([...'carro'], 2, 'pt-BR')).toEqual({
      consumed: 2,
      viseme: 'B',
    });
    for (const [word, index, viseme] of [
      ['chuva', 0, 'B'],
      ['ninho', 2, 'B'],
      ['passo', 2, 'B'],
      ['guerra', 0, 'B'],
    ] as const) {
      expect(matchGraphemeToViseme([...word], index, 'pt-BR')).toEqual({
        consumed: 2,
        viseme,
      });
    }
    expect(matchGraphemeToViseme([...'som'], 1, 'pt-BR')).toEqual({
      consumed: 2,
      viseme: 'E',
    });
    // In `cama`, m begins the next syllable and must still close the lips.
    expect(matchGraphemeToViseme([...'cama'], 1, 'pt-BR')).toEqual({
      consumed: 1,
      viseme: 'D',
    });
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
          {char: 'ó', start: 0.3, end: 0.35},
          {char: 'f', start: 0.5, end: 0.55},
        ],
      },
      {language: 'pt', audio: 'x.wav'},
    );
    expect(track.cues).toEqual([
      {t: 0, viseme: 'A'},
      {t: 0.1, viseme: 'X'},
      {t: 0.22, viseme: 'E'},
      {t: 0.35, viseme: 'X'},
      {t: 0.5, viseme: 'G'},
      {t: 0.55, viseme: 'X'},
    ]);
  });

  test('applies contextual PT units without false h/u/m mouths', () => {
    const chars = [...'olho que som'].map((char, index) => ({
      char,
      start: Number((index * 0.05).toFixed(2)),
      end: Number(((index + 1) * 0.05).toFixed(2)),
    }));
    const track = charAlignmentToVisemes(
      {words: [], chars},
      {language: 'pt-BR', audio: 'x.wav'},
    );
    expect(track.cues).toEqual([
      {t: 0, viseme: 'E'},
      {t: 0.05, viseme: 'H'},
      {t: 0.15, viseme: 'E'},
      {t: 0.25, viseme: 'B'},
      {t: 0.35, viseme: 'C'},
      {t: 0.45, viseme: 'B'},
      {t: 0.5, viseme: 'E'},
      {t: 0.6, viseme: 'X'},
    ]);
  });

  test('does not form a digraph across an omitted word separator', () => {
    const track = charAlignmentToVisemes(
      {
        words: [],
        chars: [
          {char: 'l', start: 0, end: 0.1},
          // The untimed space was omitted; the 100ms hole is still a boundary.
          {char: 'h', start: 0.2, end: 0.3},
          {char: 'o', start: 0.3, end: 0.4},
        ],
      },
      {language: 'pt-BR', audio: 'x.wav'},
    );
    expect(track.cues).toEqual([
      {t: 0, viseme: 'H'},
      {t: 0.1, viseme: 'X'},
      {t: 0.3, viseme: 'E'},
      {t: 0.4, viseme: 'X'},
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
