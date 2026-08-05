import {describe, expect, test} from 'vitest';
import {
  compileDocument,
  CompileError,
  FULL_SELECTION,
} from '../compiler/compile.js';
import {validateDocument} from '../validate.js';

function compile(raw: unknown) {
  const result = validateDocument(raw);
  if (!result.ok) {
    throw new Error(`fixture invalid: ${JSON.stringify(result.errors)}`);
  }
  return compileDocument(result.doc);
}

const base = {
  version: '0.1',
  meta: {fps: 30, size: [640, 360]},
};

describe('compileDocument', () => {
  test('minimal doc with explicit duration', () => {
    const {ir, warnings} = compile({
      ...base,
      meta: {...base.meta, duration: 2},
      elements: [],
      timeline: [],
    });
    expect(ir.durationF).toBe(60);
    expect(warnings).toEqual([]);
  });

  test('cannot infer duration → CompileError', () => {
    expect(() => compile({...base, elements: [], timeline: []})).toThrow(
      CompileError,
    );
  });

  test('set lowers to a hold key; tween to a from/to key pair', () => {
    const {ir} = compile({
      ...base,
      elements: [
        {id: 'a', type: 'rect', props: {x: -100, width: 10, height: 10}},
      ],
      timeline: [
        {at: 0.5, target: 'a', set: {opacity: 0}},
        {at: 1, target: 'a', tween: {x: {to: 200}}, dur: 1, easing: 'linear'},
      ],
    });
    const opacity = ir.tracks.find(t => t.prop === 'opacity')!;
    expect(opacity.keys).toEqual([{tF: 15, value: 0, easing: 'hold'}]);
    const x = ir.tracks.find(t => t.prop === 'x')!;
    expect(x.initial).toBe(-100);
    expect(x.keys).toEqual([
      {tF: 30, value: -100, easing: 'hold'},
      {tF: 60, value: 200, easing: 'linear'},
    ]);
  });

  test('tween from-value threads from the previous animation', () => {
    const {ir} = compile({
      ...base,
      elements: [{id: 'a', type: 'rect', props: {width: 10, height: 10}}],
      timeline: [
        {at: 0, target: 'a', tween: {x: {to: 100, from: 0}}, dur: 1},
        {at: 2, target: 'a', tween: {x: {to: -50}}, dur: 1},
      ],
    });
    const x = ir.tracks.find(t => t.prop === 'x')!;
    expect(x.keys.map(k => [k.tF, k.value])).toEqual([
      [0, 0],
      [30, 100],
      [60, 100],
      [90, -50],
    ]);
  });

  test('overlapping tweens on the same prop are a CompileError with the item path', () => {
    const doc = {
      ...base,
      elements: [{id: 'a', type: 'rect', props: {width: 10, height: 10}}],
      timeline: [
        {at: 0, target: 'a', tween: {x: {to: 100}}, dur: 2},
        {at: 1, target: 'a', tween: {x: {to: 0}}, dur: 1},
      ],
    };
    expect(() => compile(doc)).toThrow(CompileError);
    expect(() => compile(doc)).toThrow(/\/timeline\/1/);
  });

  test('parallel tweens on different props are fine', () => {
    const {ir} = compile({
      ...base,
      elements: [{id: 'a', type: 'rect', props: {width: 10, height: 10}}],
      timeline: [
        {at: 0, target: 'a', tween: {x: {to: 100}}, dur: 2},
        {at: 1, target: 'a', tween: {opacity: {to: 0}}, dur: 1},
      ],
    });
    expect(ir.tracks).toHaveLength(2);
  });

  test('unknown target → CompileError', () => {
    expect(() =>
      compile({
        ...base,
        elements: [],
        timeline: [{at: 0, target: 'ghost', set: {x: 1}}],
      }),
    ).toThrow(/unknown target "ghost"/);
  });

  test('duplicate element ids (including nested) → CompileError', () => {
    expect(() =>
      compile({
        ...base,
        meta: {...base.meta, duration: 1},
        elements: [
          {id: 'a', type: 'rect', props: {}},
          {
            id: 'row',
            type: 'layout',
            props: {},
            children: [{id: 'a', type: 'circle', props: {}}],
          },
        ],
        timeline: [],
      }),
    ).toThrow(/duplicate element id "a"/);
  });

  test('layout children flatten with parentId and document order', () => {
    const {ir} = compile({
      ...base,
      meta: {...base.meta, duration: 1},
      elements: [
        {
          id: 'row',
          type: 'layout',
          props: {},
          children: [
            {id: 'a', type: 'rect', props: {}},
            {id: 'b', type: 'rect', props: {}},
          ],
        },
        {id: 'after', type: 'circle', props: {}},
      ],
      timeline: [],
    });
    expect(ir.elements.map(e => [e.id, e.parentId, e.order])).toEqual([
      ['row', null, 0],
      ['a', 'row', 1],
      ['b', 'row', 2],
      ['after', null, 3],
    ]);
  });

  test('select/edit on a non-code element → CompileError', () => {
    expect(() =>
      compile({
        ...base,
        elements: [{id: 'a', type: 'rect', props: {}}],
        timeline: [{at: 0, target: 'a', select: {lines: [0, 1]}}],
      }),
    ).toThrow(/only apply to code elements/);
  });

  test('code edits thread text: match resolves against the current text', () => {
    const {ir} = compile({
      ...base,
      elements: [
        {id: 'c', type: 'code', props: {code: 'let x = 1;\nlet y = 2;'}},
      ],
      timeline: [
        {at: 1, target: 'c', edit: {replace: [{match: '1'}, '10']}},
        {at: 2, target: 'c', edit: {replace: [{match: '10'}, '100']}, dur: 0.5},
        {at: 3, target: 'c', edit: {remove: {lines: [1, null]}}},
      ],
    });
    const track = ir.codeTracks[0];
    expect(track.ops.map(op => (op.kind === 'edit' ? op.after : null))).toEqual(
      ['let x = 10;\nlet y = 2;', 'let x = 100;\nlet y = 2;', 'let x = 100;\n'],
    );
    expect(track.ops[1]).toMatchObject({t0F: 60, t1F: 75});
  });

  test('selection ops carry before/after resolved ranges', () => {
    const {ir} = compile({
      ...base,
      elements: [{id: 'c', type: 'code', props: {code: 'a\nb\nc'}}],
      timeline: [{at: 1, target: 'c', select: {lines: [1, 1]}, dur: 0.4}],
    });
    const op = ir.codeTracks[0].ops[0];
    expect(op.kind).toBe('select');
    if (op.kind === 'select') {
      expect(op.before).toEqual(FULL_SELECTION);
      expect(op.after).toEqual([
        [
          [1, 0],
          [1, Infinity],
        ],
      ]);
    }
  });

  test('a match pattern that no longer exists is a CompileError with the item path', () => {
    expect(() =>
      compile({
        ...base,
        elements: [{id: 'c', type: 'code', props: {code: 'let x = 1;'}}],
        timeline: [
          {at: 0, target: 'c', edit: {replace: [{match: 'zzz'}, 'y']}},
        ],
      }),
    ).toThrow(/\/timeline\/0/);
  });

  test('blocks parse src#export and stretch the duration', () => {
    const {ir} = compile({
      ...base,
      elements: [],
      timeline: [{at: 1, block: {src: './fx.tsx#confetti', dur: 1.2}}],
    });
    expect(ir.blocks).toEqual([
      {t0F: 30, t1F: 66, src: './fx.tsx', exportName: 'confetti'},
    ]);
    expect(ir.durationF).toBe(66);
  });

  test('anchors resolve through narration and ambiguity warns', () => {
    const {ir, warnings} = compile({
      ...base,
      narration: {
        segments: [
          {
            id: 'intro',
            text: 'vai vai',
            start: 1,
            dur: 2,
            words: [
              {text: 'vai', start: 1},
              {text: 'vai', start: 2},
            ],
          },
        ],
      },
      elements: [{id: 'a', type: 'rect', props: {}}],
      timeline: [{at: 'intro.word:vai', target: 'a', set: {opacity: 1}}],
    });
    expect(ir.tracks[0].keys[0].tF).toBe(30);
    expect(warnings).toHaveLength(1);
    expect(ir.durationF).toBe(90); // narration end at 3s
  });
});
