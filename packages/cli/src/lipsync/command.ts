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
 * Parse the `--fps` flag, throwing when it is not a frame rate a document may
 * carry.
 *
 * Parsed here rather than left to the builder's own guard so the message can
 * name the flag and quote what was typed. `Number.parseInt` turns a typo into
 * `NaN` and `30.7` into a silently truncated `30`, and neither "got NaN" nor
 * a preview at the wrong frame rate tells a user which flag to go and fix.
 *
 * @param value - e.g. `"30"`.
 * @returns The parsed frame rate.
 */
export function parseFps(value: string): number {
  const trimmed = value.trim();
  const fps = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) {
    throw new Error(
      `--fps must be a whole number of frames from 1 to 120 (got "${value}")`,
    );
  }
  return fps;
}

/**
 * The SVG tags the runtime's parser actually turns into nodes.
 *
 * Mirrored by hand from the tag chain in `SVG.parseSVGData`
 * (`packages/2d/src/lib/components/SVG.ts`), which is an if/else over
 * `child.tagName` rather than a list this could import. `g` is deliberately
 * absent: it is a container, so a file whose only content is an empty group
 * draws nothing.
 *
 * The cost of the duplication is that a tag added to the parser is rejected
 * here until this list catches up — a wrong "unusable" on a sheet that would
 * have rendered. The cost of not having it is a preview of a blank canvas
 * scored as an aligner's failure, which is the more expensive mistake in a
 * comparison whose whole output is a human judgement.
 */
const DRAWABLE_TAGS = [
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'image',
  'use',
] as const;

/**
 * The canvas an `<svg>` root declares, as a comparable string, or `undefined`
 * when it declares none.
 *
 * Read off the root tag alone: a `width` anywhere else in the markup belongs
 * to a shape, and matching it would accept a sheet the runtime cannot size.
 *
 * @param rootTag - The `<svg …>` opening tag, markup included.
 * @returns The normalised viewBox, `WIDTHxHEIGHT`, or `undefined`.
 */
function canvasOf(rootTag: string): string | undefined {
  const viewBox = /viewBox\s*=\s*["']([^"']*)["']/i.exec(rootTag)?.[1];
  if (viewBox !== undefined && viewBox.trim() !== '') {
    // Separators vary ("0 0 100 60", "0,0,100,60"); the canvas does not.
    return viewBox.trim().replace(/[\s,]+/g, ' ');
  }
  const width = /\bwidth\s*=\s*["']([^"']*)["']/i.exec(rootTag)?.[1]?.trim();
  const height = /\bheight\s*=\s*["']([^"']*)["']/i.exec(rootTag)?.[1]?.trim();
  return width !== undefined &&
    width !== '' &&
    height !== undefined &&
    height !== ''
    ? `${width}x${height}`
    : undefined;
}

/**
 * Read one `<viseme>.svg` per viseme out of a mouth-sheet directory.
 *
 * The markup is inlined into the document rather than referenced, because
 * `props.src` on an `svg` element is a compile error in v0 — the runtime only
 * draws inline markup.
 *
 * Throws naming every file that is unusable at once, so a broken sheet takes
 * one run to diagnose rather than nine.
 *
 * Generic in the alphabet so the result stays keyed by the caller's own
 * viseme type: passing `VISEMES` back gives a `Record<Viseme, string>`, which
 * is exactly what the document builder asks for and no cast in between.
 *
 * @param dir - Directory holding `A.svg` … `X.svg`.
 * @param visemes - The viseme alphabet, from the document package.
 * @returns Viseme → inline SVG markup.
 */
