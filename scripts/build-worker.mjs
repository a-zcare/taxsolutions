import {build} from 'esbuild';
await build({entryPoints:['scripts/worker.ts'],outfile:'dist/worker.mjs',bundle:true,platform:'node',format:'esm',packages:'external',target:'node24'});
