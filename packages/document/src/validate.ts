import type {ZodError} from 'zod';
import type {FantocheDocument} from './schema.js';
import {documentSchema} from './schema.js';

export interface ValidationError {
  /** JSON-pointer-ish path, e.g. "/elements/0/props/text". */
  path: string;
  message: string;
}

export type ValidateResult =
  | {ok: true; doc: FantocheDocument}
  | {ok: false; errors: ValidationError[]};

export function validateDocument(input: unknown): ValidateResult {
  const result = documentSchema.safeParse(input);
  if (result.success) {
    return {ok: true, doc: result.data};
  }
  return {ok: false, errors: flattenIssues(result.error)};
}

type Issue = ZodError['issues'][number];

function flattenIssues(error: ZodError): ValidationError[] {
  const out: ValidationError[] = [];
  const walk = (issues: readonly Issue[], prefix: readonly PropertyKey[]) => {
    for (const issue of issues) {
      const path = [...prefix, ...issue.path];
      const unionErrors = (issue as {errors?: Issue[][]}).errors;
      if (issue.code === 'invalid_union' && Array.isArray(unionErrors)) {
        for (const branch of unionErrors) {
          walk(branch, path);
        }
      } else {
        out.push({
          path: `/${path.map(String).join('/')}`,
          message: issue.message,
        });
      }
    }
  };
  walk(error.issues, []);
  return out;
}
