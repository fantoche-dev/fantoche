import {
  visemeTrackSchema,
  type Viseme,
  type VisemeTrack,
} from '@fantoche-dev/document';
import {spawn} from 'child_process';
import * as path from 'path';

const VISEME_ALPHABET = 'ABCDEFGHX';

/** Metadata attached to a track produced by Rhubarb. */
export interface RhubarbTrackOptions {
  /** Audio path to record in the portable track artifact. */
  audio: string;
  /** Normalised language tag, when known. */
  language?: string;
}

/** Options for invoking the dev-time Rhubarb binary. */
export interface RunRhubarbOptions {
  /** Audio path to record in the track; defaults to the WAV basename. */
  audio?: string;
  language?: string;
  /** Override for local/tool-managed installations and tests. */
  executable?: string;
}

interface RawCue {
  start: number;
  end: number;
  value: Viseme;
}

function readRawCues(raw: unknown): RawCue[] {
  if (typeof raw !== 'object' || raw === null || !('mouthCues' in raw)) {
    throw new Error(
      'Invalid Rhubarb output: expected an object with mouthCues',
    );
  }
  const mouthCues = (raw as {mouthCues?: unknown}).mouthCues;
  if (!Array.isArray(mouthCues)) {
    throw new Error('Invalid Rhubarb output: mouthCues must be an array');
  }

  return mouthCues.map((cue, index) => {
    if (typeof cue !== 'object' || cue === null) {
      throw new Error(
        `Invalid Rhubarb output: mouthCues[${index}] is not an object`,
      );
    }
    const {start, end, value} = cue as Record<string, unknown>;
    if (
      typeof start !== 'number' ||
      !Number.isFinite(start) ||
      start < 0 ||
      typeof end !== 'number' ||
      !Number.isFinite(end) ||
      end < 0
    ) {
      throw new Error(
        `Invalid Rhubarb output: mouthCues[${index}] needs finite, non-negative start/end`,
      );
    }
    if (
      typeof value !== 'string' ||
      value.length !== 1 ||
      !VISEME_ALPHABET.includes(value)
    ) {
      throw new Error(
        `Invalid Rhubarb output: mouthCues[${index}].value must be one of ${VISEME_ALPHABET}`,
      );
    }
    return {start, end, value: value as Viseme};
  });
}

/**
 * Convert Rhubarb's JSON export into the shared viseme-track format.
 *
 * Rhubarb can emit a zero-length boundary cue or two cues with the same
 * rounded start. Neither has an interval to display, and the shared format
 * requires strictly increasing timestamps, so both are discarded here. The
 * The resulting shape is validated against the shared track schema before it
 * crosses the adapter boundary.
 */
export function parseRhubarbOutput(
  raw: unknown,
  options: RhubarbTrackOptions,
): VisemeTrack {
  if (options.audio.trim() === '') {
    throw new Error('Rhubarb track audio must be a non-empty path');
  }
  if (
    options.language !== undefined &&
    !/^[a-z]{2}(-[A-Z]{2})?$/.test(options.language)
  ) {
    throw new Error(
      `Rhubarb track language must look like "pt" or "pt-BR" (got "${options.language}")`,
    );
  }

  const cues: VisemeTrack['cues'] = [];
  for (const cue of readRawCues(raw)) {
    const previous = cues[cues.length - 1];
    if (
      cue.end <= cue.start ||
      (previous !== undefined && cue.start <= previous.t)
    ) {
      continue;
    }
    cues.push({t: cue.start, viseme: cue.value});
  }
  if (cues.length === 0) {
    throw new Error('Invalid Rhubarb output: no positive-duration mouth cues');
  }

  return visemeTrackSchema.parse({
    version: '0.1',
    engine: 'rhubarb',
    audio: options.audio,
    ...(options.language === undefined ? {} : {language: options.language}),
    cues,
  });
}

function captureRhubarb(executable: string, wavPath: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      executable,
      ['-f', 'json', '-r', 'phonetic', '--machineReadable', wavPath],
      {stdio: ['ignore', 'pipe', 'pipe']},
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.once('error', error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error(
            'Rhubarb not found — see packages/e2e/lipsync/README.md; ' +
              'the spike needs it, rendering never does',
          ),
        );
      } else {
        reject(error);
      }
    });
    child.once('close', code => {
      if (code !== 0) {
        reject(
          new Error(
            `Rhubarb exited with code ${code}${
              stderr.trim() === '' ? '' : `: ${stderr.trim()}`
            }`,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(
            `Rhubarb returned invalid JSON: ${(error as Error).message}`,
          ),
        );
      }
    });
  });
}

/** Run Rhubarb in language-independent phonetic mode and return a valid track. */
export async function runRhubarb(
  wavPath: string,
  options: RunRhubarbOptions = {},
): Promise<VisemeTrack> {
  const resolved = path.resolve(wavPath);
  const raw = await captureRhubarb(
    options.executable ?? process.env.RHUBARB_BIN ?? 'rhubarb',
    resolved,
  );
  return parseRhubarbOutput(raw, {
    audio: options.audio ?? path.basename(wavPath),
    language: options.language,
  });
}
