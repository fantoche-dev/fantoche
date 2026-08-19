/**
 * The mechanically checkable half of `docs/content-quality.md` §2.
 *
 * Pure functions over already-parsed inputs: no filesystem, no ffmpeg, no
 * document loading. The command layer supplies the numbers; everything here
 * only decides whether they clear the floor. Keeping the split means every
 * threshold is unit-testable without a render or an audio file.
 *
 * Thresholds are the project defaults from §2, exported so a caller can tune
 * them without editing a rule.
 */

/** One violation of the technical floor, named by the rule that caught it. */
export interface Finding {
  /** Stable dotted id, e.g. `lipsync.minimum-hold`. */
  rule: string;
  message: string;
}

export interface CheckedWord {
  text: string;
  start: number;
  dur?: number;
}

export interface CheckedSegment {
  id: string;
  start: number;
  dur: number;
  words?: CheckedWord[];
}

export interface CheckedCue {
  t: number;
  viseme: string;
}

/** §2.4 — one segment per sentence or visual beat. */
export const SEGMENT_SECONDS = {min: 5, max: 10} as const;

/** §2.2 — three frames at 30 fps; no one-frame shapes. */
export const MINIMUM_HOLD_SECONDS = 0.1;

/** §2.1 — alignment wants a tail; viewers do not. */
export const MAX_TRAILING_SILENCE_SECONDS = 0.5;

/** The letters whose closure a viewer can see missing (§2.2). */
const BILABIALS = /[pbm]/i;

/** Trim binary-float noise so a message quotes what the author typed. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function wordEnd(word: CheckedWord): number {
  return word.start + (word.dur ?? 0);
}

function allWords(segments: readonly CheckedSegment[]): CheckedWord[] {
  return segments.flatMap(segment => segment.words ?? []);
}

/**
 * Segments outside the 5–10 s band.
 *
 * Both directions are defects: a long segment is a beat that stopped
 * progressing, a very short one is a beat with nothing in it.
 */
export function checkSegmentLength(
  segments: readonly CheckedSegment[],
  bounds: {min: number; max: number} = SEGMENT_SECONDS,
): Finding[] {
  return segments
    .filter(segment => segment.dur < bounds.min || segment.dur > bounds.max)
    .map(segment => ({
      rule: 'narration.segment-length',
      message: `segment "${segment.id}" runs ${round(segment.dur)} s — outside the ${bounds.min}–${bounds.max} s band for one visual beat`,
    }));
}

/**
 * Cues held for less than the minimum, measured against the *next* cue.
 *
 * The final cue is never flagged: nothing follows it, so the track carries no
 * evidence of how long it is held — the audio duration decides that.
 */
export function checkMinimumHold(
  cues: readonly CheckedCue[],
  minimumHold: number = MINIMUM_HOLD_SECONDS,
): Finding[] {
  const findings: Finding[] = [];
  for (let i = 0; i + 1 < cues.length; i += 1) {
    const held = cues[i + 1].t - cues[i].t;
    // Compare in whole milliseconds. Cue times are authored in ms, and
    // 4.101 - 4.001 is 0.09999999999999964 as a double: comparing raw
    // doubles reported all 26 exactly-on-the-floor holds in the north-star
    // track as violations.
    if (Math.round(held * 1000) < Math.round(minimumHold * 1000)) {
      findings.push({
        rule: 'lipsync.minimum-hold',
        message: `cue ${cues[i].viseme} at ${round(cues[i].t)} s is held ${round(held)} s, under the ${minimumHold} s minimum`,
      });
    }
  }
  return findings;
}

/**
 * Words spelled with p, b or m whose span never reaches a pressed A.
 *
 * Word-level, not phoneme-level: the committed document carries word
 * alignment, not characters, so this approximates ADR 0007's rule. It cannot
 * tell *which* bilabial in a word closed, and a word whose only p is silent
 * would be a false positive — worth the trade for a check that needs no
 * alignment sidecar.
 */
export function checkBilabialClosure(
  segments: readonly CheckedSegment[],
  cues: readonly CheckedCue[],
): Finding[] {
  const closures = cues.filter(cue => cue.viseme === 'A');
  return allWords(segments)
    .filter(word => BILABIALS.test(word.text))
    .filter(
      word =>
        !closures.some(cue => cue.t >= word.start && cue.t <= wordEnd(word)),
    )
    .map(word => ({
      rule: 'lipsync.bilabial-closure',
      message: `"${word.text}" at ${round(word.start)} s carries a bilabial but never reaches a pressed A`,
    }));
}

/** Audio that keeps running well past the last aligned word (§2.1). */
export function checkTrailingSilence(
  audioSeconds: number,
  lastWordEnd: number,
  maximum: number = MAX_TRAILING_SILENCE_SECONDS,
): Finding[] {
  const tail = audioSeconds - lastWordEnd;
  return tail <= maximum
    ? []
    : [
        {
          rule: 'audio.trailing-silence',
          message: `${round(tail)} s of audio follow the last word, over the ${maximum} s maximum`,
        },
      ];
}
