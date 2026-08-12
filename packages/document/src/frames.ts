/**
 * Seconds → frames, shared by everything that has to agree on the answer.
 *
 * This module imports nothing, deliberately, for the same reason `search.ts`
 * does not. The compiler owns the rounding rule, but the viseme preview
 * builder has to round *identically*: it collapses two cues that land on one
 * frame, and that collapse is only correct while its arithmetic matches the
 * compiler's exactly. Two copies of `Math.round(seconds * fps)` agree by
 * inspection; one exported leaf agrees by construction. The builder is also
 * node-safe by contract (see the header of `index.ts`), so keeping the helper
 * out of `compiler/compile.ts` is what lets it borrow the rule at all.
 */

/**
 * The frame a time in seconds lands on.
 *
 * Nearest, not floor: at 30fps a cue at 0.49s belongs to frame 15 rather than
 * 14, because that is the frame it is closest to being on screen for. The
 * result is not clamped — a time past the document's end returns a frame past
 * its last one, and callers that care (durations, ranges) decide what to do
 * about it.
 *
 * @param seconds - A time, measured from the start of the document.
 * @param fps - Frames per second of the document.
 * @returns The nearest frame index.
 */
export function toFrame(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}
