import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

const CSS_FILES = [
  { src: 'src/assets/css/main.css', dest: '_site/assets/css/main.css' },
  { src: 'src/assets/css/admin.css', dest: '_site/assets/css/admin.css' },
];

const isProd = process.env.NODE_ENV === 'production';

const plugins = [
  autoprefixer(),
  ...(isProd ? [cssnano({ preset: 'default' })] : []),
];

const processor = postcss(plugins);

for (const { src, dest } of CSS_FILES) {
  try {
    const css = await readFile(src, 'utf8');
    const result = await processor.process(css, { from: src });
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, result.css);
    console.log(`  ✓ ${src} → ${dest}${isProd ? ' (minified)' : ''}`);
  } catch (e) {
    console.error(`  ✗ ${src} 构建失败:`, e.message);
    process.exit(1);
  }
}