import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, test} from 'vitest';
import {documentJsonSchema} from '../json-schema.js';
import {DOCUMENT_FORMAT_VERSION} from '../version.js';

describe('published JSON Schema artifact', () => {
  test('the committed artifact matches the zod schema (no drift)', () => {
    const committed = JSON.parse(
      readFileSync(
        resolve(
          import.meta.dirname,
          `../../schema/document-${DOCUMENT_FORMAT_VERSION}.schema.json`,
        ),
        'utf8',
      ),
    );
    expect(documentJsonSchema()).toEqual(committed);
  });

  test('tuples carry exact lengths', () => {
    const schema = JSON.stringify(documentJsonSchema());
    expect(schema).toContain('"maxItems"');
    const meta = (documentJsonSchema() as any).properties.meta.properties.size;
    expect(meta.minItems).toBe(2);
    expect(meta.maxItems).toBe(2);
    expect(meta.items).toBe(false);
  });

  test('the anchor grammar survives as a pattern', () => {
    expect(JSON.stringify(documentJsonSchema())).toContain('word:');
  });

  test('has a stable id, title and element definition name', () => {
    const schema = documentJsonSchema() as any;
    expect(schema.$id).toContain(`document-${DOCUMENT_FORMAT_VERSION}`);
    expect(schema.title).toContain(DOCUMENT_FORMAT_VERSION);
    expect(JSON.stringify(schema)).not.toContain('__schema');
  });
});
