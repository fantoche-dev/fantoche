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
}

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

function captureFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, {stdio: ['ignore', 'ignore', 'pipe']});
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.once('error', error => {
      reject(
        (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? new Error(
              'ffmpeg not found — it is required to mux the comparison audio',
            )
          : error,
      );
    });
    child.once('close', code => {
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

/** Add the same source audio to one rendered mouth video. */
export async function muxComparisonAudio(
  video: string,
  audio: string,
  out: string,
): Promise<void> {
  await captureFfmpeg([
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
  ]);
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

  const sides = assignBlindSides(a, b);
  const trackByPath = new Map([
    [a, parsed[0]],
    [b, parsed[1]],
  ]);
  const mouths = readMouthSheet(options.mouths, VISEMES);
  const fps = parseFps(options.fps);
  const size = parseSize(options.size);
  fs.mkdirSync(outDir, {recursive: true});

  const temporary: string[] = [];
  const completedSides: Record<'left' | 'right', string> = {
    left: '',
    right: '',
  };
  const collapsedBySide: Record<'left' | 'right', number> = {
    left: 0,
    right: 0,
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
      const preview = buildVisemePreviewDocument({track, mouths, fps, size});
      const docPath = path.join(outDir, `.${side}.doc.json`);
      const silentName = `.${side}.silent.mp4`;
      const silentPath = path.join(outDir, silentName);
      temporary.push(docPath, silentPath);
      fs.writeFileSync(docPath, `${JSON.stringify(preview.doc, null, 2)}\n`);
      await (dependencies.render ?? renderDoc)(docPath, {
        out: silentName,
        outDir,
        workers: options.workers,
      });
      const muxedPath = path.join(outDir, `.${side}.muxed.mp4`);
      temporary.push(muxedPath);
      await (dependencies.mux ?? muxComparisonAudio)(
        silentPath,
        audio,
        muxedPath,
      );
      completedSides[side] = muxedPath;
      collapsedBySide[side] = preview.collapsed;
      key[side] = {
        track: trackPath,
        engine: track.engine,
        cues: track.cues.length,
        collapsed: preview.collapsed,
      };
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
  console.log(
    `Frame-collapse check: left ${collapsedBySide.left}, right ${collapsedBySide.right}`,
  );
  console.log('Score left.mp4 and right.mp4 from 1–5 on:');
  console.log('  • closure on bilabials (p/b/m)');
  console.log('  • rounding on o/u');
  console.log('  • jitter');
  console.log('  • drift over the full clip');
  console.log('Do not open key.json until both score sheets are final.');
}
