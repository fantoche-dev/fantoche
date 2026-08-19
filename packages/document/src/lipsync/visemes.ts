/**
 * The viseme track: the one interchange format both lipsync spike arms emit,
 * so the blind comparison compares mouth *quality* and not plumbing.
 *
 * Node-safe by contract (see the header of `index.ts`): this module imports
 * `zod` and the import-free `../search.js`, and nothing else. In particular
 * it must never reach `@fantoche-dev/core`, which is why the hold lookup
 * borrows the search primitive rather than the evaluator that also uses it.
 */

import {z} from 'zod';
import {lastAtOrBefore} from '../search.js';

/**
 * Version of the *track* format.
 *
 * Its own constant, not `DOCUMENT_FORMAT_VERSION`: the two read '0.1' today
 * but version independently. A track is a cacheable derived asset, not part
 * of a document, so bumping the document format must not imply a track bump
 * (nor the reverse) — and reaching for the wrong one here would produce a
 * track that validates against nothing.
 */
export const VISEME_TRACK_VERSION = '0.1';

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
    version: z.literal(VISEME_TRACK_VERSION),
    /** Which arm produced this — recorded so tracks stay attributable. */
    engine: z.enum(['rhubarb', 'whisperx', 'manual']),
    /**
     * Where the audio the track was derived from lives. The consumer
     * resolves it relative to the track file; an absolute path is accepted
     * and used as-is, which is worth having while this is a locally run
     * spike tool pointed at scratch recordings.
     */
    audio: z.string().min(1),
    /**
     * BCP-47 subset: a lowercase language, optionally plus an uppercase
     * region. Narrower than BCP-47 proper on purpose — the blind comparison
     * groups arms by this exact string, and 'pt', 'pt_BR' and 'PT-br' must
     * not read as three languages. The PT-BR caveat is the whole point of
     * the field.
     */
    language: z
      .string()
      .regex(
        /^[a-z]{2}(-[A-Z]{2})?$/,
        'language must be a lowercase tag with an optional uppercase region, e.g. "pt" or "pt-BR"',
      )
      .optional(),
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
  // Strictly increasing, not merely sorted: two cues sharing a `t` would make
  // the hold lookup ambiguous (the binary search may land on either), so the
  // same track could render two different mouths. Reject at the door instead
  // of picking a winner at read time.
  //
  // `superRefine` rather than `refine` so the issue path carries the offending
  // index: an aligner emits hundreds of cues per clip and nobody should bisect
  // that by hand.
  //
  // Caveat for whoever publishes a JSON Schema for this format: `z.toJSONSchema`
  // silently drops refinements, so an emitted artifact would be *weaker* than
  // this runtime schema unless the rule is re-added by hand, the way
  // `json-schema.ts` re-adds the document format's exactly-one-of rules.
  .superRefine((track, ctx) => {
    for (let i = 1; i < track.cues.length; i++) {
      if (track.cues[i].t <= track.cues[i - 1].t) {
        ctx.addIssue({
          code: 'custom',
          message: 'cues must be strictly increasing in t',
          path: ['cues', i, 't'],
        });
      }
    }
  });

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
export function visemeAt(
  cues: readonly VisemeTrack['cues'][number][],
  t: number,
): Viseme {
  const index = lastAtOrBefore(cues, t, cue => cue.t);
  return index === -1 ? 'X' : cues[index].viseme;
}
