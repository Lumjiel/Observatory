import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

if (isWatch) {
    const ctx = await esbuild.context({
        entryPoints: ['src/assets/js/app.js'],
        bundle: true,
        outfile: 'src/assets/js/bundle.js',
        format: 'iife',
        minify: process.env.NODE_ENV === 'production',
        sourcemap: process.env.NODE_ENV !== 'production',
        target: ['es2020'],
        logLevel: 'info',
    });
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await esbuild.build({
        entryPoints: ['src/assets/js/app.js'],
        bundle: true,
        outfile: 'src/assets/js/bundle.js',
        format: 'iife',
        minify: process.env.NODE_ENV === 'production',
        sourcemap: process.env.NODE_ENV !== 'production',
        target: ['es2020'],
        logLevel: 'info',
    });
}