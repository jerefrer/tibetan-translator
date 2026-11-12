/**
 * Search Query Integration Tests
 *
 * Tests the complete search query generation flow including:
 * - Regular text search
 * - Strict phonetics search [term]
 * - Loose phonetics search {term}
 * - Combined searches with & operator
 * - Merged syllable matching (sangye vs sang gye)
 *
 * These tests validate the query generation logic extracted from SearchPage.vue
 */

import { describe, it, expect } from 'vitest'
import PhoneticSearch from '../src/services/phonetic-search.js'
import {
  parseSearchQuery,
  phoneticVariants,
  buildSearchSql,
  groupSearchEntries,
  highlightSearchTerms,
  isPlainTibetanQuery,
} from '../src/services/search-query.js'

/**
 * A thin view on the real query model (src/services/search-query.js): the
 * parsed terms, their prepared phonetic variants and the SQL conditions.
 */
class SearchQueryBuilder {
  constructor(query) {
    this.searchQuery = query
    this.parsed = parseSearchQuery(query)
    this.searchTerms = [
      ...this.parsed.regular,
      ...this.parsed.phoneticsStrict,
      ...this.parsed.phoneticsLoose,
    ]
  }

  get regularSearchTerms() {
    return this.parsed.regular
  }

  // Prepared the way they are matched against the phonetics columns
  get phoneticsStrictSearchTerms() {
    return this.parsed.phoneticsStrict.map((term) =>
      PhoneticSearch.prepareTermForStrictMatching(term)
    )
  }

  get phoneticsLooseSearchTerms() {
    return this.parsed.phoneticsLoose.map((term) =>
      PhoneticSearch.prepareTermForLooseMatching(term)
    )
  }

  get sql() {
    return buildSearchSql({
      regular: this.parsed.regular,
      strictVariants: this.parsed.phoneticsStrict,
      looseVariants: this.parsed.phoneticsLoose,
    })
  }

  // The WHERE conditions, which the SQL joins with AND
  buildFTS5Conditions() {
    const where = /WHERE (.*)\n/.exec(this.sql)?.[1]
    return where ? where.split(/(?<=\)) AND (?=\()/) : []
  }
}

