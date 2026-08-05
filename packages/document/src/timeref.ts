/**
 * Time references: a plain number of seconds, or a narration anchor string —
 * `segment.start`, `segment.end`, `segment.word:foo`, each optionally
 * suffixed with a signed offset in seconds (`intro.end+0.3`).
 *
 * Known v0 limitation: a word that literally ends in `+<number>` or
 * `-<number>` is parsed as an offset; no escaping mechanism yet.
 */

export const ANCHOR_RE =
  /^([A-Za-z_][A-Za-z0-9_-]*)\.(start|end|word:(\S+?))([+-]\d+(?:\.\d+)?)?$/;

export interface ParsedAnchor {
  segment: string;
  kind: 'start' | 'end' | 'word';
  word?: string;
  /** Signed offset in seconds; 0 when absent. */
  offset: number;
}

export function parseAnchor(ref: string): ParsedAnchor | null {
  const match = ANCHOR_RE.exec(ref);
  if (match === null) {
    return null;
  }
  const [, segment, selector, word, offset] = match;
  return {
    segment,
    kind: selector === 'start' || selector === 'end' ? selector : 'word',
    word,
    offset: offset === undefined ? 0 : Number(offset),
  };
}

export function isAnchorString(ref: string): boolean {
  return parseAnchor(ref) !== null;
}
