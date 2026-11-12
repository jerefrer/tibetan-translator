// The Search query model: what a typed query means (terms, phonetic
// variants), the SQL that finds it, how the rows are grouped and ranked, and
// how the matches are highlighted. No Vue, no database: pure functions.
import _ from 'underscore';
import TibetanRegExps from 'tibetan-regexps';

import { MAX_ENTRIES_PER_REQUEST } from '../config/constants';
import PhoneticSearch from './phonetic-search';
import {
  convertWylieInParentheses,
  phoneticsLooseFor,
  phoneticsStrictFor,
  replaceTibetanGroups,
  syllablesFor,
} from '../utils.js';

// tibetanGroups carries the g flag, so its test() resumes where the previous
// call stopped and answers false every other time on the same text. A copy
// without it gives the same answer each time.
const TIBETAN = new RegExp(TibetanRegExps.tibetanGroups.source, 'iu');

export function containsTibetan(text) {
  return TIBETAN.test(text);
}

function phoneticsTerms(searchTerms, regexp, convert) {
  return _.chain(searchTerms.map((term) => term.match(regexp)))
    .compact()
    .flatten()
    .value()
    .map((term) => term.slice(1, -1))
    .map((term) => replaceTibetanGroups(term, (tibetan) => convert(tibetan) + ' '));
}

/** The terms of a query: `a & b` are separate terms, [..] match by strict
 *  sound, {..} by loose sound, anything else is a regular term. The phonetic
 *  terms are raw: spaceless processing happens in phoneticVariants. */
export function parseSearchQuery(query) {
  const searchTerms = !query
    ? []
    : _.compact(
        convertWylieInParentheses(query)
          .split('&')
          .map((t) => t.trim())
      );
  return {
    regular: searchTerms.filter((term) => !term.match(/^[\[\{].*[\]\}]$/)),
    phoneticsStrict: phoneticsTerms(searchTerms, /^\[.*\]$/, phoneticsStrictFor),
    phoneticsLoose: phoneticsTerms(searchTerms, /^\{.*\}$/, phoneticsLooseFor),
  };
}

const MATCHING = {
  strict: (variant) => PhoneticSearch.prepareTermForStrictMatching(variant),
  loose: (variant) => PhoneticSearch.prepareTermForLooseMatching(variant),
};

// A raw phonetic term with no space is tried split every plausible way
function rawVariants(raw) {
  return raw.includes(' ') ? [raw] : PhoneticSearch.processSpacelessPhoneticSearch(raw);
}

/** The phonetic terms prepared the way they are matched against
 *  termPhoneticsStrict / termPhoneticsLoose (kind 'strict' | 'loose'). */
export function phoneticVariants(terms, kind) {
  return terms.flatMap((raw) => rawVariants(raw).map(MATCHING[kind])).filter(Boolean);
}

function prepareTerm(term) {
  return `"${term.replace(/'/g, "''").replace(/"/g, '""')}"`;
}

