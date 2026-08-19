import {
  CHARACTER_ART_VERSION,
  characterArtSchema,
  characterSchema,
  type Character,
  type CharacterArt,
} from '@fantoche-dev/document';
import {splitArt} from '@fantoche-dev/document/import';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ImportReport {
  sidecarPath: string;
  orphans: string[];
}

/**
 * Minimal, non-interactive import (plan Task 16): split the art with the
 * character's binding table and write the render-ready `*.art.json` sidecar
 * to the path `character.art.src` names. No scaffolding, no bind loop, no
 * fuzzy hints — those are Part C ergonomics (Tasks 11–12). The SVG is never
 * modified (design notes §1).
 */
export function importCharacter(
  artPath: string,
  characterPath: string,
): ImportReport {
  const resolvedArtPath = path.resolve(artPath);
  const resolvedCharacterPath = path.resolve(characterPath);
  const character = parseCharacter(resolvedCharacterPath);
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

  const art = fs.readFileSync(resolvedArtPath, 'utf8');

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

  fs.writeFileSync(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`);
  return {sidecarPath, orphans: split.orphans};
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
