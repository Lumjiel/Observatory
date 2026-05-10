import * as esbuild from 'esbuild';

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