// Escape special SQL LIKE characters and single quotes
function prepareTermForLike(term) {
  return term.replace(/'/g, "''").replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function phoneticCondition(raw, kind) {
  const column = kind === 'strict' ? 'Strict' : 'Loose';
  const prepare = MATCHING[kind];
  const termConditions = rawVariants(raw)
    .map(prepare)
    .map((prepared) => `termPhonetics${column}:${prepareTerm(prepared)}`)
    .join(' OR ');
  return `(entries_fts MATCH '(${termConditions}) OR definitionPhoneticsWords${column}:${prepareTerm(prepare(raw))}')`;
}

const SELECT_FROM = [
  'SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition',
];

/** The SQL of a search, or '' when the query holds nothing to search.
 *  `regular` are the regular terms; `strictVariants` and `looseVariants` are
 *  the RAW phonetic terms (parseSearchQuery's phoneticsStrict / phoneticsLoose),
 *  whose spaceless variants are derived here. Hybrid search: FTS for English
 *  and phonetics, LIKE for Tibetan, as the FTS unicode61 tokenizer strips
 *  Tibetan combining characters and matches wrongly. */
export function buildSearchSql({ regular = [], strictVariants = [], looseVariants = [] }) {
  const tibetanTerms = regular.filter((t) => containsTibetan(t));
  const otherTerms = regular.filter((t) => !containsTibetan(t));

  const ftsConditions = [
    ...otherTerms.map(
      (term) => `(entries_fts MATCH 'term:${prepareTerm(term)} OR definition:${prepareTerm(term)}')`
    ),
    ...strictVariants.map((raw) => phoneticCondition(raw, 'strict')),
    ...looseVariants.map((raw) => phoneticCondition(raw, 'loose')),
  ];

  // Searches both term and definition
  const likeConditions = tibetanTerms.map((term) => {
    const escaped = prepareTermForLike(term);
    return `(entries.term LIKE '%${escaped}%' ESCAPE '\\' OR entries.definition LIKE '%${escaped}%' ESCAPE '\\')`;
  });

  if (!ftsConditions.length && likeConditions.length) {
    // Pure Tibetan search: LIKE only, no FTS join. Shorter terms (more
    // specific) first, then dictionary position
    return `
            ${SELECT_FROM[0]}, 0 AS rank
            FROM entries
            INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
            WHERE ${likeConditions.join(' AND ')}
            ORDER BY length(entries.term), dictionaryPosition
            LIMIT ${MAX_ENTRIES_PER_REQUEST}
          `;
  }
  if (ftsConditions.length) {
    // BM25 column weights: term(10), termPhoneticsStrict(8), termPhoneticsLoose(8),
    // definition(1), definitionPhoneticsWordsStrict(1), definitionPhoneticsWordsLoose(1).
    // Term matches weigh 10x over definition.
    const allConditions = [...ftsConditions, ...likeConditions];
    return `
            ${SELECT_FROM[0]},
                   bm25(entries_fts, 10.0, 8.0, 8.0, 1.0, 1.0, 1.0) AS rank
            FROM entries
            INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
            INNER JOIN entries_fts ON entries.id = entries_fts.rowid
            WHERE ${allConditions.join(' AND ')}
            ORDER BY rank
            LIMIT ${MAX_ENTRIES_PER_REQUEST}
          `;
  }
  return '';
}

/** The entries of the enabled dictionaries grouped by Tibetan term, the most
 *  relevant group first; inside a group the entries follow the user's
 *  dictionary order. `dictionaries` carry id, position and enabled. */
export function groupSearchEntries(entries, { dictionaries, regular, phoneticsStrict, phoneticsLoose }) {
  // The user's customised dictionary order (the same that drives DefinePage
  // and the settings drag-drop). The SQL row's `dictionaryPosition` is the
  // build-time order, which doesn't reflect user preferences.
  const userDictPositions = {};
  const enabledIds = new Set();
  for (const d of dictionaries) {
    userDictPositions[d.id] = d.position;
    if (d.enabled) enabledIds.add(d.id);
  }
  const enabledEntries = (entries || [])
    .filter((entry) => enabledIds.has(entry.dictionaryId))
    .sort((a, b) => (userDictPositions[a.dictionaryId] || 0) - (userDictPositions[b.dictionaryId] || 0));

  const searchTermLower = regular[0]?.toLowerCase() || '';
  const pad = (x) => x.toString().padStart(10, '0');
  const byTerm = new Map();
  for (const entry of enabledEntries) {
    if (!byTerm.has(entry.term)) byTerm.set(entry.term, []);
    byTerm.get(entry.term).push(entry);
  }

  const groups = [];
  for (const [term, termEntries] of byTerm) {
    // Dictionary position first, so reordering dictionaries in Settings
    // reorders the definitions; then BM25 rank (negative, closer to 0 =
    // better; offset to stay positive for string comparison)
    const sorted = _.sortBy(termEntries, (entry) =>
      [userDictPositions[entry.dictionaryId] || 999, (entry.rank || 0) + 1000].map(pad)
    );
    groups.push({
      term,
      entries: sorted,
      bestRank: Math.min(...termEntries.map((entry) => entry.rank || 0)),
    });
  }

  // Looking up a Tibetan word (typed in Tibetan, or by its sound) wants the
  // terms that ARE that word first, then terms that contain it, and only then
  // terms found through their definitions; within each, shorter terms before
  // BM25 rank, which otherwise favours terms with many definitions. Searching
  // English words in the definitions is ranked by BM25 first.
  const tibetanQueries = regular.filter((term) => containsTibetan(term));
  const strict = phoneticVariants(phoneticsStrict, 'strict');
  const loose = phoneticVariants(phoneticsLoose, 'loose');
  const lookingUpTibetan = tibetanQueries.length > 0 || strict.length > 0 || loose.length > 0;

  // 0: the term starts with the query, 1: contains it, 2: neither
  const termMatch = (group) => {
    const [entry] = group.entries;
    const candidates = [
      ...tibetanQueries.map((query) => [group.term, query]),
      ...strict.map((variant) => [entry.termPhoneticsStrict || '', variant]),
      ...loose.map((variant) => [entry.termPhoneticsLoose || '', variant]),
    ];
    if (candidates.some(([text, query]) => text.startsWith(query))) return 0;
    if (candidates.some(([text, query]) => text.includes(query))) return 1;
    return 2;
  };

  return _.sortBy(groups, (group) => {
    const startsWithBonus = group.term.toLowerCase().startsWith(searchTermLower) ? 0 : 1;
    const rank = group.bestRank + 1000;
    const length = group.term.length;
    return (lookingUpTibetan ? [termMatch(group), length, rank] : [startsWithBonus, rank, length]).map(pad);
  });
}

export function everySyllablesCombinationsOfGivenLengthFor(source, numberOfSyllablesForTerm) {
  const syllables = syllablesFor(source);
  const combinations = [];
  for (let i = 0; i + numberOfSyllablesForTerm <= syllables.length; i++) {
    combinations.push(syllables.slice(i, i + numberOfSyllablesForTerm).join('་') + '་');
  }
  return _.chain(combinations).uniq().sortBy('length').value();
}

export function highlightTibetanMatchingPhonetics(definition, term, convert) {
  const numberOfSyllablesForTerm = term.split(' ').length;
  return replaceTibetanGroups(definition, (group) => {
    const combinations = everySyllablesCombinationsOfGivenLengthFor(group, numberOfSyllablesForTerm);
    const match = combinations.find((subgroup) => convert(subgroup).includes(term));
    if (!match) return group;
    const matchWithoutEndingTshek = match.replace(/་$/, '');
    return group.replace(new RegExp(`(${matchWithoutEndingTshek}[་།༎༑༔]?)`, 'g'), '<em>$1</em>');
  });
}

function escapeForRegExp(text) {
  return (
    text
      // Every character a RegExp reads specially: a query typed so far
      // ("(ye shes" before its closing parenthesis, "c++") is plain text
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Treat ASCII apostrophe and curly right-single-quote as interchangeable
      // so "d'après" highlights "d'après" in the text and vice-versa.
      .replace(/['’]/g, "['’]")
  );
}

/** Wraps the matches of the terms in <em>, in the text only, never in tags. */
export function highlightSearchTerms(html, { regular = [], phoneticsStrict = [], phoneticsLoose = [] }) {
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith('<') && part.endsWith('>')) return part;
      let highlighted = part;
      regular.forEach((term) => {
        highlighted = highlighted.replace(new RegExp('(' + escapeForRegExp(term) + ')', 'ig'), '<em>$1</em>');
      });
      phoneticsStrict.forEach((term) => {
        highlighted = highlightTibetanMatchingPhonetics(highlighted, term, phoneticsStrictFor);
      });
      phoneticsLoose.forEach((term) => {
        highlighted = highlightTibetanMatchingPhonetics(highlighted, term, phoneticsLooseFor);
      });
      return highlighted;
    })
    .join('');
}

/** True when the query is a single plain Tibetan term (no '&', no [..] or
 *  {..} syntax), the one Add my definition pre-fills. */
export function isPlainTibetanQuery(query) {
  const trimmed = (query || '').trim();
  if (!trimmed || trimmed.includes('&') || /[[\]{}]/.test(trimmed)) return false;
  return containsTibetan(trimmed);
}
