import { readFile, writeFile } from 'node:fs/promises';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

const CSS_FILES = [
  'src/assets/css/main.css',
  'src/assets/css/admin.css',
];

const isProd = process.env.NODE_ENV === 'production';

const plugins = [
  autoprefixer(),
  ...(isProd ? [cssnano({ preset: 'default' })] : []),
];

const processor = postcss(plugins);

for (const file of CSS_FILES) {
  const css = await readFile(file, 'utf8');
  const result = await processor.process(css, { from: file, to: file });
  await writeFile(file, result.css);
  console.log(`  ✓ ${file}${isProd ? ' (minified)' : ''}`);
}