import {describe, expect, test} from 'vitest';
import {CHARACTER_ART_VERSION, characterArtSchema} from '../character/art.js';
import {characterSchema} from '../character/schema.js';
import {CompileError, compileDocument} from '../compiler/compile.js';
import {VISEMES, VISEME_TRACK_VERSION} from '../lipsync/visemes.js';
import {validateDocument} from '../validate.js';

const character = characterSchema.parse({
  version: '0.1',
  id: 'teacher',
  art: {src: 'teacher.art.json'},
  slots: {
    torso: {element: 'torso', pivot: [100, 100]},
    ['arm-l']: {
      element: 'arm_x5F_l',
      parent: 'torso',
      pivot: [140, 90],
      rest: {depth: -1},
    },
  },
  poses: {
    wave: {['arm-l.rotation']: -30, ['arm-l.depth']: 10},
  },
});

const art = characterArtSchema.parse({
  version: CHARACTER_ART_VERSION,
  centre: [100, 100],
  slots: {
    torso: '<svg viewBox="80 80 40 40"><rect width="40" height="40"/></svg>',
    ['arm-l']:
      '<svg viewBox="120 80 40 20"><rect width="40" height="20"/></svg>',
  },
  pivots: {torso: [100, 100], ['arm-l']: [140, 90]},
});

const options = {characters: {teacher: {character, art}}};

const base = {
  version: '0.2',
  meta: {fps: 30, size: [640, 360], duration: 3},
  cast: {ana: {character: 'teacher', x: 10, y: 20, scale: 1.2}},
  elements: [],
  timeline: [
    {
      at: 1,
      target: 'ana',
      pose: 'wave',
      dur: 0.5,
      easing: 'easeOutCubic',
    },
  ],
};

function compile(raw: unknown, compileOptions = options) {
  const validation = validateDocument(raw);
  if (!validation.ok) throw new Error(JSON.stringify(validation.errors));
  return compileDocument(validation.doc, compileOptions).ir;
}

describe('document cast', () => {
  test('expands a cast member into a root with flat sibling SVG slots', () => {
    const ir = compile(base);
    const root = ir.elements.find(element => element.id === 'ana');
    const slots = ir.elements.filter(element => element.id.startsWith('ana.'));
    expect(root).toMatchObject({type: 'cast', parentId: null});
    expect(root?.props).toMatchObject({x: 10, y: 20, scale: 1.2});
    expect(slots.map(slot => slot.id)).toEqual(['ana.arm-l', 'ana.torso']);
    expect(slots.every(slot => slot.type === 'svg')).toBe(true);
    expect(slots.every(slot => slot.parentId === 'ana')).toBe(true);
    expect(slots.every(slot => !slot.id.startsWith('ana.arm-l.'))).toBe(true);
  });

  test('compiles pose params through ordinary tracks and holds depth', () => {
    const ir = compile(base);
    const rotation = ir.tracks.find(
      track => track.target === 'ana.arm-l' && track.prop === 'rotation',
    );
    const depth = ir.tracks.find(
      track => track.target === 'ana.arm-l' && track.prop === 'depth',
    );
    expect(rotation?.keys.at(-1)).toEqual({
      tF: 45,
      value: -30,
      easing: 'easeOutCubic',
    });
    expect(depth?.keys.at(-1)).toEqual({
      tF: 45,
      value: 10,
      easing: 'hold',
    });
    expect(ir.rigs.ana.slots.map(slot => slot.id)).toEqual(['torso', 'arm-l']);
  });

  test('reports an unknown pose with character and available pose names', () => {
    const doc = structuredClone(base) as any;
    doc.timeline[0].pose = 'dance';
    expect(() => compile(doc)).toThrowError(CompileError);
    expect(() => compile(doc)).toThrow(
      /teacher.*dance.*wave|dance.*teacher.*wave/,
    );
  });

  test('requires the caller to resolve character.json and its art sidecar', () => {
    expect(() => compile(base, {characters: {}})).toThrow(
      /teacher.*characters.*character.*art/i,
    );
  });

  test('cast roots expose only their documented transform surface', () => {
    const doc = {...base, timeline: [{at: 0, target: 'ana', set: {zIndex: 9}}]};
    expect(() => compile(doc)).toThrow(/zIndex.*not an animatable prop.*cast/);
  });

  test('expands a manual lipsync track into held mouth opacity switches', () => {
    const mouthSlots = Object.fromEntries(
      VISEMES.map(viseme => [
        `mouth-${viseme}`,
        {element: `mouth_${viseme}`, parent: 'torso', pivot: [100, 110]},
      ]),
    );
    const speakingCharacter = characterSchema.parse({
      ...character,
      slots: {...character.slots, ...mouthSlots},
      visemes: Object.fromEntries(
        VISEMES.map(viseme => [viseme, `mouth_${viseme}`]),
      ),
    });
    const speakingArt = characterArtSchema.parse({
      ...art,
      slots: {
        ...art.slots,
        ...Object.fromEntries(
          VISEMES.map(viseme => [
            `mouth-${viseme}`,
            `<svg><path id="mouth_${viseme}" d="M0 0L1 1"/></svg>`,
          ]),
        ),
      },
      pivots: {
        ...art.pivots,
        ...Object.fromEntries(
          VISEMES.map(viseme => [`mouth-${viseme}`, [100, 110]]),
        ),
      },
    });
    const track = {
      version: VISEME_TRACK_VERSION,
      engine: 'manual' as const,
      audio: 'voice.wav',
      language: 'pt-BR',
      cues: [
        {t: 0, viseme: 'X' as const},
        {t: 0.2, viseme: 'B' as const},
        {t: 0.4, viseme: 'F' as const},
      ],
    };
    const doc = {
      ...base,
      assets: {speech: {type: 'lipsync', src: 'speech.viseme.json'}},
      timeline: [{at: 1, target: 'ana', lipsync: 'speech'}],
    };
    const ir = compile(doc, {
      characters: {
        teacher: {character: speakingCharacter, art: speakingArt},
      },
      lipsync: {speech: track},
    });
    const b = ir.tracks.find(
      candidate =>
        candidate.target === 'ana.mouth-B' && candidate.prop === 'opacity',
    );
    const f = ir.tracks.find(
      candidate =>
        candidate.target === 'ana.mouth-F' && candidate.prop === 'opacity',
    );
    expect(b?.keys).toEqual([
      {tF: 30, value: 0, easing: 'hold'},
      {tF: 36, value: 1, easing: 'hold'},
      {tF: 42, value: 0, easing: 'hold'},
    ]);
    expect(f?.keys).toEqual([
      {tF: 30, value: 0, easing: 'hold'},
      {tF: 42, value: 1, easing: 'hold'},
    ]);
  });
});
