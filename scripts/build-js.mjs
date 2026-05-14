import * as esbuild from 'esbuild';
import fs from 'fs';

const isWatch = process.argv.includes('--watch');
const minify = process.env.NODE_ENV === 'production';
const sourcemap = process.env.NODE_ENV !== 'production';

// 检查文件是否是未打包的 ES module 源文件（源文件以 import 开头，IIFE 以 ( 开头）
function isEsmSource(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.startsWith("import");
  } catch { return false; }
}

async function build() {
    // 前台 app.js → bundle.js
    await esbuild.build({
        entryPoints: ['src/assets/js/app.js'],
        bundle: true,
        outfile: 'src/assets/js/bundle.js',
        format: 'iife',
        minify,
        sourcemap,
        target: ['es2020'],
        logLevel: 'info',
    });

    // 管理后台：从 admin-panel.src.js → admin-panel.bundle.js
    // 注意：watch 模式不包含 admin-panel，因为 esbuild 的 outdir 会覆盖源文件
    // 如果需要重构建 admin-panel，运行 node scripts/build-js.mjs
    const adminSrc = 'src/assets/js/admin-panel.src.js';
    const adminOut = 'src/assets/js/admin-panel.bundle.js';
    if (isEsmSource(adminSrc)) {
        await esbuild.build({
            entryPoints: [adminSrc],
            bundle: true,
            outfile: adminOut,
            format: 'iife',
            minify,
            sourcemap,
            target: ['es2020'],
            logLevel: 'info',
        });
    }
}

if (isWatch) {
    // 只监听前台 app.js，admin-panel 需手动执行 node scripts/build-js.mjs 构建
    const ctx = await esbuild.context({
        entryPoints: ['src/assets/js/app.js'],
        bundle: true,
        outfile: 'src/assets/js/bundle.js',
        format: 'iife',
        minify,
        sourcemap,
        target: ['es2020'],
        logLevel: 'info',
    });
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await build();
}