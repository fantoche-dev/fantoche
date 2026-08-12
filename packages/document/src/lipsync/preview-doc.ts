/**
 * A viseme track rendered as a plain document: nine stacked mouths whose
 * `opacity` is hold-switched by `set` items.
 *
 * What matters here is what the module does *not* need. The mouth is an
 * ordinary `svg` element, `opacity` an ordinary animatable transform prop and
 * the switch an ordinary `set` — so the lipsync spike renders through the
 * pipeline the document format already shipped, with no new element type, no
 * new prop and no runtime change. If this file ever needs a format change to
 * do its job, the spike stops being free and the plan that ordered it first
 * is wrong; that is the claim these functions exist to keep honest.
 *
 * Node-safe by contract (see the header of `index.ts`): types from the schema,
 * values from `./visemes.js`, and nothing that reaches `@fantoche-dev/core`.
 */

import {toFrame} from '../frames.js';
import type {FantocheDocument, TimelineItem} from '../schema.js';
import {DOCUMENT_FORMAT_VERSION} from '../version.js';
import type {Viseme, VisemeTrack} from './visemes.js';
import {VISEMES, visemeAt} from './visemes.js';

/**
 * Seconds the final mouth is held after the last cue.
 *
 * A cue list ends at the instant its last mouth *starts*, so a document that
 * ended there would render that mouth for a single frame — or, when the last
 * cue rounds onto the exclusive duration bound, not at all.
 */
const TAIL_SECONDS = 0.5;

/**
 * Highest frame rate a document may declare.
 *
 * Restated from `meta.fps` in the schema rather than derived from it: this
 * module is the one that has to reject 240 *before* building, and a guard
 * that reads a zod internal to learn its own bound would be the more fragile
 * of the two couplings. `refuses inputs the format cannot carry` in
 * `preview-doc.test.ts` fails if the schema ever moves.
 */
const MAX_FPS = 120;

/** Element id of the layer drawing one viseme. */
function idFor(viseme: Viseme): string {
  return `mouth-${viseme}`;
}

/** Inputs of {@link buildVisemePreviewDocument}. */
export interface VisemePreviewOptions {
  /** The cue list to draw; only `cues` is read. */
  track: VisemeTrack;
  /**
   * Inline SVG markup per viseme — all nine required, since any of them may
   * be the mouth a cue asks for. Markup rather than file paths because
   * `props.src` on an `svg` element is a deliberate compile error in v0: the
   * runtime only draws inline markup.
   */
  mouths: Readonly<Record<Viseme, string>>;
  /**
   * Frames per second; also the resolution the cue times collapse onto.
   *
   * Bounded by the document format itself — a whole number from 1 to 120 —
   * because a document carrying anything else does not validate.
   */
  fps: number;
  /** Preview canvas size in whole pixels, both positive. */
  size: readonly [number, number];
}

/** Output of {@link buildVisemePreviewDocument}. */
export interface VisemePreviewResult {
  /** The preview document. */
  doc: FantocheDocument;
  /**
   * How many cues the frame rate swallowed: cues that rounded onto a frame an
   * earlier cue had already claimed and so never reach the screen.
   *
   * Reported rather than left implicit because it is measurement error, not a
   * detail. At 30fps two cues less than ~17ms apart become one, and the cues
   * an aligner emits that short are disproportionately the bilabial closures
   * a lipsync comparison is scored on — so a preview that drops a dozen of
   * them can make the *frame rate* look like an engine's weakness. A caller
   * comparing engines should either report this number alongside the score or
   * raise `fps` until it is zero.
   */
  collapsed: number;
}

/**
 * Build the preview document for a viseme track.
 *
 * Pure: same inputs, deeply equal output. Nothing is read from the clock, and
 * the mouth record is walked in {@link VISEMES} order rather than key order,
 * so the caller's insertion order cannot reach the document.
 *
 * Throws when the mouth sheet is incomplete, the track has no cues, or `fps`
 * or `size` are outside what the document format accepts — none of which can
 * produce a document worth looking at, and all of which are worth saying out
 * loud rather than encoding as a blank preview or an unrenderable file.
 *
 * @param options - Track, mouth sheet and canvas, see
 *   {@link VisemePreviewOptions}.
 * @returns A document that validates and compiles as it stands, plus the
 *   number of cues the frame rate collapsed away — see
 *   {@link VisemePreviewResult}.
 */
