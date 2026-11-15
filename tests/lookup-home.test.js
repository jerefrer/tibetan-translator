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
import { setSavedTerms } from '../src/services/saved-terms'
import { RouterLinkStub } from '@vue/test-utils'
import { clearGlossCache, loadGlosses } from '../src/services/glosses'
import * as feedback from '../src/services/feedback'
import { latestReleaseNotes } from '../src/services/release-notes-markdown'
import changelog from '../CHANGELOG.md?raw'

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
  Storage.delete('newLook')
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

describe('LookupHome — saved terms', () => {
  it('should show eight saved terms and a way to all of them', async () => {
    vi.spyOn(SqlDatabase, 'exec').mockResolvedValue([])
    setSavedTerms(Array.from({ length: 11 }, (_, i) => 'ཀ' + String.fromCharCode(0x0f40 + i) + '་'))
    wrapper = mount(LookupHome, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()
    expect(wrapper.findAll('[data-testid="lookup-saved"] li')).toHaveLength(8)
    const all = wrapper.findComponent(RouterLinkStub)
    expect(all.props('to')).toBe('/saved')
    expect(all.text()).toBe('See all 11')
  })
})


describe('LookupHome — Try', () => {
  const TRY = ['སངས་རྒྱས་', 'བྱང་ཆུབ་སེམས་', 'སྟོང་པ་ཉིད་', 'སྙིང་རྗེ་']

  it('should offer four terms to try when there are no recent or saved terms', async () => {
    clearHistory()
    vi.spyOn(SqlDatabase, 'exec').mockResolvedValue([])
    wrapper = mount(LookupHome)
    await flushPromises()
    const rows = wrapper.findAll('[data-testid="lookup-try"] [data-testid="lookup-home-term"]')
    expect(rows.map((row) => row.find('.lookup-home__term').text())).toEqual(TRY)
  })

  it('should open the term when a Try row is clicked', async () => {
    clearHistory()
    vi.spyOn(SqlDatabase, 'exec').mockResolvedValue([])
    wrapper = mount(LookupHome)
    await flushPromises()
    await wrapper.findAll('[data-testid="lookup-try"] button')[1].trigger('click')
    expect(wrapper.emitted('open')[0]).toEqual([TRY[1]])
  })

  it('should hide Try when there is a recent term', async () => {
    vi.spyOn(SqlDatabase, 'exec').mockResolvedValue([])
    wrapper = mount(LookupHome)
    await flushPromises()
    expect(wrapper.find('[data-testid="lookup-try"]').exists()).toBe(false)
  })
})

describe('LookupHome — A new look', () => {
  const mountHome = async (props = {}) => {
    vi.spyOn(SqlDatabase, 'exec').mockResolvedValue([])
    wrapper = mount(LookupHome, { props, attachTo: document.body, global: { provide: { snackbar: { open: vi.fn() } } } })
    await flushPromises()
  }
  const tiles = () => wrapper.findAll('.new-look__tile').map((tile) => tile.attributes('data-testid'))

  it('should show the card first when it is pending', async () => {
    Storage.set('newLook', 'pending')
    await mountHome()
    expect(wrapper.get('[data-testid="new-look"]').text()).toContain('Welcome to the new Tibetan Translator')
    expect(wrapper.get('.lookup-home').element.firstElementChild.getAttribute('data-testid')).toBe('new-look')
  })

  it('should not show the card when it was seen', async () => {
    Storage.set('newLook', 'seen')
    await mountHome()
    expect(wrapper.find('[data-testid="new-look"]').exists()).toBe(false)
  })

  it('should remove the card and remember it when its close button is clicked', async () => {
    Storage.set('newLook', 'pending')
    await mountHome()
    await wrapper.get('[data-testid="new-look-close"]').trigger('click')
    expect(wrapper.find('[data-testid="new-look"]').exists()).toBe(false)
    expect(Storage.get('newLook')).toBe('seen')
  })

  it('should show four tiles with keycaps on a desktop', async () => {
    Storage.set('newLook', 'pending')
    await mountHome()
    expect(tiles()).toEqual(['new-look-reader', 'new-look-pages', 'new-look-keys', 'new-look-saved'])
    expect(wrapper.get('[data-testid="new-look-reader"] kbd').text()).toMatch(/^(⌘|Ctrl\+)E$/)
    expect(wrapper.findAll('[data-testid="new-look-keys"] kbd').map((key) => key.text())).toEqual(
      expect.arrayContaining([expect.stringMatching(/^(⌘|Ctrl\+)\[$/), expect.stringMatching(/^(⌘|Ctrl\+)\]$/)])
    )
    expect(wrapper.get('[data-testid="new-look-pages"]').text()).toContain('My glossary and Dictionaries')
    expect(wrapper.get('[data-testid="new-look-keys"]').text()).toContain('Return where you were.')
  })

  it('should show three tiles without keycaps on a phone', async () => {
    Storage.set('newLook', 'pending')
    await mountHome({ phone: true })
    expect(tiles()).toEqual(['new-look-reader', 'new-look-keys', 'new-look-saved'])
    expect(wrapper.find('.new-look kbd').exists()).toBe(false)
    expect(wrapper.get('[data-testid="new-look-keys"]').text()).toContain('Return where you were, with Back.')
  })

  it('should open the newest release notes when Everything that is new is clicked', async () => {
    Storage.set('newLook', 'pending')
    await mountHome()
    const { version } = latestReleaseNotes(changelog)
    await wrapper.get('[data-testid="new-look-all"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain(`What's new in v${version}`)
    expect(document.body.querySelector('[data-testid="new-look-notes"]')).not.toBeNull()
  })

  it('should open the mail app when Send feedback is clicked', async () => {
    Storage.set('newLook', 'pending')
    const send = vi.spyOn(feedback, 'openFeedbackMail').mockResolvedValue()
    await mountHome()
    await wrapper.get('[data-testid="new-look-send"]').trigger('click')
    expect(send).toHaveBeenCalledTimes(1)
  })
})
