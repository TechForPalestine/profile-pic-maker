#!/usr/bin/env node
/**
 * Installs TypeScript 6.0.3 in the nested node_modules of packages that do not
 * yet support TypeScript 7's new API architecture:
 *   - node_modules/@typescript-eslint/node_modules/typescript
 *   - node_modules/ts-api-utils/node_modules/typescript
 *   - node_modules/typescript-eslint/node_modules/typescript
 *
 * Remove this script once @typescript-eslint and ts-api-utils release versions
 * that support TypeScript 7.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const cwd = process.cwd();
const TS6_VERSION = '6.0.3';

/**
 * Targets: packages that still use the old TypeScript API (removed in TS 7).
 * Each entry is a path relative to node_modules/ where a nested typescript
 * package should be installed so that require('typescript') inside that subtree
 * resolves to TypeScript 6 rather than the root-level TypeScript 7.
 */
const TARGETS = [
  path.join(
    cwd,
    'node_modules',
    '@typescript-eslint',
    'node_modules',
    'typescript',
  ),
  path.join(cwd, 'node_modules', 'ts-api-utils', 'node_modules', 'typescript'),
  path.join(
    cwd,
    'node_modules',
    'typescript-eslint',
    'node_modules',
    'typescript',
  ),
];

function getTs6Source() {
  const compatSource = path.join(
    cwd,
    'typescript-compat',
    'node_modules',
    'typescript',
  );
  if (fs.existsSync(path.join(compatSource, 'package.json'))) {
    return compatSource;
  }
  return null;
}

function installTs6ToTmp() {
  const tmpDir = path.join(cwd, '.tmp-ts6-install');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'tmp-ts6', version: '1.0.0', private: true }),
  );
  execSync(
    `npm install typescript@${TS6_VERSION} --no-fund --no-audit --no-package-lock`,
    {
      cwd: tmpDir,
      stdio: 'pipe',
    },
  );
  return path.join(tmpDir, 'node_modules', 'typescript');
}

function installTs6(target, source) {
  if (fs.existsSync(target)) {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(target, 'package.json'), 'utf8'),
      );
      if (pkg.version === TS6_VERSION) return false; // already correct version
    } catch {
      // continue
    }
    fs.rmSync(target, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  return true;
}

// Skip entirely if node_modules doesn't exist yet
if (!fs.existsSync(path.join(cwd, 'node_modules'))) {
  process.exit(0);
}

// Get or install TypeScript 6.0.3 source
let ts6Source = getTs6Source();
let tmpDir = null;

if (!ts6Source) {
  console.log(
    `Downloading TypeScript ${TS6_VERSION} for @typescript-eslint / ts-api-utils compatibility...`,
  );
  tmpDir = path.join(cwd, '.tmp-ts6-install');
  try {
    ts6Source = installTs6ToTmp();
  } catch (err) {
    console.error(`Failed to install TypeScript ${TS6_VERSION}:`, err.message);
    process.exit(1);
  }
}

// Install TypeScript 6 into each target directory
let changed = false;
for (const target of TARGETS) {
  const parentDir = path.dirname(path.dirname(target)); // package dir
  if (!fs.existsSync(parentDir)) continue; // skip if package not installed
  if (installTs6(target, ts6Source)) {
    console.log(
      `TypeScript ${TS6_VERSION} installed at ${path.relative(cwd, target)}`,
    );
    changed = true;
  }
}

// Clean up temp dir
if (tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

if (!changed) {
  // All targets already at the correct version — nothing to do
}
