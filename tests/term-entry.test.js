/**
 * TermEntry: one Tibetan term as a page (headword, transcription, In short,
 * a tab per dictionary, then the definitions grouped by dictionary).
 * The database is mocked; EntriesEntry, the decorator, DictionaryTabs and the
 * src/ui components are the real ones.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

const writeToClipboard = vi.fn()
const getEntriesFor = vi.fn()
let tauri = false

vi.mock('../src/services/copy-service', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    writeToClipboard: (...args) => writeToClipboard(...args),
    default: { ...actual.default, writeToClipboard: (...args) => writeToClipboard(...args) },
  }
})
vi.mock('../src/services/sql-database', async (importOriginal) => {
  const actual = await importOriginal()
  actual.default.getEntriesFor = (...args) => getEntriesFor(...args)
  return actual
})
vi.mock('../src/config/platform', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    supportsModularPacks: () => tauri,
    default: { ...actual.default, supportsModularPacks: () => tauri },
  }
})

import TermEntry from '../src/components/entry/TermEntry.vue'
import Storage from '../src/services/storage'
import { savedTerms } from '../src/services/saved-terms'

const TERM = 'བཅོམ་ལྡན་འདས་'
const RY = { id: 1, name: 'RangjungYeshe', position: 1, enabled: true }
const HOPKINS = { id: 2, name: 'Hopkins2015', position: 2, enabled: true }
const TSEPAK = { id: 3, name: 'TsepakRigdzin', position: 3, enabled: true }

const row = (dictionary, definition, overrides = {}) => ({
  term: TERM,
  dictionary: dictionary.name,
  dictionaryId: dictionary.id,
  dictionaryPosition: dictionary.position,
  definition,
  ...overrides,
})

const ROWS = [
  row(RY, 'Blessed One; Bhagavan'),
  row(RY, 'an epithet of the Buddha'),
  row(HOPKINS, 'Supramundane Victor; blessed one'),
  row(TSEPAK, 'Bhagavan; conqueror'),
]

const snackbar = { open: vi.fn() }
const scanViewerStub = { name: 'ScanViewer', template: '<div />' }

let wrapper
async function mountEntry(props = {}, rows = ROWS) {
  getEntriesFor.mockResolvedValue(rows)
  wrapper = mount(TermEntry, {
    props: { term: TERM, ...props },
    attachTo: document.body,
    global: { provide: { snackbar }, stubs: { ScanViewer: scanViewerStub } },
  })
  await flushPromises()
  return wrapper
}

const sources = () => wrapper.findAll('[data-testid="entry-source"]')
const tabs = () => wrapper.findAll('[data-testid="entry-tab"]')
const sourceNames = () => sources().map((source) => source.find('[data-testid="entry-source-name"]').text())

beforeEach(() => {
  tauri = false
  getEntriesFor.mockReset()
  writeToClipboard.mockReset().mockResolvedValue()
  snackbar.open.mockClear()
  Storage.set('dictionaries', [RY, HOPKINS, TSEPAK])
  Storage.delete('savedTerms')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('TermEntry', () => {
  it('should show the headword, its Wylie and phonetics, and the count', async () => {
    await mountEntry()

    expect(wrapper.find('[data-testid="entry-headword"]').text()).toBe(TERM)
    expect(wrapper.find('[data-testid="entry-transcription"]').text()).toBe(
      "bcom ldan 'das · chomdendé · 4 definitions"
    )
    expect(getEntriesFor).toHaveBeenCalledWith(TERM)
  })

  it('should look up the term with one closing tsheg', async () => {
    await mountEntry({ term: 'བཅོམ་ལྡན་འདས' })

    expect(getEntriesFor).toHaveBeenCalledWith(TERM)
  })

  it('should say loading, then tell when a term has no definition', async () => {
    getEntriesFor.mockReturnValue(new Promise(() => {}))
    wrapper = mount(TermEntry, { props: { term: TERM }, global: { provide: { snackbar } } })
    await nextTick()
    expect(wrapper.find('[data-testid="entry-loading"]').exists()).toBe(true)
    wrapper.unmount()

    await mountEntry({}, [])
    expect(wrapper.find('[data-testid="entry-loading"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="entry-empty"]').exists()).toBe(true)
    expect(wrapper.emitted('loaded')).toEqual([[0]])
  })

  it('should show no definitions when they cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    getEntriesFor.mockRejectedValue(new Error('database closed'))
    wrapper = mount(TermEntry, { props: { term: TERM }, global: { provide: { snackbar } } })
    await flushPromises()
    expect(wrapper.find('[data-testid="entry-loading"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="entry-empty"]').exists()).toBe(true)
    expect(wrapper.emitted('loaded')).toEqual([[0]])
    expect(warn).toHaveBeenCalled()
  })

  it('should put the content of the leading slot in the row of the actions', async () => {
    getEntriesFor.mockResolvedValue(ROWS)
    wrapper = mount(TermEntry, {
      props: { term: TERM },
      slots: { leading: '<button data-testid="lead">Back</button>' },
      global: { provide: { snackbar }, stubs: { ScanViewer: scanViewerStub } },
    })
    await flushPromises()
    expect(wrapper.find('.term-entry__actions [data-testid="lead"]').exists()).toBe(true)
  })

  it('should tell how many definitions loaded', async () => {
    await mountEntry()

    expect(wrapper.emitted('loaded')).toEqual([[4]])
  })

  it('should show In short when two dictionaries agree and hide it otherwise', async () => {
    await mountEntry()
    const box = wrapper.find('[data-testid="entry-in-short"]')
    expect(box.exists()).toBe(true)
    expect(box.text()).toContain('In short')
    expect(box.text()).toContain('Blessed One · Bhagavan')
    wrapper.unmount()

    await mountEntry({}, [row(RY, 'Blessed One'), row(HOPKINS, 'Victor'), row(TSEPAK, 'conqueror')])
    expect(wrapper.find('[data-testid="entry-in-short"]').exists()).toBe(false)
  })

  it("should group definitions under each dictionary in the user's order", async () => {
    Storage.set('dictionaries', [
      { ...TSEPAK, position: 1 },
      { ...RY, position: 2 },
      { ...HOPKINS, position: 3 },
    ])
    await mountEntry()

    expect(sourceNames()).toEqual(['Tsepak Rigdzin', 'Rangjung Yeshe', 'Hopkins 2015'])
    expect(sources()[1].findAll('.definition')).toHaveLength(2)
  })

  it('should leave out dictionaries switched off', async () => {
    Storage.set('dictionaries', [RY, { ...HOPKINS, enabled: false }, TSEPAK])
    await mountEntry()

    expect(sourceNames()).toEqual(['Rangjung Yeshe', 'Tsepak Rigdzin'])
    expect(wrapper.find('[data-testid="entry-transcription"]').text()).toContain('3 definitions')
    expect(tabs().map((tab) => tab.text())).not.toContain('Hopkins')
  })

  it('should filter by a dictionary tab and go back with All', async () => {
    await mountEntry()
    expect(tabs()).toHaveLength(3)

    await tabs()[1].trigger('click')
    expect(sourceNames()).toEqual(['Hopkins 2015'])
    expect(tabs()[1].attributes('aria-selected')).toBe('true')

    await wrapper.find('[data-testid="entry-tab-all"]').trigger('click')
    expect(sourceNames()).toHaveLength(3)
    expect(wrapper.find('[data-testid="entry-tab-all"]').text()).toBe('All · 4')
  })

  it('should go back to All when the term changes', async () => {
    await mountEntry()
    await tabs()[1].trigger('click')

    await wrapper.setProps({ term: 'སངས་རྒྱས་' })
    await flushPromises()

    expect(sourceNames()).toHaveLength(3)
  })

  describe('when the tabs do not all fit', () => {
    let offsetWidth
    let clientWidth
    beforeEach(() => {
      offsetWidth = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100)
      clientWidth = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300)
    })

    it('should put dictionaries that do not fit under More', async () => {
      await mountEntry()

      expect(tabs()).toHaveLength(1)
      expect(wrapper.find('[data-testid="entry-tabs-more"]').text()).toBe('More…')
    })

    it('should show every tab and no More when they all fit', async () => {
      clientWidth.mockReturnValue(900)
      await mountEntry()

      expect(tabs()).toHaveLength(3)
      expect(wrapper.find('[data-testid="entry-tabs-more"]').exists()).toBe(false)
    })

    it('should filter by a dictionary chosen under More', async () => {
      await mountEntry()

      await wrapper.find('[data-testid="entry-tabs-more"]').trigger('keydown', { key: 'Enter' })
      await flushPromises()
      const item = document.body.querySelector('[data-testid="ui-menu-item-dict-3"]')
      expect(item).not.toBeNull()
      item.click()
      await flushPromises()

      expect(sourceNames()).toEqual(['Tsepak Rigdzin'])
    })

    it('should give More the tab role when it sits in the tab list', async () => {
      await mountEntry()

      const roles = wrapper.findAll('[role="tablist"] > button').map((button) => button.attributes('role'))
      expect(roles).toEqual(['tab', 'tab', 'tab'])
    })

    it('should measure the tabs again when the web fonts have loaded', async () => {
      let fontsLoaded
      const ready = new Promise((resolve) => { fontsLoaded = resolve })
      Object.defineProperty(document, 'fonts', { value: { ready }, configurable: true })
      try {
        await mountEntry()
        expect(tabs()).toHaveLength(1)

        // The web font is narrower than the fallback the first measure saw
        offsetWidth.mockReturnValue(50)
        fontsLoaded()
        await flushPromises()

        expect(tabs()).toHaveLength(3)
      } finally {
        delete document.fonts
      }
    })
  })

  it('should copy every definition shown', async () => {
    await mountEntry()

    await wrapper.find('.term-entry__actions [data-testid="entry-copy"]').trigger('click')
    await flushPromises()

    const text = writeToClipboard.mock.calls[0][0]
    expect(text.startsWith(TERM)).toBe(true)
    expect(text).toContain('(Rangjung Yeshe) : Blessed One; Bhagavan')
    expect(text).toContain('(Hopkins 2015) : Supramundane Victor; blessed one')
    expect(text).toContain('(Tsepak Rigdzin) : Bhagavan; conqueror')
    expect(snackbar.open).toHaveBeenCalledWith('Copied')
  })

  it('should copy only the dictionary of the tab when one is chosen', async () => {
    await mountEntry()
    await tabs()[1].trigger('click')

    await wrapper.find('.term-entry__actions [data-testid="entry-copy"]').trigger('click')
    await flushPromises()

    const text = writeToClipboard.mock.calls[0][0]
    expect(text).toContain('Hopkins 2015')
    expect(text).not.toContain('Rangjung Yeshe')
  })

  it('should say when the copy failed', async () => {
    writeToClipboard.mockRejectedValue(new Error('denied'))
    await mountEntry()

    await wrapper.find('.term-entry__actions [data-testid="entry-copy"]').trigger('click')
    await flushPromises()

    expect(snackbar.open).toHaveBeenCalledWith('Copy failed')
  })

  it('should save and unsave the term', async () => {
    await mountEntry()
    const save = () => wrapper.find('[data-testid="entry-save"]')
    expect(save().attributes('aria-pressed')).toBe('false')

    await save().trigger('click')
    expect(save().attributes('aria-pressed')).toBe('true')
    expect(savedTerms()).toEqual([TERM])

    await save().trigger('click')
    expect(save().attributes('aria-pressed')).toBe('false')
    expect(savedTerms()).toEqual([])
  })

  it('should show a term saved elsewhere as saved', async () => {
    Storage.set('savedTerms', [TERM])
    await mountEntry()

    expect(wrapper.find('[data-testid="entry-save"]').attributes('aria-pressed')).toBe('true')
  })

  it('should offer Add my definition only where packs are supported', async () => {
    await mountEntry()
    expect(wrapper.find('[data-testid="entry-add"]').exists()).toBe(false)
    wrapper.unmount()

    tauri = true
    await mountEntry()
    expect(wrapper.find('[data-testid="entry-add"]').exists()).toBe(true)
  })

  it('should keep definitions inside .definition so links and abbreviations work', async () => {
    await mountEntry({}, [
      row(RY, 'see ཀ་ and <abbr data-title="noun">n.</abbr> x'),
    ])

    const definition = wrapper.find('[data-testid="entry-source"] .definition')
    expect(definition.exists()).toBe(true)
    expect(definition.find('abbr[data-title]').exists()).toBe(true)
    expect(definition.find('.tibetan').exists()).toBe(true)
  })

  it('should show a link to the term in a definition as an in-app /define link', async () => {
    const { default: SqlDatabase } = await import('../src/services/sql-database')
    vi.spyOn(SqlDatabase, 'hasTerm').mockImplementation((term) => term === 'ཀ་')
    await mountEntry({}, [row(RY, 'see ཀ་')])

    expect(wrapper.find('.definition a[href="/define/ཀ་"]').exists()).toBe(true)
  })

  it('should show View scan for a scanned dictionary', async () => {
    const SCAN = { id: 4, name: 'Jaeschke_Scan', position: 4, enabled: true }
    Storage.set('dictionaries', [RY, SCAN])
    await mountEntry({}, [row(RY, 'Blessed One'), row(SCAN, '479')])

    expect(wrapper.find('[data-testid="entry-view-scan"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="entry-scan"]').text()).toContain('Page 479')
  })

  it('should not repeat the dictionary name on each definition', async () => {
    await mountEntry()

    expect(wrapper.find('[data-testid="entry-dictionary"]').exists()).toBe(false)
  })

  it('should open the dictionary about dialog from its name', async () => {
    await mountEntry()

    await sources()[1].find('[data-testid="entry-source-name"]').trigger('click')
    await flushPromises()

    expect(document.body.querySelector('[data-testid="dictionary-about"]')).not.toBeNull()
  })

  it('should show three dictionaries and Open entry when compact', async () => {
    const FOURTH = { id: 4, name: 'Berzin', position: 4, enabled: true }
    Storage.set('dictionaries', [RY, HOPKINS, TSEPAK, FOURTH])
    await mountEntry({ compact: true }, [...ROWS, row(FOURTH, 'Vanquishing Master')])

    expect(sources()).toHaveLength(3)
    expect(wrapper.find('[data-testid="entry-tabs"]').exists()).toBe(false)
    const open = wrapper.find('[data-testid="entry-open"]')
    expect(open.text()).toContain('Open entry')

    await open.trigger('click')
    expect(wrapper.emitted('open-entry')).toEqual([[TERM]])
  })

  it('should not offer Open entry when not compact', async () => {
    await mountEntry()

    expect(wrapper.find('[data-testid="entry-open"]').exists()).toBe(false)
  })

  it('should highlight hits when given a highlighter', async () => {
    const highlight = vi.fn((html) => html.replace('Victor', '<em>Victor</em>'))
    await mountEntry({ highlight })

    expect(wrapper.find('.definition em').text()).toBe('Victor')
  })

  it('should refresh when the dictionaries change', async () => {
    await mountEntry()
    expect(sourceNames()).toHaveLength(3)

    Storage.set('dictionaries', [RY, { ...HOPKINS, enabled: false }, TSEPAK])
    window._triggerEvent('dictionaries-updated')
    await flushPromises()

    expect(sourceNames()).toEqual(['Rangjung Yeshe', 'Tsepak Rigdzin'])
  })

  it('should filter and reorder without reading the database again when only enabled or order changed', async () => {
    await mountEntry()
    getEntriesFor.mockClear()

    Storage.set('dictionaries', [
      { ...RY, position: 3 },
      { ...HOPKINS, enabled: false },
      { ...TSEPAK, position: 1 },
    ])
    window._triggerEvent('dictionaries-updated')
    await nextTick()

    expect(getEntriesFor).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="entry-loading"]').exists()).toBe(false)
    expect(sourceNames()).toEqual(['Tsepak Rigdzin', 'Rangjung Yeshe'])
  })

  it('should read the database again when a dictionary was added', async () => {
    await mountEntry()
    getEntriesFor.mockClear()
    const added = { id: 4, name: 'RichardBarron', position: 4, enabled: true }
    getEntriesFor.mockResolvedValue([...ROWS, row(added, 'the Transcendent Conqueror')])

    Storage.set('dictionaries', [RY, HOPKINS, TSEPAK, added])
    window._triggerEvent('dictionaries-updated')
    await flushPromises()

    expect(getEntriesFor).toHaveBeenCalledTimes(1)
    expect(sourceNames()).toHaveLength(4)
  })
})
