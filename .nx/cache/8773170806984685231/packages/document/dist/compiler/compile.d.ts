import type { CodeRange, TimelineIR } from '../ir.js';
import type { FantocheDocument } from '../schema.js';
export declare class CompileError extends Error {
    /** JSON-pointer-ish location in the source document. */
    readonly path: string;
    constructor(message: string, 
    /** JSON-pointer-ish location in the source document. */
    path: string);
}
export interface CompileResult {
    ir: TimelineIR;
    warnings: string[];
}
/** The whole code is "selected" — nothing is dimmed. */
export declare const FULL_SELECTION: CodeRange[];
export declare function compileDocument(doc: FantocheDocument): CompileResult;
//# sourceMappingURL=compile.d.ts.map