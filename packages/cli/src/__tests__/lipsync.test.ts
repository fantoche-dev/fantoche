import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {afterEach, describe, expect, test, vi} from 'vitest';
import type {LipsyncPreviewOptions} from '../lipsync/command';
import {
  lipsyncPreview,
  parseFps,
  parseSize,
  readMouthSheet,
} from '../lipsync/command';

const VISEMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'];

const temporaries: string[] = [];

/** A scratch directory holding a mouth sheet and (optionally) a track. */
function scratch(track?: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fantoche-lipsync-'));
  temporaries.push(dir);
  fs.mkdirSync(path.join(dir, 'mouth'));
  for (const viseme of VISEMES) {
    // `<rect>`, not `<text>`: the runtime's parser draws neither text nor
    // anything else outside its tag list, so a sheet of `<text>` renders an
    // empty frame. This fixture used to be exactly that — every assertion
    // about a written preview held over mouths that would never appear.
    fs.writeFileSync(
      path.join(dir, 'mouth', `${viseme}.svg`),
      `<svg viewBox="0 0 100 60"><rect id="${viseme}" width="100" height="60"/></svg>\n`,
    );
  }
  if (track !== undefined) {
    fs.writeFileSync(
      path.join(dir, 'track.json'),
      JSON.stringify(track, null, 2),
    );
  }
  return dir;
}

/** A well-formed track, so a test only has to vary what it is about. */
function goodTrack(cues?: {t: number; viseme: string}[]): unknown {
  return {
    version: '0.1',
    engine: 'rhubarb',
    audio: 'pt-br-01.wav',
    language: 'pt-BR',
    cues: cues ?? [
      {t: 0, viseme: 'X'},
      {t: 0.4, viseme: 'B'},
      {t: 0.9, viseme: 'F'},
    ],
  };
}

/**
 * Run the command the way a shell would see it: `process.exit` becomes a
 * throw the run swallows, and both consoles are captured, so a test can
 * assert on the exit code and on what the user was actually told.
 */
async function run(
  trackPath: string,
  options: LipsyncPreviewOptions,
): Promise<{code: number | null; out: string; err: string}> {
  const out: string[] = [];
  const err: string[] = [];
  let code: number | null = null;
  const exit = vi.spyOn(process, 'exit').mockImplementation(((c?: number) => {
    code = c ?? 0;
    throw new Error('EXIT');
  }) as never);
  const log = vi
    .spyOn(console, 'log')
    .mockImplementation((...args: unknown[]) => {
      out.push(args.join(' '));
    });
  const error = vi
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => {
      err.push(args.join(' '));
    });
  try {
    await lipsyncPreview(trackPath, options);
  } catch (thrown) {
    if ((thrown as Error).message !== 'EXIT') {
      throw thrown;
    }
  } finally {
    exit.mockRestore();
    log.mockRestore();
    error.mockRestore();
  }
  return {code, out: out.join('\n'), err: err.join('\n')};
}

