/**
 * Pure text helpers for code elements: RangeSpec → concrete ranges against a
 * given code string, and edit application. Mirrors the semantics of
 * `@fantoche-dev/2d`'s code/CodeRange.ts (0-based lines/columns, exclusive
 * end) without depending on the 2d package — the compiler must stay DOM-free.
 */
import type { CodePoint, CodeRange } from './ir.js';
import type { RangeSpec } from './schema.js';
export declare class CodeRangeError extends Error {
    constructor(message: string);
}
export declare function rangeToIndices(code: string, range: CodeRange): [number, number];
/** Expand a schema RangeSpec (with null sentinels) against a code string. */
export declare function resolveRangeSpec(spec: RangeSpec, code: string): CodeRange[];
export declare function applyReplace(code: string, range: CodeRange, text: string): string;
export declare function applyInsert(code: string, point: CodePoint, text: string): string;
//# sourceMappingURL=code-text.d.ts.map