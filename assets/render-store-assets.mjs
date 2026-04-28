import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, 'store');
mkdirSync(outDir, { recursive: true });

const renders = [
  { svg: 'icon-only.svg',       out: 'play-store-icon-512.png',      w: 512,  h: 512 },
  { svg: 'feature-graphic.svg', out: 'feature-graphic-1024x500.png', w: 1024, h: 500 },
];

for (const { svg, out, w, h } of renders) {
  const buf = readFileSync(resolve(here, svg));
  await sharp(buf, { density: 384 })
    .resize(w, h, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(resolve(outDir, out));
  console.log(`wrote ${out}  (${w}x${h})`);
}
