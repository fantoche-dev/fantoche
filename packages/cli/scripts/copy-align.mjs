import {copyFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const source = fileURLToPath(
  new URL('../../../scripts/align.py', import.meta.url),
);
const destination = fileURLToPath(
  new URL('../dist/scripts/align.py', import.meta.url),
);

await mkdir(path.dirname(destination), {recursive: true});
await copyFile(source, destination);
