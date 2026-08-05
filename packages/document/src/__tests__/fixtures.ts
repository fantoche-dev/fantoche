/** Shared full-feature document fixture — exercises every element type and
 * timeline item kind. Kept in one place so schema, migrate and evaluator
 * tests all pin the same contract. */
export const fullDocument = {
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
    {
      id: 'wave',
      type: 'svg',
      props: {svg: '<svg><path d="M0 0L10 10"/></svg>'},
    },
    {id: 'poly', type: 'polygon', props: {sides: 6, width: 80, height: 80}},
    {id: 'curve', type: 'path', props: {data: 'M 0 0 C 10 10 20 10 30 0'}},
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
