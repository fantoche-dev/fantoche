import {describe, expect, test} from 'vitest';
import {DOCUMENT_FORMAT_VERSION} from '../index.js';
import {MigrationError, migrateDocument} from '../migrate.js';
import {validateDocument} from '../validate.js';
import {fullDocument} from './fixtures.js';

const current = {
  version: DOCUMENT_FORMAT_VERSION,
  meta: {fps: 30, size: [640, 360]},
  elements: [],
  timeline: [],
};

describe('migrateDocument', () => {
  test('current version passes through untouched', () => {
    const {doc, applied} = migrateDocument(current);
    expect(applied).toEqual([]);
    expect(doc).toEqual(current);
  });

  test('is idempotent', () => {
    const once = migrateDocument(current);
    const twice = migrateDocument(once.doc);
    expect(twice.doc).toEqual(once.doc);
    expect(twice.applied).toEqual([]);
  });

  test('rejects unknown versions with a typed error', () => {
    expect(() => migrateDocument({...current, version: '9.9'})).toThrow(
      MigrationError,
    );
    expect(() => migrateDocument({no: 'version'})).toThrow(MigrationError);
  });

  test('migrated output round-trips through validate + JSON serialization', () => {
    for (const fixture of [current, fullDocument]) {
      const {doc} = migrateDocument(fixture);
      const reparsed = JSON.parse(JSON.stringify(doc));
      const result = validateDocument(reparsed);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(JSON.parse(JSON.stringify(result.doc))).toEqual(reparsed);
      }
    }
  });
});
