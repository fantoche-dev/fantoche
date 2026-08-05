import {describe, expect, test} from 'vitest';
import {compileDocument} from '../compiler/compile.js';
import {evaluate, lerpValue} from '../evaluator.js';
import type {TimelineIR} from '../ir.js';
import {validateDocument} from '../validate.js';

function compile(raw: unknown): TimelineIR {
  const result = validateDocument(raw);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.errors));
  }
  return compileDocument(result.doc).ir;
}

const doc = {
  version: '0.1',
  meta: {fps: 30, size: [640, 360], duration: 10},
  elements: [
    {
      id: 'a',
      type: 'rect',
      props: {x: 0, width: 10, height: 10, fill: '#000000'},
    },
    {id: 'c', type: 'code', props: {code: 'let x = 1;'}},
  ],
  timeline: [
    {at: 1, target: 'a', tween: {x: {to: 300}}, dur: 2, easing: 'linear'},
    {at: 4, target: 'a', set: {opacity: 0.5}},
    {
      at: 5,
      target: 'a',
      tween: {fill: {to: '#ffffff'}},
      dur: 1,
      easing: 'linear',
    },
    {at: 2, target: 'c', select: {lines: [0, 0]}, dur: 1},
    {at: 6, target: 'c', edit: {to: 'let x = 2;'}, dur: 1},
    {at: 8, block: {src: './fx.tsx#burst', dur: 1}},
  ],
};

describe('evaluate', () => {
  const ir = compile(doc);

  test('before, during and after a linear tween', () => {
    expect(evaluate(ir, 0).props.get('a')!.get('x')).toBe(0);
    expect(evaluate(ir, 2).props.get('a')!.get('x')).toBeCloseTo(150);
    expect(evaluate(ir, 3).props.get('a')!.get('x')).toBe(300);
    expect(evaluate(ir, 9).props.get('a')!.get('x')).toBe(300);
  });

  test('set jumps exactly at its frame', () => {
    expect(evaluate(ir, 3.99).props.get('a')!.get('opacity')).toBeUndefined();
    expect(evaluate(ir, 4).props.get('a')!.get('opacity')).toBe(0.5);
  });

  test('color tween interpolates and settles on plain strings', () => {
    const mid = evaluate(ir, 5.5).props.get('a')!.get('fill');
    expect(typeof mid).toBe('string');
    expect(mid).not.toBe('#000000');
    expect(mid).not.toBe('#ffffff');
    const done = evaluate(ir, 6.1).props.get('a')!.get('fill');
    expect(done).toBe('#ffffff');
  });

  test('code selection transitions then settles', () => {
    const during = evaluate(ir, 2.5).code.get('c')!.selection;
    expect(during.progress).not.toBeNull();
    expect(during.from).not.toBeNull();
    const after = evaluate(ir, 3.5).code.get('c')!.selection;
    expect(after.progress).toBeNull();
    expect(after.ranges).toEqual([
      [
        [0, 0],
        [0, Infinity],
      ],
    ]);
  });

  test('code edit exposes from/to/progress in flight and settles after', () => {
    expect(evaluate(ir, 5.9).code.get('c')!.code).toBe('let x = 1;');
    const during = evaluate(ir, 6.5).code.get('c')!.code;
    expect(during).toMatchObject({from: 'let x = 1;', to: 'let x = 2;'});
    expect(evaluate(ir, 7.5).code.get('c')!.code).toBe('let x = 2;');
  });

  test('blocks activate only inside their window with local time', () => {
    expect(evaluate(ir, 7.9).blocks).toHaveLength(0);
    const active = evaluate(ir, 8.5).blocks;
    expect(active).toHaveLength(1);
    expect(active[0].localSeconds).toBeCloseTo(0.5);
    expect(evaluate(ir, 9).blocks).toHaveLength(0);
  });

  test('purity: same t ⇒ deep-equal state across 500 random samples', () => {
    for (let i = 0; i < 500; i++) {
      const t = ((i * 7919) % 1000) / 100; // deterministic pseudo-random 0..10
      expect(evaluate(ir, t)).toEqual(evaluate(ir, t));
    }
  });

  test('random access equals a monotone sweep at every frame', () => {
    const sweep: unknown[] = [];
    for (let f = 0; f <= ir.durationF; f++) {
      sweep.push(evaluate(ir, f / ir.fps));
    }
    for (let f = ir.durationF; f >= 0; f--) {
      expect(evaluate(ir, f / ir.fps)).toEqual(sweep[f]);
    }
  });

  test('evaluation cost is flat in document length (O(log keys))', () => {
    const makeLongDoc = (seconds: number) => {
      const timeline = [];
      for (let s = 0; s < seconds; s += 2) {
        timeline.push({
          at: s,
          target: 'a',
          tween: {x: {to: (s * 13) % 500}},
          dur: 1,
        });
      }
      return compile({
        version: '0.1',
        meta: {fps: 30, size: [640, 360]},
        elements: [
          {id: 'a', type: 'rect', props: {x: 0, width: 10, height: 10}},
        ],
        timeline,
      });
    };
    const short = makeLongDoc(10);
    const long = makeLongDoc(600);

    const bench = (ir: TimelineIR, t: number) => {
      evaluate(ir, t); // warmup
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        evaluate(ir, t);
      }
      return (performance.now() - start) / 1000;
    };
    const shortMs = bench(short, 9.5);
    const longMs = bench(long, 599.5);
    console.log(
      `evaluate: short=${shortMs.toFixed(4)}ms long=${longMs.toFixed(4)}ms`,
    );
    expect(longMs).toBeLessThan(1);
    expect(longMs).toBeLessThan(Math.max(shortMs * 20, 0.5));
  });
});

describe('lerpValue', () => {
  test('numbers, arrays, point lists', () => {
    expect(lerpValue(0, 10, 0.5)).toBe(5);
    expect(lerpValue([0, 10], [10, 20], 0.5)).toEqual([5, 15]);
    expect(
      lerpValue(
        [
          [0, 0],
          [10, 10],
        ],
        [
          [10, 10],
          [20, 20],
        ],
        0.5,
      ),
    ).toEqual([
      [5, 5],
      [15, 15],
    ]);
  });

  test('non-color strings and booleans cut over at 0.5', () => {
    expect(lerpValue('left', 'right', 0.4)).toBe('left');
    expect(lerpValue('left', 'right', 0.6)).toBe('right');
    expect(lerpValue(false, true, 0.6)).toBe(true);
  });

  test('endpoints are exact', () => {
    expect(lerpValue('#000000', '#ffffff', 0)).toBe('#000000');
    expect(lerpValue('#000000', '#ffffff', 1)).toBe('#ffffff');
  });
});
