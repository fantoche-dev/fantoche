import {describe, expect, test} from 'vitest';
import {compileDocument, CompileError} from '../compiler/compile.js';
import {evaluate} from '../evaluator.js';
import type {TimelineIR} from '../ir.js';
import {validateDocument} from '../validate.js';

function compile(raw: unknown): TimelineIR {
  const result = validateDocument(raw);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.errors));
  }
  return compileDocument(result.doc).ir;
}

const base = {
  version: '0.1',
  meta: {fps: 30, size: [640, 360]},
  elements: [{id: 'a', type: 'rect', props: {x: 0, width: 10, height: 10}}],
};

describe('adjacency matrix (batch C review C1/C2)', () => {
  test('zero-gap chained tweens both animate', () => {
    const ir = compile({
      ...base,
      timeline: [
        {at: 0, target: 'a', tween: {x: {to: 100}}, dur: 1, easing: 'linear'},
        {at: 1, target: 'a', tween: {x: {to: 200}}, dur: 1, easing: 'linear'},
      ],
    });
    expect(evaluate(ir, 0.5).props.get('a')!.get('x')).toBeCloseTo(50);
    expect(evaluate(ir, 1).props.get('a')!.get('x')).toBeCloseTo(100);
    expect(evaluate(ir, 1.5).props.get('a')!.get('x')).toBeCloseTo(150);
  });

  test('one-frame-gap and one-second-gap chains hold between tweens', () => {
    for (const gap of [1 / 30, 1]) {
      const ir = compile({
        ...base,
        timeline: [
          {at: 0, target: 'a', tween: {x: {to: 100}}, dur: 1, easing: 'linear'},
          {
            at: 1 + gap,
            target: 'a',
            tween: {x: {to: 200}},
            dur: 1,
            easing: 'linear',
          },
        ],
      });
      expect(evaluate(ir, 0.5).props.get('a')!.get('x')).toBeCloseTo(50);
      expect(
        evaluate(ir, 1 + gap / 2)
          .props.get('a')!
          .get('x'),
      ).toBeCloseTo(100);
      expect(
        evaluate(ir, 1 + gap + 0.5)
          .props.get('a')!
          .get('x'),
      ).toBeCloseTo(150);
    }
  });

  test('a set exactly at a tween end is a CompileError, one frame later is fine', () => {
    const colliding = {
      ...base,
      timeline: [
        {at: 0, target: 'a', tween: {x: {to: 100}}, dur: 1},
        {at: 1, target: 'a', set: {x: 5}},
      ],
    };
    expect(() => compile(colliding)).toThrow(CompileError);
    expect(() => compile(colliding)).toThrow(
      /move it at least one frame later/,
    );

    const ir = compile({
      ...base,
      timeline: [
        {at: 0, target: 'a', tween: {x: {to: 100}}, dur: 1, easing: 'linear'},
        {at: 1 + 1 / 30, target: 'a', set: {x: 5}},
      ],
    });
    expect(evaluate(ir, 0.5).props.get('a')!.get('x')).toBeCloseTo(50);
    expect(evaluate(ir, 1).props.get('a')!.get('x')).toBe(100);
    expect(evaluate(ir, 2).props.get('a')!.get('x')).toBe(5);
  });

  test('set then tween starting at the same frame animates from the set value', () => {
    const ir = compile({
      ...base,
      timeline: [
        {at: 0, target: 'a', set: {x: 40}},
        {at: 0, target: 'a', tween: {x: {to: 140}}, dur: 1, easing: 'linear'},
      ],
    });
    expect(evaluate(ir, 0).props.get('a')!.get('x')).toBe(40);
    expect(evaluate(ir, 0.5).props.get('a')!.get('x')).toBeCloseTo(90);
  });
});

describe('easing overshoot (batch C review I1)', () => {
  test('easeOutBack overshoots past the target mid-tween', () => {
    const ir = compile({
      ...base,
      timeline: [
        {
          at: 0,
          target: 'a',
          tween: {x: {to: 100}},
          dur: 1,
          easing: 'easeOutBack',
        },
      ],
    });
    const samples = [0.5, 0.6, 0.7, 0.8].map(
      t => evaluate(ir, t).props.get('a')!.get('x') as number,
    );
    expect(Math.max(...samples)).toBeGreaterThan(100);
    expect(evaluate(ir, 1).props.get('a')!.get('x')).toBe(100);
  });

  test('easeInBack dips below the start early on', () => {
    const ir = compile({
      ...base,
      timeline: [
        {
          at: 0,
          target: 'a',
          tween: {x: {to: 100, from: 0}},
          dur: 1,
          easing: 'easeInBack',
        },
      ],
    });
    const samples = [0.1, 0.2, 0.3].map(
      t => evaluate(ir, t).props.get('a')!.get('x') as number,
    );
    expect(Math.min(...samples)).toBeLessThan(0);
  });
});

describe('duration bound (batch C review C3/I6)', () => {
  test('inferred duration includes the settle frame of the last keyframe', () => {
    const ir = compile({
      ...base,
      timeline: [{at: 0, target: 'a', tween: {x: {to: 100}}, dur: 1}],
    });
    expect(ir.durationF).toBe(31);
    expect(
      evaluate(ir, (ir.durationF - 1) / ir.fps)
        .props.get('a')!
        .get('x'),
    ).toBe(100);
  });

  test('explicit meta.duration ceils fractional frames', () => {
    const ir = compile({
      version: '0.1',
      meta: {fps: 30, size: [640, 360], duration: 1.001},
      elements: [],
      timeline: [],
    });
    expect(ir.durationF).toBe(31);
  });
});

describe('IR ownership (batch C review I2)', () => {
  test('evaluated arrays are fresh objects, never IR references', () => {
    const ir = compile({
      version: '0.1',
      meta: {fps: 30, size: [640, 360]},
      elements: [
        {
          id: 'l',
          type: 'line',
          props: {
            points: [
              [0, 0],
              [10, 10],
            ],
          },
        },
        {id: 'c', type: 'code', props: {code: 'a\nb'}},
      ],
      timeline: [
        {
          at: 0,
          target: 'l',
          tween: {
            points: {
              to: [
                [10, 10],
                [20, 20],
              ],
            },
          },
          dur: 1,
        },
        {at: 0, target: 'c', select: {lines: [0, 0]}, dur: 0.5},
      ],
    });
    const first = evaluate(ir, 2);
    const second = evaluate(ir, 2);
    const p1 = first.props.get('l')!.get('points');
    const p2 = second.props.get('l')!.get('points');
    expect(p1).toEqual(p2);
    expect(p1).not.toBe(p2);
    const key = ir.tracks.find(t => t.prop === 'points')!.keys.at(-1)!.value;
    expect(p1).not.toBe(key);

    const s1 = evaluate(ir, 2).code.get('c')!.selection.ranges;
    const s2 = evaluate(ir, 2).code.get('c')!.selection.ranges;
    expect(s1).not.toBe(s2);
    expect(s1).not.toBe(ir.codeTracks[0].selects[0].after);
    (s1[0][0] as number[])[0] = 999;
    expect(evaluate(ir, 2).code.get('c')!.selection.ranges[0][0][0]).not.toBe(
      999,
    );
  });
});
