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
  const character = parseCharacter(characterPath);
  const art = fs.readFileSync(artPath, 'utf8');

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
      `art "${path.basename(artPath)}" has no element for ` +
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
    centre: viewBoxCentre(art, artPath),
    slots: split.slots,
    pivots: split.pivots,
  });

  const sidecarPath = path.resolve(
    path.dirname(characterPath),
    character.art.src,
  );
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

function viewBoxCentre(art: string, artPath: string): [number, number] {
  const match = /viewBox\s*=\s*"([^"]+)"/.exec(art);
  const values = match?.[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    values === undefined ||
    values.length !== 4 ||
    values.some(Number.isNaN)
  ) {
    throw new Error(
      `art "${path.basename(artPath)}" has no usable viewBox — the sidecar's centre comes from it`,
    );
  }
  return [values[0] + values[2] / 2, values[1] + values[3] / 2];
}
