import {describe, expect, test} from 'vitest';
import {compileDocument, CompileError} from '../compiler/compile.js';
import {validateDocument} from '../validate.js';

const base = {
  version: '0.2',
  meta: {fps: 30, size: [320, 180], duration: 3},
  elements: [
    {id: 'box', type: 'rect', props: {x: 0, opacity: 1, width: 20, height: 20}},
  ],
};

function compile(timeline: unknown[]) {
  const result = validateDocument({...base, timeline});
  if (!result.ok) {
    throw new Error(`fixture invalid: ${JSON.stringify(result.errors)}`);
  }
  return compileDocument(result.doc).ir;
}

describe('adaptive durations', () => {
  test('fit stretches to the next event on the same prop or the document end', () => {
    const ir = compile([
      {
        at: 0,
        target: 'box',
        tween: {x: {to: 100}},
        dur: {fit: true},
        easing: 'linear',
      },
      {
        at: 1.5,
        target: 'box',
        tween: {x: {to: 200}},
        dur: 0.5,
        easing: 'linear',
      },
      {
        at: 1,
        target: 'box',
        tween: {opacity: {to: 0}},
        dur: {fit: true},
        easing: 'linear',
      },
    ]);

    expect(ir.tracks.find(track => track.prop === 'x')!.keys).toEqual([
      {tF: 0, value: 0, easing: 'hold'},
      {tF: 45, value: 100, easing: 'linear'},
      {tF: 60, value: 200, easing: 'linear'},
    ]);
    expect(
      ir.tracks.find(track => track.prop === 'opacity')!.keys.at(-1),
    ).toEqual({tF: 90, value: 0, easing: 'linear'});
  });

  test('{value, min} compresses to the available space but keeps its floor', () => {
    const compressed = compile([
      {
        at: 0,
        target: 'box',
        tween: {x: {to: 100}},
        dur: {value: 0.8, min: 0.2},
      },
      {at: 0.5, target: 'box', tween: {x: {to: 200}}, dur: 0.25},
    ]);
    expect(
      compressed.tracks.find(track => track.prop === 'x')!.keys[1].tF,
    ).toBe(15);

    expect(() =>
      compile([
        {
          at: 0,
          target: 'box',
          tween: {x: {to: 100}},
          dur: {value: 0.8, min: 0.2},
        },
        {at: 0.1, target: 'box', tween: {x: {to: 200}}, dur: 0.25},
      ]),
    ).toThrow(CompileError);
    expect(() =>
      compile([
        {
          at: 0,
          target: 'box',
          tween: {x: {to: 100}},
          dur: {value: 0.8, min: 0.2},
        },
        {at: 0.1, target: 'box', tween: {x: {to: 200}}, dur: 0.25},
      ]),
    ).toThrow(/\/timeline\/1.*overlapping animations/);
  });

  test('block windows reject adaptive durations', () => {
    const result = validateDocument({
      ...base,
      timeline: [{at: 0, block: {src: './fx.tsx#confetti', dur: {fit: true}}}],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(error => error.path === '/timeline/0/block/dur'),
      ).toBe(true);
    }
  });
});
