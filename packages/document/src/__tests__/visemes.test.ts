import {describe, expect, test} from 'vitest';
import {VISEMES, visemeAt, visemeTrackSchema} from '../lipsync/visemes.js';

describe('viseme track', () => {
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
        version: '0.1',
        engine: 'rhubarb',
        audio: 'v.wav',
        cues: [{t: 0, viseme: 'Q'}],
      }).success,
    ).toBe(false);
  });

  test('rejects unsorted cues (hold lookup assumes order)', () => {
    expect(
      visemeTrackSchema.safeParse({
        version: '0.1',
        engine: 'rhubarb',
        audio: 'v.wav',
        cues: [
          {t: 0.5, viseme: 'B'},
          {t: 0.2, viseme: 'C'},
        ],
      }).success,
    ).toBe(false);
  });

  test('rejects duplicate timestamps (strictly increasing, not merely sorted)', () => {
    const result = visemeTrackSchema.safeParse({
      version: '0.1',
      engine: 'whisperx',
      audio: 'v.wav',
      cues: [
        {t: 0.2, viseme: 'B'},
        {t: 0.2, viseme: 'C'},
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/strictly increasing/);
  });

  test('rejects empty, negative and unattributable tracks', () => {
    const base = {version: '0.1', engine: 'rhubarb', audio: 'v.wav'};
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

  test('accepts an optional language tag', () => {
    const result = visemeTrackSchema.safeParse({
      version: '0.1',
      engine: 'whisperx',
      audio: 'pt-br-01.wav',
      language: 'pt',
      cues: [{t: 0, viseme: 'X'}],
    });
    expect(result.success).toBe(true);
  });

  test('holds each cue until the next one', () => {
    const cues = [
      {t: 0, viseme: 'X'},
      {t: 0.2, viseme: 'B'},
      {t: 0.4, viseme: 'X'},
    ] as const;
    expect(visemeAt([...cues], 0)).toBe('X');
    expect(visemeAt([...cues], 0.19)).toBe('X');
    expect(visemeAt([...cues], 0.2)).toBe('B');
    expect(visemeAt([...cues], 10)).toBe('X');
  });

  test('rests before the first cue and on an empty track', () => {
    expect(visemeAt([], 0)).toBe('X');
    expect(visemeAt([], 12.5)).toBe('X');
    expect(visemeAt([{t: 0.5, viseme: 'B'}], 0.49)).toBe('X');
    expect(visemeAt([{t: 0.5, viseme: 'B'}], -1)).toBe('X');
  });
});
