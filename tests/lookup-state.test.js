/**
 * lookup-state.js: what Lookup remembers between visits and launches, and
 * what the field shows when the བོད / EN switch is used.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Storage from '../src/services/storage'
import { readLookupState, writeLookupState, switchLookupMode } from '../src/services/lookup-state'

beforeEach(() => {
  Storage.delete('lookupState')
})

describe('lookup state', () => {
  it('should start in Tibetan mode with nothing typed', () => {
    expect(readLookupState()).toEqual({ mode: 'bo', term: '', query: '' })
  })

  it('should merge what is written into what was stored', () => {
    writeLookupState({ term: 'ཀ་' })
    writeLookupState({ mode: 'en', query: 'wisdom' })
    expect(readLookupState()).toEqual({ mode: 'en', term: 'ཀ་', query: 'wisdom' })
  })

  it('should fall back to Tibetan mode when the stored mode is unknown', () => {
    Storage.set('lookupState', { mode: 'fr', term: 'ཀ་' })
    expect(readLookupState()).toEqual({ mode: 'bo', term: 'ཀ་', query: '' })
  })
})

describe('switchLookupMode', () => {
  it('should switch to English with the typed Latin when known', () => {
    expect(
      switchLookupMode({ mode: 'bo', text: 'སངས་རྒྱས་', typedWylie: 'sangs rgyas' }, 'en')
    ).toBe('sangs rgyas')
  })

  it('should switch to English with the text as is otherwise', () => {
    expect(switchLookupMode({ mode: 'bo', text: 'སངས་རྒྱས་', typedWylie: '' }, 'en')).toBe('སངས་རྒྱས་')
  })

  it('should switch to Tibetan converting Latin as Wylie', () => {
    expect(switchLookupMode({ mode: 'en', text: 'sangs rgyas', typedWylie: '' }, 'bo')).toBe('སངས་རྒྱས་')
  })

  it('should leave Tibetan as is when switching to Tibetan', () => {
    expect(switchLookupMode({ mode: 'en', text: 'སངས་རྒྱས་', typedWylie: '' }, 'bo')).toBe('སངས་རྒྱས་')
  })

  it('should keep the text when the mode does not change', () => {
    expect(switchLookupMode({ mode: 'en', text: 'sangs rgyas', typedWylie: '' }, 'en')).toBe('sangs rgyas')
  })

  it('should keep an empty field empty', () => {
    expect(switchLookupMode({ mode: 'bo', text: '', typedWylie: '' }, 'en')).toBe('')
    expect(switchLookupMode({ mode: 'en', text: '', typedWylie: '' }, 'bo')).toBe('')
  })
})
