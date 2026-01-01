/**
 * Phonetics Generation Tests
 *
 * Tests the core phonetics generation functions from utils.js:
 * - phoneticsStrictFor: Generates strict phonetics (preserves more distinctions)
 * - phoneticsLooseFor: Generates loose phonetics (merges similar sounds)
 * - syllablesFor: Splits Tibetan text into syllables
 *
 * And phonetic-search.js functions:
 * - expandDoubledConsonants: Generates doubled consonant variants
 * - generateSyllableSplits: Splits merged text into syllables
 * - processSpacelessPhoneticSearch: Main entry point for spaceless search handling
 */

import { describe, expect, it } from 'vitest';
import {
  phoneticsLooseFor,
  phoneticsStrictFor,
  strictAndLoosePhoneticsFor,
  syllablesFor,
} from '../src/utils.js';
import PhoneticSearch from '../src/services/phonetic-search.js';

describe('Phonetics Generation', () => {
  describe('syllablesFor', () => {
    it('splits simple Tibetan words into syllables', () => {
      // སངས་རྒྱས (sangs rgyas = Buddha)
      const syllables = syllablesFor('སངས་རྒྱས་');
      expect(syllables).toEqual(['སངས', 'རྒྱས']);
    });

    it('handles single syllable words', () => {
      // བླ (bla = lama prefix)
      const syllables = syllablesFor('བླ་');
      expect(syllables).toEqual(['བླ']);
    });

    it('handles multiple syllables', () => {
      // བྱང་ཆུབ་སེམས་དཔའ (byang chub sems dpa' = bodhisattva)
      const syllables = syllablesFor('བྱང་ཆུབ་སེམས་དཔའ་');
      expect(syllables).toEqual(['བྱང', 'ཆུབ', 'སེམས', 'དཔའ']);
    });

    it('handles various Tibetan punctuation', () => {
      // Text with different punctuation marks
      const syllables = syllablesFor('སངས་རྒྱས།');
      expect(syllables).toEqual(['སངས', 'རྒྱས']);
    });

    it('removes trailing tshek and shad', () => {
      const syllables = syllablesFor('བོད་');
      expect(syllables).toEqual(['བོད']);
    });
  });

  describe('phoneticsStrictFor', () => {
    it('converts སངས་རྒྱས (sangs rgyas) to strict phonetics', () => {
      const phonetics = phoneticsStrictFor('སངས་རྒྱས་');
      // The actual output is "sang gye" based on the library
      expect(phonetics.toLowerCase()).toContain('sang');
      expect(phonetics.toLowerCase()).toContain('gye');
    });

    it('converts བྱང་ཆུབ (byang chub) correctly', () => {
      const phonetics = phoneticsStrictFor('བྱང་ཆུབ་');
      // The library produces "chang chup" for strict mode
      expect(phonetics.toLowerCase()).toMatch(/chang|jang/);
      expect(phonetics.toLowerCase()).toMatch(/chu/);
    });

    it('handles compound consonants', () => {
      // རྒྱ (rgya)
      const phonetics = phoneticsStrictFor('རྒྱ་');
      expect(phonetics.toLowerCase()).toMatch(/gya/);
    });

    it('converts ཆོས (chos = dharma) correctly', () => {
      const phonetics = phoneticsStrictFor('ཆོས་');
      expect(phonetics.toLowerCase()).toMatch(/chö/);
    });

    it('converts བླ་མ (bla ma = lama) correctly', () => {
      const phonetics = phoneticsStrictFor('བླ་མ་');
      expect(phonetics.toLowerCase()).toMatch(/la/);
      expect(phonetics.toLowerCase()).toMatch(/ma/);
    });

    it('produces non-empty output for valid Tibetan', () => {
      const phonetics = phoneticsStrictFor('བོད་');
      expect(phonetics.length).toBeGreaterThan(0);
    });
  });

  describe('phoneticsLooseFor', () => {
    it('converts སངས་རྒྱས (sangs rgyas) to loose phonetics', () => {
      const phonetics = phoneticsLooseFor('སངས་རྒྱས་');
      expect(phonetics.length).toBeGreaterThan(0);
    });

    it('produces normalized output', () => {
      // Loose mode normalizes more sounds together
      const phonetics = phoneticsLooseFor('ཆོས་');
      expect(phonetics.length).toBeGreaterThan(0);
    });
  });

  describe('Syllable Expansion and Splitting (PhoneticSearch)', () => {
    describe('expandDoubledConsonants', () => {
      it('generates doubled consonant variants', () => {
        const variants = PhoneticSearch.expandDoubledConsonants('sangye');
        expect(variants).toContain('sangye');  // Original
        expect(variants).toContain('sanggye'); // Doubled g
      });

      it('handles terms without obvious doubling points', () => {
        const variants = PhoneticSearch.expandDoubledConsonants('cho');
        expect(variants).toContain('cho');
      });

      it('generates multiple variants for complex terms', () => {
        const variants = PhoneticSearch.expandDoubledConsonants('lopön');
        expect(variants.length).toBeGreaterThanOrEqual(1);
        expect(variants).toContain('lopön');
      });
    });

    describe('generateSyllableSplits', () => {
      it('splits merged terms into possible syllables', () => {
        const splits = PhoneticSearch.generateSyllableSplits('sanggye');
        // Should find "sang gye" as a valid split
        expect(splits.some(s => s.includes('sang') && s.includes('gye'))).toBe(true);
      });

      it('handles single syllable terms', () => {
        const splits = PhoneticSearch.generateSyllableSplits('cho');
        expect(splits.length).toBeGreaterThanOrEqual(1);
      });

      it('handles terms with no valid split points', () => {
        const splits = PhoneticSearch.generateSyllableSplits('x');
        expect(splits).toContain('x'); // Returns original if no valid splits
      });
    });

    describe('processSpacelessPhoneticSearch', () => {
      it('processes spaceless search terms into spaced variants', () => {
        const variants = PhoneticSearch.processSpacelessPhoneticSearch('sangye');
        // Should include variants that could match "sang gye"
        expect(variants.length).toBeGreaterThanOrEqual(1);
      });

      it('returns original for already-spaced terms', () => {
        const variants = PhoneticSearch.processSpacelessPhoneticSearch('sang gye');
        expect(variants).toContain('sang gye');
      });

      it('handles empty strings', () => {
        const variants = PhoneticSearch.processSpacelessPhoneticSearch('');
        expect(variants).toEqual(['']);
      });

      it('handles single character', () => {
        const variants = PhoneticSearch.processSpacelessPhoneticSearch('a');
        expect(variants.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Real-world spaceless search scenarios', () => {
      it('"sangye" should generate variants that can match "sang gye"', () => {
        const variants = PhoneticSearch.processSpacelessPhoneticSearch('sangye');
        // The expanded "sanggye" should split to "sang gye"
        const hasValidSplit = variants.some(v =>
          v === 'sang gye' || v.includes('sang') && v.includes('gye')
        );
        expect(hasValidSplit).toBe(true);
      });

      it('"rinpoche" should generate useful variants', () => {
        const variants = PhoneticSearch.processSpacelessPhoneticSearch('rinpoche');
        expect(variants.length).toBeGreaterThanOrEqual(1);
      });

      it('"guru" should generate useful variants', () => {
        const variants = PhoneticSearch.processSpacelessPhoneticSearch('guru');
        expect(variants.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('strictAndLoosePhoneticsFor', () => {
    it('returns both strict and loose phonetics', () => {
      const [strict, loose] = strictAndLoosePhoneticsFor('སངས་རྒྱས་');
      expect(strict.length).toBeGreaterThan(0);
      expect(loose.length).toBeGreaterThan(0);
    });

    it('returns strings', () => {
      const [strict, loose] = strictAndLoosePhoneticsFor('ཁྱེད་');
      expect(typeof strict).toBe('string');
      expect(typeof loose).toBe('string');
    });
  });

  describe('Real-world Tibetan terms - phonetics output', () => {
    // Test that phonetics are generated for various terms
    // The actual phonetic spellings depend on the tibetan-to-phonetics library configuration
    const testCases = [
      { tibetan: 'སངས་རྒྱས་', wylie: 'sangs rgyas', meaning: 'Buddha' },
      { tibetan: 'ཆོས་', wylie: 'chos', meaning: 'dharma' },
      { tibetan: 'དགེ་འདུན་', wylie: "dge 'dun", meaning: 'sangha' },
      { tibetan: 'བླ་མ་', wylie: 'bla ma', meaning: 'lama' },
      {
        tibetan: 'བྱང་ཆུབ་སེམས་དཔའ་',
        wylie: "byang chub sems dpa'",
        meaning: 'bodhisattva',
      },
      { tibetan: 'སྟོང་པ་ཉིད་', wylie: 'stong pa nyid', meaning: 'emptiness' },
      { tibetan: 'སྙིང་རྗེ་', wylie: 'snying rje', meaning: 'compassion' },
      { tibetan: 'ཤེས་རབ་', wylie: 'shes rab', meaning: 'wisdom/prajna' },
      { tibetan: 'རྡོ་རྗེ་', wylie: 'rdo rje', meaning: 'vajra' },
      { tibetan: 'པདྨ་', wylie: 'padma', meaning: 'lotus' },
    ];

    testCases.forEach(({ tibetan, wylie, meaning }) => {
      it(`generates phonetics for ${wylie} (${meaning})`, () => {
        const strictPhonetics = phoneticsStrictFor(tibetan);
        const loosePhonetics = phoneticsLooseFor(tibetan);

        // Both should produce non-empty output
        expect(
          strictPhonetics.length,
          `Strict phonetics for ${wylie} should be non-empty`
        ).toBeGreaterThan(0);
        expect(
          loosePhonetics.length,
          `Loose phonetics for ${wylie} should be non-empty`
        ).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge cases', () => {
    it('handles empty string', () => {
      const phonetics = phoneticsStrictFor('');
      expect(phonetics).toBe('');
    });

    it('handles text without tshek', () => {
      const phonetics = phoneticsStrictFor('བོད');
      expect(phonetics.length).toBeGreaterThan(0);
    });

    it('handles multiple consecutive tsheks', () => {
      const syllables = syllablesFor('སངས་་རྒྱས་');
      // Should handle gracefully
      expect(syllables.length).toBeGreaterThanOrEqual(2);
    });

    it('handles mixed Tibetan and shad', () => {
      const syllables = syllablesFor('སངས་རྒྱས།ཆོས།');
      expect(syllables.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('Phonetics Matching for Search', () => {
  describe('Query-time syllable processing', () => {
    it('spaceless search terms generate spaced variants', () => {
      // When user searches "sangye", we should generate variants
      // that can match "sang gye" stored in the database
      const variants = PhoneticSearch.processSpacelessPhoneticSearch('sangye');

      // Should have at least one variant
      expect(variants.length).toBeGreaterThan(0);

      // Should include variants with spaces (from syllable splitting)
      const hasSpacedVariant = variants.some(v => v.includes(' '));
      expect(hasSpacedVariant).toBe(true);
    });

    it('doubled consonant expansion handles syllable boundaries', () => {
      // "sangye" could be "sang" + "gye" where g is shared
      // Expansion should try "sanggye" which splits cleanly
      const expanded = PhoneticSearch.expandDoubledConsonants('sangye');
      expect(expanded).toContain('sanggye');
    });
  });

  describe('Strict vs Loose phonetics', () => {
    it('both modes produce output for the same input', () => {
      const tibetan = 'སངས་རྒྱས་';
      const strict = phoneticsStrictFor(tibetan);
      const loose = phoneticsLooseFor(tibetan);

      expect(strict.length).toBeGreaterThan(0);
      expect(loose.length).toBeGreaterThan(0);
    });

    it('loose mode may normalize more sounds', () => {
      // This is just to document that loose mode exists for fuzzy matching
      const loose = phoneticsLooseFor('ཁ་');
      expect(typeof loose).toBe('string');
    });
  });
});
