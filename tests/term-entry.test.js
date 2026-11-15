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
const getAudioUrl = vi.fn(async (audioId, file) => `/audio/${audioId}/${file}`)
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
vi.mock('../src/services/audio-service', () => ({
  getAudioUrl: (...args) => getAudioUrl(...args),
  default: { getAudioUrl: (...args) => getAudioUrl(...args) },
}))
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
const filterButton = () => wrapper.find('[data-testid="entry-filter"]')
const options = () => wrapper.findAll('[data-testid="entry-filter-option"]')
const optionTexts = () =>
  options().map((option) => `${option.find('.dict-filter__name').text()} ${option.find('.dict-filter__count').text()}`)
async function openFilter() {
  await filterButton().trigger('click')
  await flushPromises()
}
async function chooseDictionary(name) {
  await openFilter()
  await options().find((option) => option.text().includes(name)).trigger('click')
  await flushPromises()
}
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
    await openFilter()
    expect(optionTexts().join(' ')).not.toContain('Hopkins')
  })

  it('should show every dictionary at first, the filter saying how many definitions', async () => {
    await mountEntry()
    expect(filterButton().text()).toBe('All dictionaries · 4')
    expect(sourceNames()).toHaveLength(3)
  })

  it('should list the dictionaries of the term in the filter, each with its count', async () => {
    await mountEntry()
    await openFilter()
    expect(optionTexts()).toEqual(['All dictionaries 4', 'Rangjung Yeshe 2', 'Hopkins 2015 1', 'Tsepak Rigdzin 1'])
    expect(document.activeElement).toBe(wrapper.find('[data-testid="entry-filter-search"]').element)
  })

  it('should show only the dictionary chosen, then all of them again', async () => {
    await mountEntry()
    await chooseDictionary('Hopkins 2015')
    expect(sourceNames()).toEqual(['Hopkins 2015'])
    expect(filterButton().text()).toBe('Hopkins 2015 · 1')
    expect(options()).toHaveLength(0)

    await wrapper.find('[data-testid="entry-filter-clear"]').trigger('click')
    expect(sourceNames()).toHaveLength(3)
    expect(filterButton().text()).toBe('All dictionaries · 4')
  })

  it('should find a dictionary by typing part of its name, without accents', async () => {
    await mountEntry()
    await openFilter()
    await wrapper.find('[data-testid="entry-filter-search"]').setValue('tsepak')
    expect(optionTexts()).toEqual(['Tsepak Rigdzin 1'])
    await wrapper.find('[data-testid="entry-filter-search"]').setValue('zzz')
    expect(wrapper.find('[data-testid="entry-filter-none"]').text()).toBe('No dictionary of this entry matches.')
  })

  it('should be used from the keyboard: Down and Up to move, Enter to choose, Escape to close', async () => {
    await mountEntry()
    await openFilter()
    const search = wrapper.find('[data-testid="entry-filter-search"]')
    await search.trigger('keydown', { key: 'ArrowDown' })
    await search.trigger('keydown', { key: 'ArrowDown' })
    expect(options()[2].attributes('aria-selected')).toBe('true')
    await search.trigger('keydown', { key: 'Enter' })
    expect(sourceNames()).toEqual(['Hopkins 2015'])

    await openFilter()
    await wrapper.find('[data-testid="entry-filter-search"]').trigger('keydown', { key: 'Escape' })
    expect(options()).toHaveLength(0)
    expect(document.activeElement).toBe(filterButton().element)
  })

  it('should tell apart two dictionaries with the same name by their languages', async () => {
    const SYN_EN = { id: 7, name: 'Hopkins-Synonyms1992', enabled: true, position: 4 }
    const SYN_TIB = { id: 8, name: 'Hopkins-TibetanSynonyms1992', enabled: true, position: 5 }
    Storage.set('dictionaries', [RY, HOPKINS, TSEPAK, SYN_EN, SYN_TIB])
    await mountEntry({}, [...ROWS, row(SYN_EN, 'a'), row(SYN_TIB, 'b')])
    await openFilter()
    const labels = optionTexts().filter((text) => text.startsWith('Hopkins Synonyms'))
    expect(labels).toHaveLength(2)
    expect(new Set(labels).size).toBe(2)
  })

  it('should go back to every dictionary when the term changes', async () => {
    await mountEntry()
    await chooseDictionary('Hopkins 2015')

    await wrapper.setProps({ term: 'སངས་རྒྱས་' })
    await flushPromises()

    expect(sourceNames()).toHaveLength(3)
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

  it('should copy only the dictionary chosen in the filter', async () => {
    await mountEntry()
    await chooseDictionary('Hopkins 2015')

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

// Ported from tests/define-page.test.js (Define — definitions)
describe('TermEntry — ported from Define', () => {
  const SCAN = { id: 4, name: 'Jaeschke_Scan', position: 4, enabled: true }

  it('should hide Copy when only scanned entries are shown', async () => {
    Storage.set('dictionaries', [SCAN])
    await mountEntry({}, [row(SCAN, '479')])

    expect(wrapper.find('[data-testid="entry-scan"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="entry-copy"]').exists()).toBe(false)
  })

  it('should leave the scanned entries out of what Copy copies', async () => {
    Storage.set('dictionaries', [RY, SCAN])
    await mountEntry({}, [row(RY, 'Blessed One'), row(SCAN, '479')])

    await wrapper.find('.term-entry__actions [data-testid="entry-copy"]').trigger('click')
    await flushPromises()

    const text = writeToClipboard.mock.calls[0][0]
    expect(text).toContain('Blessed One')
    expect(text).not.toContain('479')
  })

  it('should open Add my definition with the term, then look it up again once saved', async () => {
    tauri = true
    await mountEntry()
    const dialog = wrapper.findComponent({ name: 'QuickAddDialog' })
    expect(dialog.props()).toMatchObject({ modelValue: false, term: TERM })

    await wrapper.find('[data-testid="entry-add"]').trigger('click')
    expect(dialog.props('modelValue')).toBe(true)

    getEntriesFor.mockClear()
    dialog.vm.$emit('saved', { id: 1, created: true })
    expect(getEntriesFor).toHaveBeenCalledWith(TERM)
  })

  it('should have no headword audio button (audio plays from links in definitions)', async () => {
    await mountEntry()

    expect(wrapper.find('.audio-play-btn').exists()).toBe(false)
    expect(wrapper.find('[aria-label*="audio" i]').exists()).toBe(false)
  })
})

describe('TermEntry — custom dictionary names', () => {
  it('should show a custom dictionary name as text in the filter and the sections', async () => {
    const NAME = '<img src=x onerror=alert(1)>'
    const CUSTOM = { id: 9, name: NAME, position: 4, enabled: true }
    Storage.set('dictionaries', [RY, CUSTOM])
    await mountEntry({}, [row(RY, 'Blessed One'), row(CUSTOM, 'my own definition')])

    await openFilter()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(optionTexts()).toContain(`${NAME} 1`)
    expect(sourceNames()).toContain(NAME)
  })
})

describe('TermEntry — Listen and In context', () => {
  const HOTL_DICTIONARY = { id: 9, name: 'hotl1', position: 4, enabled: true }
  const HOTL = row(
    HOTL_DICTIONARY,
    '[sound:1-135a.mp3]\nOld\n-----\nExample: [sound:1-135c.mp3]\n འདི་བཅོམ་ལྡན་འདས་ཡིན།  This is the Blessed One.'
  )
  let players
  let play

  beforeEach(() => {
    Storage.set('dictionaries', [RY, HOPKINS, TSEPAK, HOTL_DICTIONARY])
    Storage.delete('entryContextOpen')
    players = []
    play = vi.fn(() => Promise.resolve())
    window.Audio = vi.fn(function (url) {
      this.url = url
      this.pause = vi.fn()
      this.play = play
      this.addEventListener = vi.fn()
      players.push(this)
    })
  })

  it('should show Listen and the sentence with the term marked and its translation when a Heart of Tibetan Language entry has them', async () => {
    await mountEntry({}, [...ROWS, HOTL])
    await wrapper.find('[data-testid="entry-context-toggle"]').trigger('click')

    expect(wrapper.find('[data-testid="entry-listen"]').attributes('aria-label')).toBe(`Listen to ${TERM}`)
    const context = wrapper.find('[data-testid="entry-context"]')
    expect(context.text()).toContain('འདི་བཅོམ་ལྡན་འདས་ཡིན།')
    expect(context.text()).toContain('This is the Blessed One.')
    expect(context.text()).toContain('Heart of Tibetan Language')
    expect(context.find('mark').text()).toBe('བཅོམ་ལྡན་འདས་')
  })

  it('should fold In context to one line by default, the sentence hidden', async () => {
    await mountEntry({}, [...ROWS, HOTL])

    const toggle = wrapper.find('[data-testid="entry-context-toggle"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.text()).toContain('Hear the term in a sentence')
    expect(wrapper.find('[data-testid="entry-context-play"]').exists()).toBe(false)
  })

  it('should keep In context open for the next entries once the user opened it', async () => {
    await mountEntry({}, [...ROWS, HOTL])
    await wrapper.find('[data-testid="entry-context-toggle"]').trigger('click')
    expect(Storage.get('entryContextOpen')).toBe(true)
    wrapper.unmount()

    await mountEntry({}, [...ROWS, HOTL])
    expect(wrapper.find('[data-testid="entry-context-toggle"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('[data-testid="entry-context-play"]').exists()).toBe(true)
  })

  it('should stop the sentence when In context is folded while it plays', async () => {
    Storage.set('entryContextOpen', true)
    await mountEntry({}, [...ROWS, HOTL])
    await wrapper.find('[data-testid="entry-context-play"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="entry-context-toggle"]').trigger('click')
    expect(players[0].pause).toHaveBeenCalled()
  })

  it('should show neither when no entry has a recording', async () => {
    await mountEntry()

    expect(wrapper.find('[data-testid="entry-listen"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="entry-context"]').exists()).toBe(false)
  })

  it('should hide In context but keep Listen when compact', async () => {
    await mountEntry({ compact: true }, [...ROWS, HOTL])

    expect(wrapper.find('[data-testid="entry-listen"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="entry-context"]').exists()).toBe(false)
  })

  it('should play the word from the audio service URL and stop when clicked again', async () => {
    await mountEntry({}, [...ROWS, HOTL])
    const listen = wrapper.find('[data-testid="entry-listen"]')

    await listen.trigger('click')
    await flushPromises()
    expect(getAudioUrl).toHaveBeenCalledWith('hotl1', '1-135a.mp3')
    expect(players[0].url).toBe('/audio/hotl1/1-135a.mp3')
    expect(play).toHaveBeenCalled()
    expect(listen.text()).toBe('Playing')

    await listen.trigger('click')
    expect(players[0].pause).toHaveBeenCalled()
    expect(listen.text()).toBe('Listen')
  })

  it('should stop the word when the sentence starts', async () => {
    await mountEntry({}, [...ROWS, HOTL])

    await wrapper.find('[data-testid="entry-listen"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="entry-context-toggle"]').trigger('click')
    await wrapper.find('[data-testid="entry-context-play"]').trigger('click')
    await flushPromises()

    expect(players[0].pause).toHaveBeenCalled()
    expect(players[1].url).toBe('/audio/hotl1/1-135c.mp3')
  })

  it('should tell the user when the recording cannot play', async () => {
    play.mockRejectedValue(new Error('no'))
    snackbar.open.mockClear()
    await mountEntry({}, [...ROWS, HOTL])

    await wrapper.find('[data-testid="entry-listen"]').trigger('click')
    await flushPromises()

    expect(snackbar.open).toHaveBeenCalledWith('Could not play the recording')
  })
})
