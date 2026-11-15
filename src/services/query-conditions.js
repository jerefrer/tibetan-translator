/**
 * Search's query read as conditions, and conditions written back as a query.
 *
 * A query is conditions joined by `&`; each one is matched in a mode that its
 * brackets say: `term` contains, `(term)` Wylie, `[term]` sounds like,
 * `{term}` sounds roughly like. The query builder edits them as rows, the
 * recent searches draw them as chips.
 */

/** The modes in the order the builder offers them. */
export const MATCH_MODES = [
  { value: 'contains', label: 'contains', hint: 'Anywhere in a definition', prefix: '', suffix: '' },
  { value: 'wylie', label: 'Wylie', hint: 'Wylie, read as Tibetan', prefix: '(', suffix: ')' },
  {
    value: 'phonetic-strict',
    label: 'sounds like',
    hint: 'A Tibetan word pronounced like this, however it is spelled',
    prefix: '[',
    suffix: ']',
  },
  {
    value: 'phonetic-loose',
    label: 'sounds roughly like',
    hint: 'A Tibetan word that sounds more or less like this',
    prefix: '{',
    suffix: '}',
  },
];

// One condition's text -> its mode and term
function readCondition(text) {
  const strict = text.match(/^\[(.+)\]$/);
  if (strict) return { mode: 'phonetic-strict', term: strict[1] };
  const loose = text.match(/^\{(.+)\}$/);
  if (loose) return { mode: 'phonetic-loose', term: loose[1] };
  const wylie = text.match(/^\((.+)\)$/);
  if (wylie) return { mode: 'wylie', term: wylie[1] };
  return { mode: 'contains', term: text };
}

/** [{ mode, term }] for a query; [] when it holds nothing. */
export function queryConditions(query) {
  return (query || '')
    .split('&')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(readCondition);
}

/** The query for conditions; the ones without a term are left out. */
export function conditionsQuery(conditions) {
  return conditions
    .filter((condition) => condition.term && condition.term.trim())
    .map((condition) => {
      const { prefix, suffix } = MATCH_MODES.find((mode) => mode.value === condition.mode);
      return prefix + condition.term.trim() + suffix;
    })
    .join(' & ');
}
