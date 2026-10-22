/**
 * Pure logic of the quick lookup window (src/services/quick-lookup.js):
 * what the clipboard holds, which entries show and in which order, how a
 * full-text match is highlighted, and what switching Define/Search keeps.
 */

import { describe, it, expect } from 'vitest'
import {
  classifyClipboardText,
  entriesForEnabledDictionaries,
  escapeForRegExp,
  highlightInHtml,
  highlightInText,
  plural,
  sortSearchEntries,
  switchMode,
  termsStartingWith,
} from '../src/services/quick-lookup'

const ALL_TERMS = ['ཡེ་ཤེས་', 'ཡེ་ཤེས་པ་', 'སངས་རྒྱས་', 'ཀ་']

describe('classifyClipboardText', () => {
  it('should look nothing up for an empty or blank clipboard', () => {
    expect(classifyClipboardText('', ALL_TERMS)).toBeNull()
    expect(classifyClipboardText('   \n', ALL_TERMS)).toBeNull()
    expect(classifyClipboardText(null, ALL_TERMS)).toBeNull()
  })

  it('should send Tibetan to Define as its lookup key, trailing punctuation as one tsheg', () => {
    expect(classifyClipboardText('ཡེ་ཤེས།', ALL_TERMS)).toEqual({ mode: 'define', text: 'ཡེ་ཤེས་', wylie: '' })
    expect(classifyClipboardText('  = ཡེ་ཤེས་ ! ', ALL_TERMS).text).toBe('ཡེ་ཤེས་')
  })

  it('should send Wylie that starts a known term to Define, converted, and remember the Wylie', () => {
    expect(classifyClipboardText('ye shes', ALL_TERMS)).toEqual({ mode: 'define', text: 'ཡེ་ཤེས་', wylie: 'ye shes' })
  })

  it('should send anything else to Search as it is', () => {
    expect(classifyClipboardText('primordial wisdom', ALL_TERMS)).toEqual({
      mode: 'search',
      text: 'primordial wisdom',
      wylie: '',
    })
    // Converts to Tibetan, but no term starts with it
    expect(classifyClipboardText('kind', ALL_TERMS).mode).toBe('search')
  })

  it('should send Wylie to Search while no term list is loaded', () => {
    expect(classifyClipboardText('ye shes', []).mode).toBe('search')
  })
})

describe('termsStartingWith', () => {
  it('should list the terms starting with the text, sorted', () => {
    expect(termsStartingWith(['ཡེ་ཤེས་པ་', 'ཀ་', 'ཡེ་ཤེས་'], 'ཡེ་')).toEqual(['ཡེ་ཤེས་', 'ཡེ་ཤེས་པ་'])
  })

  it('should list nothing for an empty text', () => {
    expect(termsStartingWith(ALL_TERMS, '')).toEqual([])
  })
})

describe('entriesForEnabledDictionaries', () => {
  const entries = [
    { term: 'ཀ་', dictionaryId: 1 },
    { term: 'ཀ་', dictionaryId: 2 },
    { term: 'ཀ་', dictionaryId: 3 },
  ]

  it('should keep the dictionaries enabled in Settings, in the Settings order', () => {
    const dictionaries = [
      { id: 1, position: 3, enabled: true },
      { id: 2, position: 1, enabled: false },
      { id: 3, position: 2, enabled: true },
    ]
    expect(entriesForEnabledDictionaries(entries, dictionaries).map((e) => e.dictionaryId)).toEqual([3, 1])
  })

  it('should drop entries of a dictionary Settings does not know, as the main window does', () => {
    expect(entriesForEnabledDictionaries(entries, [{ id: 1, position: 1, enabled: true }])).toHaveLength(1)
  })

  it('should keep every entry, in order, while nothing is stored', () => {
    expect(entriesForEnabledDictionaries(entries, [])).toEqual(entries)
    expect(entriesForEnabledDictionaries(entries, null)).toEqual(entries)
  })
})

describe('sortSearchEntries', () => {
  it('should put terms starting with the query first, then shorter terms, then the dictionary position', () => {
    const sorted = sortSearchEntries(
      [
        { term: 'xx wisdom', dictionaryPosition: 1 },
        { term: 'wisdom being', dictionaryPosition: 1 },
        { term: 'wisdom', dictionaryPosition: 5 },
        { term: 'wisdom', dictionaryPosition: 2 },
      ],
      'Wisdom'
    )
    expect(sorted.map((e) => `${e.term}/${e.dictionaryPosition}`)).toEqual([
      'wisdom/2',
      'wisdom/5',
      'wisdom being/1',
      'xx wisdom/1',
    ])
  })
})

describe('highlighting', () => {
  it('should mark every match, ignoring case, in text nodes only', () => {
    expect(highlightInHtml('<a href="/wisdom">Wisdom</a> and wisdom', 'wisdom')).toBe(
      '<a href="/wisdom"><mark>Wisdom</mark></a> and <mark>wisdom</mark>'
    )
  })

  it('should treat the straight and the curly apostrophe as the same', () => {
    expect(highlightInText('d’après', "d'après")).toBe('<mark>d’après</mark>')
    expect(highlightInText("d'après", 'd’après')).toBe("<mark>d'après</mark>")
  })

  it('should escape characters that mean something in a regular expression', () => {
    expect(escapeForRegExp('a.b(c)')).toBe('a\\.b\\(c\\)')
    expect(highlightInText('a.b and axb', 'a.b')).toBe('<mark>a.b</mark> and axb')
  })

  it('should leave the text alone for an empty query', () => {
    expect(highlightInHtml('wisdom', '  ')).toBe('wisdom')
  })
})

describe('switchMode', () => {
  it('should keep the text from Define to Search and remember it', () => {
    expect(switchMode({ mode: 'define', text: 'ཡེ་ཤེས་', lastDefineText: '' }, 'search')).toEqual({
      mode: 'search',
      text: 'ཡེ་ཤེས་',
      lastDefineText: 'ཡེ་ཤེས་',
    })
  })

  it('should keep Tibetan from Search to Define', () => {
    expect(switchMode({ mode: 'search', text: 'སངས་', lastDefineText: 'ཀ་' }, 'define').text).toBe('སངས་')
  })

  it('should bring back the last Define value instead of converting Latin text', () => {
    expect(switchMode({ mode: 'search', text: 'kind', lastDefineText: 'ཀ་' }, 'define')).toEqual({
      mode: 'define',
      text: 'ཀ་',
      lastDefineText: 'ཀ་',
    })
    expect(switchMode({ mode: 'search', text: 'kind', lastDefineText: '' }, 'define').text).toBe('')
  })

  it('should change nothing for the current or an unknown mode', () => {
    const state = { mode: 'define', text: 'ཀ་', lastDefineText: '' }
    expect(switchMode(state, 'define')).toEqual(state)
    expect(switchMode(state, 'split')).toEqual(state)
  })
})

describe('plural', () => {
  it('should agree with the count', () => {
    expect(plural(1, 'term')).toBe('1 term')
    expect(plural(3, 'entry', 'entries')).toBe('3 entries')
  })
})
