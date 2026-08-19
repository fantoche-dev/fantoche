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
    // The plugin loads project.ts dynamically, so vite's startup crawl never
    // sees it: its deps used to be discovered on demand, in the first
    // optimize wave. When the project gained the @fantoche-dev/document
    // barrel import (character schemas → zod), that discovery slipped into a
    // SECOND wave — "optimized dependencies changed. reloading", 504
    // "Outdated Optimize Dep", and a page that never mounts `main` on a cold
    // CI start. Crawling the project at startup keeps every dep in wave one;
    // zod stays pinned as the barrel's only third-party dep.
    entries: [path.resolve(path.dirname(documentsDir), 'tests/project.ts')],
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
