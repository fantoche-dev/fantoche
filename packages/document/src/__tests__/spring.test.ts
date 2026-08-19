import {describe, expect, test} from 'vitest';
import {compileDocument} from '../compiler/compile.js';
import {evaluateFrame} from '../evaluator.js';
import {validateDocument} from '../validate.js';

interface SpringDocOptions {
  from?: unknown;
  to?: unknown;
  dur?: number;
  prop?: string;
  duration?: number;
  start?: number;
}

function springDoc({
  from = 0,
  to = 100,
  dur = 0.5,
  prop = 'x',
  duration = 8,
  start = 0,
}: SpringDocOptions = {}) {
  return {
    version: '0.2',
    meta: {fps: 30, size: [320, 180], duration},
    elements: [
      {
        id: 'box',
        type: 'rect',
        props: {[prop]: from, width: 20, height: 20},
      },
    ],
    timeline: [
      {
        at: start,
        target: 'box',
        tween: {[prop]: {to}},
        dur,
        easing: 'spring',
      },
    ],
  };
}

function compile(raw: unknown) {
  const result = validateDocument(raw);
  if (!result.ok) {
    throw new Error(`fixture invalid: ${JSON.stringify(result.errors)}`);
  }
  return compileDocument(result.doc).ir;
}

function xAt(ir: ReturnType<typeof compile>, frame: number): number {
  return evaluateFrame(ir, frame).props.get('box')!.get('x') as number;
}

describe('closed-form spring easing', () => {
  test('lands exactly on the target at the settle frame', () => {
    const ir = compile(springDoc());
    expect(xAt(ir, 15)).toBeCloseTo(100, 9);

    const key = ir.tracks.find(track => track.prop === 'x')!.keys.at(-1)!;
    expect(key.easing).toBe('spring');
    expect(key.spring?.norm).toBeGreaterThan(0);
  });

  test('carries momentum from the immediately previous spring segment', () => {
    const chained = compile({
      ...springDoc(),
      timeline: [
        {
          at: 0,
          target: 'box',
          tween: {x: {to: 100}},
          dur: 0.5,
          easing: 'spring',
        },
        {
          at: 0.5,
          target: 'box',
          tween: {x: {to: 200}},
          dur: 0.5,
          easing: 'spring',
        },
      ],
    });
    const fresh = compile(springDoc({from: 100, to: 200, start: 0.5}));

    expect(xAt(chained, 20)).toBeGreaterThan(xAt(fresh, 20));
    expect(
      chained.tracks.find(track => track.prop === 'x')!.keys.at(-1)!.spring!
        .v0n,
    ).toBeGreaterThan(0);
  });

  test('a hold gap resets the baked entry velocity', () => {
    const ir = compile({
      ...springDoc(),
      timeline: [
        {
          at: 0,
          target: 'box',
          tween: {x: {to: 100}},
          dur: 0.5,
          easing: 'spring',
        },
        {
          at: 1,
          target: 'box',
          tween: {x: {to: 200}},
          dur: 0.5,
          easing: 'spring',
        },
      ],
    });

    expect(ir.tracks[0].keys.at(-1)!.spring!.v0n).toBe(0);
  });

  test('is O(1) in document duration', () => {
    const short = compile(springDoc({duration: 8}));
    const long = compile(springDoc({duration: 600}));

    expect(short.tracks[0].keys).toHaveLength(long.tracks[0].keys.length);
    expect(evaluateFrame(short, 300)).toEqual(evaluateFrame(long, 300));
  });

  test('rejects springs on non-scalar props with an actionable message', () => {
    expect(() =>
      compile(springDoc({prop: 'scale', from: [1, 1], to: [2, 2]})),
    ).toThrow(/spring.*scalar number/i);
  });

  test('stays pure: same IR and frame gives the same value', () => {
    const ir = compile(springDoc());
    expect(evaluateFrame(ir, 7)).toEqual(evaluateFrame(ir, 7));
  });
});