// A spaceless sound ("sangye") is tried split every plausible way, in the same
// termPhonetics column: "sang gye" is found by it
const MANY_STRICT_VARIANTS = /termPhoneticsStrict:"[^"]*" OR termPhoneticsStrict:"[^"]*"/
const MANY_LOOSE_VARIANTS = /termPhoneticsLoose:"[^"]*" OR termPhoneticsLoose:"[^"]*"/

describe('Search Query Builder', () => {

  describe('Term parsing', () => {
    it('parses single regular term', () => {
      const builder = new SearchQueryBuilder('buddha')
      expect(builder.regularSearchTerms).toEqual(['buddha'])
      expect(builder.phoneticsStrictSearchTerms).toEqual([])
      expect(builder.phoneticsLooseSearchTerms).toEqual([])
    })

    it('parses single strict phonetics term [term]', () => {
      const builder = new SearchQueryBuilder('[sangye]')
      expect(builder.regularSearchTerms).toEqual([])
      expect(builder.phoneticsStrictSearchTerms.length).toBe(1)
      expect(builder.phoneticsLooseSearchTerms).toEqual([])
    })

    it('parses single loose phonetics term {term}', () => {
      const builder = new SearchQueryBuilder('{sangye}')
      expect(builder.regularSearchTerms).toEqual([])
      expect(builder.phoneticsStrictSearchTerms).toEqual([])
      expect(builder.phoneticsLooseSearchTerms.length).toBe(1)
    })

    it('parses multiple terms with & operator', () => {
      const builder = new SearchQueryBuilder('buddha & dharma')
      expect(builder.regularSearchTerms).toEqual(['buddha', 'dharma'])
    })

    it('parses mixed regular and phonetics terms', () => {
      const builder = new SearchQueryBuilder('buddha & [sangye]')
      expect(builder.regularSearchTerms).toEqual(['buddha'])
      expect(builder.phoneticsStrictSearchTerms.length).toBe(1)
    })

    it('parses multiple phonetics terms', () => {
      const builder = new SearchQueryBuilder('[sangye] & {dorje}')
      expect(builder.phoneticsStrictSearchTerms.length).toBe(1)
      expect(builder.phoneticsLooseSearchTerms.length).toBe(1)
    })

    it('handles whitespace around & operator', () => {
      const builder = new SearchQueryBuilder('  buddha  &  dharma  ')
      expect(builder.regularSearchTerms).toEqual(['buddha', 'dharma'])
    })

    it('handles empty query', () => {
      const builder = new SearchQueryBuilder('')
      expect(builder.regularSearchTerms).toEqual([])
      expect(builder.phoneticsStrictSearchTerms).toEqual([])
      expect(builder.phoneticsLooseSearchTerms).toEqual([])
    })

    it('handles query with only &', () => {
      const builder = new SearchQueryBuilder('&')
      expect(builder.regularSearchTerms).toEqual([])
    })

    it('handles multiple & operators', () => {
      const builder = new SearchQueryBuilder('a & b & c')
      expect(builder.regularSearchTerms).toEqual(['a', 'b', 'c'])
    })
  })

  describe('FTS5 condition generation', () => {
    it('generates regular search condition', () => {
      const builder = new SearchQueryBuilder('buddha')
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(1)
      expect(conditions[0]).toMatch(/term:.*buddha/)
      expect(conditions[0]).toMatch(/definition:.*buddha/)
    })

    it('generates strict phonetics condition with spaceless variants', () => {
      const builder = new SearchQueryBuilder('[sangye]')
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(1)
      // Tries the spaceless sound split every plausible way
      expect(conditions[0]).toMatch(/termPhoneticsStrict:/)
      expect(conditions[0]).toMatch(MANY_STRICT_VARIANTS)
      expect(conditions[0]).toMatch(/definitionPhoneticsWordsStrict:/)
    })

    it('generates loose phonetics condition with spaceless variants', () => {
      const builder = new SearchQueryBuilder('{sangye}')
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(1)
      expect(conditions[0]).toMatch(/termPhoneticsLoose:/)
      expect(conditions[0]).toMatch(MANY_LOOSE_VARIANTS)
      expect(conditions[0]).toMatch(/definitionPhoneticsWordsLoose:/)
    })

    it('generates multiple conditions for & queries', () => {
      const builder = new SearchQueryBuilder('buddha & [sangye]')
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(2)
    })

    it('properly escapes single quotes in terms', () => {
      const builder = new SearchQueryBuilder("it's")
      const conditions = builder.buildFTS5Conditions()

      expect(conditions[0]).toMatch(/it''s/) // Single quote should be doubled
    })

    it('properly escapes double quotes in terms', () => {
      const builder = new SearchQueryBuilder('"quoted"')
      const conditions = builder.buildFTS5Conditions()

      // The prepareTerm function wraps in double quotes and escapes internal quotes
      expect(conditions[0]).toContain('quoted')
    })
  })

  describe('Spaceless syllable matching', () => {
    it('[sangye] generates the spaceless variants of the term', () => {
      const builder = new SearchQueryBuilder('[sangye]')
      const conditions = builder.buildFTS5Conditions()

      // The condition tries several splits of the spaceless sound
      expect(conditions[0]).toMatch(MANY_STRICT_VARIANTS)
    })

    it('{sanggye} should work for finding sang gye', () => {
      const builder = new SearchQueryBuilder('{sanggye}')
      const conditions = builder.buildFTS5Conditions()

      // Several splits of the sound are tried
      expect(conditions[0]).toMatch(MANY_LOOSE_VARIANTS)
    })

    it('complex terms generate spaceless variants', () => {
      const builder = new SearchQueryBuilder('[jangchub]')
      const conditions = builder.buildFTS5Conditions()

      // Should try several splits
      expect(conditions[0]).toMatch(MANY_STRICT_VARIANTS)
    })
  })

  describe('AND operation with multiple terms', () => {
    it('combines regular and phonetics terms with AND', () => {
      const builder = new SearchQueryBuilder('compassion & [nying]')
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(2)
      // First condition is regular search
      expect(conditions[0]).toMatch(/term:.*compassion/)
      // Second condition is phonetics search
      expect(conditions[1]).toMatch(/termPhoneticsStrict:/)
    })

    it('supports three-way AND', () => {
      const builder = new SearchQueryBuilder('[sangye] & {cho} & dharma')
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(3)
    })

    it('AND conditions should be joined with AND in final query', () => {
      const builder = new SearchQueryBuilder('a & b')
      const conditions = builder.buildFTS5Conditions()

      // When used in SQL, these should be joined with AND
      const finalWhere = conditions.join(' AND ')
      expect(finalWhere).toMatch(/AND/)
    })
  })

  describe('Strict vs Loose phonetics behavior', () => {
    it('[term] uses strict matching rules', () => {
      const builder = new SearchQueryBuilder('[kha]')
      const strictTerms = builder.phoneticsStrictSearchTerms
      const conditions = builder.buildFTS5Conditions()

      expect(conditions[0]).toMatch(/termPhoneticsStrict:/)
      expect(conditions[0]).not.toMatch(/termPhoneticsLoose:/)
    })

    it('{term} uses loose matching rules', () => {
      const builder = new SearchQueryBuilder('{kha}')
      const looseTerms = builder.phoneticsLooseSearchTerms
      const conditions = builder.buildFTS5Conditions()

      expect(conditions[0]).toMatch(/termPhoneticsLoose:/)
      expect(conditions[0]).not.toMatch(/termPhoneticsStrict:/)
    })

    it('[kha] and [ka] generate different conditions', () => {
      const builder1 = new SearchQueryBuilder('[kha]')
      const builder2 = new SearchQueryBuilder('[ka]')

      const terms1 = builder1.phoneticsStrictSearchTerms
      const terms2 = builder2.phoneticsStrictSearchTerms

      // In strict mode, kha and ka should be different
      expect(terms1[0]).not.toBe(terms2[0])
    })

    it('{kha} and {ka} may generate similar conditions', () => {
      const builder1 = new SearchQueryBuilder('{kha}')
      const builder2 = new SearchQueryBuilder('{ka}')

      const terms1 = builder1.phoneticsLooseSearchTerms
      const terms2 = builder2.phoneticsLooseSearchTerms

      // In loose mode, kh->k normalization means these might be the same
      // This is the expected behavior for fuzzy matching
      expect(terms1[0].replace(/h/g, '')).toBe(terms2[0].replace(/h/g, ''))
    })
  })

  describe('Real-world search scenarios', () => {
    it('searching for Buddha in phonetics: [sangye]', () => {
      const builder = new SearchQueryBuilder('[sangye]')
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(1)
      expect(conditions[0]).toMatch(/termPhoneticsStrict:/)
      expect(conditions[0]).toMatch(MANY_STRICT_VARIANTS)
    })

    it('searching for "enlightenment" AND phonetics: enlightenment & [jangchub]', () => {
      const builder = new SearchQueryBuilder('enlightenment & [jangchub]')
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(2)
      expect(conditions[0]).toMatch(/enlightenment/)
      expect(conditions[1]).toMatch(/termPhoneticsStrict:/)
    })

    it('fuzzy phonetics search: {dorje}', () => {
      const builder = new SearchQueryBuilder('{dorje}')
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(1)
      expect(conditions[0]).toMatch(/termPhoneticsLoose:/)
    })

    it('combining strict and loose: [sangye] & {cho}', () => {
      const builder = new SearchQueryBuilder('[sangye] & {cho}')
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(2)
      expect(conditions[0]).toMatch(/termPhoneticsStrict:/)
      expect(conditions[1]).toMatch(/termPhoneticsLoose:/)
    })

    it('searching compassion: compassion & [nying] & {je}', () => {
      const builder = new SearchQueryBuilder('compassion & [nying] & {je}')
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(3)
      expect(conditions[0]).toMatch(/term:.*compassion/)
      expect(conditions[1]).toMatch(/termPhoneticsStrict:/)
      expect(conditions[2]).toMatch(/termPhoneticsLoose:/)
    })
  })

  describe('Tibetan script in search', () => {
    it('handles Tibetan script in brackets: [སངས་རྒྱས]', () => {
      const builder = new SearchQueryBuilder('[སངས་རྒྱས་]')
      const strictTerms = builder.phoneticsStrictSearchTerms

      // Should convert Tibetan to phonetics
      expect(strictTerms.length).toBe(1)
      expect(strictTerms[0].length).toBeGreaterThan(0)
    })

    it('handles Tibetan script in braces: {ཆོས}', () => {
      const builder = new SearchQueryBuilder('{ཆོས་}')
      const looseTerms = builder.phoneticsLooseSearchTerms

      expect(looseTerms.length).toBe(1)
      expect(looseTerms[0].length).toBeGreaterThan(0)
    })

    it('handles mixed Tibetan and English in AND: wisdom & [ཤེས་རབ]', () => {
      const builder = new SearchQueryBuilder('wisdom & [ཤེས་རབ་]')
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(2)
      expect(conditions[0]).toMatch(/wisdom/)
      expect(conditions[1]).toMatch(/termPhoneticsStrict:/)
    })
  })

  describe('Edge cases', () => {
    it('handles nested brackets (should be treated literally)', () => {
      const builder = new SearchQueryBuilder('[[nested]]')
      // Should not crash, behavior may vary
      expect(builder.searchTerms.length).toBe(1)
    })

    it('handles unclosed bracket', () => {
      const builder = new SearchQueryBuilder('[unclosed')
      // Should be treated as regular term
      expect(builder.regularSearchTerms).toContain('[unclosed')
    })

    it('handles empty brackets []', () => {
      const builder = new SearchQueryBuilder('[]')
      // Empty brackets should not produce search terms
      expect(builder.phoneticsStrictSearchTerms.length).toBeLessThanOrEqual(1)
    })

    it('handles empty braces {}', () => {
      const builder = new SearchQueryBuilder('{}')
      expect(builder.phoneticsLooseSearchTerms.length).toBeLessThanOrEqual(1)
    })

    it('handles very long search queries', () => {
      const longQuery = '[sangye] & {dorje} & [padma] & {cho} & enlightenment & buddha & dharma'
      const builder = new SearchQueryBuilder(longQuery)
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(7)
    })

    it('handles special characters in regular search', () => {
      const builder = new SearchQueryBuilder("Buddha's teachings")
      const conditions = builder.buildFTS5Conditions()

      expect(conditions[0]).toMatch(/Buddha''s/)
    })
  })
})

describe('SQL of a search', () => {
  // Captured from SearchPage.performSearch before the code moved here
  const EXPECTED = {
    "wakefulness": "\n            SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition,\n                   bm25(entries_fts, 10.0, 8.0, 8.0, 1.0, 1.0, 1.0) AS rank\n            FROM entries\n            INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId\n            INNER JOIN entries_fts ON entries.id = entries_fts.rowid\n            WHERE (entries_fts MATCH 'term:\"wakefulness\" OR definition:\"wakefulness\"')\n            ORDER BY rank\n            LIMIT 5000\n          ",
    "ཡེ་ཤེས་ & wisdom": "\n            SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition,\n                   bm25(entries_fts, 10.0, 8.0, 8.0, 1.0, 1.0, 1.0) AS rank\n            FROM entries\n            INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId\n            INNER JOIN entries_fts ON entries.id = entries_fts.rowid\n            WHERE (entries_fts MATCH 'term:\"wisdom\" OR definition:\"wisdom\"') AND (entries.term LIKE '%ཡེ་ཤེས་%' ESCAPE '\\' OR entries.definition LIKE '%ཡེ་ཤེས་%' ESCAPE '\\')\n            ORDER BY rank\n            LIMIT 5000\n          ",
    "{jomden}": "\n            SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition,\n                   bm25(entries_fts, 10.0, 8.0, 8.0, 1.0, 1.0, 1.0) AS rank\n            FROM entries\n            INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId\n            INNER JOIN entries_fts ON entries.id = entries_fts.rowid\n            WHERE (entries_fts MATCH '(termPhoneticsLoose:\"cho mten\" OR termPhoneticsLoose:\"chom ten\" OR termPhoneticsLoose:\"chomten\" OR termPhoneticsLoose:\"cho mmten\" OR termPhoneticsLoose:\"chom mten\" OR termPhoneticsLoose:\"chommten\" OR termPhoneticsLoose:\"chommten\" OR termPhoneticsLoose:\"cho mtten\" OR termPhoneticsLoose:\"chom tten\" OR termPhoneticsLoose:\"chomtten\" OR termPhoneticsLoose:\"chomtten\" OR termPhoneticsLoose:\"cho mtenn\" OR termPhoneticsLoose:\"chom tenn\" OR termPhoneticsLoose:\"chomt enn\") OR definitionPhoneticsWordsLoose:\"chom ten\"')\n            ORDER BY rank\n            LIMIT 5000\n          "
  }

  for (const [query, expected] of Object.entries(EXPECTED)) {
    it(`should build the same SQL as the Search page did for ${query}`, () => {
      expect(new SearchQueryBuilder(query).sql).toBe(expected)
    })
  }

  it('should return no SQL when the query holds nothing to search', () => {
    expect(new SearchQueryBuilder('&').sql).toBe('')
  })
})

describe('phoneticVariants', () => {
  it('should keep a term with a space as is, prepared for matching', () => {
    expect(phoneticVariants(['sang gye'], 'strict')).toEqual([
      PhoneticSearch.prepareTermForStrictMatching('sang gye'),
    ])
  })

  it('should try a spaceless term split several ways', () => {
    expect(phoneticVariants(['sangye'], 'loose').length).toBeGreaterThan(1)
  })
})

describe('groupSearchEntries', () => {
  const dictionaries = [
    { id: 1, position: 2, enabled: true },
    { id: 2, position: 1, enabled: true },
    { id: 3, position: 3, enabled: false },
  ]
  const terms = { regular: ['wisdom'], phoneticsStrict: [], phoneticsLoose: [] }

  it('should leave out the entries of disabled dictionaries', () => {
    const entries = [
      { term: 'a', dictionaryId: 1, rank: -1 },
      { term: 'b', dictionaryId: 3, rank: -5 },
    ]
    expect(groupSearchEntries(entries, { dictionaries, ...terms }).map((g) => g.term)).toEqual(['a'])
  })

  it('should order the entries of a group by the user dictionary order', () => {
    const entries = [
      { term: 'a', dictionaryId: 1, rank: -9 },
      { term: 'a', dictionaryId: 2, rank: -1 },
    ]
    const [group] = groupSearchEntries(entries, { dictionaries, ...terms })
    expect(group.entries.map((e) => e.dictionaryId)).toEqual([2, 1])
  })

  it('should rank a term starting with the query first, then by BM25, for English', () => {
    const entries = [
      { term: 'unwise', dictionaryId: 1, rank: -9 },
      { term: 'wisdom', dictionaryId: 1, rank: -1 },
    ]
    expect(groupSearchEntries(entries, { dictionaries, ...terms }).map((g) => g.term)).toEqual(['wisdom', 'unwise'])
  })

  it('should put the term that is the Tibetan query before longer terms containing it', () => {
    const entries = [
      { term: 'ཡེ་ཤེས་ཀྱི་', dictionaryId: 1, rank: -9 },
      { term: 'ཡེ་ཤེས་', dictionaryId: 1, rank: -1 },
    ]
    const query = { regular: ['ཡེ་ཤེས་'], phoneticsStrict: [], phoneticsLoose: [] }
    expect(groupSearchEntries(entries, { dictionaries, ...query }).map((g) => g.term)).toEqual([
      'ཡེ་ཤེས་',
      'ཡེ་ཤེས་ཀྱི་',
    ])
  })
})

describe('highlightSearchTerms', () => {
  const none = { regular: [], phoneticsStrict: [], phoneticsLoose: [] }

  it('should wrap a regular term in em, ignoring case', () => {
    expect(highlightSearchTerms('Wisdom of wisdom', { ...none, regular: ['wisdom'] })).toBe(
      '<em>Wisdom</em> of <em>wisdom</em>'
    )
  })

  it('should not touch the inside of tags', () => {
    expect(highlightSearchTerms('<a href="/define/wisdom">wisdom</a>', { ...none, regular: ['wisdom'] })).toBe(
      '<a href="/define/wisdom"><em>wisdom</em></a>'
    )
  })

  it('should treat the curly and the straight apostrophe alike', () => {
    expect(highlightSearchTerms('d\u2019apr\u00e8s', { ...none, regular: ["d'apr\u00e8s"] })).toBe(
      '<em>d\u2019apr\u00e8s</em>'
    )
  })
})

describe('isPlainTibetanQuery', () => {
  it('should accept a single Tibetan term', () => {
    expect(isPlainTibetanQuery(' ཡེ་ཤེས་ ')).toBe(true)
  })

  it('should refuse English, empty, multi-term and phonetic queries', () => {
    for (const query of ['wisdom', '', undefined, 'ཡེ་ཤེས་ & wisdom', '[ཡེ་ཤེས་]', '{ཡེ་ཤེས་}']) {
      expect(isPlainTibetanQuery(query)).toBe(false)
    }
  })
})
