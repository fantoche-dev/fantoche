// Emits the published JSON Schema artifact. Run via `npm run schema:emit`
// (builds first — imports from dist).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DOCUMENT_FORMAT_VERSION} from '../dist/index.js';
import {documentJsonSchema} from '../dist/json-schema.js';

const outDir = path.resolve(
  fileURLToPath(import.meta.url),
  '..',
  '..',
  'schema',
);
fs.mkdirSync(outDir, {recursive: true});
const outFile = path.join(
  outDir,
  `document-${DOCUMENT_FORMAT_VERSION}.schema.json`,
);
fs.writeFileSync(outFile, `${JSON.stringify(documentJsonSchema(), null, 2)}\n`);
console.log(`wrote ${outFile}`);
