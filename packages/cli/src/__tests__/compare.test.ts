import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {afterEach, describe, expect, test, vi} from 'vitest';
import {assignBlindSides, lipsyncCompare} from '../lipsync/compare';

const temporaries: string[] = [];

function scratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fantoche-compare-'));
  temporaries.push(dir);
  const mouths = path.join(dir, 'mouths');
  fs.mkdirSync(mouths);
  for (const viseme of 'ABCDEFGHX') {
    fs.writeFileSync(
      path.join(mouths, `${viseme}.svg`),
      `<svg viewBox="0 0 100 60"><rect width="100" height="60"/></svg>`,
    );
  }
  fs.writeFileSync(path.join(dir, 'voice.wav'), 'fixture');
  return dir;
}

function writeTrack(
  dir: string,
  name: string,
  engine: 'rhubarb' | 'whisperx',
  cues = [
    {t: 0, viseme: 'X'},
    {t: 0.2, viseme: engine === 'rhubarb' ? 'B' : 'C'},
  ],
): string {
  const file = path.join(dir, name);
  fs.writeFileSync(
    file,
    JSON.stringify({
      version: '0.1',
      engine,
      audio: 'voice.wav',
      language: 'pt',
      cues,
    }),
  );
  return file;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of temporaries.splice(0)) {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

describe('blind assignment', () => {
  test('is deterministic and independent of argument order', () => {
    expect(assignBlindSides('/tmp/rhubarb.json', '/tmp/whisperx.json')).toEqual(
      assignBlindSides('/tmp/whisperx.json', '/tmp/rhubarb.json'),
    );
  });

  test('refuses equal basenames that cannot seed a unique key', () => {
    expect(() => assignBlindSides('/a/track.json', '/b/track.json')).toThrow(
      /different basenames/,
    );
  });
});

describe('lipsync comparison harness', () => {
  test('writes blinded videos and keeps the engines only in key.json', async () => {
    const dir = scratch();
    const a = writeTrack(dir, 'rhubarb.viseme.json', 'rhubarb');
    const b = writeTrack(dir, 'whisperx.viseme.json', 'whisperx');
    const out = path.join(dir, 'comparison');
    const render = vi.fn(
      async (_doc: string, options: {out?: string; outDir?: string}) => {
        fs.writeFileSync(
          path.join(options.outDir!, options.out!),
          'silent-video',
        );
        fs.writeFileSync(
          path.join(options.outDir!, options.out!.replace(/\.mp4$/, '-0.mp4')),
          'renderer-fragment',
        );
      },
    );
    const mux = vi.fn(
      async (_video: string, _audio: string, output: string) => {
        fs.writeFileSync(output, 'muxed-video');
      },
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await lipsyncCompare(
      a,
      b,
      {
        mouths: path.join(dir, 'mouths'),
        audio: path.join(dir, 'voice.wav'),
        out,
        fps: '60',
        size: '480x320',
      },
      {render: render as never, mux},
    );

    expect(fs.readFileSync(path.join(out, 'left.mp4'), 'utf8')).toBe(
      'muxed-video',
    );
    expect(fs.readFileSync(path.join(out, 'right.mp4'), 'utf8')).toBe(
      'muxed-video',
    );
    expect(fs.existsSync(path.join(out, '.left.doc.json'))).toBe(false);
    expect(fs.existsSync(path.join(out, '.left.silent.mp4'))).toBe(false);
    expect(fs.existsSync(path.join(out, '.left.muxed.mp4'))).toBe(false);
    expect(fs.existsSync(path.join(out, '.left.silent-0.mp4'))).toBe(false);
    const key = JSON.parse(fs.readFileSync(path.join(out, 'key.json'), 'utf8'));
    expect(new Set([key.left.engine, key.right.engine])).toEqual(
      new Set(['rhubarb', 'whisperx']),
    );
    expect(key.left.collapsed).toBeTypeOf('number');
    expect(log.mock.calls.flat().join(' ')).not.toMatch(/rhubarb|whisperx/);
    expect(log.mock.calls.flat().join(' ')).toMatch(
      /Frame-collapse check: zero in both arms/,
    );
  });

  test('refuses a comparison that is not between the two arms', async () => {
    const dir = scratch();
    const a = writeTrack(dir, 'a.json', 'rhubarb');
    const b = writeTrack(dir, 'b.json', 'rhubarb');
    await expect(
      lipsyncCompare(a, b, {
        mouths: path.join(dir, 'mouths'),
        audio: path.join(dir, 'voice.wav'),
        out: path.join(dir, 'comparison'),
        fps: '60',
        size: '480x320',
      }),
    ).rejects.toThrow(/two different engines/);
  });

  test('refuses to mux audio the tracks were not derived from', async () => {
    const dir = scratch();
    const a = writeTrack(dir, 'a.json', 'rhubarb');
    const b = writeTrack(dir, 'b.json', 'whisperx');
    const otherAudio = path.join(dir, 'other.wav');
    fs.writeFileSync(otherAudio, 'other');
    await expect(
      lipsyncCompare(a, b, {
        mouths: path.join(dir, 'mouths'),
        audio: otherAudio,
        out: path.join(dir, 'comparison'),
        fps: '60',
        size: '480x320',
      }),
    ).rejects.toThrow(/was derived from/);
  });

  test('aborts before rendering when either arm loses cues to frame rounding', async () => {
    const dir = scratch();
    const a = writeTrack(dir, 'a.json', 'rhubarb', [
      {t: 0, viseme: 'X'},
      {t: 0.001, viseme: 'B'},
    ]);
    const b = writeTrack(dir, 'b.json', 'whisperx');
    const render = vi.fn();

    await expect(
      lipsyncCompare(
        a,
        b,
        {
          mouths: path.join(dir, 'mouths'),
          audio: path.join(dir, 'voice.wav'),
          out: path.join(dir, 'comparison'),
          fps: '60',
          size: '480x320',
        },
        {render: render as never},
      ),
    ).rejects.toThrow(/increase --fps before scoring/);
    expect(render).not.toHaveBeenCalled();
  });
});
