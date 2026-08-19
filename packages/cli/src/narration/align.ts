import {spawn} from 'child_process';
import {
  findNodeAtLocation,
  parseTree,
  type Node as JsonNode,
} from 'jsonc-parser';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {errorWithCause} from '../errors';

export interface AlignedWord {
  text: string;
  start: number;
  end: number;
}

export interface AlignSegmentInput {
  id: string;
  text: string;
}

export interface AlignedSegment {
  id: string;
  words: AlignedWord[];
}

export interface AlignmentResult {
  segments: AlignedSegment[];
}

export interface AlignNarrationOptions {
  /** Audio file to force-align. Required unless `align` is injected. */
  audio?: string;
  /** Language tag handed to WhisperX (e.g. `pt-BR`). */
  language?: string;
  /** Python with whisperx installed. Default: `$WHISPERX_PYTHON`. */
  python?: string;
  /** Model cache directory. Default: `$WHISPERX_MODEL_DIR`. */
  modelDir?: string;
  /** Wrapper script path. Default: the copy bundled with the CLI package. */
  script?: string;
  /** Injectable alignment seam — tests feed committed WhisperX output. */
  align?: (
    segments: readonly AlignSegmentInput[],
  ) => Promise<AlignmentResult> | AlignmentResult;
}

interface DocumentSegment extends AlignSegmentInput {
  start?: unknown;
  dur?: unknown;
  words?: unknown;
}

interface RawAlignmentResult {
  words: AlignedWord[];
}

/**
 * Fill `narration.segments[].words[]` from forced alignment (plan Task 17).
 *
 * The segments' `text` is the transcript and is never altered; WhisperX
 * aligns it verbatim (ADR 0004 — no ASR before the gate). Written word text
 * is normalised (lowercase, edge punctuation stripped) so `binária,`
 * anchors as `binária`; word times are absolute document seconds, the
 * scale `resolveTimeRef` reads. Re-running is idempotent.
 */
export async function alignNarration(
  docPath: string,
  options: AlignNarrationOptions = {},
): Promise<void> {
  const original = fs.readFileSync(docPath, 'utf8');
  const doc = JSON.parse(original) as {
    narration?: {segments?: DocumentSegment[]};
  };

  const segments = doc.narration?.segments;
  if (segments === undefined || segments.length === 0) {
    throw new Error(
      `"${docPath}" has no narration segments — nothing to align`,
    );
  }

  const requests = segments.map(({id, text}) => ({id, text}));
  const requestedIds = new Set<string>();
  for (const segment of requests) {
    if (requestedIds.has(segment.id)) {
      throw new Error(
        `document carries duplicate narration segment id "${segment.id}"`,
      );
    }
    requestedIds.add(segment.id);
  }

  const runner = options.align ?? makeWhisperXRunner(options);
  const aligned = await runner(requests);
  const alignedById = indexAlignedSegments(aligned, requestedIds);

  // Word presence cannot be verified by alignment alone (it places every
  // word somewhere — the Part A incident). Demanding an exact token-for-token
  // match between transcript and aligned output at least catches count and
  // order drift loudly instead of writing ghost timings.
  const writes: {index: number; words: NormalisedWord[]}[] = [];
  for (const [index, segment] of segments.entries()) {
    const alignedSegment = alignedById.get(segment.id);
    if (alignedSegment === undefined) {
      throw new Error(`alignment is missing segment "${segment.id}"`);
    }
    const tokens = segment.text.split(/\s+/).filter(token => token !== '');
    const words: NormalisedWord[] = [];
    for (const [wordIndex, token] of tokens.entries()) {
      const word = alignedSegment.words[wordIndex];
      if (word === undefined) {
        throw new Error(
          `alignment ran out of words at segment "${segment.id}" — ` +
            `the audio does not carry the full transcript`,
        );
      }
      validateAlignedWord(word, segment.id, wordIndex);
      if (normalise(word.text) !== normalise(token)) {
        throw new Error(
          `segment "${segment.id}": transcript token "${token}" does not ` +
            `match aligned word "${word.text}" — transcript and audio disagree`,
        );
      }
      const dur = round3(word.end - word.start);
      const text = normalise(token);
      if (text === '') {
        throw new Error(
          `segment "${segment.id}": transcript token "${token}" becomes empty after normalisation`,
        );
      }
      words.push({
        text,
        start: word.start,
        ...(dur > 0 ? {dur} : {}),
      });
    }
    if (alignedSegment.words.length > tokens.length) {
      throw new Error(
        `segment "${segment.id}": alignment carries ${
          alignedSegment.words.length - tokens.length
        } extra word(s) beyond the transcript`,
      );
    }
    // Containment: `segment.start`/`dur` are the user's fields and anchors
    // resolve against words, so words landing outside the declared window
    // make `<segment>.start` fire after `<segment>.word:*`. Retiming the
    // user's fields silently would be a decision of its own (they stay
    // theirs) — refuse with the minimal window named instead.
    if (
      words.length > 0 &&
      typeof segment.start === 'number' &&
      typeof segment.dur === 'number'
    ) {
      const first = words[0].start;
      const last = words[words.length - 1];
      const lastEnd = last.start + (last.dur ?? 0);
      const windowEnd = segment.start + segment.dur;
      if (first < segment.start - 0.001 || lastEnd > windowEnd + 0.001) {
        throw new Error(
          `segment "${segment.id}" declares ${segment.start}–${round3(windowEnd)} s ` +
            `but its aligned words span ${first}–${round3(lastEnd)} s — widen the ` +
            `window (e.g. "start": ${first}, "dur": ${round3(lastEnd - first)}) ` +
            `or re-cut the segments; word timings are the audio's truth`,
        );
      }
    }
    writes.push({index, words});
  }

  fs.writeFileSync(docPath, patchWordArrays(original, writes));
}

