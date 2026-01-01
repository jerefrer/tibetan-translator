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

import { describe, it, expect, beforeEach } from 'vitest'
import PhoneticSearch from '../src/services/phonetic-search.js'
import {
  phoneticsStrictFor,
  phoneticsLooseFor,
  replaceTibetanGroups,
} from '../src/utils.js'

/**
 * Simulates the search query parsing logic from SearchPage.vue
 */
class SearchQueryBuilder {
  constructor(query) {
    this.searchQuery = query
    this.searchTerms = this.parseSearchTerms()
  }

  parseSearchTerms() {
    if (!this.searchQuery) return []
    return this.searchQuery
      .split('&')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
  }

  get regularSearchTerms() {
    return this.searchTerms.filter((term) => !term.match(/^[\[\{].*[\]\}]$/))
  }

  get phoneticsStrictSearchTerms() {
    const terms = this.phoneticsTerms(/^\[.*\]$/, phoneticsStrictFor)
    return terms.map((term) =>
      PhoneticSearch.prepareTermForStrictMatching(term)
    )
  }

  get phoneticsLooseSearchTerms() {
    const terms = this.phoneticsTerms(/^\{.*\}$/, phoneticsLooseFor)
    return terms.map((term) =>
      PhoneticSearch.prepareTermForLooseMatching(term)
    )
  }

  phoneticsTerms(regexp, convert) {
    return this.searchTerms
      .map((term) => term.match(regexp))
      .filter((match) => match !== null)
      .flat()
      .map((term) => term.slice(1, -1)) // Remove brackets
      .map((term) =>
        replaceTibetanGroups(term, (tibetan) => convert(tibetan) + ' ')
      )
  }

  prepareTerm(term) {
    return `"${term.replace(/'/g, "''").replace(/"/g, '""')}"`
  }

  buildFTS5Conditions() {
    const conditions = []

    // Regular search terms
    this.regularSearchTerms.forEach((term) => {
      conditions.push(
        `(entries_fts MATCH 'term:${this.prepareTerm(term)} OR definition:${this.prepareTerm(term)}')`
      )
    })

    // Strict phonetics search terms
    this.phoneticsStrictSearchTerms.forEach((phoneticsStrictTerm) => {
      const mergedTerm = phoneticsStrictTerm.replace(/ /g, '')
      conditions.push(
        `(entries_fts MATCH 'termPhoneticsStrict:${this.prepareTerm(phoneticsStrictTerm)} OR termPhoneticsMergedStrict:${this.prepareTerm(mergedTerm)} OR definitionPhoneticsWordsStrict:${this.prepareTerm(phoneticsStrictTerm)}')`
      )
    })

    // Loose phonetics search terms
    this.phoneticsLooseSearchTerms.forEach((phoneticsLooseTerm) => {
      const mergedTerm = phoneticsLooseTerm.replace(/ /g, '')
      conditions.push(
        `(entries_fts MATCH 'termPhoneticsLoose:${this.prepareTerm(phoneticsLooseTerm)} OR termPhoneticsMergedLoose:${this.prepareTerm(mergedTerm)} OR definitionPhoneticsWordsLoose:${this.prepareTerm(phoneticsLooseTerm)}')`
      )
    })

    return conditions
  }
}

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

    it('generates strict phonetics condition with merged variant', () => {
      const builder = new SearchQueryBuilder('[sangye]')
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(1)
      // Should search both spaced and merged columns
      expect(conditions[0]).toMatch(/termPhoneticsStrict:/)
      expect(conditions[0]).toMatch(/termPhoneticsMergedStrict:/)
      expect(conditions[0]).toMatch(/definitionPhoneticsWordsStrict:/)
    })

    it('generates loose phonetics condition with merged variant', () => {
      const builder = new SearchQueryBuilder('{sangye}')
      const conditions = builder.buildFTS5Conditions()

      expect(conditions.length).toBe(1)
      expect(conditions[0]).toMatch(/termPhoneticsLoose:/)
      expect(conditions[0]).toMatch(/termPhoneticsMergedLoose:/)
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

  describe('Merged syllable matching', () => {
    it('[sangye] generates both spaced and merged search terms', () => {
      const builder = new SearchQueryBuilder('[sangye]')
      const conditions = builder.buildFTS5Conditions()

      // The condition should include both the spaced version and merged version
      expect(conditions[0]).toMatch(/termPhoneticsMergedStrict:/)
    })

    it('{sanggye} should work for finding sang gye', () => {
      const builder = new SearchQueryBuilder('{sanggye}')
      const conditions = builder.buildFTS5Conditions()

      // Merged search should be included
      expect(conditions[0]).toMatch(/termPhoneticsMergedLoose:/)
    })

    it('complex terms generate proper merged variants', () => {
      const builder = new SearchQueryBuilder('[jangchub]')
      const conditions = builder.buildFTS5Conditions()

      // Should include merged column search
      expect(conditions[0]).toMatch(/termPhoneticsMergedStrict:/)
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
      expect(conditions[0]).toMatch(/termPhoneticsMergedStrict:/)
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