export function readMouthSheet<TViseme extends string>(
  dir: string,
  visemes: readonly TViseme[],
): Record<TViseme, string> {
  const sheet = {} as Record<TViseme, string>;
  const unusable: string[] = [];
  const canvases = new Map<TViseme, string>();
  for (const viseme of visemes) {
    const file = path.resolve(dir, `${viseme}.svg`);
    let markup: string;
    try {
      markup = fs.readFileSync(file, 'utf8');
    } catch (error) {
      // Absent, unreadable and directory-shaped are one failure to a user
      // staring at a half-exported mouth sheet, so they are reported together
      // — but with the OS's own reason attached, because "missing" sends
      // someone looking for a file that is sitting right there under an
      // EACCES.
      unusable.push(`${viseme}.svg (${(error as Error).message})`);
      sheet[viseme] = '';
      continue;
    }
    sheet[viseme] = markup;

    // Structural, not a parse: the real parser needs a DOM this process does
    // not have. It catches what actually goes wrong with a hand-made or
    // half-exported sheet — an empty file, an error page saved as .svg, an
    // export with no canvas, a drawing made of tags the runtime ignores.
    // A shape that sits in `<defs>` and is never `<use>`d still counts here
    // and still draws nothing; that is the gap this check does not close.
    const rootTag = /<svg\b[^>]*>/i.exec(markup)?.[0];
    if (markup.trim() === '') {
      unusable.push(`${viseme}.svg (file is empty)`);
    } else if (rootTag === undefined) {
      unusable.push(`${viseme}.svg (no <svg> root element)`);
    } else if (canvasOf(rootTag) === undefined) {
      unusable.push(
        `${viseme}.svg (root <svg> has neither viewBox nor width and height)`,
      );
    } else if (
      !DRAWABLE_TAGS.some(tag => new RegExp(`<${tag}\\b`, 'i').test(markup))
    ) {
      unusable.push(
        `${viseme}.svg (nothing the renderer draws — no ` +
          `${DRAWABLE_TAGS.join(', ')})`,
      );
    } else {
      canvases.set(viseme, canvasOf(rootTag) as string);
    }
  }
  if (unusable.length > 0) {
    throw new Error(
      `mouth sheet "${dir}" is unusable: ${unusable.join(', ')} — one ` +
        `non-empty file per viseme (${visemes.join('')}) is needed, each an ` +
        `<svg> with a canvas and something drawable in it`,
    );
  }

  // Reported only once every file is individually sound, because a file that
  // could not be read has no canvas to disagree with — "C.svg mixes canvases"
  // on top of "C.svg is missing" would be noise on the real failure.
  const distinct = new Set(canvases.values());
  if (distinct.size > 1) {
    throw new Error(
      `mouth sheet "${dir}" mixes canvases: ` +
        `${[...canvases]
          .map(([viseme, canvas]) => `${viseme}.svg (${canvas})`)
          .join(', ')} — every mouth must share one viewBox and origin, or ` +
        `the mouth jumps at each cue that changes canvas`,
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
  const {
    VISEMES,
    buildVisemePreviewDocument,
    validateDocument,
    visemeTrackSchema,
  } = await import('@fantoche-dev/document');

  const resolvedTrackPath = path.resolve(trackPath);
  const outPath = path.resolve(options.out);
  // Checked before anything is read, because the failure it prevents is
  // destructive: `--out track.json` overwrote the very alignment being
  // previewed, and a track costs a tool run — and, for the spike, a recording
  // session — to reproduce. Resolved paths rather than the typed strings, so
  // `mouth/../track.json` is caught too. It does not resolve symlinks or a
  // case-insensitive filesystem's idea of sameness; those are exotic next to
  // the accident this is here for, and the write itself is unchanged.
  if (outPath === resolvedTrackPath) {
    console.error(
      `--out ${options.out} is the viseme track being read ` +
        `(${resolvedTrackPath}) — writing the preview there would destroy ` +
        `its own input; pass a different path`,
    );
    process.exit(1);
  }

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

  let fps: number;
  let preview: {doc: unknown; collapsed: number};
  try {
    fps = parseFps(options.fps);
    preview = buildVisemePreviewDocument({
      track: parsed.data,
      mouths: readMouthSheet(options.mouths, VISEMES),
      fps,
      size: parseSize(options.size),
    });
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  // Nothing downstream re-checks this file before it is a file: `--render`
  // would surface a schema failure from inside the renderer, pointing at a
  // path the user never wrote by hand, and without `--render` an invalid
  // document would sit on disk behind an exit code of 0. Whatever the builder
  // promises, the promise is worth a check at the point it leaves the process.
  const validation = validateDocument(preview.doc);
  if (!validation.ok) {
    console.error(
      `Built an invalid document from ${resolvedTrackPath} — this is a bug in fantoche:`,
    );
    for (const issue of validation.errors) {
      console.error(`  ${issue.path}: ${issue.message}`);
    }
    process.exit(1);
  }

  try {
    fs.mkdirSync(path.dirname(outPath), {recursive: true});
    fs.writeFileSync(outPath, `${JSON.stringify(preview.doc, null, 2)}\n`);
  } catch (error) {
    console.error(`Could not write ${outPath}: ${(error as Error).message}`);
    process.exit(1);
  }
  // The collapsed count is printed every run, zero included: it is how much of
  // the track this frame rate could not show, and a lipsync comparison that
  // does not know its own measurement loss can blame an engine for it.
  console.log(
    `Wrote ${outPath} (${parsed.data.cues.length} cues, ` +
      `${preview.collapsed} collapsed at ${fps}fps, ` +
      `engine ${parsed.data.engine})`,
  );

  if (options.render === true) {
    await renderDoc(outPath, {
      outDir: options.outDir,
      workers: options.workers,
    });
  }
}
