// Emits the published JSON Schema artifact. Run via `npm run schema:emit`
// (builds first — imports from dist).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHARACTER_FORMAT_VERSION} from '../dist/character/schema.js';
import {characterJsonSchema, documentJsonSchema} from '../dist/json-schema.js';
import {DOCUMENT_FORMAT_VERSION} from '../dist/version.js';

const outDir = path.resolve(
  fileURLToPath(import.meta.url),
  '..',
  '..',
  'schema',
);
fs.mkdirSync(outDir, {recursive: true});
const artifacts = [
  [`document-${DOCUMENT_FORMAT_VERSION}.schema.json`, documentJsonSchema],
  [`character-${CHARACTER_FORMAT_VERSION}.schema.json`, characterJsonSchema],
];
for (const [name, emit] of artifacts) {
  const outFile = path.join(outDir, name);
  fs.writeFileSync(outFile, `${JSON.stringify(emit(), null, 2)}\n`);
  console.log(`wrote ${outFile}`);
}
