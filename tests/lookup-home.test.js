/**
 * LookupHome: the glosses of the recent terms follow the dictionaries, even
 * when they change while glosses are still being read.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

import LookupHome from '../src/components/lookup/LookupHome.vue'
import SqlDatabase from '../src/services/sql-database'
import Storage from '../src/services/storage'
import { clearHistory, recordTerm } from '../src/services/history'
import { clearGlossCache, loadGlosses } from '../src/services/glosses'

const KA = 'ཀ་'
const OLD = { id: 1, name: 'Old', position: 0, enabled: true }
const NEW = { id: 2, name: 'New', position: 0, enabled: true }
const ROWS = [
  { term: KA, dictionaryId: 1, definition: 'old gloss' },
  { term: KA, dictionaryId: 2, definition: 'new gloss' },
]

let wrapper

beforeEach(() => {
  clearHistory()
  clearGlossCache()
  Storage.delete('savedTerms')
  recordTerm(KA)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
})

describe('LookupHome — glosses', () => {
  it('should drop glosses read from the dictionaries in use before they changed', async () => {
    let finishFirstRead
    vi.spyOn(SqlDatabase, 'exec')
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirstRead = () => resolve(ROWS) }))
      .mockImplementation(async () => ROWS)
    Storage.set('dictionaries', [OLD])
    wrapper = mount(LookupHome, { attachTo: document.body })
    await flushPromises()

    // The dictionaries change while the first read is still running
    Storage.set('dictionaries', [NEW])
    // The glosses service forgets its cache on this event (its listener may
    // be gone from the test's event registry), then the home reloads
    clearGlossCache()
    window._triggerEvent('dictionaries-updated')
    await flushPromises()
    expect(wrapper.get('[data-testid="lookup-recent"]').text()).toContain('new gloss')

    finishFirstRead()
    await flushPromises()
    const recent = wrapper.get('[data-testid="lookup-recent"]').text()
    expect(recent).toContain('new gloss')
    expect(recent).not.toContain('old gloss')
    // Nor is the old gloss kept for the next reader
    expect((await loadGlosses([KA], [NEW])).get(KA)).toBe('new gloss')
  })
})
