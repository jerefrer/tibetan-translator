/**
 * Spreadsheet import — the decisions Rust deliberately refuses to make.
 *
 * `read_spreadsheet` returns every row plus column letters; which row is a
 * header and which columns mean what is decided here, where it can be tested
 * without a filesystem.
 */
import TibetanRegExps from 'tibetan-regexps';
import { tibetanLookupKey } from '../utils';

const TIBETAN = new RegExp(
  `[${TibetanRegExps.expressions.allTibetanCharacters}]`,
  'u'
);

const hasTibetan = (cell) => TIBETAN.test(cell || '');

/** How much of this column is Tibetan? Empty cells count neither way. */
function tibetanRatio(rows, column) {
  const filled = rows
    .map((row) => row[column] || '')
    .filter((cell) => cell.trim());
  if (!filled.length) return 0;
  return filled.filter(hasTibetan).length / filled.length;
}

/**
 * Work out how to read a grid: whether it has a header row, what to call each
 * column, and which two columns hold the term and its definition.
 *
 * @param {{headers: string[], rows: string[][]}} grid As returned by read_spreadsheet.
 * @returns {{hasHeaderRow: boolean, labels: string[], termColumn: number|null,
 *   definitionColumn: number|null, dataRows: string[][]}}
 */
export function detectLayout({ headers = [], rows = [] } = {}) {
  // Row 0 is a header when it holds no Tibetan AND something later does.
  // Without that second half, a sheet with no Tibetan anywhere would silently
  // lose its first row of data.
  const firstRow = rows[0] || [];
  const hasHeaderRow =
    rows.length > 1 &&
    !firstRow.some(hasTibetan) &&
    rows.slice(1).some((row) => row.some(hasTibetan));

  const dataRows = hasHeaderRow ? rows.slice(1) : rows;
  const labels = hasHeaderRow
    ? headers.map((letter, index) => (firstRow[index] || '').trim() || letter)
    : [...headers];

  let termColumn = null;
  let best = 0;
  headers.forEach((_, column) => {
    const ratio = tibetanRatio(dataRows, column);
    if (ratio > best) {
      best = ratio;
      termColumn = column;
    }
  });

  const definitionColumn = headers.findIndex(
    (_, column) =>
      column !== termColumn && dataRows.some((row) => (row[column] || '').trim())
  );

  return {
    hasHeaderRow,
    labels,
    termColumn,
    definitionColumn: definitionColumn === -1 ? null : definitionColumn,
    dataRows,
  };
}

/**
 * Classify every data row against what the dictionary already holds.
 *
 * Keyed on tibetanLookupKey — the same normalization the write and lookup paths
 * use — so "same term written with a shad" and "with a tsheg" collapse to one
 * entry instead of silently duplicating. tibetanLookupKey returns a lone tsheg
 * for anything with no Tibetan in it, which is how a stray "notes" cell is
 * told apart from a real term.
 *
 * @param {string[][]} dataRows Rows with the header already removed.
 * @param {{termColumn: number, definitionColumn: number}} columns
 * @param {Array<{id: number, term: string, definition: string}>} existingEntries
 * @returns {{created: Array, modified: Array, unchangedCount: number, ignored: Array}}
 */
export function diffRows(dataRows, { termColumn, definitionColumn }, existingEntries = []) {
  const existing = new Map(
    existingEntries.map((entry) => [tibetanLookupKey(entry.term), entry])
  );

  // Last occurrence wins, so walk backwards and skip keys already taken.
  const seen = new Set();
  const ignored = [];
  const retained = [];

  for (let index = dataRows.length - 1; index >= 0; index--) {
    const row = index + 1; // 1-based: what the user sees in the sheet
    const rawTerm = (dataRows[index][termColumn] || '').trim();
    const key = rawTerm ? tibetanLookupKey(rawTerm) : '';

    if (!key || !key.replace(/[་།༑༔\s]/g, '')) {
      ignored.push({ row, reason: 'noTerm' });
      continue;
    }
    if (seen.has(key)) {
      ignored.push({ row, reason: 'duplicate' });
      continue;
    }
    seen.add(key);
    retained.push({
      row,
      key,
      term: key,
      definition: (dataRows[index][definitionColumn] || '').trim(),
    });
  }

  retained.reverse();
  ignored.sort((a, b) => a.row - b.row);

  const created = [];
  const modified = [];
  let unchangedCount = 0;

  for (const { row, key, term, definition } of retained) {
    const match = existing.get(key);
    if (!match) {
      created.push({ term, definition, row });
    } else if (match.definition === definition) {
      unchangedCount++;
    } else {
      modified.push({ term, definition, previousDefinition: match.definition, row });
    }
  }

  return { created, modified, unchangedCount, ignored };
}
