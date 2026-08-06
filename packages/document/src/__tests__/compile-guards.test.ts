import {describe, expect, test} from 'vitest';
import {CompileError, compileDocument} from '../compiler/compile.js';
import {validateDocument} from '../validate.js';

function compile(raw: unknown) {
  const result = validateDocument(raw);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.errors));
  }
  return compileDocument(result.doc);
}

const base = {version: '0.1', meta: {fps: 30, size: [320, 320]}};

describe('compile guards (batch E+F review I8)', () => {
  test('non-animatable props are CompileErrors with the item path', () => {
    for (const prop of ['dispose', 'remove', 'reparent', 'opactiy']) {
      const doc = {
        ...base,
        elements: [{id: 'a', type: 'rect', props: {}}],
        timeline: [{at: 0, target: 'a', set: {[prop]: 1}}],
      };
      expect(() => compile(doc), prop).toThrow(CompileError);
      expect(() => compile(doc), prop).toThrow(/not an animatable prop/);
      expect(() => compile(doc), prop).toThrow(/\/timeline\/0/);
    }
  });

  test('animatable props differ per element type', () => {
    const lineDoc = {
      ...base,
      elements: [
        {
          id: 'l',
          type: 'line',
          props: {
            points: [
              [0, 0],
              [1, 1],
            ],
          },
        },
      ],
      timeline: [{at: 0, target: 'l', set: {end: 1}}],
    };
    expect(() => compile(lineDoc)).not.toThrow();
    const rectDoc = {
      ...base,
      elements: [{id: 'r', type: 'rect', props: {}}],
      timeline: [{at: 0, target: 'r', set: {end: 1}}],
    };
    expect(() => compile(rectDoc)).toThrow(/not an animatable prop/);
  });

  test('svg asset-file src is a CompileError, not a runtime crash', () => {
    const doc = {
      ...base,
      meta: {...base.meta, duration: 1},
      elements: [{id: 's', type: 'svg', props: {src: 'wave'}}],
      timeline: [],
    };
    expect(() => compile(doc)).toThrow(CompileError);
    expect(() => compile(doc)).toThrow(/inline markup/);
  });

  test('overlapping block windows are a CompileError', () => {
    const doc = {
      ...base,
      elements: [],
      timeline: [
        {at: 0, block: {src: './a.tsx#x', dur: 2}},
        {at: 1, block: {src: './b.tsx#y', dur: 2}},
      ],
    };
    expect(() => compile(doc)).toThrow(CompileError);
    expect(() => compile(doc)).toThrow(/block windows overlap/);
  });
});
