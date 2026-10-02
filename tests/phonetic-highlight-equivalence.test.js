/**
 * Equivalence + performance net for the phonetic highlighting hot path.
 *
 * phoneticsStrictFor / phoneticsLooseFor generate the termPhonetics* and
 * definitionPhoneticsWords* columns stored in the shipped .sqlite packs
 * (build/build-packs.js, build-database.js, build-for-stardict.js). If their
 * output changes by one character, phonetic search stops matching packs that
 * are already installed. The LEGACY* functions below are verbatim copies of the
 * implementations before optimisation; the real ones must match them exactly.
 */

import { describe, it, expect, vi } from 'vitest'
import _ from 'underscore'
import TibetanRegExps from 'tibetan-regexps'
import { TibetanToPhonetics, Settings } from 'tibetan-to-phonetics'

vi.mock('../src/services/sql-database', () => ({
  default: { allTerms: [], hasTerm: () => false, exec: vi.fn(async () => []) },
}))
vi.mock('../src/services/scan-service', () => ({ getScanInfo: () => null }))

import SearchPage from '../src/components/SearchPage.vue'
import {
  phoneticsStrictFor,
  phoneticsLooseFor,
  syllablesFor,
  replaceTibetanGroups,
} from '../src/utils'
import corpus from './fixtures/tibetan-definitions.json'

// ---- Legacy implementations (verbatim copies) ------------------------------

const legacyPhoneticsFor = function (setting, text) {
  var phonetics = new TibetanToPhonetics({ setting: setting })
  return syllablesFor(text).map((syllable) => phonetics.convert(syllable)).join(' ')
}
const legacyPhoneticsStrictFor = function (text) {
  var setting = Settings.find('english-semi-strict')
  _.extend(setting.rules, { drengbu: 'e', aKikuI: 'e', baAsWa: 'p' })
  return legacyPhoneticsFor(setting, text)
}
const legacyPhoneticsLooseFor = function (text) {
  return legacyPhoneticsFor('english-super-loose', text)
}
const legacyCombinations = function (source, numberOfSyllablesForTerm) {
  var syllables = syllablesFor(source)
  var numberOfSyllables = syllables.length
  var combinations = []
  for (var i = 0; i < numberOfSyllables; i++) {
    for (var j = numberOfSyllables; j > 0; j--) {
      var slice = syllables.slice(i, j)
      if (slice.length == numberOfSyllablesForTerm)
        combinations.push(slice.join('་') + '་')
    }
  }
  return _.chain(combinations).uniq().sortBy('length').value()
}
const legacyHighlight = function (definition, term, convert) {
  return replaceTibetanGroups(definition, (group) => {
    var numberOfSyllablesForTerm = term.split(' ').length
    var combinations = legacyCombinations(group, numberOfSyllablesForTerm)
    var match = combinations.find((subgroup) => {
      var groupInPhonetics = convert(subgroup)
      return groupInPhonetics.includes(term)
    })
    if (match) {
      var matchWithoutEndingTshek = match.replace(/་$/, '')
      return group.replace(
        new RegExp(`(${matchWithoutEndingTshek}[་།༎༑༔]?)`, 'g'),
        '<em>$1</em>'
      )
    } else return group
  })
}

// ---- New implementations under test ----------------------------------------

const newCombinations = (source, n) =>
  SearchPage.methods.everySyllablesCombinationsOfGivenLengthFor.call({}, source, n)
const newHighlight = (definition, term, convert) =>
  SearchPage.methods.highlightTibetanMatchingPhonetics.call(
    { everySyllablesCombinationsOfGivenLengthFor: newCombinations },
    definition, term, convert
  )

// ---- Corpus ----------------------------------------------------------------

const definitions = corpus.map((e) => e.definition)
const terms = corpus.map((e) => e.term)
const groupsOf = (text) => text.match(TibetanRegExps.tibetanGroups) || []
const allGroups = _.uniq(definitions.flatMap(groupsOf))
const allTexts = _.uniq([...terms, ...allGroups])

const highlightTerms = [
  ...['འཇམ་དབྱངས་', 'ནོར་བུ་', 'སངས་རྒྱས་', 'ཀ་', 'བླ་མ་'].map((t) => ({
    label: 'loose ' + t, term: legacyPhoneticsLooseFor(t).trim(), legacy: legacyPhoneticsLooseFor, now: phoneticsLooseFor,
  })),
  ...['འཇམ་དབྱངས་', 'ནོར་བུ་', 'ཀ་'].map((t) => ({
    label: 'strict ' + t, term: legacyPhoneticsStrictFor(t).trim(), legacy: legacyPhoneticsStrictFor, now: phoneticsStrictFor,
  })),
]

describe('corpus sanity', () => {
  it('should hold a few hundred real definitions with many Tibetan groups', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(200)
    expect(allGroups.length).toBeGreaterThan(200)
  })
})

