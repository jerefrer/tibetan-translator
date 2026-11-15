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
  removePreviousQuery,
  cleanPreviousQueries,
} from '../src/services/lookup-state'

beforeEach(() => {
  Storage.delete('lookupState')
  Storage.delete('selectedTerm')
  Storage.delete('previousQueries')
  // Lists in these tests are taken as already cleaned unless a test says otherwise
  Storage.set('previousQueriesCleaned', true)
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

describe('removePreviousQuery', () => {
  it('should remove only the query given when it is in the list', () => {
    Storage.set('previousQueries', ['wisdom', 'compassion', 'buddha'])
    removePreviousQuery('compassion')
    expect(readPreviousQueries()).toEqual(['wisdom', 'buddha'])
  })

  it('should leave the list as it is when the query is not in it', () => {
    Storage.set('previousQueries', ['wisdom'])
    removePreviousQuery('buddha')
    expect(readPreviousQueries()).toEqual(['wisdom'])
  })
})

describe('cleanPreviousQueries', () => {
  it('should drop empty queries and queries ending with & when they are trimmed', () => {
    expect(cleanPreviousQueries(['wisdom', '', '   ', 'buddha &', 'buddha & ', 'dharma'])).toEqual(['wisdom', 'dharma'])
  })

  it('should drop a query that is the start of a more recent one when its last condition is cut mid-word', () => {
    const queries = ['[sang gye] & enlightenment & siddhartha', '[sang gye] & enlightenment & sidd', 'wisdom']
    expect(cleanPreviousQueries(queries)).toEqual(['[sang gye] & enlightenment & siddhartha', 'wisdom'])
  })

  it('should keep a shorter query when the longer one extending it is older', () => {
    expect(cleanPreviousQueries(['sidd', 'siddhartha'])).toEqual(['sidd', 'siddhartha'])
  })

  it('should keep a query whose conditions are all complete when a more recent one adds to it', () => {
    expect(cleanPreviousQueries(['buddha & dharma', 'buddha'])).toEqual(['buddha & dharma', 'buddha'])
  })

  it('should keep a query when the more recent one differs in an earlier condition', () => {
    expect(cleanPreviousQueries(['[sang gye] & enlightenment', '[sang gye] & enlight'])).toEqual([
      '[sang gye] & enlightenment',
    ])
    expect(cleanPreviousQueries(['(sang gye) & enlightenment', '[sang gye] & enlight'])).toEqual([
      '(sang gye) & enlightenment',
      '[sang gye] & enlight',
    ])
  })

  it('should keep a query when the more recent one reads its last condition in another mode', () => {
    expect(cleanPreviousQueries(['(siddhartha)', 'sidd'])).toEqual(['(siddhartha)', 'sidd'])
  })

  it('should keep the order of what remains', () => {
    expect(cleanPreviousQueries(['c', 'b &', 'a'])).toEqual(['c', 'a'])
  })
})

describe('previous queries from 1.12', () => {
  it('should clean the stored list once when it was never cleaned', () => {
    Storage.delete('previousQueriesCleaned')
    Storage.set('previousQueries', ['siddhartha', 'sidd', 'sid', 'wisdom &'])
    expect(readPreviousQueries()).toEqual(['siddhartha'])
    expect(Storage.get('previousQueries')).toEqual(['siddhartha'])
    expect(Storage.get('previousQueriesCleaned')).toBe(true)
  })

  it('should not clean the list again when it was cleaned before', () => {
    Storage.set('previousQueries', ['siddhartha', 'sidd'])
    expect(readPreviousQueries()).toEqual(['siddhartha', 'sidd'])
  })
})
