/**
 * query-conditions.js: a query read into conditions, and written back.
 */
import { describe, it, expect } from 'vitest'
import { MATCH_MODES, queryConditions, conditionsQuery } from '../src/services/query-conditions'

describe('match modes', () => {
  it('should list the four modes in the order the builder offers them', () => {
    expect(MATCH_MODES.map((mode) => mode.value)).toEqual(['contains', 'wylie', 'phonetic-strict', 'phonetic-loose'])
    expect(MATCH_MODES.map((mode) => mode.label)).toEqual(['contains', 'Wylie', 'sounds like', 'sounds roughly like'])
  })
})

describe('queryConditions', () => {
  it.each([
    ['wisdom', 'contains', 'wisdom'],
    ['(dga\' ba)', 'wylie', 'dga\' ba'],
    ['[sang gye]', 'phonetic-strict', 'sang gye'],
    ['{jom ten te}', 'phonetic-loose', 'jom ten te'],
  ])('should read %s as one %s condition', (query, mode, term) => {
    expect(queryConditions(query)).toEqual([{ mode, term }])
  })

  it('should read each part of a mixed query in its own mode', () => {
    expect(queryConditions('[a] & b & (c) & {d}')).toEqual([
      { mode: 'phonetic-strict', term: 'a' },
      { mode: 'contains', term: 'b' },
      { mode: 'wylie', term: 'c' },
      { mode: 'phonetic-loose', term: 'd' },
    ])
  })

  it('should return no condition when the query is empty or blank', () => {
    expect(queryConditions('')).toEqual([])
    expect(queryConditions('   ')).toEqual([])
    expect(queryConditions(undefined)).toEqual([])
  })

  it('should drop the empty parts when ampersands are left dangling', () => {
    expect(queryConditions('wisdom & ')).toEqual([{ mode: 'contains', term: 'wisdom' }])
    expect(queryConditions(' & & ')).toEqual([])
  })

  it('should keep empty brackets as plain text when they hold no term', () => {
    expect(queryConditions('[]')).toEqual([{ mode: 'contains', term: '[]' }])
  })
})

describe('conditionsQuery', () => {
  it('should write each condition in its syntax joined by &', () => {
    expect(
      conditionsQuery([
        { mode: 'phonetic-strict', term: 'a' },
        { mode: 'contains', term: 'b' },
        { mode: 'wylie', term: 'c' },
        { mode: 'phonetic-loose', term: 'd' },
      ])
    ).toBe('[a] & b & (c) & {d}')
  })

  it('should leave out the conditions without a term', () => {
    expect(conditionsQuery([{ mode: 'contains', term: '  ' }, { mode: 'wylie', term: 'x' }])).toBe('(x)')
  })

  it('should return the same query when it reads one and writes it back', () => {
    const query = '[sang gye] & enlightenment & (dga\' ba) & {d}'
    expect(conditionsQuery(queryConditions(query))).toBe(query)
  })
})
