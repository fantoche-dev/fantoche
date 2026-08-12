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
    const {doc} = buildVisemePreviewDocument({
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
    const {doc} = buildVisemePreviewDocument({
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
      }).doc,
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
      }).doc,
    );
    expect(visibleAt(ir, 30)).toEqual(['B']);
    expect(visibleAt(ir, ir.durationF - 1)).toEqual(['B']);
  });

  test('cues that round onto one frame collapse to the last of them', () => {
    // 0.50 and 0.51 both round to frame 15 at 30fps. That frame can only draw
    // one mouth, and the survivor must be the one still in effect at frame 16.
    const {doc} = buildVisemePreviewDocument({
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

  test('collapsing costs nothing on screen and drops a dead track', () => {
    // What the collapse is, and is not, for. Uncollapsed, the compiler's
    // same-frame overwrite draws exactly the same preview — so this is not a
    // bug being papered over. It buys a document a reader can predict without
    // knowing that overwrite rule, and an IR without a track that does
    // nothing.
    const cues: VisemeTrack['cues'] = [
      {t: 0, viseme: 'X'},
      {t: 0.5, viseme: 'B'},
      {t: 0.51, viseme: 'C'},
      {t: 0.9, viseme: 'D'},
    ];
    const {doc} = buildVisemePreviewDocument({
      track: track(cues),
      mouths,
      fps: 30,
      size: [480, 320],
    });

    // The same document with every cue's switch left in, superseded or not.
    const timeline: FantocheDocument['timeline'] = [];
    let held: Viseme = 'X';
    for (const cue of cues) {
      timeline.push({
        at: cue.t,
        target: `mouth-${cue.viseme}`,
        set: {opacity: 1},
      });
      if (cue.viseme !== held) {
        timeline.push({at: cue.t, target: `mouth-${held}`, set: {opacity: 0}});
      }
      held = cue.viseme;
    }
    const collapsed = compile(doc);
    const uncollapsed = compile({...doc, timeline});

    expect(collapsed.durationF).toBe(uncollapsed.durationF);
    for (let frame = 0; frame < collapsed.durationF; frame++) {
      expect(visibleAt(collapsed, frame)).toEqual(
        visibleAt(uncollapsed, frame),
      );
    }
    // Same pixels, not the same IR: B is raised and lowered on frame 15, so
    // uncollapsed it survives as a track whose only key restates the opacity
    // it started at.
    expect(uncollapsed.tracks.map(t => t.target)).toContain('mouth-B');
    expect(collapsed.tracks.map(t => t.target)).not.toContain('mouth-B');
  });

  test('counts the cues the frame rate collapsed away', () => {
    const cues: VisemeTrack['cues'] = [
      {t: 0, viseme: 'X'},
      {t: 0.5, viseme: 'B'},
      {t: 0.51, viseme: 'C'},
      {t: 0.515, viseme: 'D'},
      {t: 0.9, viseme: 'F'},
    ];
    // 0.5, 0.51 and 0.515 all round onto frame 15 at 30fps: two of those three
    // cues never reach the screen, and the count is the only place that says
    // so — the document itself looks perfectly healthy without them.
    const lossy = buildVisemePreviewDocument({
      track: track(cues),
      mouths,
      fps: 30,
      size: [480, 320],
    });
    expect(lossy.collapsed).toBe(2);
    expect(lossy.doc.timeline).toEqual([
      {at: 0, target: 'mouth-X', set: {opacity: 1}},
      {at: 0.515, target: 'mouth-D', set: {opacity: 1}},
      {at: 0.515, target: 'mouth-X', set: {opacity: 0}},
      {at: 0.9, target: 'mouth-F', set: {opacity: 1}},
      {at: 0.9, target: 'mouth-D', set: {opacity: 0}},
    ]);

    // The loss is the frame rate's, not the track's: at 120fps the same cues
    // land on frames 60, 61 and 62 and every one of them is drawn.
    const dense = buildVisemePreviewDocument({
      track: track(cues),
      mouths,
      fps: 120,
      size: [480, 320],
    });
    expect(dense.collapsed).toBe(0);
    expect(dense.doc.timeline).toHaveLength(cues.length * 2 - 1);

    // A track no frame rate has to squeeze reports zero rather than nothing.
    expect(
      buildVisemePreviewDocument({
        track: track([
          {t: 0, viseme: 'X'},
          {t: 0.5, viseme: 'B'},
        ]),
        mouths,
        fps: 30,
        size: [480, 320],
      }).collapsed,
    ).toBe(0);
  });

  test('rests before a track that does not start at zero', () => {
    const {doc} = buildVisemePreviewDocument({
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
    const {doc} = buildVisemePreviewDocument({
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

  test('refuses inputs the format cannot carry', () => {
    expect(() =>
      buildVisemePreviewDocument({
        track: track([]),
        mouths,
        fps: 30,
        size: [480, 320],
      }),
    ).toThrow(/cue/);
    // 121 and up are as unusable as 0: `meta.fps` tops out at 120, so a
    // document built at 240 is one no renderer will ever be handed.
    for (const fps of [0, -30, 1.5, NaN, Infinity, 121, 240]) {
      expect(() =>
        buildVisemePreviewDocument({
          track: track([{t: 0, viseme: 'X'}]),
          mouths,
          fps,
          size: [480, 320],
        }),
      ).toThrow(/fps/);
    }
    // `meta.size` is two positive *integers*: a half pixel is as invalid as a
    // canvas with no area.
    const badSizes: (readonly [number, number])[] = [
      [480.5, 320],
      [480, 319.5],
      [480, 0],
      [0, 320],
      [-4, 8],
      [NaN, 320],
      [480.5, 0],
    ];
    for (const size of badSizes) {
      expect(() =>
        buildVisemePreviewDocument({
          track: track([{t: 0, viseme: 'X'}]),
          mouths,
          fps: 30,
          size,
        }),
      ).toThrow(/size/);
    }
  });

  test('keeps its promise: every document it returns validates', () => {
    // The guards exist to make the return type honest, so the bounds are
    // checked from the outside — at the edges, where an off-by-one in a guard
    // would show up as a document the schema rejects.
    const corners = [
      [1, [1, 1]],
      [24, [480, 320]],
      [120, [1920, 1080]],
    ] as const;
    for (const [fps, size] of corners) {
      const {doc} = buildVisemePreviewDocument({
        track: track([
          {t: 0, viseme: 'X'},
          {t: 0.5, viseme: 'B'},
        ]),
        mouths,
        fps,
        size,
      });
      const validation = validateDocument(doc);
      expect(validation.ok).toBe(true);
      expect(doc.meta).toMatchObject({fps, size: [size[0], size[1]]});
    }
  });
});
