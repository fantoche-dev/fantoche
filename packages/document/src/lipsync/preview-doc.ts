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
  /** Frames per second; also the resolution the cue times collapse onto. */
  fps: number;
  /** Preview canvas size, in pixels. */
  size: readonly [number, number];
}

/**
 * Build the preview document for a viseme track.
 *
 * Pure: same inputs, deeply equal output. Nothing is read from the clock, and
 * the mouth record is walked in {@link VISEMES} order rather than key order,
 * so the caller's insertion order cannot reach the document.
 *
 * Throws when the mouth sheet is incomplete, the track has no cues, or `fps`
 * is not a positive integer — none of which can produce a document worth
 * looking at, and all of which are worth saying out loud rather than encoding
 * as a blank preview.
 *
 * @param options - Track, mouth sheet and canvas, see
 *   {@link VisemePreviewOptions}.
 * @returns A document that validates and compiles as it stands.
 */
export function buildVisemePreviewDocument(
  options: VisemePreviewOptions,
): FantocheDocument {
  const {track, mouths, fps, size} = options;
  const cues = track.cues;

  if (cues.length === 0) {
    throw new Error('a viseme preview needs at least one cue');
  }
  if (!Number.isInteger(fps) || fps < 1) {
    throw new Error(`fps must be a positive integer (got ${fps})`);
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

  // Frame rounding matches the compiler's `toFrame` exactly: a cue lands on
  // the nearest frame, so two cues less than half a frame apart claim the
  // same one. Collapsing them here — last one wins, because it is the mouth
  // still in effect on the *following* frame — keeps the emitted document
  // unambiguous instead of leaning on the compiler's same-frame key tiebreak.
  const switches: {t: number; viseme: Viseme}[] = [];
  for (const cue of cues) {
    const previous = switches[switches.length - 1];
    // Copied, never aliased: a caller may keep mutating its parsed track.
    const next = {t: cue.t, viseme: cue.viseme};
    if (
      previous !== undefined &&
      toFrame(previous.t, fps) === toFrame(cue.t, fps)
    ) {
      switches[switches.length - 1] = next;
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
  };
}
