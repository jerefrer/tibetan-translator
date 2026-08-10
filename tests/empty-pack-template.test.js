import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from '../public/sql-wasm.js';
import { createPackTables } from '../build/lib/pack-schema.js';

// Vitest runs tests as ESM — __dirname is not defined, so derive it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.resolve(__dirname, '../src-tauri/resources/empty-pack.sqlite');

function schemaOf(db) {
  const [result] = db.exec(
    "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
  );
  return result.values.map((row) => row.join('\n'));
}

describe('empty-pack.sqlite template', () => {
  it('exists', () => {
    expect(fs.existsSync(TEMPLATE)).toBe(true);
  });

  it('has exactly the schema createPackTables produces', async () => {
    const SQL = await initSqlJs();

    const expected = new SQL.Database();
    createPackTables(expected);
    const expectedSchema = schemaOf(expected);
    expected.close();

    const actual = new SQL.Database(new Uint8Array(fs.readFileSync(TEMPLATE)));
    const actualSchema = schemaOf(actual);
    actual.close();

    expect(actualSchema).toEqual(expectedSchema);
  });

  it('contains no rows', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(fs.readFileSync(TEMPLATE)));
    const [dicts] = db.exec('SELECT COUNT(*) FROM dictionaries');
    const [entries] = db.exec('SELECT COUNT(*) FROM entries');
    db.close();
    expect(dicts.values[0][0]).toBe(0);
    expect(entries.values[0][0]).toBe(0);
  });
});
