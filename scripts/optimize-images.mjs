import { readdir, stat, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import sharp from 'sharp';

const IMG_DIR = 'src/img';

async function getFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name)) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

function formatSize(bytes) {
  return bytes < 1024 ? `${bytes}B` : `${(bytes / 1024).toFixed(1)}KB`;
}

const files = await getFiles(IMG_DIR);
console.log(`Found ${files.length} images\n`);

let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const ext = extname(file).toLowerCase();
  const before = (await stat(file)).size;
  totalBefore += before;

  let buffer;
  if (ext === '.png') {
    buffer = await sharp(file)
      .png({ palette: true, colors: 256, compressionLevel: 9 })
      .toBuffer();
  } else if (ext === '.jpg' || ext === '.jpeg') {
    buffer = await sharp(file)
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  } else {
    continue;
  }

  const after = buffer.length;
  totalAfter += after;
  const saved = ((1 - after / before) * 100).toFixed(1);

  await writeFile(file, buffer);
  console.log(`  ${formatSize(before)} → ${formatSize(after)}  (${saved}% off)  ${file.slice(IMG_DIR.length + 1)}`);
}

const totalSaved = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
console.log(`\nTotal: ${formatSize(totalBefore)} → ${formatSize(totalAfter)}  (${totalSaved}% saved)`);