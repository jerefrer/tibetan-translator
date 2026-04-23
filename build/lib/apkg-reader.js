/**
 * APKG reader.
 *
 * Newer Anki .apkg archives contain a zstd-compressed `collection.anki21b`
 * SQLite database (in addition to the legacy placeholder `collection.anki2`).
 * We extract that file, decompress it, open it, and read the `notes` table.
 */

import fs from 'fs';
import AdmZip from 'adm-zip';
import { decompress } from '@mongodb-js/zstd';
import initSqlJs from '../../public/sql-wasm.js';

/**
 * Read all notes from an .apkg file.
 *
 * @param {string} apkgPath - absolute path to the .apkg file
 * @returns {Promise<Array<[string, string]>>} - array of [field0, field1] pairs
 *
 * Notes whose `flds` has more than 2 fields return only the first two.
 * Notes with fewer than 2 fields are skipped silently.
 */
export async function readApkgNotes(apkgPath) {
  if (!fs.existsSync(apkgPath)) {
    throw new Error(`APKG not found: ${apkgPath}`);
  }

  const zip = new AdmZip(apkgPath);
  const entries = zip.getEntries();
  const dbEntry = entries.find((e) => e.entryName === 'collection.anki21b');

  if (!dbEntry) {
    throw new Error(`APKG ${apkgPath} does not contain collection.anki21b`);
  }

  const compressed = dbEntry.getData();
  const rawSqlite = await decompress(compressed);

  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(rawSqlite));

  try {
    const result = db.exec('SELECT flds FROM notes WHERE flds IS NOT NULL');
    if (!result.length) return [];

    const [{ values }] = result;
    const notes = [];
    for (const row of values) {
      const flds = row[0];
      if (typeof flds !== 'string') continue;
      const parts = flds.split('\x1f'); // ASCII unit separator
      if (parts.length < 2) continue;
      notes.push([parts[0], parts[1]]);
    }
    return notes;
  } finally {
    db.close();
  }
}
