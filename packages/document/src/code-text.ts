/**
 * Pure text helpers for code elements: RangeSpec → concrete ranges against a
 * given code string, and edit application. Mirrors the semantics of
 * `@fantoche-dev/2d`'s code/CodeRange.ts (0-based lines/columns, exclusive
 * end) without depending on the 2d package — the compiler must stay DOM-free.
 */
import type {CodePoint, CodeRange} from './ir.js';
import type {RangeSpec} from './schema.js';

export class CodeRangeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CodeRangeError';
  }
}

function pointToIndex(code: string, point: CodePoint): number {
  const [line, column] = point;
  const lines = code.split('\n');
  if (line === Infinity || line >= lines.length) {
    return code.length;
  }
  let index = 0;
  for (let i = 0; i < line; i++) {
    index += lines[i].length + 1;
  }
  const lineLength = lines[line].length;
  return (
    index + (column === Infinity ? lineLength : Math.min(column, lineLength))
  );
}

export function rangeToIndices(
  code: string,
  range: CodeRange,
): [number, number] {
  const from = pointToIndex(code, range[0]);
  const to = pointToIndex(code, range[1]);
  return from <= to ? [from, to] : [to, from];
}

function indexToPoint(code: string, index: number): CodePoint {
  const before = code.slice(0, index);
  const line = (before.match(/\n/g) ?? []).length;
  const lastNewline = before.lastIndexOf('\n');
  return [line, index - lastNewline - 1];
}

/** Expand a schema RangeSpec (with null sentinels) against a code string. */
export function resolveRangeSpec(spec: RangeSpec, code: string): CodeRange[] {
  if ('lines' in spec) {
    const [from, to] = spec.lines;
    return [
      [
        [from, 0],
        [to === null ? Infinity : to, Infinity],
      ],
    ];
  }
  if ('word' in spec) {
    const [line, column, length] =
      spec.word.length === 3 ? spec.word : [...spec.word, null];
    return [
      [
        [line, column],
        [
          line,
          length === null || length === undefined ? Infinity : column + length,
        ],
      ],
    ];
  }
  const matches: CodeRange[] = [];
  let searchIndex = 0;
  for (;;) {
    const found = code.indexOf(spec.match, searchIndex);
    if (found === -1) {
      break;
    }
    matches.push([
      indexToPoint(code, found),
      indexToPoint(code, found + spec.match.length),
    ]);
    searchIndex = found + Math.max(spec.match.length, 1);
  }
  if (matches.length === 0) {
    throw new CodeRangeError(`pattern "${spec.match}" not found in code`);
  }
  switch (spec.which) {
    case 'all':
      return matches;
    case 'last':
      return [matches[matches.length - 1]];
    default:
      return [matches[0]];
  }
}

export function applyReplace(
  code: string,
  range: CodeRange,
  text: string,
): string {
  const [from, to] = rangeToIndices(code, range);
  return code.slice(0, from) + text + code.slice(to);
}

export function applyInsert(
  code: string,
  point: CodePoint,
  text: string,
): string {
  const index = pointToIndex(code, point);
  return code.slice(0, index) + text + code.slice(index);
}
