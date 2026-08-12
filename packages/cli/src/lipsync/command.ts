import * as fs from 'fs';
import * as path from 'path';
import {renderDoc} from '../render-doc';

/**
 * Options of `fantoche lipsync preview`. `out` is the document to write —
 * `--out-dir` and `--workers` are forwarded to the renderer under `--render`,
 * where the mp4 name is derived from the document, as `fantoche render` does.
 */
export interface LipsyncPreviewOptions {
  mouths: string;
  out: string;
  fps: string;
  size: string;
  render?: boolean;
  outDir?: string;
  workers?: string;
}

/**
 * Parse a `WIDTHxHEIGHT` canvas string, throwing when it is not two positive
 * integers.
 *
 * @param value - e.g. `"480x320"`.
 * @returns The parsed size.
 */
export function parseSize(value: string): [number, number] {
  const match = /^(\d+)[xX](\d+)$/.exec(value.trim());
  const width = Number(match?.[1]);
  const height = Number(match?.[2]);
  if (match === null || width < 1 || height < 1) {
    throw new Error(
      `--size must be WIDTHxHEIGHT, e.g. 480x320 (got "${value}")`,
    );
  }
  return [width, height];
}

/**
 * Read one `<viseme>.svg` per viseme out of a mouth-sheet directory.
 *
 * The markup is inlined into the document rather than referenced, because
 * `props.src` on an `svg` element is a compile error in v0 — the runtime only
 * draws inline markup.
 *
 * Throws naming every file that is missing or empty at once, so a broken
 * sheet takes one run to diagnose rather than nine.
 *
 * @param dir - Directory holding `A.svg` … `X.svg`.
 * @param visemes - The viseme alphabet, from the document package.
 * @returns Viseme → inline SVG markup.
 */
export function readMouthSheet(
  dir: string,
  visemes: readonly string[],
): Record<string, string> {
  const sheet: Record<string, string> = {};
  const missing: string[] = [];
  for (const viseme of visemes) {
    const file = path.resolve(dir, `${viseme}.svg`);
    let markup: string;
    try {
      markup = fs.readFileSync(file, 'utf8');
    } catch {
      // Unreadable and absent are the same failure to a user staring at a
      // half-exported mouth sheet; both are reported by name below.
      markup = '';
    }
    if (markup.trim() === '') {
      missing.push(`${viseme}.svg`);
    }
    sheet[viseme] = markup;
  }
  if (missing.length > 0) {
    throw new Error(
      `mouth sheet "${dir}" is missing ${missing.join(', ')} — one file per ` +
        `viseme (${visemes.join('')}) is needed`,
    );
  }
  return sheet;
}

/**
 * `fantoche lipsync preview` — turn a viseme track into a renderable document.
 *
 * The output is a plain document: nine stacked mouths whose opacity is
 * hold-switched per cue. That is the whole point of the spike arm — the
 * lipsync experiment renders through the existing pipeline, and `--render`
 * hands the file straight to `fantoche render`'s own code path.
 *
 * @param trackPath - Path to a `*.viseme.json` track.
 * @param options - See {@link LipsyncPreviewOptions}.
 */
export async function lipsyncPreview(
  trackPath: string,
  options: LipsyncPreviewOptions,
): Promise<void> {
  const {VISEMES, buildVisemePreviewDocument, visemeTrackSchema} = await import(
    '@fantoche-dev/document'
  );

  const resolvedTrackPath = path.resolve(trackPath);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(resolvedTrackPath, 'utf8'));
  } catch (error) {
    console.error(`Could not read viseme track: ${(error as Error).message}`);
    process.exit(1);
  }

  const parsed = visemeTrackSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`Invalid viseme track ${resolvedTrackPath}:`);
    for (const issue of parsed.error.issues) {
      console.error(`  /${issue.path.join('/')}: ${issue.message}`);
    }
    process.exit(1);
  }

  let document: unknown;
  try {
    document = buildVisemePreviewDocument({
      track: parsed.data,
      mouths: readMouthSheet(options.mouths, VISEMES) as Record<
        (typeof VISEMES)[number],
        string
      >,
      fps: Number.parseInt(options.fps, 10),
      size: parseSize(options.size),
    });
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  const outPath = path.resolve(options.out);
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  fs.writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
  console.log(
    `Wrote ${outPath} (${parsed.data.cues.length} cues, engine ${parsed.data.engine})`,
  );

  if (options.render === true) {
    await renderDoc(outPath, {
      outDir: options.outDir,
      workers: options.workers,
    });
  }
}
