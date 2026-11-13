/**
 * lookup-state.js: what Lookup and Search remember between visits and launches.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Storage from '../src/services/storage'
import {
  readLookupState,
  writeLookupState,
  readPreviousQueries,
  storePreviousQuery,
} from '../src/services/lookup-state'

beforeEach(() => {
  Storage.delete('lookupState')
  Storage.delete('selectedTerm')
  Storage.delete('previousQueries')
})

describe('lookup state', () => {
  it('should start with nothing typed', () => {
    expect(readLookupState()).toEqual({ term: '', query: '' })
  })

  it('should merge what is written into what was stored', () => {
    writeLookupState({ term: 'ཀ་' })
    writeLookupState({ query: 'wisdom' })
    expect(readLookupState()).toEqual({ term: 'ཀ་', query: 'wisdom' })
  })

  it("should start on Define's last term when nothing was stored by Lookup yet", () => {
    Storage.set('selectedTerm', 'ཀ་')
    expect(readLookupState()).toEqual({ term: 'ཀ་', query: '' })
  })

  it("should prefer Lookup's own term to Define's", () => {
    Storage.set('selectedTerm', 'ཀ་')
    Storage.set('lookupState', { term: 'ཁ་' })
    expect(readLookupState().term).toBe('ཁ་')
  })

  it('should ignore a mode stored when one page held both', () => {
    Storage.set('lookupState', { mode: 'en', term: 'ཀ་', query: 'wisdom' })
    expect(readLookupState()).toEqual({ term: 'ཀ་', query: 'wisdom' })
  })

  it('should not keep a former mode when something is written', () => {
    Storage.set('lookupState', { mode: 'en', term: 'ཀ་' })
    writeLookupState({ query: 'wisdom' })
    expect(Storage.get('lookupState')).toEqual({ term: 'ཀ་', query: 'wisdom' })
  })
})

describe('previous queries', () => {
  it('should add each query to the front, once', () => {
    storePreviousQuery('wisdom')
    storePreviousQuery('compassion')
    storePreviousQuery('wisdom')
    expect(readPreviousQueries()).toEqual(['wisdom', 'compassion'])
  })

  it('should keep at most 100 queries', () => {
    for (let i = 0; i < 105; i++) storePreviousQuery('query ' + i)
    const queries = readPreviousQueries()
    expect(queries).toHaveLength(100)
    expect(queries[0]).toBe('query 104')
    expect(queries.at(-1)).toBe('query 5')
  })

  it('should ignore an empty query', () => {
    storePreviousQuery('')
    expect(readPreviousQueries()).toEqual([])
  })
})
