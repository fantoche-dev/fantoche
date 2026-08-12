import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {afterEach, describe, expect, test, vi} from 'vitest';
import {lipsyncPreview, parseSize, readMouthSheet} from '../lipsync/command';

const VISEMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'];

const temporaries: string[] = [];

/** A scratch directory holding a mouth sheet and (optionally) a track. */
function scratch(track?: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fantoche-lipsync-'));
  temporaries.push(dir);
  fs.mkdirSync(path.join(dir, 'mouth'));
  for (const viseme of VISEMES) {
    fs.writeFileSync(
      path.join(dir, 'mouth', `${viseme}.svg`),
      `<svg viewBox="0 0 100 60"><text>${viseme}</text></svg>\n`,
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

describe('readMouthSheet', () => {
  test('reads one file per viseme, keyed by viseme', () => {
    const dir = scratch();
    const sheet = readMouthSheet(path.join(dir, 'mouth'), VISEMES);
    expect(Object.keys(sheet).sort()).toEqual([...VISEMES].sort());
    expect(sheet.B).toContain('<text>B</text>');
  });

  test('names every missing file at once', () => {
    const dir = scratch();
    fs.rmSync(path.join(dir, 'mouth', 'C.svg'));
    fs.rmSync(path.join(dir, 'mouth', 'G.svg'));
    expect(() => readMouthSheet(path.join(dir, 'mouth'), VISEMES)).toThrow(
      /C\.svg, G\.svg/,
    );
  });
});

describe('fantoche lipsync preview', () => {
  test('writes a document that validates and compiles', async () => {
    const dir = scratch({
      version: '0.1',
      engine: 'rhubarb',
      audio: 'pt-br-01.wav',
      language: 'pt-BR',
      cues: [
        {t: 0, viseme: 'X'},
        {t: 0.4, viseme: 'B'},
        {t: 0.9, viseme: 'F'},
      ],
    });
    const out = path.join(dir, 'nested', 'preview.json');

    await lipsyncPreview(path.join(dir, 'track.json'), {
      mouths: path.join(dir, 'mouth'),
      out,
      fps: '30',
      size: '480x320',
    });

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
      svg: expect.stringContaining('<text>B</text>'),
    });
    const {ir} = compileDocument(validation.doc);
    expect(ir.tracks.every(t => t.keys.every(k => k.easing === 'hold'))).toBe(
      true,
    );
    expect(ir.fps).toBe(30);
    expect(ir.size).toEqual([480, 320]);
  });

  test('refuses a file that is not a viseme track', async () => {
    const dir = scratch({version: '0.1', engine: 'rhubarb', cues: []});
    // The command reports and exits, exactly as `fantoche render` does; the
    // spy turns that exit into something a test can observe.
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('EXIT');
    }) as never);
    const errors: unknown[][] = [];
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation((...args: unknown[]) => {
        errors.push(args);
      });
    try {
      await expect(
        lipsyncPreview(path.join(dir, 'track.json'), {
          mouths: path.join(dir, 'mouth'),
          out: path.join(dir, 'preview.json'),
          fps: '30',
          size: '480x320',
        }),
      ).rejects.toThrow('EXIT');
      expect(exit).toHaveBeenCalledWith(1);
      expect(errors.flat().join('\n')).toMatch(/track/i);
      expect(fs.existsSync(path.join(dir, 'preview.json'))).toBe(false);
    } finally {
      exit.mockRestore();
      error.mockRestore();
    }
  });
});
