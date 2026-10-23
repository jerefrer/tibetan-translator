/**
 * Settings screen (ConfigurePage) and its cards.
 *
 * Services are mocked; `env` switches between the browser build and the app
 * (Tauri), and between desktop and phone widths.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'

const env = vi.hoisted(() => ({ tauri: false, mobile: false }))

const mocks = vi.hoisted(() => ({
  globalLookup: null,
  update: null,
  packs: null,
  db: null,
  scans: null,
}))

vi.mock('../src/config/platform', () => ({
  isTauri: () => env.tauri,
  isMobile: () => false,
  supportsModularPacks: () => env.tauri,
  isMacOS: () => false,
}))

vi.mock('../src/services/resize-service', () => ({
  default: {
    isMobile: () => env.mobile,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}))

vi.mock('../src/services/global-lookup', () => {
  mocks.globalLookup = {
    isSupported: vi.fn(() => env.tauri),
    isMacOS: vi.fn(() => false),
    isEnabled: vi.fn(() => true),
    getHotkey: vi.fn(() => 'CommandOrControl+Shift+C'),
    formatHotkeyForDisplay: vi.fn((hotkey) => `display(${hotkey})`),
    keyEventToHotkeyString: vi.fn(() => 'CommandOrControl+Alt+K'),
    updateHotkey: vi.fn(async () => ({ success: true })),
    toggle: vi.fn(async () => ({ success: true })),
    checkAccessibilityPermission: vi.fn(async () => true),
    requestAccessibilityPermission: vi.fn(async () => {}),
  }
  return { default: mocks.globalLookup }
})

vi.mock('../src/services/update-service', async () => {
  const { reactive } = await import('vue')
  mocks.update = {
    state: reactive({ updateReady: false, version: null, notes: null, downloading: false, downloadProgress: 0 }),
    getVersion: vi.fn(async () => '1.12.0'),
    checkOnly: vi.fn(async () => null),
    checkAndDownload: vi.fn(async () => null),
    installAndRelaunch: vi.fn(async () => {}),
  }
  return { default: mocks.update }
})

vi.mock('../src/services/pack-manager', async () => {
  const { reactive } = await import('vue')
  const state = reactive({
    installedPacks: ['core'],
    downloadingPacks: {},
    updatingPacks: {},
    availableUpdates: {},
    customPacks: [],
    initialized: true,
  })
  mocks.packs = {
    state,
    get installedPacks() { return state.installedPacks },
    get downloadingPacks() { return state.downloadingPacks },
    get updatingPacks() { return state.updatingPacks },
    get availableUpdates() { return state.availableUpdates },
    get customPacks() { return state.customPacks },
    get isInitialized() { return state.initialized },
    get hasUpdates() { return Object.keys(state.availableUpdates).length > 0 },
    init: vi.fn(async () => {}),
    downloadPack: vi.fn(async () => {}),
    waitForDownload: vi.fn(async () => {}),
    removePack: vi.fn(async () => {}),
    checkForUpdates: vi.fn(async () => {}),
    updatePack: vi.fn(async () => {}),
    waitForUpdate: vi.fn(async () => {}),
  }
  return { default: mocks.packs, PackManager: mocks.packs }
})

vi.mock('../src/services/sql-database', () => {
  mocks.db = { reloadPack: vi.fn(async () => {}), unloadPack: vi.fn() }
  return { default: mocks.db }
})

vi.mock('../src/services/scan-service', () => {
  mocks.scans = {
    getScannedDictionaries: vi.fn(() => [
      { scanId: 'das', label: 'Chandra Das (scanned dictionary)', pageCount: 10 },
    ]),
    isScanDownloaded: vi.fn(async () => false),
    downloadScan: vi.fn(async () => {}),
    deleteScan: vi.fn(async () => {}),
    isAppMode: vi.fn(async () => env.tauri),
  }
  return mocks.scans
})

import Storage from '../src/services/storage'
import ConfigurePage from '../src/components/ConfigurePage.vue'
import AppearanceCard from '../src/components/settings/AppearanceCard.vue'
import GlobalLookupCard, { DEFAULT_HOTKEY } from '../src/components/settings/GlobalLookupCard.vue'
import AboutCard from '../src/components/settings/AboutCard.vue'
import PackManagerCard from '../src/components/settings/PackManagerCard.vue'
import ScannedDictionariesCard, { estimatedScanSize } from '../src/components/settings/ScannedDictionariesCard.vue'
import DictionaryPreferencesCard, { languageLabel } from '../src/components/settings/DictionaryPreferencesCard.vue'
import { packSummary, plural } from '../src/components/settings/pack-summary'

const Stub = { template: '<div />' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings', component: Stub },
      { path: '/dictionaries', component: Stub },
      { path: '/glossary', component: Stub },
    ],
  })
}

let wrapper
let snackbar
let router

async function mountWith(component, { props, path = '/settings' } = {}) {
  router = makeRouter()
  await router.push(path)
  await router.isReady()
  wrapper = mount(component, {
    props,
    attachTo: document.body,
    global: { plugins: [router], provide: { snackbar } },
  })
  await flushPromises()
  return wrapper
}

const byTestId = (testid) => wrapper.find(`[data-testid="${testid}"]`)
const inBody = (testid) => document.body.querySelector(`[data-testid="${testid}"]`)

function seedDictionaries() {
  Storage.set('dictionaries', [
    { id: 1, name: 'Hopkins2015', position: 2, enabled: true },
    { id: 2, name: 'RangjungYeshe', position: 1, enabled: true },
    { id: 3, name: 'Berzin-Def', position: 3, enabled: false },
  ])
}

beforeEach(() => {
  env.tauri = false
  env.mobile = false
  localStorage.clear()
  snackbar = { open: vi.fn() }
  vi.clearAllMocks()
  Object.assign(mocks.update.state, { updateReady: false, version: null, notes: null, downloading: false, downloadProgress: 0 })
  Object.assign(mocks.packs.state, {
    installedPacks: ['core'],
    downloadingPacks: {},
    updatingPacks: {},
    availableUpdates: {},
    customPacks: [],
    initialized: true,
  })
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('pack summary', () => {
  it('counts the bundled pack as installed and its dictionaries', () => {
    const summary = packSummary([])
    expect(summary.installed).toBe(1)
    expect(summary.total).toBe(3)
    expect(summary.dictionaries).toBeGreaterThan(0)
  })

  it('adds the dictionaries of each installed optional pack', () => {
    expect(packSummary(['tibetan-monolingual']).dictionaries).toBeGreaterThan(packSummary([]).dictionaries)
    expect(packSummary(['tibetan-monolingual']).installed).toBe(2)
  })

  it('pluralises', () => {
    expect(plural(1, 'entry', 'entries')).toBe('1 entry')
    expect(plural(3, 'entry', 'entries')).toBe('3 entries')
  })
})

describe('ConfigurePage', () => {
  it('shows the Settings cards and no dictionary catalog', async () => {
    seedDictionaries()
    await mountWith(ConfigurePage)
    expect(byTestId('appearance-card').exists()).toBe(true)
    expect(byTestId('dictionary-preferences').exists()).toBe(true)
    expect(byTestId('scanned-card').exists()).toBe(true)
    expect(wrapper.find('.dictionary-catalog').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('v-card')
  })

  it('leaves out the app-only cards in a browser', async () => {
    await mountWith(ConfigurePage)
    expect(byTestId('global-lookup-card').exists()).toBe(false)
    expect(byTestId('about-card').exists()).toBe(false)
    expect(byTestId('pack-manager-card').exists()).toBe(false)
  })

  it('shows the app-only cards in the app', async () => {
    env.tauri = true
    await mountWith(ConfigurePage)
    expect(byTestId('global-lookup-card').exists()).toBe(true)
    expect(byTestId('about-card').exists()).toBe(true)
    expect(byTestId('pack-manager-card').exists()).toBe(true)
    // Managing your own dictionaries lives on the Glossary page
    expect(wrapper.findComponent({ name: 'CustomPackSection' }).exists()).toBe(false)
  })

  it('forwards the old catalog links to Dictionaries', async () => {
    await mountWith(ConfigurePage, { path: '/settings?status=available' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/dictionaries')
    expect(router.currentRoute.value.query).toEqual({ status: 'available' })
  })

  describe('on a phone', () => {
    beforeEach(() => {
      env.mobile = true
    })

    it('opens My glossary and Dictionaries from the first rows', async () => {
      await mountWith(ConfigurePage)
      const rows = wrapper.findAll('.settings-row')
      expect(rows[0].text()).toContain('My glossary')
      expect(rows[1].text()).toContain('Dictionaries')

      await byTestId('settings-row-glossary').find('button').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/glossary')

      await router.push('/settings')
      await byTestId('settings-row-dictionaries').find('button').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/dictionaries')
    })

    it('summarises glossary entries and installed packs', async () => {
      env.tauri = true
      mocks.packs.state.customPacks = [
        { id: 'custom-mine', manifest: { name: 'Mine', dictionaries: [{ name: 'A', entriesCount: 2 }, { name: 'B', entriesCount: 1 }] } },
      ]
      await mountWith(ConfigurePage)
      expect(byTestId('settings-row-glossary').text()).toContain('3 entries')
      expect(byTestId('settings-row-dictionaries').text()).toMatch(/\d+ installed · 1 of 3 packs/)
    })

    it('opens Dictionary preferences as a sub-screen and comes back', async () => {
      seedDictionaries()
      await mountWith(ConfigurePage)
      expect(byTestId('dictionary-preferences').exists()).toBe(false)

      await byTestId('settings-row-preferences').find('button').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.view).toBe('preferences')
      expect(byTestId('dictionary-preferences').exists()).toBe(true)
      expect(byTestId('appearance-card').exists()).toBe(false)

      await byTestId('settings-back').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.fullPath).toBe('/settings')
      expect(byTestId('appearance-card').exists()).toBe(true)
    })

    it('lists What’s new and the update check as rows in the app', async () => {
      env.tauri = true
      await mountWith(ConfigurePage)
      expect(byTestId('about-whats-new-row').text()).toContain('Tibetan Translator 1.12.0')
      expect(byTestId('about-check-row').exists()).toBe(true)
      expect(byTestId('about-card').exists()).toBe(false)
    })
  })
})

describe('AppearanceCard', () => {
  it('saves and applies the chosen theme', async () => {
    await mountWith(AppearanceCard)
    await byTestId('theme-dark').trigger('click')
    expect(Storage.get('themePreference')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(byTestId('theme-dark').attributes('aria-pressed')).toBe('true')
  })

  it('follows the system preference', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    await mountWith(AppearanceCard)
    await byTestId('theme-system').trigger('click')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('switches back to light', async () => {
    await mountWith(AppearanceCard)
    await byTestId('theme-dark').trigger('click')
    await byTestId('theme-light').trigger('click')
    expect(Storage.get('themePreference')).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('offers a reset only when the text size is not the default', async () => {
    Storage.set('fontSize', 115)
    await mountWith(AppearanceCard)
    expect(byTestId('font-size-value').text()).toBe('115%')
    expect(document.documentElement.style.fontSize).toBe('115%')

    await byTestId('font-size-reset').trigger('click')
    expect(Storage.get('fontSize')).toBe(100)
    expect(document.documentElement.style.fontSize).toBe('100%')
    expect(byTestId('font-size-reset').exists()).toBe(false)
  })
})

describe('GlobalLookupCard', () => {
  beforeEach(() => {
    env.tauri = true
  })

  it('renders nothing where global lookup is unsupported', async () => {
    env.tauri = false
    await mountWith(GlobalLookupCard)
    expect(byTestId('global-lookup-card').exists()).toBe(false)
  })

  it('shows the stored hotkey', async () => {
    await mountWith(GlobalLookupCard)
    expect(byTestId('hotkey-field').find('input').element.value).toBe('display(CommandOrControl+Shift+C)')
  })

  it('records a new hotkey from the next key combination', async () => {
    await mountWith(GlobalLookupCard)
    await byTestId('hotkey-change').trigger('click')
    const input = byTestId('hotkey-field').find('input')
    expect(input.element.value).toBe('Press any key combination...')
    expect(byTestId('hotkey-cancel').exists()).toBe(true)

    await input.trigger('keydown', { key: 'k', altKey: true, metaKey: true })
    await flushPromises()
    expect(mocks.globalLookup.updateHotkey).toHaveBeenCalledWith('CommandOrControl+Alt+K')
    expect(input.element.value).toBe('display(CommandOrControl+Alt+K)')
    expect(snackbar.open).toHaveBeenCalledWith('Hotkey updated successfully')
  })

  it('ignores keys while not recording', async () => {
    await mountWith(GlobalLookupCard)
    await byTestId('hotkey-field').find('input').trigger('keydown', { key: 'k' })
    expect(mocks.globalLookup.updateHotkey).not.toHaveBeenCalled()
  })

  it('stops recording on Cancel', async () => {
    await mountWith(GlobalLookupCard)
    await byTestId('hotkey-change').trigger('click')
    await byTestId('hotkey-cancel').trigger('click')
    expect(byTestId('hotkey-change').exists()).toBe(true)
  })

  it('resets the hotkey to the default', async () => {
    await mountWith(GlobalLookupCard)
    await byTestId('hotkey-reset').trigger('click')
    expect(mocks.globalLookup.updateHotkey).toHaveBeenCalledWith(DEFAULT_HOTKEY)
  })

  it('turns global lookup off with the switch', async () => {
    await mountWith(GlobalLookupCard)
    await byTestId('global-lookup-switch').find('button').trigger('click')
    await flushPromises()
    expect(mocks.globalLookup.toggle).toHaveBeenCalledWith(false)
    expect(wrapper.find('.global-lookup-card__hotkey').classes()).toContain('is-disabled')
  })

  it('asks for the macOS accessibility permission when it is missing', async () => {
    mocks.globalLookup.isMacOS.mockReturnValueOnce(true)
    mocks.globalLookup.checkAccessibilityPermission.mockResolvedValueOnce(false)
    await mountWith(GlobalLookupCard)
    expect(byTestId('accessibility-warning').exists()).toBe(true)
    await byTestId('grant-permission').trigger('click')
    await flushPromises()
    expect(mocks.globalLookup.requestAccessibilityPermission).toHaveBeenCalled()
    expect(snackbar.open).toHaveBeenCalled()
  })
})

describe('AboutCard', () => {
  beforeEach(() => {
    env.tauri = true
  })

  it('renders nothing in a browser', async () => {
    env.tauri = false
    await mountWith(AboutCard)
    expect(byTestId('about-card').exists()).toBe(false)
  })

  it('shows the version and this version’s notes under What’s new', async () => {
    await mountWith(AboutCard)
    expect(byTestId('about-card').text()).toContain('Tibetan Translator 1.12.0')
    await byTestId('about-whats-new').trigger('click')
    await nextTick()
    expect(inBody('ui-dialog').textContent).toContain('What’s new in v1.12.0')
    expect(inBody('release-notes')).not.toBeNull()
    expect(inBody('notes-close')).not.toBeNull()
  })

  it('says when the app is up to date', async () => {
    await mountWith(AboutCard)
    await byTestId('about-check').trigger('click')
    await flushPromises()
    expect(mocks.update.checkOnly).toHaveBeenCalled()
    expect(snackbar.open).toHaveBeenCalledWith("You're running the latest version!")
  })

  it('downloads an available update', async () => {
    mocks.update.checkOnly.mockResolvedValueOnce({ version: '1.13.0' })
    await mountWith(AboutCard)
    await byTestId('about-check').trigger('click')
    await flushPromises()
    expect(snackbar.open).toHaveBeenCalledWith('Update to v1.13.0 available! Downloading...')
    expect(mocks.update.checkAndDownload).toHaveBeenCalled()
  })

  it('reports a failed check', async () => {
    mocks.update.checkOnly.mockRejectedValueOnce(new Error('offline'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await mountWith(AboutCard)
    await byTestId('about-check').trigger('click')
    await flushPromises()
    expect(snackbar.open).toHaveBeenCalledWith('Failed to check for updates')
    error.mockRestore()
  })

  it('shows download progress while an update downloads', async () => {
    Object.assign(mocks.update.state, { downloading: true, downloadProgress: 42 })
    await mountWith(AboutCard)
    expect(byTestId('about-downloading').text()).toContain('42%')
    expect(byTestId('about-downloading').attributes('disabled')).toBeDefined()
  })

  it('offers a restart with the downloaded update’s notes', async () => {
    Object.assign(mocks.update.state, { updateReady: true, version: '1.13.0', notes: '### Fixed\n- A thing' })
    await mountWith(AboutCard)
    expect(byTestId('about-card').text()).toContain('Version 1.12.0 → v1.13.0 ready')
    await byTestId('about-restart').trigger('click')
    await nextTick()
    expect(inBody('ui-dialog').textContent).toContain('What’s new in v1.13.0')
    expect(inBody('release-notes').innerHTML).toContain('<li>A thing</li>')

    inBody('restart-now').click()
    await flushPromises()
    expect(mocks.update.installAndRelaunch).toHaveBeenCalled()
  })

  it('says so when the downloaded update has no notes', async () => {
    Object.assign(mocks.update.state, { updateReady: true, version: '1.13.0', notes: null })
    await mountWith(AboutCard)
    await byTestId('about-restart').trigger('click')
    await nextTick()
    expect(inBody('release-notes-empty')).not.toBeNull()
  })
})

describe('PackManagerCard', () => {
  beforeEach(() => {
    env.tauri = true
  })

  it('renders nothing without modular packs', async () => {
    env.tauri = false
    await mountWith(PackManagerCard)
    expect(byTestId('pack-manager-card').exists()).toBe(false)
  })

  it('summarises installed packs and lists each one', async () => {
    await mountWith(PackManagerCard)
    expect(byTestId('pack-manager-card').text()).toMatch(/1 of 3 installed · \d+ dictionaries on this device/)
    expect(byTestId('pack-core').text()).toContain('Installed')
    expect(byTestId('pack-tibetan-monolingual').find('[data-testid="pack-install"]').exists()).toBe(true)
    // The bundled pack cannot be removed
    expect(byTestId('pack-core').find('[data-testid="pack-remove"]').exists()).toBe(false)
  })

  it('initialises the pack manager when needed', async () => {
    mocks.packs.state.initialized = false
    await mountWith(PackManagerCard)
    expect(mocks.packs.init).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Loading pack information...')
  })

  it('installs a pack and reloads it', async () => {
    await mountWith(PackManagerCard)
    await byTestId('pack-tibetan-monolingual').find('[data-testid="pack-install"]').trigger('click')
    await flushPromises()
    expect(mocks.packs.downloadPack).toHaveBeenCalledWith('tibetan-monolingual')
    expect(mocks.db.reloadPack).toHaveBeenCalledWith('tibetan-monolingual')
  })

  it('shows progress while a pack downloads', async () => {
    mocks.packs.state.downloadingPacks = { 'tibetan-monolingual': { percentage: 41.6 } }
    await mountWith(PackManagerCard)
    expect(byTestId('pack-tibetan-monolingual').text()).toContain('Downloading 42%')
    expect(byTestId('pack-tibetan-monolingual').find('[data-testid="ui-progress"]').exists()).toBe(true)
  })

  it('removes an installed pack after confirmation', async () => {
    mocks.packs.state.installedPacks = ['core', 'sanskrit-academic']
    await mountWith(PackManagerCard)
    await byTestId('pack-sanskrit-academic').find('[data-testid="pack-remove"]').trigger('click')
    await nextTick()
    expect(inBody('ui-dialog').textContent).toContain('Remove pack?')
    inBody('remove-confirm').click()
    await flushPromises()
    expect(mocks.db.unloadPack).toHaveBeenCalledWith('sanskrit-academic')
    expect(mocks.packs.removePack).toHaveBeenCalledWith('sanskrit-academic')
  })

  it('checks for and applies pack updates', async () => {
    await mountWith(PackManagerCard)
    await byTestId('packs-check-updates').trigger('click')
    await flushPromises()
    expect(mocks.packs.checkForUpdates).toHaveBeenCalled()

    mocks.packs.state.availableUpdates = { core: { sizeMB: 12 } }
    await nextTick()
    expect(byTestId('pack-core').find('[data-testid="pack-update"]').text()).toContain('12 MB')
    await byTestId('packs-update-all').trigger('click')
    await flushPromises()
    expect(mocks.packs.updatePack).toHaveBeenCalledWith('core')
    expect(mocks.db.reloadPack).toHaveBeenCalledWith('core')
  })

  it('lists the dictionaries of a pack on demand', async () => {
    await mountWith(PackManagerCard)
    expect(byTestId('pack-dictionaries').exists()).toBe(false)
    await byTestId('pack-core').find('[data-testid="pack-toggle"]').trigger('click')
    expect(byTestId('pack-dictionaries').text()).toContain('Hopkins')
  })

  it('opens Dictionaries', async () => {
    await mountWith(PackManagerCard)
    await byTestId('manage-in-dictionaries').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/dictionaries')
  })
})

describe('ScannedDictionariesCard', () => {
  it('estimates the download size', () => {
    expect(estimatedScanSize(2)).toBe('400 KB')
    expect(estimatedScanSize(695)).toBe('136 MB')
  })

  it('marks scans as online only in a browser', async () => {
    await mountWith(ScannedDictionariesCard)
    expect(byTestId('scan-das').text()).toContain('Chandra Das')
    expect(byTestId('scan-das').text()).not.toContain('scanned dictionary')
    expect(byTestId('scan-online-only').exists()).toBe(true)
    expect(byTestId('scan-web-note').exists()).toBe(true)
  })

  it('downloads a scan in the app', async () => {
    env.tauri = true
    await mountWith(ScannedDictionariesCard)
    await byTestId('scan-download').trigger('click')
    await flushPromises()
    expect(mocks.scans.downloadScan).toHaveBeenCalledWith('das')
    expect(snackbar.open).toHaveBeenCalledWith('Download complete!')
    expect(byTestId('scan-delete').exists()).toBe(true)
  })

  it('deletes a downloaded scan', async () => {
    env.tauri = true
    mocks.scans.isScanDownloaded.mockResolvedValueOnce(true)
    await mountWith(ScannedDictionariesCard)
    await byTestId('scan-delete').trigger('click')
    await flushPromises()
    expect(mocks.scans.deleteScan).toHaveBeenCalledWith('das')
    expect(snackbar.open).toHaveBeenCalledWith('Deleted successfully')
  })

  it('reports a failed download', async () => {
    env.tauri = true
    mocks.scans.downloadScan.mockRejectedValueOnce(new Error('disk full'))
    await mountWith(ScannedDictionariesCard)
    await byTestId('scan-download').trigger('click')
    await flushPromises()
    expect(snackbar.open).toHaveBeenCalledWith('Download failed: disk full')
    expect(byTestId('scan-download').exists()).toBe(true)
  })
})

describe('DictionaryPreferencesCard', () => {
  it('reads language pairs', () => {
    expect(languageLabel({ language: ['tib', '<->', 'en'] })).toBe('Tib ↔ En')
    expect(languageLabel({})).toBe('')
  })

  it('lists dictionaries in their saved order', async () => {
    seedDictionaries()
    await mountWith(DictionaryPreferencesCard)
    const rows = wrapper.findAll('[data-testid="dictionary-pref"]')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('1.')
    expect(rows[0].text()).toContain('Rangjung')
    expect(rows[2].classes()).toContain('is-disabled')
  })

  it('names each switch after its dictionary', async () => {
    seedDictionaries()
    await mountWith(DictionaryPreferencesCard)
    const control = wrapper.findAll('[data-testid="dictionary-pref-switch"]')[0].find('button')
    expect(control.attributes('aria-label')).toContain('Rangjung')
  })

  it('saves a dictionary switched off, with positions', async () => {
    seedDictionaries()
    await mountWith(DictionaryPreferencesCard)
    await wrapper.findAll('[data-testid="dictionary-pref-switch"]')[0].find('button').trigger('click')
    await flushPromises()
    const saved = Storage.get('dictionaries')
    expect(saved.map((d) => d.name)).toEqual(['RangjungYeshe', 'Hopkins2015', 'Berzin-Def'])
    expect(saved.map((d) => d.position)).toEqual([1, 2, 3])
    expect(saved[0].enabled).toBe(false)
  })

  it('shows what is known about a dictionary', async () => {
    seedDictionaries()
    await mountWith(DictionaryPreferencesCard)
    await wrapper.findAll('[data-testid="dictionary-pref-info"]')[0].trigger('click')
    expect(snackbar.open).toHaveBeenCalledTimes(1)
    expect(snackbar.open.mock.calls[0][0]).toContain('<strong>')
  })

  it('reloads after the dictionary list changes', async () => {
    seedDictionaries()
    await mountWith(DictionaryPreferencesCard)
    Storage.set('dictionaries', [{ id: 9, name: 'DanMartin', position: 1, enabled: true }])
    // tests/setup.js replaces window listeners; this fires the registered ones
    window._triggerEvent('dictionaries-updated')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="dictionary-pref"]')).toHaveLength(1)
  })

  describe('from the keyboard', () => {
    const handles = () => wrapper.findAll('[data-testid="dictionary-pref-handle"]')
    const names = () => Storage.get('dictionaries').map((d) => d.name)
    const announcement = () => wrapper.find('[data-testid="dictionary-pref-announcement"]')

    it('makes each drag handle focusable, with a name saying what and where it is', async () => {
      seedDictionaries()
      await mountWith(DictionaryPreferencesCard)
      const handle = handles()[0]
      expect(handle.attributes('tabindex')).toBe('0')
      expect(handle.attributes('role')).toBe('button')
      expect(handle.attributes('aria-label')).toBe('Move Rangjung Yeshe, position 1 of 3')
      expect(handle.attributes('aria-keyshortcuts')).toBe('Alt+ArrowUp Alt+ArrowDown')
      const hint = wrapper.find('#' + handle.attributes('aria-describedby'))
      expect(hint.text()).toBe('Alt+Up or Alt+Down moves it up or down.')
      expect(announcement().attributes('aria-live')).toBe('polite')
    })

    it('moves a dictionary down with Alt+Down, saves the order, announces it and keeps the focus on its handle', async () => {
      seedDictionaries()
      await mountWith(DictionaryPreferencesCard)
      handles()[0].element.focus()

      await handles()[0].trigger('keydown', { key: 'ArrowDown', altKey: true })
      await flushPromises()

      expect(names()).toEqual(['Hopkins2015', 'RangjungYeshe', 'Berzin-Def'])
      expect(Storage.get('dictionaries').map((d) => d.position)).toEqual([1, 2, 3])
      expect(announcement().text()).toBe('Rangjung Yeshe moved to position 2 of 3')
      expect(document.activeElement).toBe(handles()[1].element)
      expect(handles()[1].attributes('aria-label')).toBe('Move Rangjung Yeshe, position 2 of 3')
    })

    it('moves a dictionary up with Alt+Up', async () => {
      seedDictionaries()
      await mountWith(DictionaryPreferencesCard)

      await handles()[2].trigger('keydown', { key: 'ArrowUp', altKey: true })
      await flushPromises()

      expect(names()).toEqual(['RangjungYeshe', 'Berzin-Def', 'Hopkins2015'])
      expect(document.activeElement).toBe(handles()[1].element)
    })

    it('leaves the order as it is past either end, and for Up / Down without Alt', async () => {
      seedDictionaries()
      await mountWith(DictionaryPreferencesCard)

      await handles()[0].trigger('keydown', { key: 'ArrowUp', altKey: true })
      await handles()[2].trigger('keydown', { key: 'ArrowDown', altKey: true })
      await handles()[1].trigger('keydown', { key: 'ArrowDown' })
      await flushPromises()

      expect(names()).toEqual(['Hopkins2015', 'RangjungYeshe', 'Berzin-Def'])
      expect(announcement().text()).toBe('')
    })
  })

  it('drops its own header in the phone sub-screen', async () => {
    seedDictionaries()
    await mountWith(DictionaryPreferencesCard, { props: { bare: true } })
    expect(wrapper.text()).not.toContain('Drag to reorder')
  })
})
