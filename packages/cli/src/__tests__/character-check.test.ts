import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {afterEach, describe, expect, test} from 'vitest';
import {
  checkCharacter,
  printCharacterCheck,
  rankBindingCandidates,
} from '../character/check';

const ART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <g id="torso"><rect x="80" y="20" width="40" height="60"/></g>
  <g id="arm_x5F_l"><rect x="120" y="30" width="50" height="10"/></g>
  <g id="unrelated"><circle cx="20" cy="20" r="10"/></g>
</svg>`;

const CHARACTER = {
  version: '0.1',
  id: 'hero',
  art: {src: 'hero.art.json'},
  slots: {
    torso: {element: 'torso'},
    ['arm-l']: {element: 'arm-l', parent: 'torso'},
  },
  poses: {},
};

const dirs: string[] = [];
function makeFixture(
  character: unknown = CHARACTER,
  art = ART,
): {characterPath: string; artPath: string} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fantoche-check-'));
  dirs.push(dir);
  const characterPath = path.join(dir, 'character.json');
  const artPath = path.join(dir, 'hero.svg');
  fs.writeFileSync(characterPath, `${JSON.stringify(character, null, 2)}\n`);
  fs.writeFileSync(artPath, art);
  return {characterPath, artPath};
}

afterEach(() => {
  while (dirs.length > 0) {
    fs.rmSync(dirs.pop()!, {recursive: true, force: true});
  }
});

describe('checkCharacter', () => {
  test('reports bound, missing and orphaned bindings with a fuzzy hint', () => {
    const {characterPath, artPath} = makeFixture();
    const report = checkCharacter(characterPath);

    expect(report).toMatchObject({
      characterPath,
      artPath,
      ok: false,
      slots: [
        {slot: 'torso', element: 'torso', status: 'bound'},
        {
          slot: 'arm-l',
          element: 'arm-l',
          status: 'missing',
          suggestion: 'arm_x5F_l',
        },
      ],
      orphans: ['arm_x5F_l', 'unrelated'],
    });
  });

  test('normalises mangled ids and applies the 40% Levenshtein cutoff', () => {
    expect(
      rankBindingCandidates('arm-l', 'arm-l', [
        'unrelated',
        'arm_x5F_l',
        'arm-r',
      ]),
    ).toEqual(['arm_x5F_l', 'arm-r']);
    expect(
      rankBindingCandidates('mouth', 'mouth', ['totally-different']),
    ).toEqual([]);
  });

  test('prints a reusable report and returns exit code 1 while anything is unbound', () => {
    const {characterPath} = makeFixture();
    const lines: string[] = [];
    const code = printCharacterCheck(checkCharacter(characterPath), line =>
      lines.push(line),
    );

    expect(code).toBe(1);
    expect(lines.join('\n')).toMatch(/bound\s+torso.*torso/);
    expect(lines.join('\n')).toMatch(
      /missing\s+arm-l.*arm-l.*suggest.*arm_x5F_l/,
    );
    expect(lines.join('\n')).toMatch(/orphan\s+arm_x5F_l/);
  });

  test('is clean only when every slot and art id is bound', () => {
    const art = ART.replace(
      '  <g id="unrelated"><circle cx="20" cy="20" r="10"/></g>\n',
      '',
    );
    const character = structuredClone(CHARACTER) as any;
    character.slots['arm-l'].element = 'arm_x5F_l';
    const {characterPath} = makeFixture(character, art);
    const report = checkCharacter(characterPath);
    const lines: string[] = [];

    expect(report.ok).toBe(true);
    expect(report.orphans).toEqual([]);
    expect(printCharacterCheck(report, line => lines.push(line))).toBe(0);
    expect(lines.at(-1)).toMatch(/clean/i);
  });

  test('supports an explicit source SVG when it does not match the sidecar stem', () => {
    const {characterPath, artPath} = makeFixture();
    const renamed = path.join(path.dirname(artPath), 'export-v7.svg');
    fs.renameSync(artPath, renamed);

    expect(() => checkCharacter(characterPath)).toThrow(/--art/);
    expect(checkCharacter(characterPath, {artPath: renamed}).artPath).toBe(
      renamed,
    );
  });
});
