/**
 * Shared SQLite schema for dictionary packs (official and custom).
 *
 * Both build-packs.js and convert-anki-to-tibdict.js use this to guarantee
 * the exact same schema in every pack.
 */

export function createPackTables(database) {
  database.run(`
    CREATE TABLE dictionaries (
      id        integer primary key,
      name      text not null,
      position  integer NOT NULL,
      enabled   boolean default true
    );
  `);

  database.run(`
    CREATE TABLE entries (
      id                              integer primary key,
      term                            text not null,
      termPhoneticsStrict             text not null,
      termPhoneticsLoose              text not null,
      definition                      text not null,
      definitionPhoneticsWordsStrict  text not null,
      definitionPhoneticsWordsLoose   text not null,
      dictionaryId                    integer
    );
  `);

  database.run(`
    CREATE VIRTUAL TABLE entries_fts USING fts5(
      term,
      termPhoneticsStrict,
      termPhoneticsLoose,
      definition,
      definitionPhoneticsWordsStrict,
      definitionPhoneticsWordsLoose,
      content = 'entries',
      content_rowid = 'id',
      tokenize = 'unicode61'
    );
  `);

  database.run(`
    CREATE TRIGGER entries_after_insert AFTER INSERT ON entries BEGIN
      INSERT INTO entries_fts(
        rowid, term, termPhoneticsStrict, termPhoneticsLoose,
        definition, definitionPhoneticsWordsStrict, definitionPhoneticsWordsLoose
      ) VALUES (
        new.id, new.term, new.termPhoneticsStrict, new.termPhoneticsLoose,
        new.definition, new.definitionPhoneticsWordsStrict, new.definitionPhoneticsWordsLoose
      );
    END;
    CREATE TRIGGER entries_after_delete AFTER DELETE ON entries BEGIN
      INSERT INTO entries_fts(
        entries_fts, rowid, term, termPhoneticsStrict, termPhoneticsLoose,
        definition, definitionPhoneticsWordsStrict, definitionPhoneticsWordsLoose
      ) VALUES (
        'delete', old.id, old.term, old.termPhoneticsStrict, old.termPhoneticsLoose,
        old.definition, old.definitionPhoneticsWordsStrict, old.definitionPhoneticsWordsLoose
      );
    END;
    CREATE TRIGGER entries_after_update AFTER UPDATE ON entries BEGIN
      INSERT INTO entries_fts(
        entries_fts, rowid, term, termPhoneticsStrict, termPhoneticsLoose,
        definition, definitionPhoneticsWordsStrict, definitionPhoneticsWordsLoose
      ) VALUES (
        'delete', old.id, old.term, old.termPhoneticsStrict, old.termPhoneticsLoose,
        old.definition, old.definitionPhoneticsWordsStrict, old.definitionPhoneticsWordsLoose
      );
      INSERT INTO entries_fts(
        rowid, term, termPhoneticsStrict, termPhoneticsLoose,
        definition, definitionPhoneticsWordsStrict, definitionPhoneticsWordsLoose
      ) VALUES (
        new.id, new.term, new.termPhoneticsStrict, new.termPhoneticsLoose,
        new.definition, new.definitionPhoneticsWordsStrict, new.definitionPhoneticsWordsLoose
      );
    END;
  `);

  database.run(`CREATE INDEX idx_entries_term ON entries(term);`);
}
