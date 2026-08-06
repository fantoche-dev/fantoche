/**
 * Time references: a plain number of seconds, or a narration anchor string —
 * `segment.start`, `segment.end`, `segment.word:foo`, each optionally
 * suffixed with a signed offset in seconds (`intro.end+0.3`).
 *
 * Known v0 limitation: a word that literally ends in `+<number>` or
 * `-<number>` is parsed as an offset; no escaping mechanism yet.
 */
export declare const ANCHOR_RE: RegExp;
export interface ParsedAnchor {
    segment: string;
    kind: 'start' | 'end' | 'word';
    word?: string;
    /** Signed offset in seconds; 0 when absent. */
    offset: number;
}
export declare function parseAnchor(ref: string): ParsedAnchor | null;
export declare function isAnchorString(ref: string): boolean;
//# sourceMappingURL=timeref.d.ts.map