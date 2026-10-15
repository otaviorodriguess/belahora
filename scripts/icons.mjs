import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const fullBleed = svg.replace('rx="112"', 'rx="0"');
await Promise.all(
  [
    ['bela-hora-icon-192.png', 192, svg],
    ['bela-hora-icon-512.png', 512, svg],
    ['bela-hora-apple-touch-icon.png', 180, fullBleed],
    ['bela-hora-icon-maskable.png', 512, fullBleed],
  ].map(([name, size, source]) =>
    sharp(Buffer.from(source))
      .resize(size, size)
      .png()
      .toFile(fileURLToPath(new URL(`../public/${name}`, import.meta.url))),
  ),
);

