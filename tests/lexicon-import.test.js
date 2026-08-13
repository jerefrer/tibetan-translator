import { describe, it, expect } from 'vitest';
import { detectLayout } from '../src/services/lexicon-import.js';

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
