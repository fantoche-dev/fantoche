import {
  CHARACTER_ART_VERSION,
  characterArtSchema,
  characterSchema,
  type Character,
  type CharacterArt,
} from '@fantoche-dev/document';
import {listTopLevelGroupIds, splitArt} from '@fantoche-dev/document/import';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ImportReport {
  characterPath: string;
  createdCharacter: boolean;
  sidecarPath: string;
  orphans: string[];
}

/**
 * Split art with an existing character's binding table, or scaffold a new
 * character.json from the SVG's top-level groups before the first split.
 * The SVG is never modified (design notes §1).
 */
export function importCharacter(
  artPath: string,
  characterPath?: string,
): ImportReport {
  const resolvedArtPath = path.resolve(artPath);
  const resolvedCharacterPath = path.resolve(
    characterPath ?? path.join(path.dirname(resolvedArtPath), 'character.json'),
  );
  const art = fs.readFileSync(resolvedArtPath, 'utf8');
  const createdCharacter = !fs.existsSync(resolvedCharacterPath);
  if (
    createdCharacter &&
    path.dirname(resolvedCharacterPath) !== path.dirname(resolvedArtPath)
  ) {
    throw new Error(
      'a scaffolded character.json must live beside its source SVG so check/bind can find the art by convention',
    );
  }
  const scaffold = createdCharacter
    ? scaffoldCharacter(resolvedArtPath, art)
    : undefined;
  const character = scaffold?.parsed ?? parseCharacter(resolvedCharacterPath);
  const sidecarPath = path.resolve(
    path.dirname(resolvedCharacterPath),
    character.art.src,
  );
  refuseInputCollision(sidecarPath, resolvedArtPath, 'source art');
  refuseInputCollision(
    sidecarPath,
    resolvedCharacterPath,
    'character definition',
  );
  if (!/\.art\.json$/i.test(sidecarPath)) {
    throw new Error(
      `refusing to write non-sidecar path "${sidecarPath}" — character.art.src must end in *.art.json`,
    );
  }

  const split = splitArt(
    art,
    Object.fromEntries(
      Object.entries(character.slots).map(([slotId, slot]) => [
        slotId,
        {element: slot.element, pivot: slot.pivot},
      ]),
    ),
  );

  if (split.missing.length > 0) {
    throw new Error(
      `art "${path.basename(resolvedArtPath)}" has no element for ` +
        `slot(s): ${split.missing
          .map(
            slotId =>
              `"${slotId}" (element "${character.slots[slotId].element}")`,
          )
          .join(', ')}` +
        (split.orphans.length > 0
          ? ` — unbound art ids: ${split.orphans.join(', ')}`
          : ''),
    );
  }

  const sidecar: CharacterArt = characterArtSchema.parse({
    version: CHARACTER_ART_VERSION,
    centre: split.centre,
    slots: split.slots,
    pivots: split.pivots,
  });

  if (createdCharacter) {
    fs.writeFileSync(
      resolvedCharacterPath,
      `${JSON.stringify(scaffold!.source, null, 2)}\n`,
    );
  }
  fs.writeFileSync(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`);
  return {
    characterPath: resolvedCharacterPath,
    createdCharacter,
    sidecarPath,
    orphans: split.orphans,
  };
}

function scaffoldCharacter(
  artPath: string,
  art: string,
): {source: unknown; parsed: Character} {
  if (!/\.svg$/i.test(artPath)) {
    throw new Error(`character art must be an .svg file (got "${artPath}")`);
  }
  const groups = listTopLevelGroupIds(art);
  if (groups.length === 0) {
    throw new Error(
      `art "${path.basename(artPath)}" has no top-level group ids to scaffold as slots`,
    );
  }
  const used = new Set<string>();
  const slots: Record<string, {element: string}> = {};
  for (const element of groups) {
    const base = friendlyId(element, 'slot');
    let slot = base;
    let suffix = 2;
    while (used.has(slot)) {
      slot = `${base}-${suffix++}`;
    }
    used.add(slot);
    slots[slot] = {element};
  }
  const stem = path.basename(artPath).replace(/\.svg$/i, '');
  const source = {
    version: '0.1',
    id: friendlyId(stem, 'character'),
    art: {src: `${stem}.art.json`},
    slots,
    poses: {},
  };
  return {source, parsed: characterSchema.parse(source)};
}

function friendlyId(value: string, fallback: string): string {
  let id = value
    .replace(/_x5f_/gi, '-')
    .replace(/[_\s]+/g, '-')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (id === '') {
    id = fallback;
  }
  if (!/^[A-Za-z_]/.test(id)) {
    id = `${fallback}-${id}`;
  }
  return id;
}

function parseCharacter(characterPath: string): Character {
  const raw: unknown = JSON.parse(fs.readFileSync(characterPath, 'utf8'));
  const result = characterSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map(issue => `  /${issue.path.map(String).join('/')}: ${issue.message}`)
      .join('\n');
    throw new Error(`invalid character "${characterPath}":\n${details}`);
  }
  return result.data;
}

function refuseInputCollision(
  sidecarPath: string,
  inputPath: string,
  inputLabel: string,
): void {
  const canonical = (candidate: string) =>
    fs.existsSync(candidate)
      ? fs.realpathSync.native(candidate)
      : path.resolve(candidate);
  if (canonical(sidecarPath) === canonical(inputPath)) {
    throw new Error(
      `refusing to overwrite ${inputLabel} "${inputPath}" — character.art.src must name a separate *.art.json sidecar`,
    );
  }
}
