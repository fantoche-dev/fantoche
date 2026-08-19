/**
 * Audio measurement for `fantoche doc check`.
 *
 * ffmpeg and ffprobe are dev-time tools here, exactly as Rhubarb and WhisperX
 * are: `doc check` is an authoring command, never a render-time dependency.
 * The parsers are separated from the spawning so every threshold in §2.1 is
 * unit-testable against captured tool output rather than a live encoder.
 */

import {spawn} from 'child_process';
import type {Finding} from './checks.js';

export interface LoudnessSummary {
  /** Integrated loudness in LUFS; `-Infinity` for silence. */
  integratedLufs: number;
  /** True peak in dBFS. */
  truePeakDb: number;
}

export interface AudioStream {
  sampleRateHz: number;
  channels: number;
  durationSeconds: number;
}

export interface AudioFormat {
  sampleRateHz: number;
  integratedLufs: number;
  truePeakDb: number;
}

/** §2.1 — publish-rate master; downsample only for alignment. */
export const PUBLISH_SAMPLE_RATE_HZ = 48000;

/** §2.1 — about -14 LUFS, with the tolerance that "about" implies. */
export const TARGET_LUFS = -14;
export const LUFS_TOLERANCE = 1;

/** §2.1 — clipping survives every later encode. */
export const MAX_TRUE_PEAK_DB = -1;

function readNumber(source: string, pattern: RegExp): number | undefined {
  const match = pattern.exec(source);
  if (match === null) {
    return undefined;
  }
  return match[1] === '-inf' ? -Infinity : Number(match[1]);
}

/**
 * Read `ebur128`'s trailing Summary block.
 *
 * Anchored on "Summary:" on purpose: the same run prints an `I:` and a `TPK:`
 * on every progress line, and parsing one of those would silently report a
 * partial measurement of a file ffmpeg had not finished reading.
 */
export function parseLoudnessSummary(stderr: string): LoudnessSummary {
  const summaryAt = stderr.lastIndexOf('Summary:');
  if (summaryAt === -1) {
    throw new Error(
      'ffmpeg produced no ebur128 Summary block — the measurement did not complete',
    );
  }
  const summary = stderr.slice(summaryAt);
  const integratedLufs = readNumber(
    summary,
    /^\s*I:\s*(-?[\d.]+|-inf)\s*LUFS/m,
  );
  const truePeakDb = readNumber(summary, /^\s*Peak:\s*(-?[\d.]+|-inf)\s*dBFS/m);
  if (integratedLufs === undefined || truePeakDb === undefined) {
    throw new Error(
      'ffmpeg ebur128 Summary block carried no integrated loudness and true peak',
    );
  }
  return {integratedLufs, truePeakDb};
}

/**
 * Read the first audio stream out of `ffprobe -of json` output.
 *
 * Indexed access rather than declared properties: these are ffprobe's key
 * names, and the shape belongs to the tool, not to us.
 */
export function parseAudioStream(probeJson: string): AudioStream {
  const parsed = JSON.parse(probeJson) as {
    streams?: Record<string, unknown>[];
  };
  const stream = parsed.streams?.find(
    candidate => candidate['codec_type'] === 'audio',
  );
  if (stream === undefined) {
    throw new Error('ffprobe found no audio stream in the narration asset');
  }
  return {
    sampleRateHz: Number(stream['sample_rate']),
    channels: Number(stream['channels']),
    durationSeconds: Number(stream['duration']),
  };
}

/** The three §2.1 rules that a single measurement of the master decides. */
export function checkAudioFormat(format: AudioFormat): Finding[] {
  const findings: Finding[] = [];
  if (format.sampleRateHz < PUBLISH_SAMPLE_RATE_HZ) {
    findings.push({
      rule: 'audio.sample-rate',
      message: `narration is ${format.sampleRateHz} Hz — band-limited below the ${PUBLISH_SAMPLE_RATE_HZ} Hz publish rate; keep the master at 48 kHz and derive a 16 kHz copy for alignment only`,
    });
  }
  if (Math.abs(format.integratedLufs - TARGET_LUFS) > LUFS_TOLERANCE) {
    findings.push({
      rule: 'audio.loudness',
      message: `integrated loudness is ${format.integratedLufs} LUFS, outside ${TARGET_LUFS} ±${LUFS_TOLERANCE} LU`,
    });
  }
  if (format.truePeakDb > MAX_TRUE_PEAK_DB) {
    findings.push({
      rule: 'audio.true-peak',
      message: `true peak is ${format.truePeakDb} dBFS, over the ${MAX_TRUE_PEAK_DB} dBTP ceiling`,
    });
  }
  return findings;
}

function run(binary: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => (stdout += chunk));
    child.stderr.on('data', chunk => (stderr += chunk));
    child.once('error', error =>
      reject(
        (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? new Error(
              `${binary} not found — doc check measures audio with ffmpeg/ffprobe`,
            )
          : error,
      ),
    );
    // ebur128 writes its report to stderr and exits 0; a non-zero exit is a
    // real failure, and stdout carries ffprobe's JSON.
    child.once('close', code =>
      code === 0
        ? resolve(`${stdout}${stderr}`)
        : reject(
            new Error(`${binary} exited with code ${code}: ${stderr.trim()}`),
          ),
    );
  });
}

/** Measure one narration file: stream facts plus the ebur128 summary. */
export async function measureAudio(
  file: string,
  binaries: {ffmpeg: string; ffprobe: string},
): Promise<AudioStream & LoudnessSummary> {
  const probe = await run(binaries.ffprobe, [
    '-v',
    'error',
    '-show_streams',
    '-of',
    'json',
    file,
  ]);
  const loudness = await run(binaries.ffmpeg, [
    '-nostdin',
    '-i',
    file,
    '-filter_complex',
    'ebur128=peak=true',
    '-f',
    'null',
    '-',
  ]);
  return {...parseAudioStream(probe), ...parseLoudnessSummary(loudness)};
}
