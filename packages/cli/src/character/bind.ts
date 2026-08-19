import {characterSchema} from '@fantoche-dev/document';
import {findNodeAtLocation, parseTree} from 'jsonc-parser';
import * as fs from 'node:fs';
import {createInterface} from 'node:readline/promises';
import {checkCharacter, rankBindingCandidates} from './check';

export interface BindCharacterOptions {
  /** Source SVG override; see `character check --art`. */
  artPath?: string;
  /** Injectable prompt seam for CI and editor reuse. */
  ask?: (prompt: string) => Promise<string> | string;
}

export interface BindCharacterReport {
  updated: string[];
  skipped: string[];
}

/**
 * Interactively repair missing slot→element mappings without touching SVG or
 * reserialising character.json. Answers are collected first; a failed or
 * aborted session never leaves a half-written binding table.
 */
export async function bindCharacter(
  characterPath: string,
  options: BindCharacterOptions = {},
): Promise<BindCharacterReport> {
  const report = checkCharacter(characterPath, {artPath: options.artPath});
  const missing = report.slots.filter(slot => slot.status === 'missing');
  if (missing.length === 0) {
    return {updated: [], skipped: []};
  }

  const readline =
    options.ask === undefined
      ? createInterface({input: process.stdin, output: process.stdout})
      : undefined;
  const ask = options.ask ?? ((prompt: string) => readline!.question(prompt));
  const available = new Set(report.orphans);
  const bindings = new Map<string, string>();
  const skipped: string[] = [];

  try {
    for (const slot of missing) {
      const candidates = rankBindingCandidates(
        slot.slot,
        slot.element,
        [...available],
        Infinity,
      );
      while (true) {
        const choices = candidates
          .map((candidate, index) => `  ${index + 1}) ${candidate}`)
          .join('\n');
        const answer = (
          await ask(
            `Bind slot "${slot.slot}" (missing "${slot.element}"):\n` +
              (choices === '' ? '  (no orphan candidates)\n' : `${choices}\n`) +
              '  s) skip\n> ',
          )
        )
          .trim()
          .toLocaleLowerCase();
        if (answer === 's' || answer === 'skip') {
          skipped.push(slot.slot);
          break;
        }
        if (/^\d+$/.test(answer)) {
          const selected = candidates[Number(answer) - 1];
          if (selected !== undefined) {
            bindings.set(slot.slot, selected);
            available.delete(selected);
            break;
          }
        }
      }
    }
  } finally {
    readline?.close();
  }

  if (bindings.size > 0) {
    const original = fs.readFileSync(report.characterPath, 'utf8');
    const patched = patchElementBindings(original, bindings);
    const validation = characterSchema.safeParse(JSON.parse(patched));
    if (!validation.success) {
      const details = validation.error.issues
        .map(
          issue => `  /${issue.path.map(String).join('/')}: ${issue.message}`,
        )
        .join('\n');
      throw new Error(`refusing to write invalid character:\n${details}`);
    }
    fs.writeFileSync(report.characterPath, patched);
  }

  return {updated: [...bindings.keys()], skipped};
}

/** Replace only existing `slots.<id>.element` string tokens. */
function patchElementBindings(
  source: string,
  bindings: ReadonlyMap<string, string>,
): string {
  const root = parseTree(source);
  if (root === undefined) {
    throw new Error('could not locate the character JSON syntax tree');
  }
  const edits: {offset: number; length: number; content: string}[] = [];
  for (const [slot, element] of bindings) {
    const node = findNodeAtLocation(root, ['slots', slot, 'element']);
    if (node?.type !== 'string') {
      throw new Error(
        `could not locate string binding /slots/${slot}/element in character.json`,
      );
    }
    edits.push({
      offset: node.offset,
      length: node.length,
      content: JSON.stringify(element),
    });
  }

  let result = source;
  for (const edit of edits.sort((left, right) => right.offset - left.offset)) {
    result =
      result.slice(0, edit.offset) +
      edit.content +
      result.slice(edit.offset + edit.length);
  }
  return result;
}
