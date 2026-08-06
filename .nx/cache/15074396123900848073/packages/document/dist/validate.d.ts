import type { FantocheDocument } from './schema.js';
export interface ValidationError {
    /** JSON-pointer-ish path, e.g. "/elements/0/props/text". */
    path: string;
    message: string;
}
export type ValidateResult = {
    ok: true;
    doc: FantocheDocument;
} | {
    ok: false;
    errors: ValidationError[];
};
export declare function validateDocument(input: unknown): ValidateResult;
//# sourceMappingURL=validate.d.ts.map