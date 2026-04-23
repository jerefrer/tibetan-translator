import { describe, it, expect } from 'vitest';
import initSqlJs from '../public/sql-wasm.js';
import { buildTibdictSqlite } from '../build/lib/build-tibdict-sqlite.js';

describe('buildTibdictSqlite', () => {
  it('creates a SQLite buffer with one dictionary and the given entries', async () => {
    const buffer = await buildTibdictSqlite({
      dictionaryName: 'Test',
      entries: [
        { term: 'ང', definition: 'je' },
        { term: 'ཁོང་', definition: 'il' },
      ],
    });

    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(buffer));

    const dicts = db.exec('SELECT id, name, position, enabled FROM dictionaries')[0].values;
    expect(dicts).toEqual([[1, 'Test', 1, 1]]);

    const entries = db.exec('SELECT term, definition, dictionaryId FROM entries ORDER BY term')[0].values;
    // First term "ང" got a tsheg appended. Second "ཁོང་" already had one.
    expect(entries[0][0]).toBe('ཁོང་');
    expect(entries[1][0]).toBe('ང་');
    expect(entries[0][2]).toBe(1); // dictionaryId
    expect(entries[1][2]).toBe(1);
  });

  it('writes non-empty phonetics columns for Tibetan terms', async () => {
    const buffer = await buildTibdictSqlite({
      dictionaryName: 'Test',
      entries: [{ term: 'ང', definition: 'je' }],
    });

    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(buffer));
    const row = db.exec('SELECT termPhoneticsStrict, termPhoneticsLoose FROM entries')[0].values[0];
    expect(row[0].length).toBeGreaterThan(0);
    expect(row[1].length).toBeGreaterThan(0);
  });

  it('escapes single quotes in definitions without failing', async () => {
    const buffer = await buildTibdictSqlite({
      dictionaryName: 'Test',
      entries: [{ term: 'ང', definition: "aujourd'hui" }],
    });

    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(buffer));
    const row = db.exec('SELECT definition FROM entries')[0].values[0];
    expect(row[0]).toBe("aujourd'hui");
  });
});
