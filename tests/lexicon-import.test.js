import { describe, it, expect } from 'vitest';
import { detectLayout, diffRows } from '../src/services/lexicon-import.js';
import { entriesForImport } from '../src/services/lexicon.js';

const GRID = {
  headers: ['A', 'B', 'C'],
  rows: [
    ['Terme', 'Traduction', 'Notes'],
    ['སངས་རྒྱས་', 'buddha', 'n.'],
    ['ཆོས་', 'dharma', ''],
  ],
};

describe('detectLayout', () => {
  it('treats a first row with no Tibetan as a header', () => {
    const layout = detectLayout(GRID);
    expect(layout.hasHeaderRow).toBe(true);
    expect(layout.labels).toEqual(['Terme', 'Traduction', 'Notes']);
    expect(layout.dataRows).toHaveLength(2);
  });

  it('keeps the column letters when there is no header row', () => {
    const layout = detectLayout({ ...GRID, rows: GRID.rows.slice(1) });
    expect(layout.hasHeaderRow).toBe(false);
    expect(layout.labels).toEqual(['A', 'B', 'C']);
    expect(layout.dataRows).toHaveLength(2);
  });

  it('picks the most Tibetan column as the term', () => {
    expect(detectLayout(GRID).termColumn).toBe(0);
  });

  it('picks the first remaining non-empty column as the definition', () => {
    expect(detectLayout(GRID).definitionColumn).toBe(1);
  });

  it('picks the term column even when it is not the first', () => {
    const layout = detectLayout({
      headers: ['A', 'B'],
      rows: [
        ['buddha', 'སངས་རྒྱས་'],
        ['dharma', 'ཆོས་'],
      ],
    });
    expect(layout.termColumn).toBe(1);
    expect(layout.definitionColumn).toBe(0);
  });

  it('reports no term column when the sheet holds no Tibetan at all', () => {
    const layout = detectLayout({ headers: ['A', 'B'], rows: [['one', 'two']] });
    expect(layout.termColumn).toBe(null);
  });

  it('does not call a first row a header when every row is Tibetan-free', () => {
    // Nothing later contains Tibetan, so there is no evidence row 0 is special.
    const layout = detectLayout({ headers: ['A'], rows: [['one'], ['two']] });
    expect(layout.hasHeaderRow).toBe(false);
  });

  it('falls back to the column letter for a header cell left blank', () => {
    const layout = detectLayout({
      headers: ['A', 'B'],
      rows: [
        ['Terme', ''],
        ['སངས་རྒྱས་', 'buddha'],
      ],
    });
    expect(layout.labels).toEqual(['Terme', 'B']);
  });

  it('survives an empty sheet', () => {
    const layout = detectLayout({ headers: [], rows: [] });
    expect(layout.termColumn).toBe(null);
    expect(layout.dataRows).toEqual([]);
  });

  it('survives being handed nothing at all', () => {
    expect(detectLayout().termColumn).toBe(null);
  });
});

describe('diffRows', () => {
  const COLUMNS = { termColumn: 0, definitionColumn: 1 };
  const EXISTING = [
    { id: 1, term: 'སངས་རྒྱས་', definition: 'buddha' },
    { id: 2, term: 'ཆོས་', definition: 'dharma' },
  ];

  it('classifies an absent term as created', () => {
    const diff = diffRows([['བླ་མ་', 'lama']], COLUMNS, EXISTING);
    expect(diff.created).toEqual([{ term: 'བླ་མ་', definition: 'lama', row: 1 }]);
  });

  it('classifies a changed definition as modified and carries the old one', () => {
    const diff = diffRows([['སངས་རྒྱས་', 'awakened one']], COLUMNS, EXISTING);
    expect(diff.modified).toEqual([
      { term: 'སངས་རྒྱས་', definition: 'awakened one', previousDefinition: 'buddha', row: 1 },
    ]);
  });

  it('counts an identical definition as unchanged and never lists it', () => {
    const diff = diffRows([['སངས་རྒྱས་', 'buddha']], COLUMNS, EXISTING);
    expect(diff.unchangedCount).toBe(1);
    expect(diff.created).toEqual([]);
    expect(diff.modified).toEqual([]);
  });

  it('matches a term written with a shad against one stored with a tsheg', () => {
    // tibetanLookupKey is the single normalization shared by storage, lookup
    // and this diff — without it this row would duplicate the entry.
    const diff = diffRows([['སངས་རྒྱས།', 'buddha']], COLUMNS, EXISTING);
    expect(diff.unchangedCount).toBe(1);
    expect(diff.created).toEqual([]);
  });

  it('ignores a row whose term cell is empty', () => {
    expect(diffRows([['', 'orphan']], COLUMNS, EXISTING).ignored).toEqual([
      { row: 1, reason: 'noTerm' },
    ]);
  });

  it('ignores a row whose term holds no Tibetan at all', () => {
    expect(diffRows([['notes', 'orphan']], COLUMNS, EXISTING).ignored).toEqual([
      { row: 1, reason: 'noTerm' },
    ]);
  });

  it('lets the last of two identical terms win and reports the earlier one', () => {
    const diff = diffRows(
      [
        ['བླ་མ་', 'first'],
        ['བླ་མ་', 'second'],
      ],
      COLUMNS,
      EXISTING
    );
    expect(diff.created).toEqual([{ term: 'བླ་མ་', definition: 'second', row: 2 }]);
    expect(diff.ignored).toEqual([{ row: 1, reason: 'duplicate' }]);
  });

  it('numbers rows from 1 so they match what the user sees in the sheet', () => {
    const diff = diffRows([['', 'a'], ['', 'b']], COLUMNS, EXISTING);
    expect(diff.ignored.map((entry) => entry.row)).toEqual([1, 2]);
  });

  it('keeps created entries in sheet order', () => {
    const diff = diffRows(
      [
        ['བླ་མ་', 'lama'],
        ['དགེ་བ་', 'virtue'],
      ],
      COLUMNS,
      EXISTING
    );
    expect(diff.created.map((entry) => entry.row)).toEqual([1, 2]);
  });

  it('treats every row as created when the dictionary is empty', () => {
    const diff = diffRows([['བླ་མ་', 'lama']], COLUMNS, []);
    expect(diff.created).toHaveLength(1);
    expect(diff.modified).toEqual([]);
  });

  it('stores the normalized term, not the raw cell', () => {
    // What goes in must be byte-identical to what the lookup path searches for.
    const diff = diffRows([['བླ་མ།', 'lama']], COLUMNS, []);
    expect(diff.created[0].term).toBe('བླ་མ་');
  });
});

