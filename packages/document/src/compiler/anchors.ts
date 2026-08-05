import {parseAnchor} from '../timeref.js';

export class AnchorError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AnchorError';
  }
}

interface NarrationWordsInput {
  text: string;
  start: number;
  dur?: number;
}

interface NarrationSegmentInput {
  id: string;
  text: string;
  start: number;
  dur: number;
  words?: NarrationWordsInput[];
}

export interface NarrationIndex {
  segments: Map<
    string,
    {
      start: number;
      end: number;
      /** word text → starts of every occurrence, in narration order. */
      words: Map<string, number[]> | null;
    }
  >;
}

export function buildNarrationIndex(
  narration: {segments: NarrationSegmentInput[]} | undefined,
): NarrationIndex {
  const segments: NarrationIndex['segments'] = new Map();
  for (const segment of narration?.segments ?? []) {
    let words: Map<string, number[]> | null = null;
    if (segment.words !== undefined) {
      words = new Map();
      for (const word of segment.words) {
        const starts = words.get(word.text) ?? [];
        starts.push(word.start);
        words.set(word.text, starts);
      }
    }
    segments.set(segment.id, {
      start: segment.start,
      end: segment.start + segment.dur,
      words,
    });
  }
  return {segments};
}

export interface ResolvedTime {
  seconds: number;
  warnings: string[];
}

export function resolveTimeRef(
  ref: number | string,
  index: NarrationIndex,
): ResolvedTime {
  if (typeof ref === 'number') {
    return {seconds: ref, warnings: []};
  }
  const anchor = parseAnchor(ref);
  if (anchor === null) {
    throw new AnchorError(`"${ref}" is not a valid time reference`);
  }
  const segment = index.segments.get(anchor.segment);
  if (segment === undefined) {
    throw new AnchorError(
      `"${ref}" references unknown narration segment "${anchor.segment}"`,
    );
  }

  let base: number;
  const warnings: string[] = [];
  if (anchor.kind === 'start') {
    base = segment.start;
  } else if (anchor.kind === 'end') {
    base = segment.end;
  } else {
    if (segment.words === null) {
      throw new AnchorError(
        `"${ref}": segment "${anchor.segment}" has no word timings — ` +
          `add a words[] array (or use ${anchor.segment}.start/.end)`,
      );
    }
    const starts = segment.words.get(anchor.word ?? '');
    if (starts === undefined || starts.length === 0) {
      throw new AnchorError(
        `"${ref}": word "${anchor.word}" not found in segment "${anchor.segment}"`,
      );
    }
    base = starts[0];
    if (starts.length > 1) {
      warnings.push(
        `"${ref}" is ambiguous — "${anchor.word}" occurs ${starts.length} ` +
          `times in "${anchor.segment}"; using the first occurrence`,
      );
    }
  }
  if (anchor.kind === 'word' && anchor.offset !== 0) {
    warnings.push(
      `"${ref}": trailing ${anchor.offset > 0 ? '+' : ''}${anchor.offset} was ` +
        `parsed as a seconds offset on word "${anchor.word}" — if the word ` +
        `itself ends in +/-<digits>, word anchors cannot express it`,
    );
  }

  return {seconds: Math.max(0, base + anchor.offset), warnings};
}
