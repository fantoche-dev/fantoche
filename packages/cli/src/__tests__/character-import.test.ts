import {characterArtSchema} from '@fantoche-dev/document';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {afterEach, describe, expect, test} from 'vitest';
import {importCharacter} from '../character/import';

const ART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <g id="torso"><rect x="80" y="20" width="40" height="60"/></g>
  <g id="arm_x5F_l"><rect x="120" y="30" width="50" height="10"/></g>
  <circle id="pivot-arm-l" cx="122" cy="35" r="1"/>
</svg>`;

const CHARACTER = {
  version: '0.1',
  id: 'hero',
  art: {src: 'hero.art.json'},
  slots: {
    torso: {element: 'torso'},
    ['arm-l']: {element: 'arm_x5F_l', parent: 'torso'},
  },
  poses: {},
};

const dirs: string[] = [];
function makeFixture(
  character: unknown = CHARACTER,
  art = ART,
): {
  artPath: string;
  characterPath: string;
  sidecarPath: string;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fantoche-import-'));
  dirs.push(dir);
  const artPath = path.join(dir, 'hero.svg');
  const characterPath = path.join(dir, 'character.json');
  fs.writeFileSync(artPath, art);
  fs.writeFileSync(characterPath, `${JSON.stringify(character, null, 2)}\n`);
  return {artPath, characterPath, sidecarPath: path.join(dir, 'hero.art.json')};
}

afterEach(() => {
  while (dirs.length > 0) {
    fs.rmSync(dirs.pop()!, {recursive: true, force: true});
  }
});

describe('importCharacter', () => {
  test('writes a valid sidecar next to character.json, at art.src', () => {
    const {artPath, characterPath, sidecarPath} = makeFixture();
    const report = importCharacter(artPath, characterPath);

    expect(report.sidecarPath).toBe(sidecarPath);
    const sidecar = characterArtSchema.parse(
      JSON.parse(fs.readFileSync(sidecarPath, 'utf8')),
    );
    // Marker wins over the (defaulted) preset, in art coordinates.
    expect(sidecar.pivots['arm-l']).toEqual([122, 35]);
    // Centre comes from the art's viewBox.
    expect(sidecar.centre).toEqual([100, 50]);
    expect(Object.keys(sidecar.slots).sort()).toEqual(['arm-l', 'torso']);
    expect(sidecar.slots['arm-l']).toContain('<svg');
  });

  test('reports orphans without failing', () => {
    const character = structuredClone(CHARACTER) as any;
    delete character.slots['arm-l'];
    const {artPath, characterPath} = makeFixture(character);
    const report = importCharacter(artPath, characterPath);
    expect(report.orphans).toContain('arm_x5F_l');
  });

  test('fails loudly on a missing binding and writes nothing', () => {
    const character = structuredClone(CHARACTER) as any;
    character.slots.torso.element = 'nope';
    const {artPath, characterPath, sidecarPath} = makeFixture(character);
    expect(() => importCharacter(artPath, characterPath)).toThrow(/torso/);
    expect(fs.existsSync(sidecarPath)).toBe(false);
  });

  test('rejects an invalid character.json with the schema errors', () => {
    const character = structuredClone(CHARACTER) as any;
    character.slots.torso.parent = 'ghost';
    const {artPath, characterPath} = makeFixture(character);
    expect(() => importCharacter(artPath, characterPath)).toThrow(/ghost/);
  });

  test.each([
    ['source art', 'hero.svg'],
    ['character definition', 'character.json'],
  ])('never overwrites the %s when art.src collides', (_label, src) => {
    const character = structuredClone(CHARACTER) as any;
    character.art.src = src;
    const {artPath, characterPath} = makeFixture(character);
    const artBefore = fs.readFileSync(artPath, 'utf8');
    const characterBefore = fs.readFileSync(characterPath, 'utf8');

    expect(() => importCharacter(artPath, characterPath)).toThrow(
      /refusing to overwrite/,
    );
    expect(fs.readFileSync(artPath, 'utf8')).toBe(artBefore);
    expect(fs.readFileSync(characterPath, 'utf8')).toBe(characterBefore);
  });

  test('never overwrites an arbitrary non-sidecar file', () => {
    const character = structuredClone(CHARACTER) as any;
    character.art.src = 'notes.txt';
    const {artPath, characterPath} = makeFixture(character);
    const notesPath = path.join(path.dirname(characterPath), 'notes.txt');
    fs.writeFileSync(notesPath, 'keep me\n');

    expect(() => importCharacter(artPath, characterPath)).toThrow(
      /non-sidecar/,
    );
    expect(fs.readFileSync(notesPath, 'utf8')).toBe('keep me\n');
  });

  test('accepts a valid single-quoted viewBox via splitArt centre measurement', () => {
    const singleQuoted = ART.replace(
      'viewBox="0 0 200 100"',
      "viewBox='0 0 200 100'",
    );
    const {artPath, characterPath, sidecarPath} = makeFixture(
      CHARACTER,
      singleQuoted,
    );

    importCharacter(artPath, characterPath);
    const sidecar = characterArtSchema.parse(
      JSON.parse(fs.readFileSync(sidecarPath, 'utf8')),
    );
    expect(sidecar.centre).toEqual([100, 50]);
  });
});
