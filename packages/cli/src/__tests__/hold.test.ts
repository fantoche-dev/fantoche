import {describe, expect, test} from 'vitest';
import {enforceMinimumHold} from '../lipsync/hold';

const at = (t: number, viseme: string) => ({t, viseme}) as const;

describe('minimum-hold collapse', () => {
  test('leaves a track that already clears the floor untouched', () => {
    const cues = [at(0, 'X'), at(0.2, 'A'), at(0.4, 'D')];
    expect(enforceMinimumHold(cues, 0.1)).toEqual(cues);
  });

  test('collapses a run of sub-minimum cues into one', () => {
    const result = enforceMinimumHold(
      [at(0, 'D'), at(0.02, 'B'), at(0.04, 'C'), at(0.5, 'E')],
      0.1,
    );
    expect(result.map(c => c.t)).toEqual([0, 0.5]);
  });

  test('keeps a surviving closure at its own aligned time', () => {
    // ADR 0007 axis 1: a lost closure is the defect a viewer sees first, so A
    // wins its window. It must also keep its OWN time: measured against the
    // English north-star, moving winners to the window start dropped 5 of 48
    // word-level closures, because the A slid out of the word it belonged to.
    const result = enforceMinimumHold(
      [at(0, 'D'), at(0.02, 'A'), at(0.04, 'C'), at(0.5, 'E')],
      0.1,
    );
    expect(result[0]).toEqual({t: 0.02, viseme: 'A'});
  });

  test('drops the lower-priority cue rather than the closure in a long run', () => {
    const result = enforceMinimumHold(
      [at(0, 'D'), at(0.05, 'C'), at(0.09, 'A'), at(0.13, 'D'), at(0.5, 'E')],
      0.1,
    );
    expect(result.map(c => c.viseme)).toContain('A');
    expect(result.find(c => c.viseme === 'A')?.t).toBe(0.09);
  });

  test('keeps a measured rest rather than a neutral shape beside it', () => {
    // §2.2 names exactly two hard rules — closure on p/b/m, and X only where
    // alignment measured a pause. Neither may lose to a neutral mouth: with
    // rests ranked below them the English draft kept only 35 of its 63
    // measured pauses.
    const result = enforceMinimumHold(
      [at(0, 'D'), at(0.02, 'X'), at(0.5, 'E')],
      0.1,
    );
    expect(result.map(c => c.viseme)).toEqual(['X', 'E']);
  });

  test('never invents a rest that the source did not carry', () => {
    const result = enforceMinimumHold(
      [at(0, 'D'), at(0.02, 'B'), at(0.5, 'E')],
      0.1,
    );
    expect(result.every(c => c.viseme !== 'X')).toBe(true);
  });

  test('keeps a rest that survives on its own', () => {
    const result = enforceMinimumHold(
      [at(0, 'D'), at(0.3, 'X'), at(0.6, 'E')],
      0.1,
    );
    expect(result.map(c => c.viseme)).toEqual(['D', 'X', 'E']);
  });

  test('output is strictly increasing and clears the floor everywhere', () => {
    const noisy = Array.from({length: 200}, (_, i) =>
      at(Math.round(i * 23) / 1000, 'ABCDEFGHX'[i % 9]),
    );
    const result = enforceMinimumHold(noisy, 0.1);
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i].t).toBeGreaterThan(result[i - 1].t);
      expect(
        Math.round((result[i].t - result[i - 1].t) * 1000),
      ).toBeGreaterThanOrEqual(100);
    }
  });

  test('preserves the first cue, which anchors the track', () => {
    const result = enforceMinimumHold(
      [at(0.28, 'F'), at(0.3, 'D'), at(0.9, 'E')],
      0.1,
    );
    expect(result[0].t).toBe(0.28);
  });
});