interface NormalisedWord {
  text: string;
  start: number;
  dur?: number;
}

function indexAlignedSegments(
  result: AlignmentResult,
  requestedIds: ReadonlySet<string>,
): Map<string, AlignedSegment> {
  if (!result || !Array.isArray(result.segments)) {
    throw new Error('invalid alignment result: missing segments array');
  }
  const indexed = new Map<string, AlignedSegment>();
  for (const segment of result.segments) {
    if (
      segment === null ||
      typeof segment !== 'object' ||
      typeof segment.id !== 'string' ||
      !Array.isArray(segment.words)
    ) {
      throw new Error('invalid aligned segment entry');
    }
    if (indexed.has(segment.id)) {
      throw new Error(`alignment carries duplicate segment id "${segment.id}"`);
    }
    if (!requestedIds.has(segment.id)) {
      throw new Error(`alignment carries unknown segment id "${segment.id}"`);
    }
    indexed.set(segment.id, segment);
  }
  return indexed;
}

function validateAlignedWord(
  word: AlignedWord,
  segmentId: string,
  index: number,
): void {
  if (
    word === null ||
    typeof word !== 'object' ||
    typeof word.text !== 'string' ||
    !Number.isFinite(word.start) ||
    !Number.isFinite(word.end) ||
    word.start < 0 ||
    word.end < word.start
  ) {
    throw new Error(
      `segment "${segmentId}": aligned word ${index + 1} has invalid text/start/end`,
    );
  }
}

