import preact from '@preact/preset-vite';
import {defineConfig} from 'vite';
import motionCanvas from '../vite-plugin/src/main';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@fantoche-dev/ui',
        replacement: '@fantoche-dev/ui/src/main.tsx',
      },
      {
        find: '@fantoche-dev/2d/editor',
        replacement: '@fantoche-dev/2d/src/editor',
      },
      {
        find: /@fantoche-dev\/2d(\/lib)?/,
        replacement: '@fantoche-dev/2d/src/lib',
      },
      {find: '@fantoche-dev/core', replacement: '@fantoche-dev/core/src'},
    ],
  },
  plugins: [
    preact({
      include: [
        /packages\/ui\/src\/(.*)\.tsx?$/,
        /packages\/2d\/src\/editor\/(.*)\.tsx?$/,
      ],
    }),
    motionCanvas({
      buildForEditor: false,
    }),
  ],
  build: {
    minify: false,
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});
