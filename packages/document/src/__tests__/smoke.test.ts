import {describe, expect, test} from 'vitest';
import {DOCUMENT_FORMAT_VERSION} from '../index.js';

describe('package', () => {
  test('exports the format version', () => {
    expect(DOCUMENT_FORMAT_VERSION).toBe('0.1');
  });
});
