import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'src/lib/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      {
        resolveId(id) {
          if (id.startsWith('@fantoche-dev/core')) {
            return {
              id: '@fantoche-dev/core',
              external: true,
            };
          }
        },
      },
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './src/lib/tsconfig.json',
        compilerOptions: {
          composite: false,
          // The lib tsconfig emits declarations into lib/; the bundle only
          // needs plain JS routed to dist/.
          outDir: 'dist',
          declaration: false,
          declarationMap: false,
          incremental: false,
        },
      }),
      terser(),
    ],
  },
];
