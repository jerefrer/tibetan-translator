/**
 * Spreadsheet import — the decisions Rust deliberately refuses to make.
 *
 * `read_spreadsheet` returns every row plus column letters; which row is a
 * header and which columns mean what is decided here, where it can be tested
 * without a filesystem.
 */
import TibetanRegExps from 'tibetan-regexps';

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
