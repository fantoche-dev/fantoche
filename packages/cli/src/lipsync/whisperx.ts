import {
  visemeTrackSchema,
  type Viseme,
  type VisemeTrack,
} from '@fantoche-dev/document';
import {graphemeToViseme} from './viseme-map';

/** Silence long enough to put the mouth back at rest. */
export const SILENCE_SECONDS = 0.12;

export interface AlignedWord {
  text: string;
  start: number;
  end: number;
}

export interface AlignedChar {
  char: string;
  start: number;
  end: number;
}

/** Stable, tool-version-independent shape emitted by `scripts/align.py`. */
export interface WhisperXAlignment {
  words: AlignedWord[];
  chars: AlignedChar[];
}

export interface WhisperXTrackOptions {
  language: string;
  audio: string;
}

function timedEntry(
  raw: unknown,
  index: number,
  textKey: 'text' | 'char',
  collection: string,
): {text: string; start: number; end: number} | undefined {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(
      `Invalid WhisperX output: ${collection}[${index}] is not an object`,
    );
  }
  const record = raw as Record<string, unknown>;
  const text =
    record[textKey] ?? (textKey === 'text' ? record.word : undefined);
  // WhisperX leaves timestamps off punctuation/spacing it could not align.
  // Those entries carry no time evidence and are safely omitted.
  if (record.start === undefined || record.end === undefined) {
    return undefined;
  }
  if (
    typeof text !== 'string' ||
    typeof record.start !== 'number' ||
    !Number.isFinite(record.start) ||
    record.start < 0 ||
    typeof record.end !== 'number' ||
    !Number.isFinite(record.end) ||
    record.end <= record.start
  ) {
    throw new Error(
      `Invalid WhisperX output: ${collection}[${index}] needs text and a positive finite interval`,
    );
  }
  return {text, start: record.start, end: record.end};
}

/**
 * Normalise either raw WhisperX JSON or the already-normalised script output.
 */
export function normaliseWhisperXOutput(raw: unknown): WhisperXAlignment {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid WhisperX output: expected an object');
  }
  const record = raw as Record<string, unknown>;
  let words: unknown[];
  let chars: unknown[];
  if (Array.isArray(record.words) && Array.isArray(record.chars)) {
    words = record.words;
    chars = record.chars;
  } else if (Array.isArray(record.segments)) {
    words = record.segments.flatMap(segment =>
      typeof segment === 'object' &&
      segment !== null &&
      Array.isArray((segment as {words?: unknown}).words)
        ? ((segment as {words: unknown[]}).words ?? [])
        : [],
    );
    chars = record.segments.flatMap(segment =>
      typeof segment === 'object' &&
      segment !== null &&
      Array.isArray((segment as {chars?: unknown}).chars)
        ? ((segment as {chars: unknown[]}).chars ?? [])
        : [],
    );
  } else {
    throw new Error(
      'Invalid WhisperX output: expected words/chars or segments',
    );
  }

  const alignedWords = words
    .map((word, index) => timedEntry(word, index, 'text', 'words'))
    .filter(
      (word): word is {text: string; start: number; end: number} =>
        word !== undefined,
    );
  const alignedChars = chars
    .map((char, index) => timedEntry(char, index, 'char', 'chars'))
    .filter(
      (char): char is {text: string; start: number; end: number} =>
        char !== undefined,
    )
    .map(char => ({char: char.text, start: char.start, end: char.end}));
  if (alignedChars.length === 0) {
    throw new Error('Invalid WhisperX output: no timed character alignments');
  }
  return {words: alignedWords, chars: alignedChars};
}

function pushCue(cues: VisemeTrack['cues'], t: number, viseme: Viseme): void {
  const previous = cues[cues.length - 1];
  if (previous !== undefined && previous.viseme === viseme) {
    return;
  }
  if (previous !== undefined && t <= previous.t) {
    // Two graphemes may share a frame-level alignment boundary. Last wins at
    // that instant, exactly as the preview collapse does later in frames.
    if (t === previous.t) {
      cues[cues.length - 1] = {t, viseme};
      return;
    }
    throw new Error('WhisperX character alignments must be ordered by start');
  }
  cues.push({t, viseme});
}

/** Convert character alignments to a held viseme track. */
export function charAlignmentToVisemes(
  alignment: WhisperXAlignment,
  options: WhisperXTrackOptions,
): VisemeTrack {
  if (options.audio.trim() === '') {
    throw new Error('WhisperX track audio must be a non-empty path');
  }
  if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(options.language)) {
    throw new Error(
      `WhisperX track language must look like "pt" or "pt-BR" (got "${options.language}")`,
    );
  }

  const chars = [...alignment.chars].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
  const cues: VisemeTrack['cues'] = [];
  let previousEnd: number | undefined;
  for (const char of chars) {
    if (
      typeof char.char !== 'string' ||
      !Number.isFinite(char.start) ||
      char.start < 0 ||
      !Number.isFinite(char.end) ||
      char.end <= char.start
    ) {
      throw new Error(
        'WhisperX character alignments need positive finite intervals',
      );
    }
    const viseme = graphemeToViseme(char.char, options.language);
    if (viseme === undefined) {
      continue;
    }
    if (
      previousEnd !== undefined &&
      char.start - previousEnd >= SILENCE_SECONDS
    ) {
      pushCue(cues, previousEnd, 'X');
    }
    pushCue(cues, char.start, viseme);
    previousEnd = Math.max(previousEnd ?? char.end, char.end);
  }
  if (cues.length === 0 || previousEnd === undefined) {
    throw new Error('WhisperX alignment contains no mapped graphemes');
  }
  pushCue(cues, previousEnd, 'X');

  return visemeTrackSchema.parse({
    version: '0.1',
    engine: 'whisperx',
    audio: options.audio,
    language: options.language,
    cues,
  });
}
