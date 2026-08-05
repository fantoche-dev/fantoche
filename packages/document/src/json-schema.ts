import {z} from 'zod';
import {documentSchema} from './schema.js';

/**
 * The published JSON Schema for the document format — the artifact agents
 * and editors point their validators at. Emitted to
 * `schema/document-<version>.schema.json` by `npm run schema:emit`.
 */
export function documentJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(documentSchema, {
    target: 'draft-2020-12',
    io: 'input',
  }) as Record<string, unknown>;
}
