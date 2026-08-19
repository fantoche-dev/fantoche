import {describe, expect, test} from 'vitest';
import {
  VISEME_TRACK_VERSION,
  visemeAt,
  VISEMES,
  visemeTrackSchema,
} from '../lipsync/visemes.js';

/** A minimal valid track, spread over in the negative cases below. */
const base = {
  version: VISEME_TRACK_VERSION,
  engine: 'rhubarb',
  audio: 'v.wav',
} as const;

describe('viseme track', () => {
  test('accepts manual tracks as the ADR 0007 shipping path', () => {
    expect(
      visemeTrackSchema.safeParse({
        ...base,
        engine: 'manual',
        cues: [{t: 0, viseme: 'X'}],
      }).success,
    ).toBe(true);
  });

  test('accepts the Preston-Blair alphabet and rejects strays', () => {
    expect(VISEMES).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X']);
    const ok = visemeTrackSchema.safeParse({
      version: '0.1',
      engine: 'rhubarb',
      audio: 'voice.wav',
      cues: [
        {t: 0, viseme: 'X'},
        {t: 0.2, viseme: 'B'},
      ],
    });
    expect(ok.success).toBe(true);
    expect(
      visemeTrackSchema.safeParse({
        ...base,
        cues: [{t: 0, viseme: 'Q'}],
      }).success,
    ).toBe(false);
  });

  test('pins the track format version, independent of the document format', () => {
    expect(VISEME_TRACK_VERSION).toBe('0.1');
    const cues = [{t: 0, viseme: 'X'}];
    expect(
      visemeTrackSchema.safeParse({
        engine: 'rhubarb',
        audio: 'v.wav',
        cues,
      }).success,
    ).toBe(false);
    // A document-format bump must not be mistaken for a track-format bump.
    expect(
      visemeTrackSchema.safeParse({...base, version: '0.2', cues}).success,
    ).toBe(false);
    expect(
      visemeTrackSchema.safeParse({...base, version: 0.1, cues}).success,
    ).toBe(false);
  });

  test('rejects unsorted cues (hold lookup assumes order)', () => {
    const result = visemeTrackSchema.safeParse({
      ...base,
      cues: [
        {t: 0.5, viseme: 'B'},
        {t: 0.2, viseme: 'C'},
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['cues', 1, 't']);
  });

  test('rejects duplicate timestamps (strictly increasing, not merely sorted)', () => {
    const result = visemeTrackSchema.safeParse({
      ...base,
      engine: 'whisperx',
      cues: [
        {t: 0.2, viseme: 'B'},
        {t: 0.2, viseme: 'C'},
      ],
    });
    expect(result.success).toBe(false);
    // The path, not the prose: it is what points an aligner author at the one
    // bad cue among hundreds.
    expect(result.error?.issues[0].path).toEqual(['cues', 1, 't']);
  });

  test('points at every offending cue, not just the first', () => {
    const result = visemeTrackSchema.safeParse({
      ...base,
      cues: [
        {t: 0, viseme: 'X'},
        {t: 0.4, viseme: 'B'},
        {t: 0.2, viseme: 'C'},
        {t: 0.6, viseme: 'D'},
        {t: 0.6, viseme: 'E'},
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map(issue => issue.path)).toEqual([
      ['cues', 2, 't'],
      ['cues', 4, 't'],
    ]);
  });

  test('rejects empty, negative and unattributable tracks', () => {
    expect(visemeTrackSchema.safeParse({...base, cues: []}).success).toBe(
      false,
    );
    expect(
      visemeTrackSchema.safeParse({...base, cues: [{t: -0.1, viseme: 'X'}]})
        .success,
    ).toBe(false);
    expect(
      visemeTrackSchema.safeParse({
        ...base,
        engine: 'montreal',
        cues: [{t: 0, viseme: 'X'}],
      }).success,
    ).toBe(false);
    expect(
      visemeTrackSchema.safeParse({
        ...base,
        cues: [{t: 0, viseme: 'X'}],
        fps: 24,
      }).success,
    ).toBe(false);
  });

  test('rejects non-finite cue times', () => {
    // Kept explicit even though plain `z.number()` already rejects these: the
    // tests are what stop a later "`.finite()` is redundant" cleanup from
    // quietly loosening the field back to Infinity/NaN.
    for (const t of [Infinity, -Infinity, NaN]) {
      expect(
        visemeTrackSchema.safeParse({...base, cues: [{t, viseme: 'X'}]})
          .success,
      ).toBe(false);
    }
  });

  test('requires an audio path', () => {
    expect(
      visemeTrackSchema.safeParse({
        ...base,
        audio: '',
        cues: [{t: 0, viseme: 'X'}],
      }).success,
    ).toBe(false);
    // Absolute paths are legitimate for a locally run spike tool.
    expect(
      visemeTrackSchema.safeParse({
        ...base,
        audio: '/Users/x/scratch/voice.wav',
        cues: [{t: 0, viseme: 'X'}],
      }).success,
    ).toBe(true);
  });

  test('accepts a BCP-47 subset language tag and nothing looser', () => {
    const cues = [{t: 0, viseme: 'X'}];
    for (const language of ['pt', 'pt-BR', 'en', 'en-US']) {
      expect(
        visemeTrackSchema.safeParse({...base, language, cues}).success,
      ).toBe(true);
    }
    // Each of these would silently become its own group in the by-language
    // blind comparison.
    for (const language of [
      'pt_BR',
      'PT-br',
      'Portuguese',
      'pt-br',
      '  ',
      'p',
      '',
    ]) {
      expect(
        visemeTrackSchema.safeParse({...base, language, cues}).success,
      ).toBe(false);
    }
    // The field stays optional.
    expect(visemeTrackSchema.safeParse({...base, cues}).success).toBe(true);
  });

  test('holds each cue until the next one', () => {
    const cues = [
      {t: 0, viseme: 'X'},
      {t: 0.2, viseme: 'B'},
      {t: 0.4, viseme: 'X'},
    ] as const;
    expect(visemeAt(cues, 0)).toBe('X');
    expect(visemeAt(cues, 0.19)).toBe('X');
    expect(visemeAt(cues, 0.2)).toBe('B');
    expect(visemeAt(cues, 10)).toBe('X');
  });

  test('rests before the first cue and on an empty track', () => {
    expect(visemeAt([], 0)).toBe('X');
    expect(visemeAt([], 12.5)).toBe('X');
    expect(visemeAt([{t: 0.5, viseme: 'B'}], 0.49)).toBe('X');
    expect(visemeAt([{t: 0.5, viseme: 'B'}], -1)).toBe('X');
  });

  test('probes every cue of a longer track', () => {
    // Ten cues make the search recurse ~4 levels; an off-by-one in the
    // bisection bounds only shows up away from the ends, so sweep the lot.
    const cues = VISEMES.map((viseme, i) => ({t: i / 10, viseme}));
    expect(visemeTrackSchema.safeParse({...base, cues}).success).toBe(true);
    for (const [i, cue] of cues.entries()) {
      expect(visemeAt(cues, cue.t)).toBe(VISEMES[i]);
      expect(visemeAt(cues, cue.t + 0.05)).toBe(VISEMES[i]);
      expect(visemeAt(cues, cue.t - 0.05)).toBe(i === 0 ? 'X' : VISEMES[i - 1]);
    }
  });
});
