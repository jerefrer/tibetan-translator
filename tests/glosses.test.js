import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/sql-database', () => ({ default: { exec: vi.fn() } }))

import SqlDatabase from '../src/services/sql-database'
import { loadGlosses, clearGlossCache, plainGloss } from '../src/services/glosses'

const dictionaries = [
  { id: 1, enabled: true, position: 2 },
  { id: 2, enabled: true, position: 1 },
  { id: 3, enabled: false, position: 0 },
]

describe('loadGlosses', () => {
  beforeEach(() => {
    clearGlossCache()
    SqlDatabase.exec.mockReset()
  })

  it("should pick the first enabled dictionary in the user's order", async () => {
    SqlDatabase.exec.mockResolvedValue([
      { term: 'a', definition: 'from one', dictionaryId: 1 },
      { term: 'a', definition: '<i>from two</i>', dictionaryId: 2 },
      { term: 'a', definition: 'from three', dictionaryId: 3 },
    ])
    const glosses = await loadGlosses(['a'], dictionaries)
    expect(glosses.get('a')).toBe('from two')
  })

  it('should query only the terms not cached', async () => {
    SqlDatabase.exec.mockResolvedValue([{ term: 'a', definition: 'x', dictionaryId: 1 }])
    await loadGlosses(['a'], dictionaries)
    SqlDatabase.exec.mockResolvedValue([{ term: 'b', definition: 'y', dictionaryId: 1 }])
    const glosses = await loadGlosses(['a', 'b'], dictionaries)
    expect(SqlDatabase.exec).toHaveBeenCalledTimes(2)
    const sql = SqlDatabase.exec.mock.calls[1][0]
    expect(sql).toContain("'b'")
    expect(sql).not.toContain("'a'")
    expect(glosses.get('a')).toBe('x')
    expect(glosses.get('b')).toBe('y')
  })

  it('should escape quotes in terms', async () => {
    SqlDatabase.exec.mockResolvedValue([])
    await loadGlosses(["it's"], dictionaries)
    expect(SqlDatabase.exec.mock.calls[0][0]).toContain("'it''s'")
  })

  it('should forget the cache when packs change', async () => {
    // tests/setup.js clears window listeners before each test and replaces
    // addEventListener, so load a fresh module (it registers at import) and
    // reach its handlers through _triggerEvent
    vi.resetModules()
    const fresh = await import('../src/services/glosses')
    const { default: freshDb } = await import('../src/services/sql-database')
    freshDb.exec.mockResolvedValue([{ term: 'a', definition: 'x', dictionaryId: 1 }])
    await fresh.loadGlosses(['a'], dictionaries)
    window._triggerEvent('all-terms-updated')
    await fresh.loadGlosses(['a'], dictionaries)
    expect(freshDb.exec).toHaveBeenCalledTimes(2)
  })
})

describe('plainGloss', () => {
  it('should decode HTML entities', () => {
    expect(plainGloss('fire&nbsp;&amp;&nbsp;water, Buddha&#39;s')).toBe("fire & water, Buddha's")
  })

  it('should strip tags and cut on a word', () => {
    expect(plainGloss('<b>hello</b>   world')).toBe('hello world')
    expect(plainGloss('alpha beta gamma delta', 12)).toBe('alpha beta…')
  })
})