afterEach(() => {
  for (const dir of temporaries.splice(0)) {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

describe('parseSize', () => {
  test('reads WxH and rejects anything else', () => {
    expect(parseSize('480x320')).toEqual([480, 320]);
    expect(parseSize('1920X1080')).toEqual([1920, 1080]);
    for (const bad of ['480', '480x', 'x320', '480x0', '-4x8', '4.5x8', '']) {
      expect(() => parseSize(bad)).toThrow(/size/);
    }
  });
});

describe('parseFps', () => {
  test('reads a frame rate a document may carry', () => {
    expect(parseFps('30')).toBe(30);
    expect(parseFps(' 120 ')).toBe(120);
    expect(parseFps('1')).toBe(1);
  });

  test('names the flag and quotes what was typed', () => {
    // parseInt would have made 30 out of "30.7" and NaN out of "banana", and
    // reported neither the flag nor the string the user actually passed.
    for (const bad of ['0', '121', '240', '30.7', '-30', 'banana', '', '3e1']) {
      expect(() => parseFps(bad)).toThrow(/--fps/);
      expect(() => parseFps(bad)).toThrow(`"${bad}"`);
    }
  });
});

describe('readMouthSheet', () => {
  test('reads one file per viseme, keyed by viseme', () => {
    const dir = scratch();
    const sheet = readMouthSheet(path.join(dir, 'mouth'), VISEMES);
    expect(Object.keys(sheet).sort()).toEqual([...VISEMES].sort());
    expect(sheet.B).toContain('id="B"');
  });

  test('keeps the caller’s viseme type, so no cast is needed', () => {
    const dir = scratch();
    const sheet = readMouthSheet(path.join(dir, 'mouth'), ['B', 'X'] as const);
    // Typed as Record<'B' | 'X', string>: reading `sheet.B` compiles and
    // reading a viseme that was not asked for does not.
    expect(sheet.B).toContain('id="B"');
    expect(sheet.X).toContain('id="X"');
    // @ts-expect-error 'A' is not in the alphabet this call asked for.
    expect(sheet.A).toBeUndefined();
  });

  test('names every unusable file at once, with the reason', () => {
    const dir = scratch();
    fs.rmSync(path.join(dir, 'mouth', 'C.svg'));
    fs.rmSync(path.join(dir, 'mouth', 'G.svg'));
    fs.writeFileSync(path.join(dir, 'mouth', 'H.svg'), '   \n');
    let message = '';
    try {
      readMouthSheet(path.join(dir, 'mouth'), VISEMES);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/C\.svg \(ENOENT/);
    expect(message).toMatch(/G\.svg \(ENOENT/);
    expect(message).toMatch(/H\.svg \(file is empty\)/);
  });

  test('does not report a directory or an unreadable file as missing', () => {
    const dir = scratch();
    // A directory where a file should be: "missing C.svg" would send someone
    // looking for a path that is sitting right there.
    fs.rmSync(path.join(dir, 'mouth', 'C.svg'));
    fs.mkdirSync(path.join(dir, 'mouth', 'C.svg'));
    let message = '';
    try {
      readMouthSheet(path.join(dir, 'mouth'), VISEMES);
    } catch (error) {
      message = (error as Error).message;
    }
    // The errno is the OS's, not ours — assert it carried one, not which.
    expect(message).toMatch(/C\.svg \(E[A-Z]+/);
    expect(message).not.toMatch(/C\.svg \(ENOENT/);
  });

  test('refuses files the renderer would draw nothing from', () => {
    const dir = scratch();
    // Non-empty and still blank on screen. The runtime's parser draws a fixed
    // list of tags and silently returns zero nodes for anything else — no
    // throw, no non-zero exit, just a preview of an empty canvas that a
    // reviewer would score as the *engine's* failure.
    fs.writeFileSync(
      path.join(dir, 'mouth', 'D.svg'),
      '<svg viewBox="0 0 100 60"><text>D</text></svg>',
    );
    // Not SVG at all — an export that wrote an error page, say.
    fs.writeFileSync(
      path.join(dir, 'mouth', 'E.svg'),
      '<html><body>not an svg</body></html>',
    );
    // No canvas: nothing tells the runtime how big this mouth is.
    fs.writeFileSync(
      path.join(dir, 'mouth', 'F.svg'),
      '<svg><rect width="10" height="10"/></svg>',
    );
    let message = '';
    try {
      readMouthSheet(path.join(dir, 'mouth'), VISEMES);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/D\.svg \(nothing the renderer draws/);
    expect(message).toMatch(/E\.svg \(no <svg> root element\)/);
    expect(message).toMatch(/F\.svg \(root <svg> has neither viewBox nor/);
  });

  test('accepts a drawable nested in a group', () => {
    const dir = scratch();
    // The scan is structural, not a parse: a shape inside `<g>` counts, and
    // the tag may carry any attributes.
    fs.writeFileSync(
      path.join(dir, 'mouth', 'A.svg'),
      '<svg viewBox="0 0 100 60"><g transform="translate(2,2)">' +
        '<path d="M0 0 L10 10"/></g></svg>',
    );
    expect(() =>
      readMouthSheet(path.join(dir, 'mouth'), VISEMES),
    ).not.toThrow();
  });

  test('refuses a sheet whose mouths disagree on the canvas', () => {
    const dir = scratch();
    // Every mouth is drawn on one canvas or the mouth jumps at the cue that
    // hands over — which reads as the aligner being unstable, not as the
    // sheet being wrong.
    fs.writeFileSync(
      path.join(dir, 'mouth', 'C.svg'),
      '<svg viewBox="0 0 200 60"><rect id="C" width="200" height="60"/></svg>',
    );
    let message = '';
    try {
      readMouthSheet(path.join(dir, 'mouth'), VISEMES);
    } catch (error) {
      message = (error as Error).message;
    }
    // Names the odd one out and what each canvas is, so the fix is obvious
    // without opening nine files.
    expect(message).toMatch(/C\.svg \(0 0 200 60\)/);
    expect(message).toMatch(/A\.svg \(0 0 100 60\)/);
  });
});

describe('fantoche lipsync preview', () => {
  test('writes a document that validates and compiles', async () => {
    const dir = scratch(goodTrack());
    const out = path.join(dir, 'nested', 'preview.json');

    const result = await run(path.join(dir, 'track.json'), {
      mouths: path.join(dir, 'mouth'),
      out,
      fps: '30',
      size: '480x320',
    });
    expect(result.code).toBeNull();

    const written = JSON.parse(fs.readFileSync(out, 'utf8'));
    const {compileDocument, validateDocument} = await import(
      '@fantoche-dev/document'
    );
    const validation = validateDocument(written);
    expect(validation.ok).toBe(true);
    if (!validation.ok) {
      return;
    }
    expect(validation.doc.elements).toHaveLength(9);
    // The mouth markup came off disk, inline — not a src reference, which the
    // compiler rejects outright.
    expect(validation.doc.elements[1].props).toMatchObject({
      svg: expect.stringContaining('id="B"'),
    });
    const {ir} = compileDocument(validation.doc);
    expect(ir.tracks.every(t => t.keys.every(k => k.easing === 'hold'))).toBe(
      true,
    );
    expect(ir.fps).toBe(30);
    expect(ir.size).toEqual([480, 320]);
  });

  test('reports how many cues the frame rate swallowed', async () => {
    // 0.5 and 0.51 round onto frame 15 at 30fps; the second one is dropped.
    const dir = scratch(
      goodTrack([
        {t: 0, viseme: 'X'},
        {t: 0.5, viseme: 'B'},
        {t: 0.51, viseme: 'C'},
      ]),
    );
    const options = {
      mouths: path.join(dir, 'mouth'),
      out: path.join(dir, 'preview.json'),
      fps: '30',
      size: '480x320',
    };

    const lossy = await run(path.join(dir, 'track.json'), options);
    expect(lossy.out).toMatch(/3 cues, 1 collapsed at 30fps, engine rhubarb/);

    // Zero is reported too — "no loss" is a measurement, not silence.
    const dense = await run(path.join(dir, 'track.json'), {
      ...options,
      fps: '120',
    });
    expect(dense.out).toMatch(/3 cues, 0 collapsed at 120fps, engine rhubarb/);
  });

  test('refuses a file that is not a viseme track', async () => {
    const dir = scratch({version: '0.1', engine: 'rhubarb', cues: []});
    const out = path.join(dir, 'preview.json');
    const result = await run(path.join(dir, 'track.json'), {
      mouths: path.join(dir, 'mouth'),
      out,
      fps: '30',
      size: '480x320',
    });
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/track/i);
    expect(fs.existsSync(out)).toBe(false);
  });

  test('refuses a frame rate no document may carry', async () => {
    const dir = scratch(goodTrack());
    const out = path.join(dir, 'preview.json');
    const result = await run(path.join(dir, 'track.json'), {
      mouths: path.join(dir, 'mouth'),
      out,
      fps: '240',
      size: '480x320',
    });
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/--fps/);
    expect(fs.existsSync(out)).toBe(false);
  });

  test('refuses to overwrite the track it is reading', async () => {
    const dir = scratch(goodTrack());
    const trackPath = path.join(dir, 'track.json');
    const before = fs.readFileSync(trackPath, 'utf8');

    const result = await run(trackPath, {
      mouths: path.join(dir, 'mouth'),
      out: trackPath,
      fps: '30',
      size: '480x320',
    });
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/--out/);
    // The guard exists for the artifact, not the message: `--out track.json`
    // used to destroy the only copy of an alignment that costs a tool run to
    // reproduce, and exit 0 while doing it.
    expect(fs.readFileSync(trackPath, 'utf8')).toBe(before);

    // Spelled differently, same file. The comparison is between resolved
    // paths, not between the strings the user typed.
    const unnormalised = await run(trackPath, {
      mouths: path.join(dir, 'mouth'),
      out: `${dir}/mouth/../track.json`,
      fps: '30',
      size: '480x320',
    });
    expect(unnormalised.code).toBe(1);
    expect(fs.readFileSync(trackPath, 'utf8')).toBe(before);
  });

  test('says what went wrong when the output cannot be written', async () => {
    const dir = scratch(goodTrack());
    // --out under a path component that is a file: mkdir cannot make that
    // directory, and a raw ENOTDIR stack trace is not an answer.
    const out = path.join(dir, 'track.json', 'preview.json');
    const result = await run(path.join(dir, 'track.json'), {
      mouths: path.join(dir, 'mouth'),
      out,
      fps: '30',
      size: '480x320',
    });
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/Could not write/);
    expect(result.err).toContain(out);
  });

  test('never writes a document that does not validate', async () => {
    const dir = scratch(goodTrack());
    const out = path.join(dir, 'preview.json');
    // The builder's own guards make an invalid document unreachable through
    // the flags, which is the point — so the writer's last check is exercised
    // by handing it one directly. Without that check the file lands on disk
    // and the command exits 0.
    vi.doMock('@fantoche-dev/document', async () => {
      const actual = await vi.importActual<Record<string, unknown>>(
        '@fantoche-dev/document',
      );
      return {
        ...actual,
        buildVisemePreviewDocument: () => ({
          doc: {
            version: '0.1',
            meta: {fps: 30, size: [480, 320], duration: 0},
            elements: [],
            timeline: [],
          },
          collapsed: 0,
        }),
      };
    });
    try {
      const result = await run(path.join(dir, 'track.json'), {
        mouths: path.join(dir, 'mouth'),
        out,
        fps: '30',
        size: '480x320',
      });
      expect(result.code).toBe(1);
      // Reported in the same shape as a bad track: one indented pointer and
      // message per issue.
      expect(result.err).toMatch(/^ {2}\/meta\/duration: .+$/m);
      expect(fs.existsSync(out)).toBe(false);
    } finally {
      vi.doUnmock('@fantoche-dev/document');
      vi.resetModules();
    }
  });
});
