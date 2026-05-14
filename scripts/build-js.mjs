import * as esbuild from 'esbuild';
import fs from 'fs';

const isWatch = process.argv.includes('--watch');
const minify = process.env.NODE_ENV === 'production';
const sourcemap = process.env.NODE_ENV !== 'production';

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

    // 管理后台 admin-panel.js → admin-panel.bundle.js
    await esbuild.build({
        entryPoints: ['src/assets/js/admin-panel.js'],
        bundle: true,
        outfile: 'src/assets/js/admin-panel.bundle.js',
        format: 'iife',
        minify,
        sourcemap,
        target: ['es2020'],
        logLevel: 'info',
    });
}

if (isWatch) {
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