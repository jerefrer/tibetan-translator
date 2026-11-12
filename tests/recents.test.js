import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRecents } from '../src/services/recents'
import Storage from '../src/services/storage'

const KEY = 'recentsTest'
const make = (overrides = {}) => createRecents({
  key: KEY,
  limit: 3,
  sameAs: (a, b) => a === b,
  replacesLatest: () => false,
  ...overrides
})

beforeEach(() => Storage.delete(KEY))

describe('recents', () => {
  it('should keep the newest first and drop beyond the limit', () => {
    const recents = make()
    ;['a', 'b', 'c', 'd'].forEach((x) => recents.record(x))
    expect(recents.list()).toEqual(['d', 'c', 'b'])
  })

  it('should move a duplicate to the top', () => {
    const recents = make()
    ;['a', 'b', 'c', 'a'].forEach((x) => recents.record(x))
    expect(recents.list()).toEqual(['a', 'c', 'b'])
  })

  it('should replace the latest when replacesLatest says so', () => {
    const recents = make({ replacesLatest: (latest, next) => next.startsWith(latest) })
    recents.record('a')
    recents.record('ab')
    recents.record('abc')
    expect(recents.list()).toEqual(['abc'])
  })

  it('should announce changes with recents-updated', () => {
    const recents = make()
    // tests/setup.js replaces addEventListener, so spy on the dispatch itself
    const spy = vi.spyOn(window, 'dispatchEvent')
    recents.record('a')
    recents.clear()
    const events = spy.mock.calls.map(([e]) => e).filter((e) => e.type === 'recents-updated')
    spy.mockRestore()
    expect(events.map((e) => e.detail)).toEqual([{ key: KEY }, { key: KEY }])
  })
})
