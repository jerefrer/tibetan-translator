/**
 * Build the data.sqlite buffer for a .tibdict pack.
 *
 * Uses the shared pack schema and mirrors build-packs.js:
 *   - ensures each term ends with a Tibetan punctuation mark (adds tsheg otherwise)
 *   - computes strict/loose phonetics for both term and definition
 *   - inserts all entries under a single dictionary with id=1
 */

import initSqlJs from '../../public/sql-wasm.js';
import { createPackTables } from './pack-schema.js';
import { strictAndLoosePhoneticsFor } from '../../src/utils.js';

export async function buildTibdictSqlite({ dictionaryName, entries }) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  createPackTables(db);

  const dictId = 1;
  const escName = sqlEscape(dictionaryName);
  db.run(`INSERT INTO dictionaries VALUES (${dictId}, '${escName}', 1, 1);`);

  for (const entry of entries) {
    const term = ensureTrailingTsheg(entry.term);
    const [ts, tl] = strictAndLoosePhoneticsFor(term);
    const [ds, dl] = strictAndLoosePhoneticsFor(entry.definition);

    db.run(
      `INSERT INTO entries VALUES (
        NULL,
        '${sqlEscape(term)}',
        '${sqlEscape(ts)}',
        '${sqlEscape(tl)}',
        '${sqlEscape(entry.definition)}',
        '${sqlEscape(ds)}',
        '${sqlEscape(dl)}',
        ${dictId}
      );`
    );
  }

  const data = db.export();
  db.close();
  return Buffer.from(data);
}

function ensureTrailingTsheg(term) {
  if (!term.match(/[་།༑༔]$/)) return term + '་';
  return term;
}

function sqlEscape(text) {
  return String(text).replace(/'/g, "''");
}
