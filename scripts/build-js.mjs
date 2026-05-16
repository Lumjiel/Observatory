import * as esbuild from 'esbuild';
import { readFile } from 'node:fs/promises';

const isProd = process.env.NODE_ENV === 'production';

const entries = [
  { in: 'src/assets/js/app.js', out: 'bundle' },
  { in: 'src/assets/js/admin-panel.js', out: 'admin-panel.bundle' },
];

for (const entry of entries) {
  await esbuild.build({
    entryPoints: [entry.in],
    outfile: `src/assets/js/${entry.out}.js`,
    bundle: true,
    minify: isProd,
    sourcemap: !isProd,
    format: 'esm',
    target: 'es2020',
    logLevel: 'warning',
  });
  console.log(`  ✓ ${entry.out}.js${isProd ? ' (minified)' : ''}`);
}