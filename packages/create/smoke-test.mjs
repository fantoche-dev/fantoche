// Temporary smoke-test wrapper: injects prompt answers, then runs the scaffolder.
import prompts from 'prompts';

const target = process.argv[2];
if (!target) {
  console.error('usage: node smoke-test.mjs <target-dir> [--default]');
  process.exit(1);
}
prompts.inject(['smoke-proj', target]);
await import('./index.js');
