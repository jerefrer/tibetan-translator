/**
 * Term lookup performance contract.
 *
 * Decorator.wrapDefinedTibetanWithLinks asks "is this Tibetan group a known
 * term?" once per group per definition. With ~500k terms, a linear
 * Array.includes made every Search keystroke lag. These tests pin the
 * behaviour (an O(1) hasTerm that cannot drift from allTerms, and a decorator
 * that never scans linearly) without asserting on timings, which would flake.
 */

import { describe, it, expect, vi } from 'vitest'

const { knownTerms, linearScanTerms } = vi.hoisted(() => {
  const linearScanTerms = []
  linearScanTerms.includes = () => {
    throw new Error('linear scan')
  }
  return { knownTerms: new Set(['ཀ་']), linearScanTerms }
})

vi.mock('../src/services/sql-database', () => ({
  default: {
    allTerms: linearScanTerms,
    hasTerm: (term) => knownTerms.has(term),
  },
}))

import Decorator from '../src/services/decorator'

describe('SqlDatabase.hasTerm', () => {
  // The decorator tests below mock sql-database, so load the real module.
  it('should answer from the current allTerms, including after reassignment', async () => {
    const { default: SqlDatabase } = await vi.importActual('../src/services/sql-database')

    SqlDatabase.allTerms = ['ཀ་', 'ཁ་']
    expect(SqlDatabase.hasTerm('ཀ་')).toBe(true)
    expect(SqlDatabase.hasTerm('གག་')).toBe(false)

    SqlDatabase.allTerms = ['གག་']
    expect(SqlDatabase.hasTerm('ཀ་')).toBe(false)
    expect(SqlDatabase.hasTerm('གག་')).toBe(true)
  })

  it('should keep allTerms readable as the same plain array', async () => {
    const { default: SqlDatabase } = await vi.importActual('../src/services/sql-database')
    const terms = ['ཀ་']
    SqlDatabase.allTerms = terms
    expect(SqlDatabase.allTerms).toBe(terms)
  })
})

describe('Decorator term lookup', () => {
  it('should wrap known terms in define links without scanning allTerms linearly', () => {
    const entry = { dictionary: 'TsepakRigdzin', definition: 'see ཀ་ for details' }

    let decorated
    expect(() => {
      decorated = Decorator.decorate(entry)
    }).not.toThrow()

    expect(decorated).toContain("<a href='/define/ཀ་'>")
  })
})
