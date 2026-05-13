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

    // 管理后台：仅当 admin-panel.js 是源文件时才打包
    const adminFile = 'src/assets/js/admin-panel.js';
    if (isEsmSource(adminFile)) {
        await esbuild.build({
            entryPoints: [adminFile],
            bundle: true,
            outfile: adminFile,
            format: 'iife',
            minify,
            sourcemap,
            target: ['es2020'],
            logLevel: 'info',
            allowOverwrite: true,
        });
    }
}

if (isWatch) {
    const entryPoints = ['src/assets/js/app.js'];
    if (isEsmSource('src/assets/js/admin-panel.js')) {
        entryPoints.push('src/assets/js/admin-panel.js');
    }
    const ctx = await esbuild.context({
        entryPoints,
        bundle: true,
        outdir: 'src/assets/js',
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