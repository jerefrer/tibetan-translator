#!/usr/bin/env node
/**
 * Verify that every Tauri Rust crate and its @tauri-apps/* npm counterpart
 * resolve to the same major/minor version. This mirrors the check that
 * `tauri build` does in CI, without actually running a build.
 *
 * Usage:  node scripts/check-tauri-versions.js
 * Exit:   0 if everything matches, 1 on any mismatch or missing counterpart.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CARGO_LOCK = path.join(ROOT, 'src-tauri', 'Cargo.lock');

const PAIRS = [
  ['tauri',                          '@tauri-apps/api'],
  ['tauri-plugin-clipboard-manager', '@tauri-apps/plugin-clipboard-manager'],
  ['tauri-plugin-dialog',            '@tauri-apps/plugin-dialog'],
  ['tauri-plugin-global-shortcut',   '@tauri-apps/plugin-global-shortcut'],
  ['tauri-plugin-process',           '@tauri-apps/plugin-process'],
  ['tauri-plugin-updater',           '@tauri-apps/plugin-updater'],
];

const cargoLock = fs.readFileSync(CARGO_LOCK, 'utf8');

function rustVersionOf(crate) {
  const re = new RegExp(`name = "${crate}"\\nversion = "([^"]+)"`);
  const m = cargoLock.match(re);
  return m ? m[1] : null;
}

function npmVersionOf(pkg) {
  // pnpm's node_modules uses symlinks; read package.json directly by path so
  // we don't depend on Node's module resolution quirks.
  const pkgJsonPath = path.join(ROOT, 'node_modules', pkg, 'package.json');
  try {
    return JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version;
  } catch {
    return null;
  }
}

const majorMinor = (v) => v.split('.').slice(0, 2).join('.');

let mismatches = 0;
let skipped = 0;
console.log('Tauri package version check:\n');

for (const [rustCrate, npmPkg] of PAIRS) {
  const r = rustVersionOf(rustCrate);
  const n = npmVersionOf(npmPkg);

  if (!r && !n) {
    console.log(`  ·  ${rustCrate}: neither side declared, skipping`);
    skipped++;
    continue;
  }
  if (!r) {
    console.error(`  ❌ ${rustCrate}: missing from Cargo.lock (npm has ${n})`);
    mismatches++;
    continue;
  }
  if (!n) {
    console.error(`  ❌ ${npmPkg}: not installed (Cargo has ${r})`);
    mismatches++;
    continue;
  }

  const ok = majorMinor(r) === majorMinor(n);
  const mark = ok ? '✅' : '❌';
  console.log(`  ${mark} ${rustCrate.padEnd(34)} Rust=${r.padEnd(8)} npm=${n}`);
  if (!ok) mismatches++;
}

if (mismatches > 0) {
  console.error(`\n${mismatches} version mismatch(es). Align each pair on matching major/minor (the same check CI runs).`);
  process.exit(1);
}

console.log(`\nAll tauri package pairs aligned${skipped ? ` (${skipped} skipped)` : ''}.`);
