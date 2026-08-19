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
  optimizeDeps: {
    // project.ts imports the @fantoche-dev/document barrel (for the character
    // schemas), whose only third-party dep is zod. Without pre-bundling it,
    // vite discovers zod mid-run, re-optimizes, and the page 504s
    // ("Outdated Optimize Dep") before `main` ever mounts — which is how the
    // CI e2e job died the first time this import landed.
    include: ['zod'],
  },
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
