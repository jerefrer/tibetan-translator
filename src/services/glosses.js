// One-line glosses for the rows of a result list: the first words of the
// definition of the first enabled dictionary that has the term.
import SqlDatabase from './sql-database';
import { decodeEntities } from './html-entities';

const cache = new Map();

export function clearGlossCache() {
  cache.clear();
}

if (typeof window !== 'undefined') {
  window.addEventListener('all-terms-updated', clearGlossCache);
  window.addEventListener('dictionaries-updated', clearGlossCache);
}

/** The definition as one line of plain text, cut on a word with an ellipsis. */
export function plainGloss(definitionHtml, maxLength = 120) {
  const text = decodeEntities((definitionHtml || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const atWord = cut.lastIndexOf(' ');
  return (atWord > 0 ? cut.slice(0, atWord) : cut).replace(/[\s,;:.]+$/, '') + '…';
}

const quote = (term) => `'${term.replace(/'/g, "''")}'`;

/** term -> one-line gloss, for the enabled dictionary that comes first in the
 *  user's order. Only the terms not cached are queried. */
export async function loadGlosses(terms, dictionaries) {
  const missing = [...new Set(terms)].filter((term) => !cache.has(term));
  if (missing.length) {
    const rows = await SqlDatabase.exec(
      `SELECT term, definition, dictionaryId FROM entries WHERE term IN (${missing.map(quote).join(', ')})`
    );
    const positions = new Map(dictionaries.filter((d) => d.enabled).map((d) => [d.id, d.position]));
    const best = new Map();
    for (const row of rows || []) {
      if (!positions.has(row.dictionaryId)) continue;
      const current = best.get(row.term);
      if (!current || positions.get(row.dictionaryId) < positions.get(current.dictionaryId)) {
        best.set(row.term, row);
      }
    }
    for (const term of missing) {
      cache.set(term, best.has(term) ? plainGloss(best.get(term).definition) : '');
    }
  }
  return new Map(terms.map((term) => [term, cache.get(term)]));
}
