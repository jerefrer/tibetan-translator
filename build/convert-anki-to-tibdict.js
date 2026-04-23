#!/usr/bin/env node
/**
 * APKG → .tibdict converter.
 *
 * Usage:
 *   pnpm build:tibdict -- --config <file.json> [--output <file.tibdict>]
 */

import fs from 'fs';
import path from 'path';
import { readApkgNotes } from './lib/apkg-reader.js';
import { normalizeEntries } from './lib/normalize-entries.js';
import { buildTibdictSqlite } from './lib/build-tibdict-sqlite.js';
import { writeTibdict } from './lib/tibdict-writer.js';
import { SUPPORTED_SCHEMA_VERSION } from '../src/config/pack-definitions.js';

const FORMAT_VERSION = 1;

function parseArgs(argv) {
  const args = {};
  let i = 2;
  while (i < argv.length) {
    const token = argv[i];
    if (token === '--') { i += 1; continue; }
    if (!token.startsWith('--')) { i += 1; continue; }
    const key = token.replace(/^--/, '');
    args[key] = argv[i + 1];
    i += 2;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.config) {
    console.error('Usage: node build/convert-anki-to-tibdict.js --config <config.json> [--output <file.tibdict>]');
    process.exit(1);
  }

  const configPath = path.resolve(process.cwd(), args.config);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const configDir = path.dirname(configPath);
  const projectRoot = path.resolve(__dirname, '..');

  const outputPath = path.resolve(
    process.cwd(),
    args.output || `${config.id}.tibdict`
  );

  console.log(`\n=== Converting to ${path.basename(outputPath)} ===\n`);

  // Collect notes from all sources
  const allNotes = [];
  for (const source of config.dictionary.sources) {
    // Resolve source file: try config dir first, then project root
    let sourcePath = path.resolve(configDir, source.file);
    if (!fs.existsSync(sourcePath)) {
      sourcePath = path.resolve(projectRoot, source.file);
    }

    console.log(`  Reading: ${source.file} (reversed=${source.reversed})`);
    try {
      const notes = await readApkgNotes(sourcePath);
      const normalized = normalizeEntries(notes, { reversed: !!source.reversed });
      console.log(`    → ${notes.length} raw notes, ${normalized.length} kept after normalization`);
      for (const entry of normalized) allNotes.push(entry);
    } catch (err) {
      console.warn(`    ⚠️  Skipping ${source.file}: ${err.message}`);
    }
  }

  // Deduplicate across sources too
  const seen = new Set();
  const finalEntries = [];
  for (const e of allNotes) {
    const key = e.term + '\x00' + e.definition;
    if (seen.has(key)) continue;
    seen.add(key);
    finalEntries.push(e);
  }

  if (finalEntries.length === 0) {
    console.error('\n❌ No entries collected. Aborting.\n');
    process.exit(2);
  }

  console.log(`\n  Total entries: ${finalEntries.length}`);

  // Build SQLite
  const sqliteBuffer = await buildTibdictSqlite({
    dictionaryName: config.dictionary.name,
    entries: finalEntries,
  });

  // Build manifest
  const manifest = {
    format: 'tibdict',
    formatVersion: FORMAT_VERSION,
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    id: config.id,
    name: config.name,
    description: config.description,
    ...(config.author && { author: config.author }),
    ...(config.version && { version: config.version }),
    createdAt: new Date().toISOString(),
    ...(config.icon && { icon: config.icon }),
    dictionaries: [{ name: config.dictionary.name, entriesCount: finalEntries.length }],
  };

  // Write archive
  await writeTibdict(outputPath, manifest, sqliteBuffer);
  const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`\n✅ Wrote ${outputPath} (${sizeKB} kB)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
