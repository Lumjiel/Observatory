import * as esbuild from 'esbuild';
import { readFile } from 'node:fs/promises';

const isProd = process.env.NODE_ENV === 'production';

const entries = [
  { in: 'src/assets/js/app.js', out: 'bundle', format: 'esm' },
  { in: 'src/assets/js/admin-panel.js', out: 'admin-panel.bundle', format: 'iife' },
];

for (const entry of entries) {
  try {
    await esbuild.build({
      entryPoints: [entry.in],
      outfile: `src/assets/js/${entry.out}.js`,
      bundle: true,
      minify: isProd,
      sourcemap: !isProd,
      format: entry.format,
      target: 'es2020',
      logLevel: 'warning',
    });
    console.log(`  ✓ ${entry.out}.js${isProd ? ' (minified)' : ''}`);
  } catch (e) {
    console.error(`  ✗ ${entry.out}.js 构建失败:`, e.message);
    process.exit(1);
  }
}