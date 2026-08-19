/**
 * Run every §2 rule that the committed inputs can decide, in one place.
 *
 * Pure: the caller does the loading, the compiling and the ffmpeg work, then
 * hands the results here. That keeps the ordering of the report — and the
 * decision of which rules a partial input set can still answer — under test.
 */

import type {AudioStream, LoudnessSummary} from './audio.js';
import {checkAudioFormat} from './audio.js';
import type {CheckedCue, CheckedSegment, Finding} from './checks.js';
import {
  checkBilabialClosure,
  checkMinimumHold,
  checkSegmentLength,
  checkTrailingSilence,
} from './checks.js';

export interface CollectInput {
  doc: {narration?: {audio?: string; segments: CheckedSegment[]}};
  /** One cue list per lipsync asset the document carries. */
  tracks: readonly (readonly CheckedCue[])[];
  /** Absent when the document has no narration audio, or ffmpeg was skipped. */
  audio?: AudioStream & LoudnessSummary;
  /** Anchor and retiming warnings the compiler produced for this document. */
  warnings: readonly string[];
}

/** The end of the last aligned word, or undefined when nothing is aligned. */
function lastAlignedWordEnd(
  segments: readonly CheckedSegment[],
): number | undefined {
  const ends = segments
    .flatMap(segment => segment.words ?? [])
    .map(word => word.start + (word.dur ?? 0));
  return ends.length === 0 ? undefined : Math.max(...ends);
}

export function collectFindings(input: CollectInput): Finding[] {
  const segments = input.doc.narration?.segments ?? [];
  const findings: Finding[] = [
    // A warned anchor means a gesture landed on a word the author did not
    // choose (§2.5) — it is a content defect, not compiler noise.
    ...input.warnings.map(warning => ({
      rule: 'document.anchor-warning',
      message: warning,
    })),
    ...checkSegmentLength(segments),
  ];
  for (const track of input.tracks) {
    findings.push(
      ...checkMinimumHold(track),
      ...checkBilabialClosure(segments, track),
    );
  }
  if (input.audio !== undefined) {
    findings.push(...checkAudioFormat(input.audio));
    const lastWord = lastAlignedWordEnd(segments);
    if (lastWord !== undefined) {
      findings.push(
        ...checkTrailingSilence(input.audio.durationSeconds, lastWord),
      );
    }
  }
  return findings;
}
