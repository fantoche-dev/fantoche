import {describe, expect, test} from 'vitest';
import {validateDocument} from '../validate.js';
import {fullDocument as full} from './fixtures.js';

const minimal = {
  version: '0.1',
  meta: {fps: 30, size: [640, 360]},
  elements: [],
  timeline: [],
};

describe('validateDocument', () => {
  test('accepts a minimal document', () => {
    const result = validateDocument(minimal);
    expect(result.ok).toBe(true);
  });

  test('accepts a full-feature document', () => {
    const result = validateDocument(full);
    if (!result.ok) console.error(result.errors);
    expect(result.ok).toBe(true);
  });

  test('rejects unknown element type with a path', () => {
    const doc = {...minimal, elements: [{id: 'x', type: 'blob', props: {}}]};
    const result = validateDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.path.startsWith('/elements/0'))).toBe(
        true,
      );
    }
  });

  test('rejects a bad anchor string with a path into the timeline', () => {
    const doc = {
      ...minimal,
      timeline: [{at: 'intro.wrd:x', target: 't', set: {opacity: 1}}],
    };
    const result = validateDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.path.startsWith('/timeline/0/at'))).toBe(
        true,
      );
    }
  });

  test('rejects unknown keys (strict mode) and wrong versions', () => {
    expect(validateDocument({...minimal, extra: 1}).ok).toBe(false);
    expect(validateDocument({...minimal, version: '9.9'}).ok).toBe(false);
    expect(
      validateDocument({...minimal, meta: {fps: 0, size: [640, 360]}}).ok,
    ).toBe(false);
  });

  test('rejects unknown easing names', () => {
    const doc = {
      ...minimal,
      elements: [{id: 'a', type: 'rect', props: {}}],
      timeline: [
        {at: 0, target: 'a', tween: {x: {to: 1}}, dur: 1, easing: 'zoom'},
      ],
    };
    expect(validateDocument(doc).ok).toBe(false);
  });
});
