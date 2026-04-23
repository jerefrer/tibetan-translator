import { describe, it, expect } from 'vitest';
import initSqlJs from '../public/sql-wasm.js';
import { createPackTables } from '../build/lib/pack-schema.js';

describe('createPackTables', () => {
  it('creates the expected tables, triggers, and index', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    createPackTables(db);

    const tables = db
      .exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0]
      .values.flat();
    expect(tables).toEqual(expect.arrayContaining(['dictionaries', 'entries', 'entries_fts']));

    const triggers = db
      .exec("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name")[0]
      .values.flat();
    expect(triggers).toEqual([
      'entries_after_delete',
      'entries_after_insert',
      'entries_after_update',
    ]);

    const indexes = db
      .exec("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_entries_term'")[0];
    expect(indexes).toBeTruthy();
  });
});
