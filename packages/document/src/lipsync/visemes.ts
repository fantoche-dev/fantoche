/**
 * The viseme track: the one interchange format both lipsync spike arms emit,
 * so the blind comparison compares mouth *quality* and not plumbing.
 *
 * Node-safe by contract (see the header of `index.ts`): this module imports
 * `zod` and nothing else. In particular it must never reach
 * `@fantoche-dev/core`, which is what forces the binary search below to be
 * spelled out again instead of reusing the evaluator's `lastAtOrBefore`.
 */

import {z} from 'zod';

/**
 * Preston-Blair / Rhubarb mouth set: A–H plus X (rest).
 *
 * The order is part of the format — adapters, the mouth-sheet fixtures and
 * the comparison harness all index by it — so it is exported as one readonly
 * tuple rather than rebuilt per call site.
 */
export const VISEMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'] as const;

/** A single mouth shape drawn from {@link VISEMES}. */
export type Viseme = (typeof VISEMES)[number];

/**
 * A committed, cacheable lipsync artifact: which engine produced it, over
 * which audio, and the cue list that drives the mouth.
 *
 * ADR 0004 makes alignment a cacheable derived asset — deterministic given
 * audio + transcript + tool version — so a track is plain JSON produced at
 * dev time and committed. Rendering reads it; it never shells out.
 */
export const visemeTrackSchema = z
  .strictObject({
    version: z.literal('0.1'),
    /** Which arm produced this — recorded so tracks stay attributable. */
    engine: z.enum(['rhubarb', 'whisperx']),
    /** Path to the audio the track was derived from, relative to the track. */
    audio: z.string().min(1),
    /** BCP-47-ish language tag; the PT-BR caveat is the whole point of it. */
    language: z.string().min(2).optional(),
    /** Cue times are seconds from the start of `audio`, never frames. */
    cues: z
      .array(
        z.strictObject({
          t: z.number().finite().min(0),
          viseme: z.enum(VISEMES),
        }),
      )
      .min(1),
  })
  .refine(
    // Strictly increasing, not merely sorted: two cues sharing a `t` would
    // make the hold lookup ambiguous (the binary search may land on either),
    // so the same track could render two different mouths. Reject at the
    // door instead of picking a winner at read time.
    track =>
      track.cues.every((cue, i) => i === 0 || cue.t > track.cues[i - 1].t),
    {message: 'cues must be strictly increasing in t', path: ['cues']},
  );

/** A parsed, validated viseme track — the output of both spike arms. */
export type VisemeTrack = z.infer<typeof visemeTrackSchema>;

/**
 * The viseme in effect at time `t`, in seconds.
 *
 * Hold semantics, deliberately — visemes are a discrete alphabet, so there is
 * no shape "halfway between B and F"; the mouth sheet realises them by
 * switching `opacity` between stacked drawings, and interpolating would only
 * cross-fade two mouths into a third that no phoneme asked for. This is the
 * same rule as `TrackKey.easing === 'hold'` in the IR.
 *
 * Total by design: the schema guarantees at least one cue, but this is public
 * API and a caller may hold an unvalidated (or empty) list, so an empty track
 * — and any `t` before the first cue — rests rather than throwing.
 *
 * @param cues - Cues in strictly increasing `t`, as the schema guarantees.
 * @param t - Time in seconds from the start of the audio.
 * @returns The held viseme, or `'X'` (rest) when no cue has started yet.
 */
export function visemeAt(cues: VisemeTrack['cues'], t: number): Viseme {
  // Binary search for the last cue at or before `t`: O(log n) keeps the
  // lookup seekable, matching the evaluator's O(1)-in-document-length rule.
  let low = 0;
  let high = cues.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].t <= t) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found === -1 ? 'X' : cues[found].viseme;
}
