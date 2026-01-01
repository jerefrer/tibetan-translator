import _ from "underscore";

import normalize from "../services/normalize";

// Valid syllable finals (consonants/clusters that can end a syllable)
const VALID_FINALS = ['ng', 'n', 'm', 'r', 'l', 'k', 'p', 'b', 's', 'g', 'd'];

// Valid syllable initials (consonants/clusters that can start a syllable)
const VALID_INITIALS = [
  'kh', 'gh', 'ch', 'jh', 'th', 'dh', 'ph', 'bh', 'sh', 'zh',
  'ts', 'dz', 'tr', 'dr', 'kr', 'gr', 'pr', 'br', 'sr', 'hr',
  'ky', 'gy', 'py', 'by', 'my', 'ny', 'ly', 'ry',
  'k', 'g', 'c', 'j', 't', 'd', 'n', 'p', 'b', 'm',
  'w', 'y', 'r', 'l', 's', 'h', 'z',
  'a', 'e', 'i', 'o', 'u'  // Vowel-initial syllables
];

export default {
  /**
   * Expand doubled consonants at syllable boundaries.
   * When syllables merge, consonants often double: "sang" + "gye" = "sanggye"
   * This function generates variants where consonants are doubled.
   * @param {string} term - The merged phonetic term (no spaces)
   * @returns {string[]} - Array of possible expanded variants
   */
  expandDoubledConsonants(term) {
    const variants = [term];

    // Try doubling each consonant that could be at a syllable boundary
    for (let i = 1; i < term.length; i++) {
      const char = term[i];
      // Only try doubling consonants (not vowels)
      if (!'aeiouöü'.includes(char)) {
        const doubled = term.slice(0, i) + char + term.slice(i);
        // Validate it could create valid syllables
        if (this.couldBeValidSyllables(doubled)) {
          variants.push(doubled);
        }
      }
    }

    return [...new Set(variants)];
  },

  /**
   * Check if a string could contain valid Tibetan phonetic syllables.
   * @param {string} text - The text to validate
   * @returns {boolean}
   */
  couldBeValidSyllables(text) {
    // Basic validation: should have vowels and reasonable consonant clusters
    const hasVowel = /[aeiouöü]/i.test(text);
    // Allow up to 5 consecutive consonants (Tibetan can have clusters like "bsgrub")
    // Doubled consonants at syllable boundaries add one more (e.g., "nggy" in "sanggye")
    const hasTooManyConsonants = /[^aeiouöü]{6,}/i.test(text);
    return hasVowel && !hasTooManyConsonants;
  },

  /**
   * Split a merged phonetic term into possible syllable combinations.
   * @param {string} merged - The merged term (no spaces)
   * @returns {string[]} - Array of possible spaced syllable combinations
   */
  generateSyllableSplits(merged) {
    if (!merged || merged.length < 2) return [merged];

    const results = [];
    this._findSplits(merged, '', results);

    // If no valid splits found, return the original
    if (results.length === 0) {
      results.push(merged);
    }

    return [...new Set(results)];
  },

  /**
   * Recursive helper to find all valid syllable splits.
   * @private
   */
  _findSplits(remaining, current, results) {
    if (!remaining) {
      if (current) {
        results.push(current.trim());
      }
      return;
    }

    // Try different split points
    for (let i = 1; i <= remaining.length; i++) {
      const syllable = remaining.slice(0, i);
      const rest = remaining.slice(i);

      // Check if this is a potentially valid syllable ending
      if (this._isValidSyllable(syllable)) {
        // Check if the rest starts with a valid initial (or is empty)
        if (!rest || this._startsWithValidInitial(rest)) {
          this._findSplits(rest, current + ' ' + syllable, results);
        }
      }
    }
  },

  /**
   * Check if a chunk could be a valid Tibetan syllable.
   * Tibetan syllables generally follow: (C)(C)V(C) pattern
   * @private
   */
  _isValidSyllable(syllable) {
    if (!syllable) return false;

    // Must contain exactly one vowel cluster
    const vowelMatch = syllable.match(/[aeiouöü]+/gi);
    if (!vowelMatch || vowelMatch.length !== 1) return false;

    // Syllable must have a vowel
    if (!/[aeiouöü]/i.test(syllable)) return false;

    // Check the ending is reasonable
    const endsWithValidFinal = VALID_FINALS.some(f => syllable.endsWith(f)) ||
                               /[aeiouöü]$/i.test(syllable);

    return endsWithValidFinal;
  },

  /**
   * Check if text starts with a valid syllable initial.
   * @private
   */
  _startsWithValidInitial(text) {
    if (!text) return true;

    // Check for multi-char initials first, then single-char
    return VALID_INITIALS.some(init => text.toLowerCase().startsWith(init));
  },

  /**
   * Process a spaceless phonetic search term.
   * Expands doubled consonants and generates possible syllable splits.
   * @param {string} term - The merged phonetic term (no spaces)
   * @returns {string[]} - Array of possible spaced variants to search for
   */
  processSpacelessPhoneticSearch(term) {
    if (!term || term.includes(' ')) {
      return [term];
    }

    const allSplits = [];

    // Generate doubled consonant variants
    const expanded = this.expandDoubledConsonants(term);

    // For each expanded variant, generate syllable splits
    for (const variant of expanded) {
      const splits = this.generateSyllableSplits(variant);
      allSplits.push(...splits);
    }

    // Remove duplicates and filter empty strings
    return [...new Set(allSplits.filter(s => s && s.trim()))];
  },

  prepareTermForStrictMatching(term) {
    return _.compact(
      this.splitSyllables(term)
        .split(" ")
        .map((subterm) =>
          subterm
            .toLowerCase()
            .replace(/a'?i/g, "e")
            .replace(/[éèë]/g, "e")
            .replace(/w/, "p") // to match ba as wa
        )
    ).join(" ");
  },
  prepareTermForLooseMatching(term) {
    return _.compact(
      this.splitSyllables(term)
        .split(" ")
        .map((subterm) =>
          normalize(subterm) // will also take care of ö=>o and ü=>u
            .toLowerCase()
            .replace(/a'?i/g, "e")
            .replace(/^g/g, "k") // all that begins with 'g' becomes 'k'
            .replace(/([^n])g/g, "$1k") // all that ends with 'g' but not 'ng' becomes 'k'
            .replace(/ky/, "k") // to match ki/kyi/gyi
            .replace(/w/, "p") // to match ba as wa
            .replace(/j/g, "ch")
            .replace(/th/g, "t")
            .replace(/d/g, "t")
            .replace(/b/g, "p")
            .replace(/z/g, "s")
            .replace(/kh/g, "k")
            .replace(/dr/g, "tr")
            .replace(/lh/g, "l")
            .replace(/ph/g, "p")
            .replace(/p'/g, "p")
            .replace(/ch'/g, "ch")
            .replace(/an$/, "en")
            .replace(/al$/, "el")
        )
    ).join(" ");
  },
  splitSyllables(text) {
    var text = text
      .toLowerCase()
      .replace(/[-_"\?\!\.]/g, "")
      .replace(/ü/g, "ü");
    var result = "";
    while (text) {
      var match = text.match(
        /((?:siddhi)|(?:ut)|((?:dz)|(?:st)|(?:sv)|(?:ng)|(?:tn)|(?:ts)|(?:[dtjn]r)|(?:[tzsclkd]h)|(?:[kgntd][h]?y)|[jwpbmntdkglrcszyvwh])?[']?[aeiouöüéè][rmnkhpbl]?[g]?[']?[i]?)$/
      );
      if (match) {
        result = match[1] + " " + result.trim();
        text = text.slice(0, match.index).trim();
      } else {
        // If the text is not valid phonetics we just return it as-is
        result = text + result.trim();
        text = "";
      }
    }
    return result;
  },
};
