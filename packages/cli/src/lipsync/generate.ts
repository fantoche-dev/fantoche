import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {errorWithCause} from '../errors';
import {runRhubarb} from './rhubarb';
import {charAlignmentToVisemes, normaliseWhisperXOutput} from './whisperx';

export interface GenerateTrackOptions {
  out: string;
  language: string;
}

export interface GenerateWhisperXTrackOptions extends GenerateTrackOptions {
  audio: string;
}

function portableAudioPath(audio: string, out: string): string {
  const relative = path.relative(path.dirname(out), audio);
  return (relative === '' ? path.basename(audio) : relative)
    .split(path.sep)
    .join('/');
}

/** Lowercase sha-256 of the source audio, so a track binds by content. */
function sha256File(file: string): string {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex');
}

/**
 * The two numbers that caught the mid-spike alignment incident.
 *
 * A run that silently drops words still writes a plausible-looking track;
 * the placed count and the largest silence between consecutive words are
 * what make that visible without opening the JSON.
 */
function reportAlignmentDiagnostics(
  words: readonly {start: number; end: number}[],
): void {
  console.log(`${words.length} words placed`);
  if (words.length < 2) {
    return;
  }
  let largest = 0;
  for (let i = 1; i < words.length; i += 1) {
    largest = Math.max(largest, words[i].start - words[i - 1].end);
  }
  console.log(`largest inter-word gap ${Math.round(largest * 1000) / 1000} s`);
}

function writeTrack(out: string, track: unknown): void {
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, `${JSON.stringify(track, null, 2)}\n`);
  console.log(`Wrote viseme track to ${out}`);
}

/** Generate arm A directly from a WAV using the dev-time Rhubarb binary. */
export async function generateRhubarbTrack(
  wavPath: string,
  options: GenerateTrackOptions,
): Promise<void> {
  const wav = path.resolve(wavPath);
  const out = path.resolve(options.out);
  if (wav === out) {
    throw new Error('--out must not overwrite the source WAV');
  }
  const track = await runRhubarb(wav, {
    audio: portableAudioPath(wav, out),
    language: options.language,
  });
  writeTrack(out, {...track, audioSha256: sha256File(wav)});
}

/** Convert the stable output of scripts/align.py into spike arm B. */
export async function generateWhisperXTrack(
  alignmentPath: string,
  options: GenerateWhisperXTrackOptions,
): Promise<void> {
  const alignment = path.resolve(alignmentPath);
  const audio = path.resolve(options.audio);
  const out = path.resolve(options.out);
  if (alignment === out || audio === out) {
    throw new Error('--out must not overwrite the alignment or source audio');
  }
  if (!fs.existsSync(audio)) {
    throw new Error(`Source audio not found: ${audio}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(alignment, 'utf8'));
  } catch (error) {
    throw errorWithCause(
      `Could not read WhisperX alignment ${alignment}: ${(error as Error).message}`,
      error,
    );
  }
  const normalised = normaliseWhisperXOutput(raw);
  reportAlignmentDiagnostics(normalised.words);
  const track = charAlignmentToVisemes(normalised, {
    audio: portableAudioPath(audio, out),
    language: options.language,
  });
  writeTrack(out, {...track, audioSha256: sha256File(audio)});
}
