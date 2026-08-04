import preact from '@preact/preset-vite';
import {defineConfig} from 'vite';
import motionCanvas from '../vite-plugin/src/main';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@fantoche/ui',
        replacement: '@fantoche/ui/src/main.tsx',
      },
      {
        find: '@fantoche/2d/editor',
        replacement: '@fantoche/2d/src/editor',
      },
      {
        find: /@fantoche\/2d(\/lib)?/,
        replacement: '@fantoche/2d/src/lib',
      },
      {find: '@fantoche/core', replacement: '@fantoche/core/src'},
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
