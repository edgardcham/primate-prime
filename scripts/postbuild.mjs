import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Copy the ESM loader to dist
const loaderSrc = path.join(__dirname, 'resolve-ts-paths-loader.mjs');
const loaderDest = path.join(
  __dirname,
  '..',
  'dist',
  'resolve-ts-paths-loader.mjs'
);
if (fs.existsSync(loaderSrc)) {
  fs.copyFileSync(loaderSrc, loaderDest);
  console.log('[postbuild] Copied resolve-ts-paths-loader.mjs to dist/');
} else {
  console.warn('[postbuild] Loader file not found:', loaderSrc);
}