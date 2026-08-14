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
  writeTrack(out, track);
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
  const track = charAlignmentToVisemes(normaliseWhisperXOutput(raw), {
    audio: portableAudioPath(audio, out),
    language: options.language,
  });
  writeTrack(out, track);
}