export function buildVisemePreviewDocument(
  options: VisemePreviewOptions,
): VisemePreviewResult {
  const {track, mouths, fps, size} = options;
  const cues = track.cues;

  if (cues.length === 0) {
    throw new Error('a viseme preview needs at least one cue');
  }
  // The bounds are the document format's own (`meta.fps`, `meta.size`), not a
  // house rule: checking them here is what lets this function promise a
  // document that validates. Reported against the option name, since the
  // caller passing 240 is holding a `VisemePreviewOptions`, not a document.
  if (!Number.isInteger(fps) || fps < 1 || fps > MAX_FPS) {
    throw new Error(
      `options.fps must be a whole number of frames from 1 to ${MAX_FPS} ` +
        `(got ${fps}) — a document may not carry any other frame rate`,
    );
  }
  if (
    !Number.isInteger(size[0]) ||
    !Number.isInteger(size[1]) ||
    size[0] < 1 ||
    size[1] < 1
  ) {
    throw new Error(
      `options.size must be two positive whole pixels ` +
        `(got ${size[0]}x${size[1]}) — a document may not carry a ` +
        `fractional or empty canvas`,
    );
  }
  // Checked up front and reported together: the mouth sheet is nine files on
  // disk, and finding out one is missing a cue at a time would mean nine runs.
  const missing = VISEMES.filter(
    viseme => (mouths[viseme] ?? '').trim() === '',
  );
  if (missing.length > 0) {
    throw new Error(
      `mouth sheet has no markup for ${missing.join(', ')} — all of ` +
        `${VISEMES.join('')} are needed, any cue may ask for any of them`,
    );
  }

  // A cue lands on the nearest frame (`toFrame`, shared with the compiler), so
  // two cues less than half a frame apart claim the same one — and a frame can
  // only draw one mouth.
  //
  // Collapsing them is not a correction. Emitted uncollapsed, `pushKey`'s
  // same-frame overwrite picks the same winner and the preview draws exactly
  // the same pixels. What it costs is a document that asks its reader to know
  // that overwrite rule to predict what it draws — and the document, not the
  // IR, is the artifact a human reads, diffs and files a bug against — plus
  // one dead track per superseded cue: a mouth raised and lowered on a single
  // frame survives compilation as a one-key track setting an opacity it
  // already had. The tiebreak is also the compiler's to tighten into a
  // `CompileError` later, as it already does for overlapping animations, and
  // nothing here should be relying on it. `collapsing costs nothing on screen`
  // in `preview-doc.test.ts` holds all of that to the evidence.
  //
  // Last one wins, and that direction is forced rather than chosen: first-wins
  // would raise the mouth of a cue that is already superseded on the only
  // frame it owns, and never raise the one still in effect on the frame after.
  //
  // The count is returned: a collapsed cue is a cue the viewer never sees, and
  // that is a fact about the measurement, not an implementation detail.
  const switches: {t: number; viseme: Viseme}[] = [];
  let collapsed = 0;
  for (const cue of cues) {
    const previous = switches[switches.length - 1];
    // Copied, never aliased: a caller may keep mutating its parsed track.
    const next = {t: cue.t, viseme: cue.viseme};
    if (
      previous !== undefined &&
      toFrame(previous.t, fps) === toFrame(cue.t, fps)
    ) {
      switches[switches.length - 1] = next;
      collapsed++;
    } else {
      switches.push(next);
    }
  }

  // The mouth on screen before any cue has fired. `visemeAt` answers this for
  // free and answers it the way the track itself would: the first cue's mouth
  // when the track starts at 0 (every aligner emits one), rest otherwise.
  const opening = visemeAt(cues, 0);

  const timeline: TimelineItem[] = [];
  let held: Viseme = opening;
  for (const change of switches) {
    timeline.push({
      at: change.t,
      target: idFor(change.viseme),
      set: {opacity: 1},
    });
    // Only when it differs: a cue repeating the held viseme would otherwise
    // raise and lower the same (target, prop) at the same frame, and the
    // lower — arriving second — would win and blank the mouth entirely.
    if (change.viseme !== held) {
      timeline.push({at: change.t, target: idFor(held), set: {opacity: 0}});
    }
    held = change.viseme;
  }

  return {
    doc: {
      version: DOCUMENT_FORMAT_VERSION,
      meta: {
        fps,
        size: [size[0], size[1]],
        duration: cues[cues.length - 1].t + TAIL_SECONDS,
      },
      elements: VISEMES.map(viseme => ({
        id: idFor(viseme),
        type: 'svg' as const,
        props: {svg: mouths[viseme], opacity: viseme === opening ? 1 : 0},
      })),
      timeline,
    },
    collapsed,
  };
}
