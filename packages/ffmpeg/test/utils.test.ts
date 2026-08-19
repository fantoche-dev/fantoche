import * as path from 'node:path';
import {describe, expect, test} from 'vitest';
import {resolvePath} from '../src/utils';

describe('resolvePath', () => {
  test('turns a Vite /@fs URL back into the source filesystem path', () => {
    const source = path.resolve('/tmp', 'narração com espaço.wav');
    const viteUrl = `/@fs/${encodeURI(source.split(path.sep).join('/'))}`;

    expect(resolvePath('/work/output', viteUrl)).toBe(source);
  });

  test('keeps the existing public-directory convention for relative assets', () => {
    expect(resolvePath('/work/output', 'voice.wav')).toBe(
      path.normalize('/work/public/voice.wav'),
    );
  });
});
