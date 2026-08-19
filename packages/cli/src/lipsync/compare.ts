import {spawn} from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {errorWithCause} from '../errors';
import {renderDoc} from '../render-doc';
import {parseFps, parseSize, readMouthSheet} from './command';

export interface LipsyncCompareOptions {
  mouths: string;
  audio: string;
  out: string;
  fps: string;
  size: string;
  workers?: string;
  /** Seconds any one render or mux may take before the run is failed. */
  timeout?: string;
}

export interface BlindSides {
  left: string;
  right: string;
  /** Stable evidence that lets a later run reproduce the hidden assignment. */
  hash: string;
}

export interface CompareDependencies {
  render?: typeof renderDoc;
  mux?: (video: string, audio: string, out: string) => Promise<void>;
  probeDuration?: (file: string) => Promise<number>;
}

/**
 * A scorer rates two clips side by side; unequal windows make one arm look
 * worse for a reason that is not its mouth. One frame at the lowest rate the
 * harness accepts (1 fps would be absurd — this is the render's 60 fps floor
 * expressed generously).
 */
const WINDOW_TOLERANCE_SECONDS = 0.05;

/** Stable under argument reversal: the command line cannot reveal the key. */
export function assignBlindSides(a: string, b: string): BlindSides {
  // Code-point order, not localeCompare: a gate rerun under another machine's
  // locale must produce the same key.
  const named = [a, b].sort((left, right) => {
    const leftName = path.basename(left);
    const rightName = path.basename(right);
    return leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
  });
  if (path.basename(named[0]) === path.basename(named[1])) {
    throw new Error(
      'blind comparison track files need different basenames; their names seed the hidden assignment',
    );
  }
  const hash = crypto
    .createHash('sha256')
    .update(`${path.basename(named[0])}\u0000${path.basename(named[1])}`)
    .digest('hex');
  return Number.parseInt(hash.slice(0, 2), 16) % 2 === 0
    ? {left: named[0], right: named[1], hash}
    : {left: named[1], right: named[0], hash};
}

function captureStdout(
  binary: string,
  args: string[],
  timeoutSeconds: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutSeconds * 1000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => (stdout += chunk));
    child.stderr.on('data', chunk => (stderr += chunk));
    child.once('error', error => {
      clearTimeout(timer);
      reject(
        (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? new Error(
              `${binary} not found — it is required to verify equal scoring windows`,
            )
          : error,
      );
    });
    child.once('close', code => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`${binary} timed out after ${timeoutSeconds} s`));
      } else if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(`${binary} exited with code ${code}: ${stderr.trim()}`),
        );
      }
    });
  });
}

/**
 * Parse the `--timeout` flag. A comparison shells out to a browser render and
 * to ffmpeg; either can wedge, and a wedged scoring run used to hold the
 * terminal open with no output rather than failing.
 */
export function parseTimeoutSeconds(value: string): number {
  const trimmed = value.trim();
  const seconds = /^\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(
      `--timeout must be a positive number of seconds (got "${value}")`,
    );
  }
  return seconds;
}

