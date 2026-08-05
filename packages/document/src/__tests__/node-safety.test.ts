import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {describe, expect, test} from 'vitest';

// The root barrel must stay importable by PLAIN node ESM — no transitive
// import of the core package, whose built lib only resolves under CJS
// require or a bundler. The CLI (and any agent tooling) depends on this.
describe('node-safety', () => {
  test('dist/index.js imports in plain node', () => {
    const dist = resolve(import.meta.dirname, '../../dist/index.js');
    const script = `import(${JSON.stringify(dist)}).then(m => {
      if (typeof m.validateDocument !== 'function') throw new Error('missing API');
      console.log('NODE-SAFE');
    });`;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '-e', script],
      {
        encoding: 'utf8',
      },
    );
    expect(output).toContain('NODE-SAFE');
  });
});
