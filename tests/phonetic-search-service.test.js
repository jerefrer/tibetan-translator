/**
 * PhoneticSearch Service Tests
 *
 * Tests the PhoneticSearch service methods:
 * - prepareTermForStrictMatching: Prepares search terms for strict FTS5 matching
 * - prepareTermForLooseMatching: Prepares search terms for loose FTS5 matching
 * - splitSyllables: Splits phonetic text into syllables
 */

import { describe, it, expect } from 'vitest'
import PhoneticSearch from '../src/services/phonetic-search.js'

describe('PhoneticSearch Service', () => {

  describe('splitSyllables', () => {
    it('handles empty string', () => {
      const result = PhoneticSearch.splitSyllables('')
      expect(result.trim()).toBe('')
    })

    it('returns a string', () => {
      const result = PhoneticSearch.splitSyllables('sangye')
      expect(typeof result).toBe('string')
    })

    it('processes phonetic input', () => {
      const result = PhoneticSearch.splitSyllables('cho')
      expect(result.length).toBeGreaterThan(0)
    })

    it('handles multi-syllable input', () => {
      const result = PhoneticSearch.splitSyllables('bodhisattva')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('prepareTermForStrictMatching', () => {
    it('returns a string', () => {
      const result = PhoneticSearch.prepareTermForStrictMatching('sangye')
      expect(typeof result).toBe('string')
    })

    it('lowercases the term', () => {
      const result = PhoneticSearch.prepareTermForStrictMatching('SANGYE')
      expect(result).toBe(result.toLowerCase())
    })

    it('handles empty string', () => {
      const result = PhoneticSearch.prepareTermForStrictMatching('')
      expect(result.trim()).toBe('')
    })

    it('converts ai to e', () => {
      const result = PhoneticSearch.prepareTermForStrictMatching('sai')
      expect(result).toContain('se')
    })

    it('converts w to p for ba/wa matching', () => {
      const result = PhoneticSearch.prepareTermForStrictMatching('wa')
      expect(result).toContain('p')
    })

    it('normalizes accented e variants (é, è, ë)', () => {
      const results = ['é', 'è', 'ë'].map(char =>
        PhoneticSearch.prepareTermForStrictMatching(char + 'pa')
      )
      results.forEach(result => {
        expect(result).toContain('e')
      })
    })

    it('handles mixed case input', () => {
      const lower = PhoneticSearch.prepareTermForStrictMatching('sangye')
      const upper = PhoneticSearch.prepareTermForStrictMatching('SANGYE')
      const mixed = PhoneticSearch.prepareTermForStrictMatching('SangYe')
      expect(lower).toBe(upper)
      expect(lower).toBe(mixed)
    })
  })

  describe('prepareTermForLooseMatching', () => {
    it('returns a string', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('sangye')
      expect(typeof result).toBe('string')
    })

    it('handles empty string', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('')
      expect(result.trim()).toBe('')
    })

    it('normalizes g to k (initial position)', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('ga')
      expect(result).toMatch(/k/)
    })

    it('converts j to ch', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('ja')
      expect(result).toContain('ch')
    })

    it('normalizes d to t', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('da')
      expect(result).toMatch(/t/)
    })

    it('normalizes b to p', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('ba')
      expect(result).toMatch(/p/)
    })

    it('normalizes z to s', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('za')
      expect(result).toMatch(/s/)
    })

    it('normalizes th to t', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('tha')
      // th -> t
      expect(result).toMatch(/t/)
    })

    it('normalizes kh to k', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('kha')
      // kh -> k
      expect(result).toMatch(/k/)
    })

    it('normalizes ph to p', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('pha')
      // ph -> p
      expect(result).toMatch(/p/)
    })

    it('normalizes dr to tr', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('dra')
      // dr -> tr
      expect(result).toMatch(/tr/)
    })

    it('normalizes lh to l', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('lha')
      // lh -> l
      expect(result).toMatch(/l/)
    })
  })

  describe('Matching equivalence classes', () => {
    // These tests verify that terms that should match in loose mode
    // produce similar or equivalent normalized forms

    it('aspirated and unaspirated k normalize similarly', () => {
      const kha = PhoneticSearch.prepareTermForLooseMatching('kha')
      const ka = PhoneticSearch.prepareTermForLooseMatching('ka')
      // Both should contain 'k' and result in similar pattern
      expect(kha).toMatch(/k/)
      expect(ka).toMatch(/k/)
    })

    it('aspirated and unaspirated t normalize similarly', () => {
      const tha = PhoneticSearch.prepareTermForLooseMatching('tha')
      const ta = PhoneticSearch.prepareTermForLooseMatching('ta')
      const da = PhoneticSearch.prepareTermForLooseMatching('da')
      // All should contain 't'
      expect(tha).toMatch(/t/)
      expect(ta).toMatch(/t/)
      expect(da).toMatch(/t/)
    })

    it('aspirated and unaspirated p normalize similarly', () => {
      const pha = PhoneticSearch.prepareTermForLooseMatching('pha')
      const pa = PhoneticSearch.prepareTermForLooseMatching('pa')
      const ba = PhoneticSearch.prepareTermForLooseMatching('ba')
      // All should contain 'p'
      expect(pha).toMatch(/p/)
      expect(pa).toMatch(/p/)
      expect(ba).toMatch(/p/)
    })

    it('j and ch normalize similarly', () => {
      const ja = PhoneticSearch.prepareTermForLooseMatching('ja')
      const cha = PhoneticSearch.prepareTermForLooseMatching('cha')
      // j -> ch, so both should contain 'ch'
      expect(ja).toMatch(/ch/)
      expect(cha).toMatch(/ch/)
    })

    it('z and s normalize similarly', () => {
      const za = PhoneticSearch.prepareTermForLooseMatching('za')
      const sa = PhoneticSearch.prepareTermForLooseMatching('sa')
      // z -> s
      expect(za).toMatch(/s/)
      expect(sa).toMatch(/s/)
    })
  })

  describe('Real-world search scenarios', () => {
    it('processes "sangye" search term', () => {
      const strict = PhoneticSearch.prepareTermForStrictMatching('sangye')
      const loose = PhoneticSearch.prepareTermForLooseMatching('sangye')
      expect(strict.length).toBeGreaterThan(0)
      expect(loose.length).toBeGreaterThan(0)
    })

    it('processes "guru" search term', () => {
      const result = PhoneticSearch.prepareTermForStrictMatching('guru')
      expect(result.length).toBeGreaterThan(0)
    })

    it('processes "rinpoche" search term', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('rinpoche')
      expect(result.length).toBeGreaterThan(0)
    })

    it('processes "karma" search term', () => {
      const strict = PhoneticSearch.prepareTermForStrictMatching('karma')
      const loose = PhoneticSearch.prepareTermForLooseMatching('karma')
      expect(strict.length).toBeGreaterThan(0)
      expect(loose.length).toBeGreaterThan(0)
    })

    it('processes "dharma" search term', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('dharma')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Edge cases and error handling', () => {
    it('handles very long terms', () => {
      const longTerm = 'bodhisattvacharyavatara'
      const result = PhoneticSearch.prepareTermForLooseMatching(longTerm)
      expect(result.length).toBeGreaterThan(0)
    })

    it('handles mixed case', () => {
      const lower = PhoneticSearch.prepareTermForStrictMatching('sangye')
      const upper = PhoneticSearch.prepareTermForStrictMatching('SANGYE')
      expect(lower).toBe(upper)
    })

    it('handles whitespace-only string', () => {
      const result = PhoneticSearch.prepareTermForLooseMatching('   ')
      expect(result.trim()).toBe('')
    })

    it('handles terms with special characters', () => {
      // Should not throw
      const result1 = PhoneticSearch.prepareTermForLooseMatching('tara-devi')
      const result2 = PhoneticSearch.prepareTermForLooseMatching('tara_devi')
      expect(typeof result1).toBe('string')
      expect(typeof result2).toBe('string')
    })
  })
})