/** Reject when `work` outlives the deadline, naming the step that wedged. */
async function withDeadline<T>(
  work: Promise<T>,
  seconds: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${seconds} s`)),
          seconds * 1000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function captureFfmpeg(
  args: string[],
  timeoutSeconds: number,
  binary = 'ffmpeg',
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {stdio: ['ignore', 'ignore', 'pipe']});
    let stderr = '';
    let timedOut = false;
    // SIGKILL, not SIGTERM: a wedged encoder is precisely the process that
    // ignores a polite signal, and the deadline exists to return.
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutSeconds * 1000);
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.once('error', error => {
      clearTimeout(timer);
      reject(
        (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? new Error(
              'ffmpeg not found — it is required to mux the comparison audio',
            )
          : error,
      );
    });
    child.once('close', code => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`${binary} timed out after ${timeoutSeconds} s`));
        return;
      }
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `ffmpeg exited with code ${code}${
              stderr.trim() === '' ? '' : `: ${stderr.trim()}`
            }`,
          ),
        );
      }
    });
  });
}

/** Container duration in seconds, as ffprobe reports it. */
export async function probeDurationSeconds(
  file: string,
  timeoutSeconds: number,
): Promise<number> {
  const out = await captureStdout(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=nw=1:nk=1',
      file,
    ],
    timeoutSeconds,
  );
  const seconds = Number(out.trim());
  if (!Number.isFinite(seconds)) {
    throw new Error(`ffprobe reported no duration for ${file}`);
  }
  return seconds;
}

/** Add the same source audio to one rendered mouth video. */
export async function muxComparisonAudio(
  video: string,
  audio: string,
  out: string,
  timeoutSeconds: number,
): Promise<void> {
  await captureFfmpeg(
    [
      '-y',
      '-i',
      video,
      '-i',
      audio,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-shortest',
      out,
    ],
    timeoutSeconds,
  );
}

/**
 * Lowercase sha-256 of a file's bytes — the digest a track records so a
 * comparison can bind to audio by content instead of by path.
 */
export function sha256File(file: string): string {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex');
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw errorWithCause(
      `Could not read ${file}: ${(error as Error).message}`,
      error,
    );
  }
}

function cleanupRendererIntermediates(outDir: string): void {
  for (const name of fs.readdirSync(outDir)) {
    if (
      /^\.(?:left|right)\.silent-(?:\d+\.mp4|audio\.wav|visuals\.mp4)$/.test(
        name,
      )
    ) {
      fs.rmSync(path.join(outDir, name), {force: true});
    }
  }
}

/** Build the two blinded, audio-muxed videos and keep the assignment in key.json. */
export async function lipsyncCompare(
  aPath: string,
  bPath: string,
  options: LipsyncCompareOptions,
  dependencies: CompareDependencies = {},
): Promise<void> {
  const {VISEMES, buildVisemePreviewDocument, visemeTrackSchema} = await import(
    '@fantoche-dev/document'
  );
  const a = path.resolve(aPath);
  const b = path.resolve(bPath);
  const audio = path.resolve(options.audio);
  const outDir = path.resolve(options.out);
  if (!fs.existsSync(audio)) {
    throw new Error(`Comparison audio not found: ${audio}`);
  }

  const parsed = [a, b].map(file => {
    const result = visemeTrackSchema.safeParse(readJson(file));
    if (!result.success) {
      throw new Error(
        `Invalid viseme track ${file}: ${result.error.issues
          .map(issue => `/${issue.path.join('/')}: ${issue.message}`)
          .join('; ')}`,
      );
    }
    return result.data;
  });
  if (parsed[0].engine === parsed[1].engine) {
    throw new Error(
      `Blind comparison needs two different engines (both are ${parsed[0].engine})`,
    );
  }
  if (parsed[0].language !== parsed[1].language) {
    throw new Error(
      `Blind comparison tracks disagree on language (${parsed[0].language ?? 'unset'} vs ${parsed[1].language ?? 'unset'})`,
    );
  }
  if (parsed[0].language === undefined) {
    throw new Error('Blind comparison tracks must record their language');
  }
  for (const [index, track] of parsed.entries()) {
    const trackAudio = path.isAbsolute(track.audio)
      ? path.resolve(track.audio)
      : path.resolve(path.dirname(index === 0 ? a : b), track.audio);
    if (trackAudio !== audio) {
      throw new Error(
        `Blind comparison track ${index === 0 ? a : b} was derived from ${trackAudio}, not ${audio}`,
      );
    }
  }
  // Content, not path: a re-recorded WAV under the same name passes every
  // check above and silently invalidates both tracks. Only tracks that
  // recorded a digest can be checked; older ones fall back to the path rule.
  const audioDigest = sha256File(audio);
  for (const [index, track] of parsed.entries()) {
    if (track.audioSha256 !== undefined && track.audioSha256 !== audioDigest) {
      throw new Error(
        `Blind comparison track ${index === 0 ? a : b} was derived from audio with sha-256 ${track.audioSha256}, but ${audio} hashes to ${audioDigest} — re-generate the track`,
      );
    }
  }

  const sides = assignBlindSides(a, b);
  const trackByPath = new Map([
    [a, parsed[0]],
    [b, parsed[1]],
  ]);
  const mouths = readMouthSheet(options.mouths, VISEMES);
  const fps = parseFps(options.fps);
  const size = parseSize(options.size);
  const timeoutSeconds = parseTimeoutSeconds(options.timeout ?? '900');
  fs.mkdirSync(outDir, {recursive: true});

  const previews = {
    left: buildVisemePreviewDocument({
      track: trackByPath.get(sides.left)!,
      mouths,
      fps,
      size,
    }),
    right: buildVisemePreviewDocument({
      track: trackByPath.get(sides.right)!,
      mouths,
      fps,
      size,
    }),
  };
  if (previews.left.collapsed > 0 || previews.right.collapsed > 0) {
    throw new Error(
      `Blind comparison would collapse cues at ${fps} fps; increase --fps before scoring`,
    );
  }

  const temporary: string[] = [];
  const completedSides: Record<'left' | 'right', string> = {
    left: '',
    right: '',
  };
  const key: Record<string, unknown> = {
    assignmentHash: sides.hash,
    language: parsed[0].language ?? null,
    audio,
  };
  try {
    for (const side of ['left', 'right'] as const) {
      const trackPath = sides[side];
      const track = trackByPath.get(trackPath)!;
      const preview = previews[side];
      const docPath = path.join(outDir, `.${side}.doc.json`);
      const silentName = `.${side}.silent.mp4`;
      const silentPath = path.join(outDir, silentName);
      temporary.push(docPath, silentPath);
      fs.writeFileSync(docPath, `${JSON.stringify(preview.doc, null, 2)}\n`);
      await withDeadline(
        (dependencies.render ?? renderDoc)(docPath, {
          out: silentName,
          outDir,
          workers: options.workers,
        }),
        timeoutSeconds,
        `${side} render`,
      );
      const muxedPath = path.join(outDir, `.${side}.muxed.mp4`);
      temporary.push(muxedPath);
      await withDeadline(
        dependencies.mux === undefined
          ? muxComparisonAudio(silentPath, audio, muxedPath, timeoutSeconds)
          : dependencies.mux(silentPath, audio, muxedPath),
        timeoutSeconds,
        `${side} audio mux`,
      );
      completedSides[side] = muxedPath;
      key[side] = {
        track: trackPath,
        engine: track.engine,
        cues: track.cues.length,
        collapsed: preview.collapsed,
      };
    }
    // The equal-window rule was recording discipline until now: -shortest
    // silently trims whichever arm the audio outran, and a scorer cannot tell
    // a short clip from a bad mouth.
    const probe =
      dependencies.probeDuration ??
      (file => probeDurationSeconds(file, timeoutSeconds));
    const durations = {
      left: await probe(completedSides.left),
      right: await probe(completedSides.right),
    };
    if (Math.abs(durations.left - durations.right) > WINDOW_TOLERANCE_SECONDS) {
      throw new Error(
        `Blind comparison arms differ in duration (${durations.left} s vs ${durations.right} s) — a scorer would not see them equally; re-cut the audio so both windows match`,
      );
    }

    const keyPath = path.join(outDir, '.key.json');
    temporary.push(keyPath);
    fs.writeFileSync(keyPath, `${JSON.stringify(key, null, 2)}\n`);

    // Publish only after both renders and both muxes succeeded. A failed rerun
    // cannot leave one new side beside one old side and look scoreable.
    fs.renameSync(completedSides.left, path.join(outDir, 'left.mp4'));
    fs.renameSync(completedSides.right, path.join(outDir, 'right.mp4'));
    fs.renameSync(keyPath, path.join(outDir, 'key.json'));
  } finally {
    for (const file of temporary) {
      fs.rmSync(file, {force: true});
    }
    cleanupRendererIntermediates(outDir);
  }

  console.log(`Wrote blinded comparison to ${outDir}`);
  console.log('Frame-collapse check: zero in both arms.');
  console.log('Score left.mp4 and right.mp4 from 1–5 on:');
  console.log('  • closure on bilabials (p/b/m)');
  console.log('  • rounding on o/u');
  console.log('  • jitter');
  console.log('  • drift over the full clip');
  console.log('Do not open key.json until both score sheets are final.');
}
