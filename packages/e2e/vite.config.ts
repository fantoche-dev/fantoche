/// <reference types="vitest" />

import motionCanvas from '@fantoche-dev/vite-plugin';
import * as path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';

// Corpus documents reference assets relative to themselves; serving the
// documents dir as publicDir makes './assets/…' resolve in the e2e page.
const documentsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'documents',
);

export default defineConfig({
  publicDir: documentsDir,
  plugins: [
    motionCanvas.default({
      project: ['./tests/project.ts'],
    }),
  ],
  test: {
    // The editor and render pipeline are transformed on demand by the Vite dev
    // server on first load, which is slow when cold; allow generous headroom.
    hookTimeout: 120000,
    testTimeout: 180000,
  },
});