describe('everySyllablesCombinationsOfGivenLengthFor', () => {
  for (const L of [1, 2, 3, 4]) {
    it(`should equal the legacy output, order included, when window length is ${L}`, () => {
      for (const group of allGroups)
        expect(newCombinations(group, L)).toEqual(legacyCombinations(group, L))
    })
  }
  it('should return nothing when the group is shorter than the window', () => {
    expect(newCombinations('ཀ་', 3)).toEqual(legacyCombinations('ཀ་', 3))
    expect(newCombinations('ཀ་', 3)).toEqual([])
  })
  it('should handle an empty string and non-Tibetan text', () => {
    for (const s of ['', 'hello world'])
      for (const L of [1, 2])
        expect(newCombinations(s, L)).toEqual(legacyCombinations(s, L))
  })
})

describe('phonetics generation (shipped in the packs)', () => {
  it('should produce identical strict phonetics when run over every term and group', () => {
    for (const text of allTexts)
      expect(phoneticsStrictFor(text)).toBe(legacyPhoneticsStrictFor(text))
  })
  it('should produce identical loose phonetics when run over every term and group', () => {
    for (const text of allTexts)
      expect(phoneticsLooseFor(text)).toBe(legacyPhoneticsLooseFor(text))
  })
  it('should stay identical when the same inputs hit the memo cache a second time', () => {
    for (const text of allTexts)
      expect(phoneticsStrictFor(text)).toBe(legacyPhoneticsStrictFor(text))
    for (const text of allTexts)
      expect(phoneticsLooseFor(text)).toBe(legacyPhoneticsLooseFor(text))
  })
  it('should stay identical when the cache cap is exceeded and cleared', () => {
    for (let i = 0; i < 21000; i++) phoneticsLooseFor('ཀ' + 'ག'.repeat(i % 3) + 'ང'.repeat(i % 7) + '་' + i)
    // One setting per loop: the legacy code builds a converter on every call,
    // and the library lets the newest converter override all older ones.
    for (const text of allTexts.slice(0, 100))
      expect(phoneticsLooseFor(text)).toBe(legacyPhoneticsLooseFor(text))
    for (const text of allTexts.slice(0, 100))
      expect(phoneticsStrictFor(text)).toBe(legacyPhoneticsStrictFor(text))
  })
  it('should convert with the right setting when strict and loose calls alternate', async () => {
    // On a COLD cache, or the alternation never reaches the converter: the
    // tests above already memoised every one of these texts, and a warm cache
    // would pass even if the converter handed back the wrong setting's rules.
    // A fresh module registry also gives this import its own copy of
    // tibetan-to-phonetics, so the legacy helpers cannot disturb it.
    vi.resetModules()
    const fresh = await import('../src/utils')
    const texts = allTexts.slice(0, 60)
    const strict = [], loose = []
    for (const t of texts) { strict.push(fresh.phoneticsStrictFor(t)); loose.push(fresh.phoneticsLooseFor(t)) }
    // Expected values computed afterwards, one setting at a time.
    expect(strict).toEqual(texts.map(legacyPhoneticsStrictFor))
    expect(loose).toEqual(texts.map(legacyPhoneticsLooseFor))
  })
  it('should handle empty and non-Tibetan input like the legacy code', () => {
    const inputs = ['', 'hello', '  ', 'ཀ', 'ཀ་ཁ་ག་']
    for (const s of inputs)
      expect(phoneticsStrictFor(s)).toBe(legacyPhoneticsStrictFor(s))
    for (const s of inputs)
      expect(phoneticsLooseFor(s)).toBe(legacyPhoneticsLooseFor(s))
  })
})

describe('highlightTibetanMatchingPhonetics', () => {
  for (const t of highlightTerms) {
    it(`should equal the legacy output over the whole corpus for ${t.label}`, () => {
      let matched = 0
      for (const d of definitions) {
        const expected = legacyHighlight(d, t.term, t.legacy)
        if (expected !== d) matched++
        expect(newHighlight(d, t.term, t.now)).toBe(expected)
      }
      // matched is informational; equality is the assertion
      expect(matched).toBeGreaterThanOrEqual(0)
    })
  }
  it('should actually highlight something in the corpus for at least one term', () => {
    const hits = highlightTerms.reduce((n, t) =>
      n + definitions.filter((d) => newHighlight(d, t.term, t.now) !== d).length, 0)
    expect(hits).toBeGreaterThan(0)
  })
  it('should equal legacy for edge cases', () => {
    const t = highlightTerms[0]
    for (const d of ['', 'no tibetan here', 'ཀ་', 'འཇམ་དབྱངས་', 'ཀ་ འཇམ་དབྱངས་ ཁ་', 'ནོར་བུ་ཀ་།'])
      for (const x of highlightTerms)
        expect(newHighlight(d, x.term, x.now)).toBe(legacyHighlight(d, x.term, x.legacy))
    expect(newHighlight('', t.term, t.now)).toBe('')
  })
})

describe('performance', () => {
  it('should highlight the whole corpus with two loose terms well under a second', () => {
    const [a, b] = [highlightTerms[0], highlightTerms[1]]
    const start = performance.now()
    for (const d of definitions) {
      let h = newHighlight(d, a.term, phoneticsLooseFor)
      newHighlight(h, b.term, phoneticsLooseFor)
    }
    const ms = performance.now() - start
    expect(ms, `highlighting ${definitions.length} definitions took ${ms.toFixed(0)}ms (limit 1000ms)`).toBeLessThan(1000)
  })
})
