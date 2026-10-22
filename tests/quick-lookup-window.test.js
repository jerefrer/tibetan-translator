/**
 * The quick lookup window (GlobalLookupWindow.vue), the global hotkey's popup.
 * One block per behaviour of the old window (docs/redesign/reports/quicklookup.md).
 * The Tauri API is mocked; Entries.vue, the decorator, the Wylie converter and
 * the src/ui components are the real ones.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

const invoke = vi.fn()
const readText = vi.fn()
const listeners = {}
const onFocusChanged = vi.fn()
const startDragging = vi.fn()
const hide = vi.fn()
const writeToClipboard = vi.fn()
const sqlGetEntriesFor = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args) => invoke(...args) }))
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({ readText: (...args) => readText(...args) }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: async (event, handler) => {
    listeners[event] = handler
    return () => delete listeners[event]
  },
}))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onFocusChanged: async (handler) => {
      onFocusChanged(handler)
      return () => {}
    },
    startDragging: (...args) => startDragging(...args),
    hide: (...args) => hide(...args),
  }),
}))
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
  actual.default.getEntriesFor = (...args) => sqlGetEntriesFor(...args)
  return actual
})
vi.mock('../src/services/legacy-to-unicode', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    mayNeedLegacyRepair: ({ text }) => text === 'LEGACY',
    convertLegacyPaste: async () => 'ཡེ་ཤེས།',
  }
})

import GlobalLookupWindow from '../src/components/GlobalLookupWindow.vue'
import Storage from '../src/services/storage'
import SqlDatabase from '../src/services/sql-database'

const TERMS = ['ཡེ་ཤེས་', 'ཡེ་ཤེས་པ་', 'ཡེ་ཤེས་ཀྱི་', 'སངས་རྒྱས་', 'ཀ་']
const entry = (overrides = {}) => ({
  term: 'ཡེ་ཤེས་',
  dictionary: 'TsepakRigdzin',
  dictionaryId: 18,
  dictionaryPosition: 1,
  definition: 'wisdom',
  ...overrides,
})

let entriesByTerm
let searchResults
let installedPacks

function defaultInvoke(cmd, args) {
  switch (cmd) {
    case 'pack_get_all_terms':
      return Promise.resolve([...TERMS])
    case 'pack_get_entries_for_term':
      return Promise.resolve(entriesByTerm[args.term] || [])
    case 'pack_search_entries':
      return Promise.resolve(searchResults)
    case 'get_installed_packs':
      return Promise.resolve(installedPacks)
    default:
      return Promise.resolve(null)
  }
}

let wrapper
async function settle(ms = 0) {
  if (ms) await new Promise((resolve) => setTimeout(resolve, ms))
  for (let i = 0; i < 4; i++) {
    await flushPromises()
    await nextTick()
  }
}

async function mountWindow({ clipboard = 'ཡེ་ཤེས།' } = {}) {
  readText.mockResolvedValue(clipboard)
  wrapper = mount(GlobalLookupWindow, { attachTo: document.body })
  // created() waits 100 ms before asking Tauri for the terms
  await settle(130)
  return wrapper
}

const find = (testid) => wrapper.find(`[data-testid="${testid}"]`)
const findAll = (testid) => wrapper.findAll(`[data-testid="${testid}"]`)
const press = async (key) => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  await settle()
}
const STORED_KEYS = ['dictionaries', 'themePreference', 'fontSize', 'globalLookupHotkey']

beforeEach(() => {
  window.__TAURI_INTERNALS__ = {}
  entriesByTerm = {
    'ཡེ་ཤེས་': [entry(), entry({ dictionary: 'Drungtso', dictionaryId: 5, definition: 'ye shes ni' })],
    'ཡེ་ཤེས་པ་': [entry({ term: 'ཡེ་ཤེས་པ་', definition: 'the wise one' })],
  }
  searchResults = []
  installedPacks = ['core', 'tibetan-monolingual', 'sanskrit-academic']
  invoke.mockReset().mockImplementation(defaultInvoke)
  readText.mockReset()
  onFocusChanged.mockReset()
  startDragging.mockReset().mockResolvedValue()
  hide.mockReset().mockResolvedValue()
  writeToClipboard.mockReset().mockResolvedValue()
  sqlGetEntriesFor.mockReset().mockResolvedValue([])
  for (const key of Object.keys(listeners)) delete listeners[key]
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  window.__TAURI_INTERNALS__ = undefined
  // Storage.set writes properties the setup's localStorage.clear() misses
  STORED_KEYS.forEach((key) => Storage.delete(key))
  SqlDatabase.allTerms = []
})

describe('start-up', () => {
  it('S3: should show a spinner while the term list loads', async () => {
    readText.mockResolvedValue('')
    wrapper = mount(GlobalLookupWindow, { attachTo: document.body })
    expect(find('ql-loading').exists()).toBe(true)
    await settle(130)
    expect(find('ql-loading').exists()).toBe(false)
  })

  it('S3: should show the empty state and call nothing outside Tauri', async () => {
    window.__TAURI_INTERNALS__ = undefined
    await mountWindow()
    expect(invoke).not.toHaveBeenCalled()
    expect(readText).not.toHaveBeenCalled()
    expect(find('ql-empty').exists()).toBe(true)
  })

  it('S4: should load the terms of every installed pack, then read the clipboard', async () => {
    await mountWindow()
    expect(invoke).toHaveBeenCalledWith('pack_get_all_terms')
    expect(readText).toHaveBeenCalled()
    expect(SqlDatabase.hasTerm('ཡེ་ཤེས་')).toBe(true)
  })

  it('W3: should turn the window into a panel on mount (NSPanel on macOS)', async () => {
    await mountWindow()
    expect(invoke).toHaveBeenCalledWith('configure_window_for_fullscreen')
  })

  it('renders without Vuetify', async () => {
    await mountWindow()
    expect(wrapper.html()).not.toMatch(/class="[^"]*\bv-/)
  })
})

describe('reading the clipboard', () => {
  it('C1: should leave the window as it is for an empty clipboard', async () => {
    await mountWindow({ clipboard: '  ' })
    expect(find('ql-field').find('input').element.value).toBe('')
    expect(find('ql-empty').exists()).toBe(true)
    expect(find('ql-title').text()).toBe('Quick lookup')
  })

  it('C2: should repair text in a pre-Unicode Tibetan font', async () => {
    await mountWindow({ clipboard: 'LEGACY' })
    expect(find('ql-field').find('input').element.value).toBe('ཡེ་ཤེས་')
  })

  it('C3: should look Tibetan up in Define, by its lookup key, and say it came from the clipboard', async () => {
    await mountWindow({ clipboard: 'ཡེ་ཤེས།' })
    expect(find('ql-mode-define').attributes('aria-pressed')).toBe('true')
    expect(find('ql-field').find('input').element.value).toBe('ཡེ་ཤེས་')
    expect(find('ql-title').text()).toBe('From your clipboard')
    expect(find('ql-headword').find('h1').text()).toBe('ཡེ་ཤེས་')
  })

  it('C4: should convert Wylie that starts a known term and show the Wylie beside the headword', async () => {
    await mountWindow({ clipboard: 'ye shes' })
    expect(find('ql-field').find('input').element.value).toBe('ཡེ་ཤེས་')
    expect(find('ql-reading').text()).toContain('ye shes ·')
  })

  it('C4: should search the definitions for anything else', async () => {
    searchResults = [entry({ definition: 'primordial wisdom' })]
    await mountWindow({ clipboard: 'primordial wisdom' })
    await settle(200)
    expect(find('ql-mode-search').attributes('aria-pressed')).toBe('true')
    expect(invoke).toHaveBeenCalledWith('pack_search_entries', {
      query: 'primordial wisdom',
      searchType: 'definition',
    })
    expect(findAll('ql-result')).toHaveLength(1)
  })

  it('the title goes back to "Quick lookup" once the text is typed over', async () => {
    await mountWindow()
    await find('ql-field').find('input').setValue('སངས་')
    await settle()
    expect(find('ql-title').text()).toBe('Quick lookup')
    expect(find('ql-reading').text()).not.toContain('·')
  })
})

describe('modes', () => {
  it('M1: Tab should toggle between Define and Search', async () => {
    await mountWindow()
    await press('Tab')
    expect(find('ql-mode-search').attributes('aria-pressed')).toBe('true')
    expect(find('ql-search-field').exists()).toBe(true)
    await press('Tab')
    expect(find('ql-mode-define').attributes('aria-pressed')).toBe('true')
  })

  it('M1: the mode buttons should switch the mode', async () => {
    await mountWindow()
    await find('ql-mode-search').trigger('click')
    await settle()
    expect(find('ql-search-field').exists()).toBe(true)
    await find('ql-mode-define').trigger('click')
    await settle()
    expect(find('ql-field').exists()).toBe(true)
  })

  it('M2: should keep Tibetan across modes and bring back the last Define value over Latin text', async () => {
    searchResults = []
    await mountWindow({ clipboard: 'ཡེ་ཤེས།' })
    await press('Tab')
    expect(find('ql-search-field').find('input').element.value).toBe('ཡེ་ཤེས་')
    await find('ql-search-field').find('input').setValue('kind')
    await settle()
    await press('Tab')
    expect(find('ql-field').find('input').element.value).toBe('ཡེ་ཤེས་')
  })

  it('M3: the Define field should convert Wylie typed in it', async () => {
    await mountWindow({ clipboard: '' })
    const input = find('ql-field').find('input')
    await input.setValue('sangs ')
    await input.trigger('keyup', { key: ' ' })
    await settle()
    expect(input.element.value).toBe('སངས་')
    expect(find('ql-terms-count').text()).toBe('1 term')
  })

  it('M4: Search should run 150 ms after typing, with Tibetan in the Tibetan font', async () => {
    await mountWindow({ clipboard: '' })
    await press('Tab')
    invoke.mockClear()
    await find('ql-search-field').find('input').setValue('ཡེ་')
    expect(invoke).not.toHaveBeenCalledWith('pack_search_entries', expect.anything())
    await settle(200)
    expect(invoke).toHaveBeenCalledWith('pack_search_entries', { query: 'ཡེ་', searchType: 'definition' })
    expect(find('ql-search-field').classes()).toContain('has-tibetan')
  })
})

describe('Define', () => {
  it('D1: should list the terms starting with the text, sorted, with their count', async () => {
    await mountWindow()
    expect(find('ql-terms-count').text()).toBe('3 terms')
    expect(findAll('ql-term').map((t) => t.text())).toEqual(['ཡེ་ཤེས་', 'ཡེ་ཤེས་ཀྱི་', 'ཡེ་ཤེས་པ་'])
  })

  it('D1: should show 50 terms, then 50 more', async () => {
    const many = Array.from({ length: 120 }, (_, i) => `ཀ་${String(i).padStart(3, '0')}`)
    invoke.mockImplementation((cmd, args) =>
      cmd === 'pack_get_all_terms' ? Promise.resolve(many) : defaultInvoke(cmd, args)
    )
    await mountWindow({ clipboard: 'ཀ་' })
    expect(findAll('ql-term')).toHaveLength(50)
    await find('ql-terms-more').find('button').trigger('click')
    await settle()
    expect(findAll('ql-term')).toHaveLength(100)
  })

  it('D2: should select the first term at once and show its entries', async () => {
    await mountWindow()
    expect(find('ql-term').classes()).toContain('is-active')
    expect(invoke).toHaveBeenCalledWith('pack_get_entries_for_term', { term: 'ཡེ་ཤེས་' })
    expect(findAll('entry')).toHaveLength(2)
    expect(find('ql-entries-count').text()).toBe('2 entries')
  })

  it('D3: Up/Down should move through the terms, and a click should select one', async () => {
    await mountWindow()
    await press('ArrowDown')
    expect(wrapper.find('.term-item.is-active').text()).toBe('ཡེ་ཤེས་ཀྱི་')
    await press('ArrowDown')
    await press('ArrowDown') // stays on the last
    expect(wrapper.find('.term-item.is-active').text()).toBe('ཡེ་ཤེས་པ་')
    expect(find('ql-entries').text()).toContain('the wise one')
    await press('ArrowUp')
    expect(wrapper.find('.term-item.is-active').text()).toBe('ཡེ་ཤེས་ཀྱི་')
    await findAll('ql-term')[0].trigger('click')
    await settle()
    expect(wrapper.find('.term-item.is-active').text()).toBe('ཡེ་ཤེས་')
  })

  it('D3: Up/Down should do nothing in Search', async () => {
    await mountWindow()
    await press('Tab')
    invoke.mockClear()
    await press('ArrowDown')
    expect(invoke).not.toHaveBeenCalledWith('pack_get_entries_for_term', expect.anything())
  })

  it('D3: a slow answer for an earlier term should not replace the entries of the selected one', async () => {
    let releaseFirst
    invoke.mockImplementation((cmd, args) => {
      if (cmd === 'pack_get_entries_for_term' && args.term === 'ཡེ་ཤེས་ཀྱི་')
        return new Promise((resolve) => { releaseFirst = () => resolve([entry({ definition: 'stale' })]) })
      return defaultInvoke(cmd, args)
    })
    await mountWindow()
    await press('ArrowDown')
    await press('ArrowDown')
    releaseFirst()
    await settle()
    expect(find('ql-entries').text()).toContain('the wise one')
    expect(find('ql-entries').text()).not.toContain('stale')
  })

  it('D4: should show the dictionaries enabled in Settings, in the Settings order, and say how many are off', async () => {
    Storage.set('dictionaries', [
      { id: 5, position: 1, enabled: true },
      { id: 18, position: 2, enabled: true },
    ])
    await mountWindow()
    expect(findAll('entry').map((e) => e.find('.definition').text())).toEqual(['ye shes ni', 'wisdom'])

    wrapper.unmount()
    Storage.set('dictionaries', [
      { id: 5, position: 1, enabled: false },
      { id: 18, position: 2, enabled: false },
    ])
    await mountWindow()
    expect(find('ql-no-entries').text()).toContain('No definitions for “ཡེ་ཤེས་”.')
    expect(find('ql-hidden-entries').text()).toBe('2 entries are in dictionaries turned off in Settings.')
  })

  it('D4: should fall back to the database service when the Tauri command fails', async () => {
    invoke.mockImplementation((cmd, args) =>
      cmd === 'pack_get_entries_for_term' ? Promise.reject(new Error('no')) : defaultInvoke(cmd, args)
    )
    sqlGetEntriesFor.mockResolvedValue([entry({ definition: 'from sql' })])
    await mountWindow()
    expect(sqlGetEntriesFor).toHaveBeenCalledWith('ཡེ་ཤེས་')
    expect(find('ql-entries').text()).toContain('from sql')
  })

  it('D5: should say when a term has no definitions', async () => {
    await mountWindow({ clipboard: 'སངས་རྒྱས་' })
    expect(find('ql-no-entries').text()).toContain('No definitions for “སངས་རྒྱས་”.')
    expect(find('ql-hidden-entries').exists()).toBe(false)
  })

  it('D5: should show a spinner while the entries load', async () => {
    let release
    invoke.mockImplementation((cmd, args) =>
      cmd === 'pack_get_entries_for_term'
        ? new Promise((resolve) => { release = () => resolve([entry()]) })
        : defaultInvoke(cmd, args)
    )
    await mountWindow()
    expect(find('ql-entries-loading').exists()).toBe(true)
    release()
    await settle()
    expect(find('ql-entries-loading').exists()).toBe(false)
  })

  it('D6: should invite to copy text, with the hotkey from Settings, when the field is empty', async () => {
    Storage.set('globalLookupHotkey', 'CommandOrControl+Shift+L')
    await mountWindow({ clipboard: '' })
    expect(find('ql-empty').text()).toContain('Copy Tibetan text anywhere, then press')
    expect(find('ql-empty').find('kbd').text()).toMatch(/L$/)
  })

  it('D6: should say when no term matches and offer to search the definitions', async () => {
    await mountWindow({ clipboard: 'ཁཁཁ' })
    expect(find('ql-no-terms').text()).toContain('No term starts with “ཁཁཁ')
    await find('ql-search-instead').trigger('click')
    await settle(200)
    expect(find('ql-mode-search').attributes('aria-pressed')).toBe('true')
    expect(invoke).toHaveBeenCalledWith('pack_search_entries', { query: 'ཁཁཁ་', searchType: 'definition' })
  })
})

describe('Search', () => {
  it('R2/R3: should sort the results and highlight the query in the term and the definition', async () => {
    searchResults = [
      entry({ term: 'a wisdom', definition: 'x' }),
      entry({ term: 'wisdom', definition: 'Wisdom itself' }),
    ]
    await mountWindow({ clipboard: 'wisdom' })
    await settle(200)
    expect(find('ql-results-count').text()).toBe('2 results')
    const results = findAll('ql-result')
    expect(results[0].find('.ql-result__term').html()).toContain('<mark>wisdom</mark>')
    expect(results[0].find('.definition').html()).toContain('<mark>Wisdom</mark> itself')
  })

  it('R3: should leave out disabled dictionaries', async () => {
    Storage.set('dictionaries', [{ id: 18, position: 1, enabled: false }])
    searchResults = [entry({ definition: 'wisdom' })]
    await mountWindow({ clipboard: 'wisdom' })
    await settle(200)
    expect(find('ql-no-results').text()).toBe('No results for “wisdom”.')
  })

  it('R4: should show 20 results, then 20 more', async () => {
    searchResults = Array.from({ length: 45 }, (_, i) => entry({ term: `wisdom ${i}`, definition: `d${i}` }))
    await mountWindow({ clipboard: 'wisdom' })
    await settle(200)
    expect(findAll('ql-result')).toHaveLength(20)
    await find('ql-results-more').find('button').trigger('click')
    await settle()
    expect(findAll('ql-result')).toHaveLength(40)
  })

  it('R5: should say when nothing matches, and invite to type when empty', async () => {
    await mountWindow({ clipboard: 'zzzz' })
    await settle(200)
    expect(find('ql-no-results').exists()).toBe(true)
    await find('ql-search-field').find('input').setValue('')
    await settle(200)
    expect(find('ql-search-empty').text()).toContain('Type to search')
  })
})

describe('packs not installed (N1)', () => {
  it('should name the packs that were not searched when few terms match', async () => {
    installedPacks = ['core']
    await mountWindow({ clipboard: 'སངས་རྒྱས་' })
    expect(invoke).toHaveBeenCalledWith('get_installed_packs')
    expect(find('ql-packs-notice').text()).toContain('2 packs were not searched: Tibetan Monolingual, Sanskrit & Academic')
  })

  it('should not show with every pack installed, or with many results', async () => {
    await mountWindow({ clipboard: 'སངས་རྒྱས་' })
    expect(find('ql-packs-notice').exists()).toBe(false)
    wrapper.unmount()
    installedPacks = ['core']
    await mountWindow({ clipboard: 'ཡེ་ཤེས།' }) // 3 terms
    expect(find('ql-packs-notice').exists()).toBe(false)
    expect(find('ql-footer').text()).toContain('Define or Search')
  })
})

describe('entries', () => {
  it('E2: copy should copy the entry and say so in a toast', async () => {
    await mountWindow()
    await find('entry-copy').trigger('click')
    await settle()
    expect(writeToClipboard).toHaveBeenCalledWith(expect.stringContaining('wisdom'))
    expect(document.body.textContent).toContain('Copied')
  })

  it('E1: the dictionary chip should open the About dialog, and Escape then leaves the window open', async () => {
    await mountWindow()
    await find('entry-dictionary').trigger('click')
    await settle()
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    invoke.mockClear()
    await press('Escape')
    expect(invoke).not.toHaveBeenCalledWith('hide_lookup_panel')
  })

  it('E3: a /define/ link inside a definition should look the term up in this window', async () => {
    entriesByTerm['ཡེ་ཤེས་'] = [entry({ definition: 'see སངས་རྒྱས་' })]
    await mountWindow()
    const link = wrapper.find(".definition a[href^='/define/']")
    expect(link.exists()).toBe(true)
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.element.dispatchEvent(click)
    await settle()
    expect(click.defaultPrevented).toBe(true)
    expect(find('ql-field').find('input').element.value).toBe('སངས་རྒྱས་')
  })

  it('E3: an abbreviation should show its expansion in a toast', async () => {
    entriesByTerm['ཡེ་ཤེས་'] = [entry({ definition: '<abbr data-title="Sanskrit">Skt.</abbr> jñāna' })]
    await mountWindow()
    wrapper.find('.definition abbr').element.click()
    await settle()
    expect(document.body.textContent).toContain('Sanskrit')
  })
})

describe('closing and the window', () => {
  it('K2: Escape should hide the panel', async () => {
    await mountWindow()
    await press('Escape')
    expect(invoke).toHaveBeenCalledWith('hide_lookup_panel')
  })

  it('W6: should hide the window when the panel command fails', async () => {
    invoke.mockImplementation((cmd, args) =>
      cmd === 'hide_lookup_panel' ? Promise.reject(new Error('no panel')) : defaultInvoke(cmd, args)
    )
    await mountWindow()
    await find('ql-close').trigger('click')
    await settle()
    expect(hide).toHaveBeenCalled()
  })

  it('W7: the bar should drag the window, but not from its buttons', async () => {
    await mountWindow()
    await find('ql-bar').trigger('mousedown', { button: 0 })
    await settle()
    expect(startDragging).toHaveBeenCalledTimes(1)
    await find('ql-mode-search').trigger('mousedown', { button: 0 })
    await settle()
    expect(startDragging).toHaveBeenCalledTimes(1)
  })

  it('W4: panel-shown should re-read the clipboard, the terms, the packs and the Settings', async () => {
    await mountWindow({ clipboard: 'ཡེ་ཤེས།' })
    readText.mockResolvedValue('སངས་རྒྱས་')
    invoke.mockClear()
    Storage.set('themePreference', 'dark')
    Storage.set('fontSize', 125)
    listeners['panel-shown']()
    await settle()
    expect(find('ql-field').find('input').element.value).toBe('སངས་རྒྱས་')
    expect(invoke).toHaveBeenCalledWith('pack_get_all_terms')
    expect(invoke).toHaveBeenCalledWith('get_installed_packs')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.style.fontSize).toBe('125%')
  })

  it('W5: regaining focus should re-read the clipboard only when it changed', async () => {
    await mountWindow({ clipboard: 'ཡེ་ཤེས།' })
    const onFocus = onFocusChanged.mock.calls[0][0]
    await find('ql-field').find('input').setValue('ཀ་')
    await settle()
    onFocus({ payload: true })
    await settle()
    expect(find('ql-field').find('input').element.value).toBe('ཀ་')

    readText.mockResolvedValue('སངས་རྒྱས་')
    onFocus({ payload: true })
    await settle()
    expect(find('ql-field').find('input').element.value).toBe('སངས་རྒྱས་')
  })

  it('removes its document listeners when unmounted', async () => {
    await mountWindow()
    wrapper.unmount()
    wrapper = undefined
    invoke.mockClear()
    await press('Escape')
    expect(invoke).not.toHaveBeenCalled()
  })
})
