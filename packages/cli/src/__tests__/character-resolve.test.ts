import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {afterEach, describe, expect, test} from 'vitest';
import {resolveCastAssets} from '../character/resolve';

const CHARACTER = {
  version: '0.1',
  id: 'hero',
  art: {src: 'hero.art.json'},
  slots: {torso: {element: 'torso'}},
  poses: {},
};

const ART = {
  version: '0.1',
  centre: [100, 50],
  slots: {
    torso:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect/></svg>',
  },
  pivots: {torso: [100, 50]},
};

const TRACK = {
  version: '0.1',
  engine: 'manual',
  audio: 'voice.wav',
  language: 'pt-BR',
  cues: [
    {t: 0, viseme: 'X'},
    {t: 0.4, viseme: 'A'},
  ],
};

const dirs: string[] = [];
function makeFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fantoche-resolve-'));
  dirs.push(dir);
  fs.writeFileSync(
    path.join(dir, 'hero.character.json'),
    JSON.stringify(CHARACTER),
  );
  fs.writeFileSync(path.join(dir, 'hero.art.json'), JSON.stringify(ART));
  fs.writeFileSync(path.join(dir, 'mouth.viseme.json'), JSON.stringify(TRACK));
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) {
    fs.rmSync(dirs.pop()!, {recursive: true, force: true});
  }
});

describe('resolveCastAssets', () => {
  test('reads character + sidecar and lipsync tracks into compile options', () => {
    const dir = makeFixture();
    const doc = {
      assets: {
        hero: {type: 'character', src: 'hero.character.json'},
        mouth: {type: 'lipsync', src: 'mouth.viseme.json'},
      },
    };
    const resolved = resolveCastAssets(doc, dir);
    expect(resolved.characters.hero.character.id).toBe('hero');
    expect(resolved.characters.hero.art.centre).toEqual([100, 50]);
    expect(resolved.lipsync.mouth.cues).toHaveLength(2);
    expect(resolved.lipsync.mouth.engine).toBe('manual');
  });

  test('rejects a character asset whose id differs from the character id', () => {
    const dir = makeFixture();
    const doc = {
      assets: {ana: {type: 'character', src: 'hero.character.json'}},
    };
    expect(() => resolveCastAssets(doc, dir)).toThrow(/ana.*hero|hero.*ana/);
  });

  test('names the character when its sidecar is missing', () => {
    const dir = makeFixture();
    fs.rmSync(path.join(dir, 'hero.art.json'));
    const doc = {
      assets: {hero: {type: 'character', src: 'hero.character.json'}},
    };
    expect(() => resolveCastAssets(doc, dir)).toThrow(/hero\.art\.json/);
  });

  test('rejects an invalid viseme track with its schema errors', () => {
    const dir = makeFixture();
    fs.writeFileSync(
      path.join(dir, 'mouth.viseme.json'),
      JSON.stringify({...TRACK, cues: []}),
    );
    const doc = {assets: {mouth: {type: 'lipsync', src: 'mouth.viseme.json'}}};
    expect(() => resolveCastAssets(doc, dir)).toThrow(/mouth/);
  });

  test('ignores unrelated asset types and empty documents', () => {
    const resolved = resolveCastAssets(
      {assets: {pic: {type: 'image', src: 'x.png'}}},
      '/nowhere',
    );
    expect(resolved.characters).toEqual({});
    expect(resolved.lipsync).toEqual({});
    expect(resolveCastAssets({}, '/nowhere').characters).toEqual({});
  });
});
