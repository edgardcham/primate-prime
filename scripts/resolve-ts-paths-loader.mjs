import { readFileSync, existsSync, statSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';

// ESM-compatible __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tsconfigPath = path.resolve('./tsconfig.json');
const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
const paths =
  (tsconfig.compilerOptions && tsconfig.compilerOptions.paths) || {};
const outDir =
  (tsconfig.compilerOptions && tsconfig.compilerOptions.outDir) || 'dist';
const rootDir =
  (tsconfig.compilerOptions && tsconfig.compilerOptions.rootDir) || 'src';

const aliasMap = [];
for (const [aliasPattern, targets] of Object.entries(paths)) {
  // Only support patterns like "@/*": ["./src/*"]
  if (aliasPattern.endsWith('/*') && targets[0].endsWith('/*')) {
    const aliasPrefix = aliasPattern.slice(0, -2); // "@/"
    const targetPrefix = targets[0].slice(0, -2); // "./src"
    aliasMap.push({ aliasPrefix, targetPrefix });
  }
}

export async function resolve(specifier, context, nextResolve) {
  for (const { aliasPrefix, targetPrefix } of aliasMap) {
    if (specifier.startsWith(aliasPrefix)) {
      // Replace alias with outDir equivalent
      // Strip any leading slash from subPath to avoid absolute path resolution
      const subPath = specifier.slice(aliasPrefix.length).replace(/^\/+/, '');
      // Map "./src" to "./dist"
      const distTarget = targetPrefix.replace(rootDir, outDir);
      let resolvedFile = path.resolve(distTarget, subPath);
      // If the resolved path is a directory, append /index.js
      if (existsSync(resolvedFile) && statSync(resolvedFile).isDirectory()) {
        resolvedFile = path.join(resolvedFile, 'index.js');
      } else if (!path.extname(resolvedFile)) {
        // Always append .js extension if not present
        resolvedFile += '.js';
      }
      const resolvedPath = pathToFileURL(resolvedFile).href;
      return nextResolve(resolvedPath, context);
    }
  }
  return nextResolve(specifier, context);
}