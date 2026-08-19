import {characterArtSchema, characterSchema} from '@fantoche-dev/document';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {afterEach, describe, expect, test} from 'vitest';
import {bindCharacter} from '../character/bind';
import {importCharacter} from '../character/import';

const ART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140">
  <g id="torso">
    <rect x="90" y="30" width="60" height="90"/>
    <g id="torso-detail"><circle cx="120" cy="60" r="8"/></g>
  </g>
  <g id="arm_x5F_l"><rect x="145" y="45" width="60" height="12"/></g>
  <g id="hand-new"><circle cx="210" cy="51" r="10"/></g>
</svg>`;

const dirs: string[] = [];
function makeDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fantoche-bind-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) {
    fs.rmSync(dirs.pop()!, {recursive: true, force: true});
  }
});

describe('bindCharacter', () => {
  test('drives the interactive loop without a TTY and changes only selected element bytes', async () => {
    const dir = makeDir();
    const artPath = path.join(dir, 'hero.svg');
    const characterPath = path.join(dir, 'character.json');
    const original = [
      '{',
      '\t"version": "0.1",',
      '\t"id": "hero",',
      '\t"art": {"src":"hero.art.json"},',
      '\t"slots": {',
      '\t\t"torso": {"element":"torso"},',
      '\t\t"arm-l": {"element": "arm-l", "parent":"torso"},',
      '\t\t"hand-l": {"element":"hand-old","parent":"arm-l"}',
      '\t},',
      '\t"poses": {}',
      '}',
      '',
    ].join('\r\n');
    fs.writeFileSync(artPath, ART);
    fs.writeFileSync(characterPath, original);
    const answers = ['1', 's'];
    const prompts: string[] = [];
    const artBefore = fs.readFileSync(artPath, 'utf8');

    const report = await bindCharacter(characterPath, {
      ask: async prompt => {
        prompts.push(prompt);
        return answers.shift() ?? 's';
      },
    });

    expect(report).toEqual({updated: ['arm-l'], skipped: ['hand-l']});
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toMatch(/arm-l[\s\S]*1.*arm_x5F_l/);
    expect(fs.readFileSync(characterPath, 'utf8')).toBe(
      original.replace('"element": "arm-l"', '"element": "arm_x5F_l"'),
    );
    expect(fs.readFileSync(artPath, 'utf8')).toBe(artBefore);
  });

  test('accepts a corrected binding and becomes byte-idempotent on the next run', async () => {
    const dir = makeDir();
    const artPath = path.join(dir, 'hero.svg');
    const characterPath = path.join(dir, 'character.json');
    fs.writeFileSync(artPath, ART);
    fs.writeFileSync(
      characterPath,
      `${JSON.stringify(
        {
          version: '0.1',
          id: 'hero',
          art: {src: 'hero.art.json'},
          slots: {
            torso: {element: 'torso'},
            ['arm-l']: {element: 'arm-l', parent: 'torso'},
            ['hand-l']: {element: 'hand-new', parent: 'arm-l'},
          },
          poses: {},
        },
        null,
        2,
      )}\n`,
    );

    await bindCharacter(characterPath, {ask: async () => '1'});
    const first = fs.readFileSync(characterPath, 'utf8');
    const second = await bindCharacter(characterPath, {
      ask: async () => {
        throw new Error('a clean character must not prompt');
      },
    });

    expect(second).toEqual({updated: [], skipped: []});
    expect(fs.readFileSync(characterPath, 'utf8')).toBe(first);
  });
});

describe('importCharacter scaffolding', () => {
  test('creates character.json from top-level group ids and writes a valid sidecar', () => {
    const dir = makeDir();
    const artPath = path.join(dir, 'hero.svg');
    fs.writeFileSync(artPath, ART);
    const artBefore = fs.readFileSync(artPath, 'utf8');

    const report = importCharacter(artPath);

    expect(report).toMatchObject({
      characterPath: path.join(dir, 'character.json'),
      createdCharacter: true,
      sidecarPath: path.join(dir, 'hero.art.json'),
      orphans: [],
    });
    const rawCharacter = JSON.parse(
      fs.readFileSync(report.characterPath, 'utf8'),
    );
    expect(rawCharacter.slots.torso).toEqual({element: 'torso'});
    const character = characterSchema.parse(rawCharacter);
    expect(character.id).toBe('hero');
    expect(character.slots).toMatchObject({
      torso: {element: 'torso'},
      ['arm-l']: {element: 'arm_x5F_l'},
      ['hand-new']: {element: 'hand-new'},
    });
    expect(character.slots).not.toHaveProperty('torso-detail');
    characterArtSchema.parse(
      JSON.parse(fs.readFileSync(report.sidecarPath, 'utf8')),
    );
    expect(fs.readFileSync(artPath, 'utf8')).toBe(artBefore);
  });

  test('refuses to scaffold an empty character from art without top-level group ids', () => {
    const dir = makeDir();
    const artPath = path.join(dir, 'empty.svg');
    const characterPath = path.join(dir, 'character.json');
    fs.writeFileSync(
      artPath,
      '<svg xmlns="http://www.w3.org/2000/svg"><rect id="loose" width="10" height="10"/></svg>',
    );

    expect(() => importCharacter(artPath)).toThrow(/top-level.*group/i);
    expect(fs.existsSync(characterPath)).toBe(false);
  });
});
