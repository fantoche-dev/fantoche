import {spawn} from 'child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {errorWithCause} from '../errors';

export interface AlignedWord {
  text: string;
  start: number;
  end: number;
}

export interface AlignmentResult {
  words: AlignedWord[];
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
  /** Wrapper script path. Default: `scripts/align.py` (repo root cwd). */
  script?: string;
  /** Injectable alignment seam — tests feed committed WhisperX output. */
  align?: (transcript: string) => Promise<AlignmentResult> | AlignmentResult;
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
    narration?: {segments?: {id: string; text: string; words?: unknown}[]};
  };

  const segments = doc.narration?.segments;
  if (segments === undefined || segments.length === 0) {
    throw new Error(
      `"${docPath}" has no narration segments — nothing to align`,
    );
  }

  const transcript = segments.map(segment => segment.text).join('\n');
  const runner = options.align ?? makeWhisperXRunner(options);
  const aligned = await runner(transcript);

  // Word presence cannot be verified by alignment alone (it places every
  // word somewhere — the Part A incident). Demanding an exact token-for-token
  // match between transcript and aligned output at least catches count and
  // order drift loudly instead of writing ghost timings.
  let cursor = 0;
  for (const segment of segments) {
    const tokens = segment.text.split(/\s+/).filter(token => token !== '');
    const words: {text: string; start: number; dur?: number}[] = [];
    for (const token of tokens) {
      const word = aligned.words[cursor];
      if (word === undefined) {
        throw new Error(
          `alignment ran out of words at segment "${segment.id}" — ` +
            `the audio does not carry the full transcript`,
        );
      }
      if (normalise(word.text) !== normalise(token)) {
        throw new Error(
          `segment "${segment.id}": transcript token "${token}" does not ` +
            `match aligned word "${word.text}" — transcript and audio disagree`,
        );
      }
      const dur = round3(word.end - word.start);
      words.push({
        text: normalise(token),
        start: word.start,
        ...(dur > 0 ? {dur} : {}),
      });
      cursor += 1;
    }
    segment.words = words;
  }
  if (cursor < aligned.words.length) {
    throw new Error(
      `alignment carries ${aligned.words.length - cursor} word(s) beyond ` +
        `the document's transcript — transcript and audio disagree`,
    );
  }

  const indent = /\n([ \t]+)"/.exec(original)?.[1] ?? '  ';
  const trailing = original.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(docPath, `${JSON.stringify(doc, null, indent)}${trailing}`);
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
): (transcript: string) => Promise<AlignmentResult> {
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
  const script = options.script ?? path.join('scripts', 'align.py');

  return async transcript => {
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
      return JSON.parse(fs.readFileSync(outPath, 'utf8')) as AlignmentResult;
    } finally {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  };
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
