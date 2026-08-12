import {describe, expect, test} from 'vitest';
import {compileDocument} from '../compiler/compile.js';
import {evaluateFrame} from '../evaluator.js';
import type {TimelineIR} from '../ir.js';
import {buildVisemePreviewDocument} from '../lipsync/preview-doc.js';
import type {Viseme, VisemeTrack} from '../lipsync/visemes.js';
import {VISEME_TRACK_VERSION, VISEMES} from '../lipsync/visemes.js';
import type {FantocheDocument} from '../schema.js';
import {validateDocument} from '../validate.js';

/** Distinct markup per viseme, so a swapped element shows up as a swap. */
const mouths = Object.fromEntries(
  VISEMES.map(viseme => [
    viseme,
    `<svg viewBox="0 0 100 60"><text>${viseme}</text></svg>`,
  ]),
) as Record<Viseme, string>;

/** A track around a cue list; the surrounding fields never vary here. */
function track(cues: VisemeTrack['cues']): VisemeTrack {
  return {
    version: VISEME_TRACK_VERSION,
    engine: 'rhubarb',
    audio: 'v.wav',
    cues,
  };
}

/** Validate + compile, the way the render path does. */
function compile(doc: FantocheDocument): TimelineIR {
  const validation = validateDocument(doc);
  if (!validation.ok) {
    throw new Error(JSON.stringify(validation.errors));
  }
  return compileDocument(validation.doc).ir;
}

/** Which mouths the evaluated frame actually draws (opacity 1). */
function visibleAt(ir: TimelineIR, frame: number): Viseme[] {
  const state = evaluateFrame(ir, frame);
  return VISEMES.filter(viseme => {
    const id = `mouth-${viseme}`;
    const tracked = state.props.get(id)?.get('opacity');
    const element = ir.elements.find(entry => entry.id === id);
    return (tracked ?? element?.props.opacity) === 1;
  });
}

