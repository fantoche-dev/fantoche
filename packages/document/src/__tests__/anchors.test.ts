import {describe, expect, test} from 'vitest';
import {
  AnchorError,
  buildNarrationIndex,
  resolveTimeRef,
} from '../compiler/anchors.js';

const narration = {
  segments: [
    {
      id: 'intro',
      text: 'Hoje vamos entender busca binária',
      start: 0.5,
      dur: 3.2,
      words: [
        {text: 'Hoje', start: 0.5},
        {text: 'busca', start: 2.4, dur: 0.4},
        {text: 'binária', start: 3.1, dur: 0.6},
      ],
    },
    {
      id: 'repeat',
      text: 'busca busca',
      start: 5,
      dur: 2,
      words: [
        {text: 'busca', start: 5.0},
        {text: 'busca', start: 6.0},
      ],
    },
    {id: 'nowords', text: 'sem timestamps', start: 8, dur: 1},
  ],
};

const index = buildNarrationIndex(narration);

describe('resolveTimeRef', () => {
  test('numbers pass through', () => {
    expect(resolveTimeRef(2.5, index).seconds).toBe(2.5);
  });

  test('segment start and end', () => {
    expect(resolveTimeRef('intro.start', index).seconds).toBe(0.5);
    expect(resolveTimeRef('intro.end', index).seconds).toBeCloseTo(3.7);
  });

  test('offsets apply after base resolution', () => {
    expect(resolveTimeRef('intro.end+0.3', index).seconds).toBeCloseTo(4.0);
    expect(resolveTimeRef('intro.start-0.25', index).seconds).toBeCloseTo(0.25);
  });

  test('word anchors resolve to the word start', () => {
    expect(resolveTimeRef('intro.word:binária', index).seconds).toBeCloseTo(
      3.1,
    );
    expect(resolveTimeRef('intro.word:binária+0.5', index).seconds).toBeCloseTo(
      3.6,
    );
  });

  test('ambiguous word resolves to first occurrence with a warning', () => {
    const result = resolveTimeRef('repeat.word:busca', index);
    expect(result.seconds).toBe(5.0);
    expect(result.warning).toMatch(/ambiguous/i);
  });

  test('missing segment is an AnchorError naming the ref', () => {
    expect(() => resolveTimeRef('outro.start', index)).toThrow(AnchorError);
    expect(() => resolveTimeRef('outro.start', index)).toThrow(/outro\.start/);
  });

  test('missing word is an AnchorError', () => {
    expect(() => resolveTimeRef('intro.word:quicksort', index)).toThrow(
      AnchorError,
    );
  });

  test('word anchor into a segment without word timings is an AnchorError', () => {
    expect(() => resolveTimeRef('nowords.word:sem', index)).toThrow(
      /no word timings/i,
    );
  });

  test('negative resolved times are clamped to 0', () => {
    expect(resolveTimeRef('intro.start-5', index).seconds).toBe(0);
  });
});
