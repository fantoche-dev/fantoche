import {describe, expect, test} from 'vitest';
import {validateDocument} from '../validate.js';

const minimal = {
  version: '0.1',
  meta: {fps: 30, size: [640, 360]},
  elements: [],
  timeline: [],
};

const full = {
  version: '0.1',
  meta: {fps: 30, size: [1920, 1080], background: '#0d0d12', duration: 12},
  assets: {
    diagram: {type: 'image', src: './diagram.png'},
    voice: {type: 'audio', src: './narration.wav'},
  },
  narration: {
    audio: 'voice',
    segments: [
      {
        id: 'intro',
        text: 'Hoje vamos entender busca binária',
        start: 0.5,
        dur: 3.2,
        words: [
          {text: 'Hoje', start: 0.5},
          {text: 'binária', start: 3.1, dur: 0.6},
        ],
      },
    ],
  },
  elements: [
    {
      id: 'title',
      type: 'text',
      props: {text: 'Busca binária', fontSize: 64, fill: '#ffffff', y: -380},
    },
    {
      id: 'box',
      type: 'rect',
      props: {width: 200, height: 120, fill: '#e13238', radius: 8},
    },
    {
      id: 'dot',
      type: 'circle',
      props: {width: 40, height: 40, fill: 'lightseagreen'},
    },
    {
      id: 'arrow',
      type: 'line',
      props: {
        points: [
          [-100, 40],
          [0, -40],
          [100, 40],
        ],
        stroke: '#5c6470',
        lineWidth: 6,
        endArrow: true,
        end: 0,
      },
    },
    {id: 'pic', type: 'image', props: {src: 'diagram', width: 400}},
    {id: 'formula', type: 'latex', props: {tex: 'O(\\log n)', height: 80}},
    {
      id: 'snippet',
      type: 'code',
      props: {code: 'function search() {\n  return -1;\n}', fontSize: 32},
    },
    {
      id: 'row',
      type: 'layout',
      props: {direction: 'row', gap: 16, padding: 24},
      children: [
        {
          id: 'cell-a',
          type: 'rect',
          props: {width: 60, height: 60, fill: '#e6a700'},
        },
        {
          id: 'cell-b',
          type: 'rect',
          props: {width: 60, height: 60, fill: '#5c6470'},
        },
      ],
    },
  ],
  timeline: [
    {at: 0, target: 'title', set: {opacity: 0}},
    {at: 'intro.start', target: 'title', tween: {opacity: {to: 1}}, dur: 0.5},
    {
      at: 'intro.word:binária',
      target: 'box',
      tween: {x: {to: 300, from: -300}},
      dur: 1,
      easing: 'easeOutCubic',
    },
    {at: 'intro.end+0.3', target: 'arrow', tween: {end: {to: 1}}, dur: 0.8},
    {at: 2, target: 'snippet', select: {lines: [1, 2]}, dur: 0.4},
    {
      at: 3,
      target: 'snippet',
      edit: {to: 'function search() {\n  return 42;\n}'},
      dur: 0.6,
    },
    {
      at: 4,
      target: 'snippet',
      edit: {replace: [{match: '42', which: 'first'}, '43']},
    },
    {at: 'intro.end+1', block: {src: './flourish.tsx#confetti', dur: 1.2}},
  ],
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
