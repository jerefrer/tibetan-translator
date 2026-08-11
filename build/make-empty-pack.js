#!/usr/bin/env node
/**
 * Emits src-tauri/resources/empty-pack.sqlite — an empty pack database used as
 * the template when the app creates a new personal lexicon.
 *
 * The output is COMMITTED to the repo so the release pipeline needs no extra
 * build step. Re-run this script whenever build/lib/pack-schema.js changes:
 *
 *   pnpm build:empty-pack
 *
 * (not `node build/make-empty-pack.js` directly — this file mixes an ESM
 * `import` with CJS `__dirname`, which only resolves under the babel-node
 * runtime the pnpm script invokes.)
 */

import fs from 'fs';
import path from 'path';
import initSqlJs from '../public/sql-wasm.js';
import { createPackTables } from './lib/pack-schema.js';

const OUTPUT = path.resolve(__dirname, '../src-tauri/resources/empty-pack.sqlite');

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  createPackTables(db);
  const data = Buffer.from(db.export());
  db.close();

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, data);
  console.log(`Wrote ${OUTPUT} (${(data.length / 1024).toFixed(1)} kB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
