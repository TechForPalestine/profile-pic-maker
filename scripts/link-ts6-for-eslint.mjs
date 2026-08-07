// Bridges TypeScript 6 into the lint toolchain so `npm run lint` keeps working
// while the project compiles with TypeScript 7.
//
// Why: typescript-eslint (v8) calls the classic TypeScript compiler API, which
// typescript@7 (the Go-native rewrite) no longer exposes — `require('typescript')`
// from inside @typescript-eslint/* or ts-api-utils crashes on load. Until
// typescript-eslint ships TS 7 support, we install TS 6 under the
// `typescript-lint` alias (tracked in package.json / package-lock.json like any
// dependency) and link it into every copy of those packages in node_modules, at
// <pkg>/node_modules/typescript, so Node's module resolution finds TS 6 before
// the root-level TS 7.
//
// This runs as a postinstall script because npm prunes "extraneous" packages
// from node_modules on every install — the links must be recreated afterwards.
// Future work: once typescript-eslint supports typescript@7, delete this script,
// the `postinstall` hook, and the `typescript-lint` devDependency.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeModules = path.join(root, 'node_modules');
const source = path.join(nodeModules, 'typescript-lint');
const consumerNames = new Set(['@typescript-eslint', 'ts-api-utils']);

if (!fs.existsSync(path.join(source, 'package.json'))) {
  console.warn(
    'link-ts6-for-eslint: typescript-lint is not installed, skipping',
  );
  process.exit(0);
}

// Find every directory in node_modules that hosts TS-API consumers, including
// copies nested under other packages. Symlinks are not followed (avoids cycles
// and the links this script itself creates).
function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === '.bin' || !entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (consumerNames.has(entry.name)) {
      yield full;
      continue; // consumer's own node_modules only needs the link, not a scan
    }
    yield* walk(full);
  }
}

let linked = 0;
for (const consumer of walk(nodeModules)) {
  const targetDir = path.join(consumer, 'node_modules');
  const target = path.join(targetDir, 'typescript');
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  // 'junction' works without admin rights on Windows and behaves as a symlink elsewhere.
  fs.symlinkSync(source, target, 'junction');
  linked++;
  console.log(
    `link-ts6-for-eslint: linked TS 6 -> ${path.relative(root, consumer)}`,
  );
}
if (linked === 0) {
  console.warn('link-ts6-for-eslint: no TS-API consumers found, skipping');
}
