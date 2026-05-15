import * as esbuild from 'esbuild';

const minify = process.env.NODE_ENV === 'production';
const sourcemap = process.env.NODE_ENV !== 'production';

async function build() {
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

await build();