describe('rows the write path would silently drop', () => {
  const COLUMNS = { termColumn: 0, definitionColumn: 1 };

  it('ignores a row with a term but no definition', () => {
    // prepareEntry() returns null when either side is empty, so counting such
    // a row as created would make the recap promise an entry that never lands.
    const diff = diffRows([['བླ་མ་', '']], COLUMNS, []);
    expect(diff.created).toEqual([]);
    expect(diff.ignored).toEqual([{ row: 1, reason: 'noDefinition' }]);
  });

  it('still counts a blank definition as unchanged when the entry is blank too', () => {
    const diff = diffRows([['བླ་མ་', '']], COLUMNS, [
      { id: 1, term: 'བླ་མ་', definition: '' },
    ]);
    expect(diff.ignored).toEqual([{ row: 1, reason: 'noDefinition' }]);
  });
});

describe('entriesForImport', () => {
  it('gives every row the six phonetic columns Rust expects', () => {
    const [entry] = entriesForImport([{ term: 'སངས་རྒྱས་', definition: 'buddha' }]);
    expect(Object.keys(entry).sort()).toEqual([
      'definition',
      'definitionPhoneticsWordsLoose',
      'definitionPhoneticsWordsStrict',
      'term',
      'termPhoneticsLoose',
      'termPhoneticsStrict',
    ]);
    expect(entry.termPhoneticsStrict).toBeTruthy();
  });

  it('drops rows that prepareEntry rejects as unusable', () => {
    expect(entriesForImport([{ term: '   ', definition: 'orphan' }])).toEqual([]);
  });
});

describe('importing the same sheet twice', () => {
  // The proof that the diff key and the write key are the same rule. If they
  // ever drift, the second import reports every row as new and the entries
  // become invisible to the global hotkey — the failure mode §6 of the design
  // calls "the one correctness trap".
  it('reports nothing to do the second time round', () => {
    const rows = [
      ['སངས་རྒྱས།', 'buddha'],
      ['བླ་མ་', 'lama'],
    ];
    const columns = { termColumn: 0, definitionColumn: 1 };

    const first = diffRows(rows, columns, []);
    expect(first.created).toHaveLength(2);

    // What the write path would actually store: prepareEntry's own normalization.
    const stored = entriesForImport(first.created).map((entry, index) => ({
      id: index + 1,
      term: entry.term,
      definition: entry.definition,
    }));

    const second = diffRows(rows, columns, stored);
    expect(second.created).toEqual([]);
    expect(second.modified).toEqual([]);
    expect(second.unchangedCount).toBe(2);
  });
});

describe('the contract between the xlsx export and the import', () => {
  // lexicon_export_xlsx writes exactly these two header labels. If either side
  // drifts, a file exported by the app stops auto-detecting on the way back in
  // and the user lands on the mapping step for no reason.
  const EXPORT_HEADERS = ['Tibetan term', 'Definition'];

  it('auto-detects a freshly exported file without asking anything', () => {
    const layout = detectLayout({
      headers: ['A', 'B'],
      rows: [
        EXPORT_HEADERS,
        ['སངས་རྒྱས་', 'buddha'],
        ['བླ་མ་', 'lama'],
      ],
    });
    expect(layout.hasHeaderRow).toBe(true);
    expect(layout.termColumn).toBe(0);
    expect(layout.definitionColumn).toBe(1);
    expect(layout.labels).toEqual(EXPORT_HEADERS);
  });

  it('reports nothing to do when an untouched export is imported back', () => {
    const rows = [
      ['སངས་རྒྱས་', 'buddha'],
      ['བླ་མ་', 'lama'],
    ];
    const stored = entriesForImport(
      rows.map(([term, definition]) => ({ term, definition }))
    ).map((entry, index) => ({ id: index + 1, ...entry }));

    const diff = diffRows(rows, { termColumn: 0, definitionColumn: 1 }, stored);
    expect(diff.unchangedCount).toBe(2);
    expect(diff.created).toEqual([]);
    expect(diff.modified).toEqual([]);
  });
});