describe('viseme preview document', () => {
  test('emits one svg element per viseme and hold-switches opacity', () => {
    const doc = buildVisemePreviewDocument({
      track: track([
        {t: 0, viseme: 'X'},
        {t: 0.5, viseme: 'B'},
      ]),
      mouths,
      fps: 30,
      size: [480, 320],
    });

    const validation = validateDocument(doc);
    expect(validation.ok).toBe(true);
    expect(doc.elements).toHaveLength(9);
    expect(doc.elements.map(element => element.id)).toEqual(
      VISEMES.map(viseme => `mouth-${viseme}`),
    );
    // Inline markup only: props.src on an svg element is a compile error.
    expect(doc.elements.map(element => element.props)).toEqual(
      VISEMES.map(viseme => ({
        svg: mouths[viseme],
        opacity: viseme === 'X' ? 1 : 0,
      })),
    );

    // Every cue raises one mouth and lowers the previous one; the first cue
    // has nothing to lower.
    expect(doc.timeline).toEqual([
      {at: 0, target: 'mouth-X', set: {opacity: 1}},
      {at: 0.5, target: 'mouth-B', set: {opacity: 1}},
      {at: 0.5, target: 'mouth-X', set: {opacity: 0}},
    ]);

    const ir = compile(doc);
    expect(ir.tracks.length).toBeGreaterThan(0);
    expect(ir.tracks.every(t => t.keys.every(k => k.easing === 'hold'))).toBe(
      true,
    );
  });

  test('meta.duration holds the last cue for half a second', () => {
    const doc = buildVisemePreviewDocument({
      track: track([
        {t: 0, viseme: 'X'},
        {t: 1.25, viseme: 'B'},
      ]),
      mouths,
      fps: 30,
      size: [480, 320],
    });
    expect(doc.meta).toEqual({fps: 30, size: [480, 320], duration: 1.75});
    // The tail must survive compilation, not just sit in meta.
    expect(compile(doc).durationF).toBe(Math.ceil(1.75 * 30));
  });

  test('draws exactly one mouth on every frame it owns', () => {
    const cues: VisemeTrack['cues'] = [
      {t: 0, viseme: 'X'},
      {t: 0.2, viseme: 'B'},
      {t: 0.44, viseme: 'F'},
      {t: 0.9, viseme: 'C'},
      {t: 1.3, viseme: 'X'},
    ];
    const ir = compile(
      buildVisemePreviewDocument({
        track: track(cues),
        mouths,
        fps: 24,
        size: [480, 320],
      }),
    );
    for (let frame = 0; frame < ir.durationF; frame++) {
      expect(visibleAt(ir, frame)).toHaveLength(1);
    }
    // …and it is the mouth the cue asked for, at the cue's own frame.
    for (const cue of cues) {
      expect(visibleAt(ir, Math.round(cue.t * 24))).toEqual([cue.viseme]);
    }
    // The mouth is held between cues, never crossfaded.
    expect(visibleAt(ir, Math.round(0.2 * 24) + 1)).toEqual(['B']);
    expect(visibleAt(ir, ir.durationF - 1)).toEqual(['X']);
  });

  test('a repeated viseme keeps its mouth up instead of hiding it', () => {
    // The trap: cue 3 raises mouth-B and would lower mouth-B in the same
    // breath — two sets on one (target, prop) at one frame, last one wins.
    const ir = compile(
      buildVisemePreviewDocument({
        track: track([
          {t: 0, viseme: 'X'},
          {t: 0.5, viseme: 'B'},
          {t: 1, viseme: 'B'},
        ]),
        mouths,
        fps: 30,
        size: [480, 320],
      }),
    );
    expect(visibleAt(ir, 30)).toEqual(['B']);
    expect(visibleAt(ir, ir.durationF - 1)).toEqual(['B']);
  });

  test('cues that round onto one frame collapse to the last of them', () => {
    // 0.50 and 0.51 both round to frame 15 at 30fps. That frame can only draw
    // one mouth, and the survivor must be the one still in effect at frame 16.
    const doc = buildVisemePreviewDocument({
      track: track([
        {t: 0, viseme: 'X'},
        {t: 0.5, viseme: 'B'},
        {t: 0.51, viseme: 'C'},
        {t: 0.9, viseme: 'D'},
      ]),
      mouths,
      fps: 30,
      size: [480, 320],
    });
    // B never gets a frame of its own, so it never gets a timeline item.
    expect(doc.timeline).toEqual([
      {at: 0, target: 'mouth-X', set: {opacity: 1}},
      {at: 0.51, target: 'mouth-C', set: {opacity: 1}},
      {at: 0.51, target: 'mouth-X', set: {opacity: 0}},
      {at: 0.9, target: 'mouth-D', set: {opacity: 1}},
      {at: 0.9, target: 'mouth-C', set: {opacity: 0}},
    ]);
    const ir = compile(doc);
    expect(visibleAt(ir, 15)).toEqual(['C']);
    expect(visibleAt(ir, 16)).toEqual(['C']);
    for (let frame = 0; frame < ir.durationF; frame++) {
      expect(visibleAt(ir, frame)).toHaveLength(1);
    }
  });

  test('rests before a track that does not start at zero', () => {
    const doc = buildVisemePreviewDocument({
      track: track([{t: 0.4, viseme: 'B'}]),
      mouths,
      fps: 30,
      size: [480, 320],
    });
    // visemeAt(cues, 0) is 'X': the mouth rests until the first cue lands.
    expect(doc.elements.map(element => element.props.opacity)).toEqual(
      VISEMES.map(viseme => (viseme === 'X' ? 1 : 0)),
    );
    const ir = compile(doc);
    expect(visibleAt(ir, 0)).toEqual(['X']);
    expect(visibleAt(ir, 11)).toEqual(['X']);
    expect(visibleAt(ir, 12)).toEqual(['B']);
  });

  test('is a pure function of its inputs', () => {
    const args = {
      track: track([
        {t: 0, viseme: 'X'},
        {t: 0.3, viseme: 'G'},
      ]),
      mouths,
      fps: 30,
      size: [480, 320] as [number, number],
    };
    expect(buildVisemePreviewDocument(args)).toEqual(
      buildVisemePreviewDocument(args),
    );
    // Insertion order of the mouth record must not reach the output — a
    // Object.keys() walk anywhere in here would leak it.
    const shuffled = Object.fromEntries(
      [...VISEMES].reverse().map(viseme => [viseme, mouths[viseme]]),
    ) as Record<Viseme, string>;
    expect(buildVisemePreviewDocument({...args, mouths: shuffled})).toEqual(
      buildVisemePreviewDocument(args),
    );
  });

  test('does not alias its inputs', () => {
    const cues: VisemeTrack['cues'] = [{t: 0, viseme: 'X'}];
    const doc = buildVisemePreviewDocument({
      track: track(cues),
      mouths,
      fps: 30,
      size: [480, 320],
    });
    cues[0].t = 99;
    expect(doc.timeline[0]).toEqual({
      at: 0,
      target: 'mouth-X',
      set: {opacity: 1},
    });
  });

  test('refuses an incomplete mouth sheet', () => {
    const {G: _g, ...incomplete} = mouths;
    expect(() =>
      buildVisemePreviewDocument({
        track: track([{t: 0, viseme: 'X'}]),
        mouths: incomplete as Record<Viseme, string>,
        fps: 30,
        size: [480, 320],
      }),
    ).toThrow(/G/);
    // Blank markup is as unusable as a missing file — an `svg` element needs
    // props.svg to be non-empty or the document will not even validate.
    const blank: Viseme = 'H';
    expect(() =>
      buildVisemePreviewDocument({
        track: track([{t: 0, viseme: 'X'}]),
        mouths: {...mouths, [blank]: '   '},
        fps: 30,
        size: [480, 320],
      }),
    ).toThrow(/H/);
  });

  test('refuses inputs the frame math cannot use', () => {
    expect(() =>
      buildVisemePreviewDocument({
        track: track([]),
        mouths,
        fps: 30,
        size: [480, 320],
      }),
    ).toThrow(/cue/);
    for (const fps of [0, -30, 1.5, NaN]) {
      expect(() =>
        buildVisemePreviewDocument({
          track: track([{t: 0, viseme: 'X'}]),
          mouths,
          fps,
          size: [480, 320],
        }),
      ).toThrow(/fps/);
    }
  });
});
