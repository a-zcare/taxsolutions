import { build } from 'esbuild';
await build({
  entryPoints: ['scripts/worker.ts'],
  outfile: 'dist/worker.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  target: 'node24',
  plugins: [
    {
      name: 'node-next-subpaths',
      setup(builder) {
        // Node ESM requires the actual extension for Next's legacy subpath modules.
        builder.onResolve({ filter: /^next\/headers$/ }, () => ({
          path: 'next/headers.js',
          external: true,
        }));
      },
    },
  ],
});