function normalise(word: string): string {
  return word
    .toLocaleLowerCase()
    .replace(/^[\p{P}\p{S}]+/u, '')
    .replace(/[\p{P}\p{S}]+$/u, '');
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function makeWhisperXRunner(
  options: AlignNarrationOptions,
): (segments: readonly AlignSegmentInput[]) => Promise<AlignmentResult> {
  const audio = options.audio;
  if (audio === undefined) {
    throw new Error('--audio is required (there is no audio to align against)');
  }
  const language = options.language;
  if (language === undefined) {
    throw new Error(
      '--language is required — alignment models are per-language',
    );
  }
  const python = options.python ?? process.env.WHISPERX_PYTHON;
  if (python === undefined) {
    throw new Error(
      'no WhisperX python — pass --python or set WHISPERX_PYTHON (see packages/e2e/lipsync/README.md)',
    );
  }
  const modelDir = options.modelDir ?? process.env.WHISPERX_MODEL_DIR;
  const script = resolveAlignScript(options.script);

  return async segments => {
    const transcript = segments.map(segment => segment.text).join('\n');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fantoche-align-'));
    try {
      const transcriptPath = path.join(dir, 'transcript.txt');
      const outPath = path.join(dir, 'alignment.json');
      fs.writeFileSync(transcriptPath, `${transcript}\n`);
      const args = [
        script,
        audio,
        '--transcript',
        transcriptPath,
        '--language',
        language,
        '--out',
        outPath,
        ...(modelDir !== undefined ? ['--model-dir', modelDir] : []),
      ];
      await run(python, args);
      const raw = JSON.parse(
        fs.readFileSync(outPath, 'utf8'),
      ) as RawAlignmentResult;
      if (!Array.isArray(raw.words)) {
        throw new Error('invalid scripts/align.py output: missing words array');
      }
      return partitionAlignment(segments, raw.words);
    } finally {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  };
}

function resolveAlignScript(override: string | undefined): string {
  if (override !== undefined) {
    return path.resolve(override);
  }
  const bundled = path.resolve(__dirname, '..', 'scripts', 'align.py');
  if (fs.existsSync(bundled)) {
    return bundled;
  }
  // Source-tree fallback for `npm run dev`; published packages take the
  // bundled branch above and never depend on the caller's cwd.
  const repository = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'scripts',
    'align.py',
  );
  if (fs.existsSync(repository)) {
    return repository;
  }
  throw new Error(
    'bundled scripts/align.py is missing — reinstall @fantoche-dev/cli or pass --script',
  );
}

function partitionAlignment(
  segments: readonly AlignSegmentInput[],
  words: AlignedWord[],
): AlignmentResult {
  let cursor = 0;
  const aligned = segments.map(segment => {
    const count = segment.text
      .split(/\s+/)
      .filter(token => token !== '').length;
    const result = {id: segment.id, words: words.slice(cursor, cursor + count)};
    cursor += count;
    return result;
  });
  if (cursor < words.length && aligned.length > 0) {
    // Keep extras attached to a named segment so the caller's refusal names
    // the precise document segment instead of emitting a position-only error.
    aligned[aligned.length - 1].words.push(...words.slice(cursor));
  }
  return {segments: aligned};
}

interface TextEdit {
  offset: number;
  length: number;
  content: string;
}

/** Replace/insert only `words`; every unrelated source byte survives. */
function patchWordArrays(
  source: string,
  writes: readonly {index: number; words: NormalisedWord[]}[],
): string {
  const root = parseTree(source);
  if (root === undefined) {
    throw new Error('could not locate the document JSON syntax tree');
  }
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const fallbackIndent = /\n([ \t]+)"/.exec(source)?.[1] ?? '  ';
  const edits: TextEdit[] = [];

  for (const write of writes) {
    const object = findNodeAtLocation(root, [
      'narration',
      'segments',
      write.index,
    ]);
    if (object?.type !== 'object') {
      throw new Error(
        `could not locate narration segment ${write.index} in the source text`,
      );
    }
    const objectSource = source.slice(
      object.offset,
      object.offset + object.length,
    );
    const multiline = /\r?\n/.test(objectSource);
    const wordsNode = findNodeAtLocation(root, [
      'narration',
      'segments',
      write.index,
      'words',
    ]);
    const wordsProperty = findProperty(object, 'words');

    if (wordsNode !== undefined && wordsProperty !== undefined) {
      const propertyIndent = lineIndent(source, wordsProperty.offset);
      const indentUnit = inferIndentUnit(
        source,
        object,
        propertyIndent,
        fallbackIndent,
      );
      edits.push({
        offset: wordsNode.offset,
        length: wordsNode.length,
        content: serialiseWords(
          write.words,
          multiline,
          eol,
          indentUnit,
          propertyIndent,
        ),
      });
      continue;
    }

    const properties = object.children ?? [];
    const last = properties[properties.length - 1];
    if (last === undefined) {
      throw new Error(`narration segment ${write.index} has no properties`);
    }
    const closeOffset = object.offset + object.length - 1;
    const colon = inferColon(source, properties[0]);
    const closeLineStart = lineStart(source, closeOffset);
    const closeIndent = source.slice(closeLineStart, closeOffset);
    const closingOnOwnLine =
      closeLineStart >= last.offset + last.length &&
      /^[ \t]*$/.test(closeIndent);

    if (multiline && closingOnOwnLine) {
      const propertyIndent = lineIndent(source, properties[0].offset);
      const indentUnit = inferIndentUnit(
        source,
        object,
        propertyIndent,
        fallbackIndent,
      );
      const value = serialiseWords(
        write.words,
        true,
        eol,
        indentUnit,
        propertyIndent,
      );
      const gapStart = last.offset + last.length;
      edits.push({
        offset: gapStart,
        length: closeLineStart - gapStart,
        content: `,${eol}${propertyIndent}"words"${colon}${value}${eol}`,
      });
    } else {
      const separator = inferInlineSeparator(source, properties);
      edits.push({
        offset: closeOffset,
        length: 0,
        content: `${separator}"words"${colon}${JSON.stringify(write.words)}`,
      });
    }
  }

  let result = source;
  for (const edit of edits.sort((a, b) => b.offset - a.offset)) {
    result =
      result.slice(0, edit.offset) +
      edit.content +
      result.slice(edit.offset + edit.length);
  }
  return result;
}

function findProperty(object: JsonNode, name: string): JsonNode | undefined {
  return object.children?.find(
    property => property.children?.[0]?.value === name,
  );
}

function inferColon(source: string, property: JsonNode): string {
  const key = property.children?.[0];
  const value = property.children?.[1];
  if (key === undefined || value === undefined) {
    return ': ';
  }
  const between = source.slice(key.offset + key.length, value.offset);
  return /^:[ \t]*$/.test(between) ? between : ': ';
}

function inferInlineSeparator(
  source: string,
  properties: readonly JsonNode[],
): string {
  if (properties.length < 2) {
    return ', ';
  }
  const left = properties[0];
  const right = properties[1];
  const between = source.slice(left.offset + left.length, right.offset);
  return /,[ \t]+$/.test(between) ? ', ' : ',';
}

function inferIndentUnit(
  source: string,
  object: JsonNode,
  propertyIndent: string,
  fallback: string,
): string {
  const closeOffset = object.offset + object.length - 1;
  const closeIndent = lineIndent(source, closeOffset);
  return propertyIndent.startsWith(closeIndent) &&
    propertyIndent.length > closeIndent.length
    ? propertyIndent.slice(closeIndent.length)
    : fallback;
}

function serialiseWords(
  words: readonly NormalisedWord[],
  multiline: boolean,
  eol: string,
  indentUnit: string,
  baseIndent: string,
): string {
  if (!multiline) {
    return JSON.stringify(words);
  }
  return JSON.stringify(words, null, indentUnit).replace(
    /\n/g,
    `${eol}${baseIndent}`,
  );
}

function lineStart(source: string, offset: number): number {
  return source.lastIndexOf('\n', offset - 1) + 1;
}

function lineIndent(source: string, offset: number): string {
  const prefix = source.slice(lineStart(source, offset), offset);
  return /^[ \t]*$/.test(prefix) ? prefix : '';
}

function run(executable: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('error', error =>
      reject(errorWithCause(`could not run ${executable}`, error)),
    );
    child.on('close', code =>
      code === 0
        ? resolve()
        : reject(new Error(`${executable} exited with code ${code}`)),
    );
  });
}
