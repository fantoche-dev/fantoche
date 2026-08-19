import {characterSchema, type Character} from '@fantoche-dev/document';
import {splitArt} from '@fantoche-dev/document/import';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {errorWithCause} from '../errors';

export interface CheckCharacterOptions {
  /** Source SVG. Defaults to the sidecar stem: `hero.art.json` → `hero.svg`. */
  artPath?: string;
}

export interface SlotBindingCheck {
  slot: string;
  element: string;
  status: 'bound' | 'missing';
  suggestion?: string;
}

export interface CharacterCheckReport {
  characterPath: string;
  artPath: string;
  slots: SlotBindingCheck[];
  orphans: string[];
  ok: boolean;
}

/**
 * Compare a character's binding table against its current source SVG.
 *
 * The source defaults to the convention established by `character import`:
 * a `hero.art.json` sidecar is generated from sibling `hero.svg`. `--art`
 * remains an escape hatch for older characters imported from another path.
 */
export function checkCharacter(
  characterPath: string,
  options: CheckCharacterOptions = {},
): CharacterCheckReport {
  const resolvedCharacterPath = path.resolve(characterPath);
  const character = readCharacter(resolvedCharacterPath);
  const artPath = resolveSourceArtPath(
    resolvedCharacterPath,
    character,
    options.artPath,
  );
  let art: string;
  try {
    art = fs.readFileSync(artPath, 'utf8');
  } catch (error) {
    throw errorWithCause(
      `could not read source SVG "${artPath}" — pass --art <art.svg> when it does not share the *.art.json stem`,
      error,
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
  const missing = new Set(split.missing);
  const slots = Object.entries(character.slots).map(
    ([slot, binding]): SlotBindingCheck => {
      if (!missing.has(slot)) {
        return {slot, element: binding.element, status: 'bound'};
      }
      const suggestion = rankBindingCandidates(
        slot,
        binding.element,
        split.orphans,
      )[0];
      return {
        slot,
        element: binding.element,
        status: 'missing',
        ...(suggestion === undefined ? {} : {suggestion}),
      };
    },
  );

  return {
    characterPath: resolvedCharacterPath,
    artPath,
    slots,
    orphans: split.orphans,
    ok: split.missing.length === 0 && split.orphans.length === 0,
  };
}

/** Print the structured report and return the CLI exit code it represents. */
export function printCharacterCheck(
  report: CharacterCheckReport,
  write: (line: string) => void = console.log,
): 0 | 1 {
  for (const slot of report.slots) {
    if (slot.status === 'bound') {
      write(`bound   ${slot.slot} -> ${slot.element}`);
    } else {
      write(
        `missing ${slot.slot} -> ${slot.element}` +
          (slot.suggestion === undefined
            ? ''
            : ` (suggest ${slot.suggestion})`),
      );
    }
  }
  for (const orphan of report.orphans) {
    write(`orphan  ${orphan}`);
  }
  if (report.ok) {
    write(`clean: ${report.slots.length} slot(s) bound`);
    return 0;
  }
  const missing = report.slots.filter(slot => slot.status === 'missing').length;
  write(`not clean: ${missing} missing, ${report.orphans.length} orphaned`);
  return 1;
}

/**
 * Rank plausible orphan bindings. Only candidates within the plan's 40%
 * Levenshtein threshold survive; exact normalised matches come first.
 */
export function rankBindingCandidates(
  slot: string,
  element: string,
  candidates: readonly string[],
): string[] {
  const needles = [
    ...new Set([normaliseBindingId(slot), normaliseBindingId(element)]),
  ].filter(value => value.length > 0);
  return candidates
    .map(candidate => {
      const normalised = normaliseBindingId(candidate);
      const scores = needles.map(needle => {
        const distance = levenshtein(needle, normalised);
        return {
          distance,
          ratio: distance / Math.max(needle.length, normalised.length, 1),
        };
      });
      const best = scores.sort(
        (a, b) => a.ratio - b.ratio || a.distance - b.distance,
      )[0] ?? {distance: Infinity, ratio: Infinity};
      return {candidate, ...best};
    })
    .filter(result => result.ratio <= 0.4)
    .sort(
      (a, b) =>
        a.ratio - b.ratio ||
        a.distance - b.distance ||
        a.candidate.localeCompare(b.candidate),
    )
    .map(result => result.candidate);
}

/** Exported for the binder and future editor to share exactly one scorer. */
export function normaliseBindingId(value: string): string {
  return value
    .replace(/_x5f_/gi, '_')
    .toLocaleLowerCase()
    .replace(/[_-]+/g, '');
}

function levenshtein(left: string, right: string): number {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;
  let previous = Array.from({length: right.length + 1}, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function readCharacter(characterPath: string): Character {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(characterPath, 'utf8'));
  } catch (error) {
    throw errorWithCause(`could not read character "${characterPath}"`, error);
  }
  const result = characterSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map(issue => `  /${issue.path.map(String).join('/')}: ${issue.message}`)
      .join('\n');
    throw new Error(`invalid character "${characterPath}":\n${details}`);
  }
  return result.data;
}

function resolveSourceArtPath(
  characterPath: string,
  character: Character,
  override: string | undefined,
): string {
  if (override !== undefined) {
    return path.resolve(override);
  }
  const sidecarPath = path.resolve(
    path.dirname(characterPath),
    character.art.src,
  );
  if (!/\.art\.json$/i.test(sidecarPath)) {
    throw new Error(
      `cannot infer the source SVG from "${character.art.src}" — pass --art <art.svg>`,
    );
  }
  return sidecarPath.replace(/\.art\.json$/i, '.svg');
}
