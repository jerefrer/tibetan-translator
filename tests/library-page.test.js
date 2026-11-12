/**
 * Library: the glossary and dictionaries rows, the device section, Settings,
 * and the help dialogs.
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

vi.mock('../src/services/audio-service', () => {
  mocks.audio = {
    getAudioDictionaries: vi.fn(async () => [
      { audioId: 'hotl1', label: 'Heart of Tibetan Language 1', count: 1742, bytes: 66060288 },
    ]),
    isAudioDownloaded: vi.fn(async () => false),
    downloadAudio: vi.fn(async () => {}),
    deleteAudio: vi.fn(async () => {}),
  }
  return { ...mocks.audio, default: mocks.audio }
})

import Storage from '../src/services/storage'
import LibraryPage from '../src/components/library/LibraryPage.vue'
import DictionariesPage from '../src/components/DictionariesPage.vue'
import { packSummary } from '../src/components/settings/pack-summary'

const Stub = { template: '<div />' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/library', component: LibraryPage },
      { path: '/library/glossary/:packId?/:dictionaryId?', component: Stub },
      { path: '/library/dictionaries', component: DictionariesPage },
    ],
  })
}

let wrapper
let router
const scrolled = []

async function mountLibrary(path = '/library') {
  router = makeRouter()
  await router.push(path)
  await router.isReady()
  wrapper = mount({ template: '<router-view />' }, {
    attachTo: document.body,
    global: { plugins: [router], provide: { snackbar: { open: vi.fn() } } },
  })
  await flushPromises()
  return wrapper
}

const byTestId = (testid) => wrapper.find(`[data-testid="${testid}"]`)
const inBody = (testid) => document.body.querySelector(`[data-testid="${testid}"]`)

beforeEach(() => {
  env.tauri = false
  env.mobile = false
  localStorage.clear()
  vi.clearAllMocks()
  scrolled.length = 0
  Element.prototype.scrollIntoView = function scrollIntoView() {
    scrolled.push(this.id)
  }
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

describe('LibraryPage', () => {
  it('should list the collections with their status', async () => {
    Storage.set('dictionaries', [
      { id: 1, name: 'Hopkins2015', position: 1, enabled: true },
      { id: 2, name: 'RangjungYeshe', position: 2, enabled: true },
    ])
    await mountLibrary()

    expect(wrapper.find('h1').text()).toBe('Library')
    const collections = byTestId('library-collections')
    expect(collections.find('[data-testid="library-row-glossary"]').text()).toContain('My glossary')
    expect(collections.find('[data-testid="library-row-glossary"]').text()).toContain('Your own definitions')
    expect(collections.find('[data-testid="library-row-dictionaries"]').text()).toContain('2 on this device')

    await collections.find('[data-testid="library-row-glossary"] button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/library/glossary')

    await router.push('/library')
    await flushPromises()
    await byTestId('library-row-dictionaries').find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/library/dictionaries')
  })

  it('should count the dictionaries of the installed packs in the app', async () => {
    env.tauri = true
    await mountLibrary()

    const { dictionaries } = packSummary(['core'])
    expect(byTestId('library-row-dictionaries').text()).toContain(`${dictionaries} on this device`)
  })

  it('should show the device section only where packs are supported', async () => {
    await mountLibrary()
    expect(byTestId('library-device').exists()).toBe(false)
    wrapper.unmount()

    env.tauri = true
    await mountLibrary()
    const device = byTestId('library-device')
    expect(device.exists()).toBe(true)
    expect(device.find('[data-testid="pack-manager-card"]').exists()).toBe(true)
    expect(device.text()).toContain('Add to this device')
  })

  it('should show Quick lookup settings only in the desktop app', async () => {
    await mountLibrary()
    expect(byTestId('global-lookup-card').exists()).toBe(false)
    wrapper.unmount()

    env.tauri = true
    await mountLibrary()
    expect(byTestId('library-settings').find('[data-testid="global-lookup-card"]').exists()).toBe(true)
  })

  it('should land on Settings from the sidebar link', async () => {
    await mountLibrary('/library#settings')

    expect(byTestId('library-settings').attributes('id')).toBe('settings')
    expect(byTestId('library-settings').find('[data-testid="appearance-card"]').exists()).toBe(true)
    expect(scrolled).toContain('settings')
  })

  it('should land on Settings when Library is already alive and the link is followed again', async () => {
    await mountLibrary('/library')
    expect(scrolled).not.toContain('settings')

    await router.push('/library#settings')
    await flushPromises()

    expect(scrolled).toContain('settings')
  })

  it('should scroll back to Settings when its link is followed again from further down', async () => {
    await mountLibrary('/library#settings')
    scrolled.length = 0

    window._triggerEvent('route-refollowed')
    await flushPromises()

    expect(scrolled).toEqual(['settings'])
  })

  it('should leave the scroll alone on a refollow while Library is not the active route', async () => {
    await mountLibrary('/library#settings')
    await router.push('/library/glossary')
    await flushPromises()
    scrolled.length = 0

    window._triggerEvent('route-refollowed')
    await flushPromises()

    expect(scrolled).toEqual([])
  })

  it('should read a hash with quotes as an id, never as a selector', async () => {
    await mountLibrary('/library')
    scrolled.length = 0
    // Read as a selector, it would also match the Settings section (and a
    // browser throws on most quotes)
    await router.push('/library#x"],[id="settings')
    await flushPromises()

    await expect(wrapper.findComponent(LibraryPage).vm.scrollToHash()).resolves.toBeUndefined()
    expect(scrolled).toEqual([])
  })

  it('should land on dictionary order from an old preferences link', async () => {
    await mountLibrary('/library#dictionary-order')

    expect(byTestId('library-settings').find('#dictionary-order').exists()).toBe(true)
    expect(scrolled).toContain('dictionary-order')
  })

  it('should open each help dialog', async () => {
    await mountLibrary()
    const help = byTestId('library-help')
    const cases = [
      ['lookup', 'Looking up a word', 'define-help'],
      ['search', 'Searching the definitions', 'search-help'],
      ['reader', 'Reading a text', 'split-help'],
    ]
    for (const [id, title, dialog] of cases) {
      const row = help.find(`[data-testid="library-help-${id}"]`)
      expect(row.text()).toContain(title)
      expect(inBody(dialog)).toBeNull()

      await row.find('button').trigger('click')
      await flushPromises()
      expect(inBody(dialog)).not.toBeNull()
      expect(document.body.querySelector('.ui-dialog__title').textContent).toBe(title)

      document.body.querySelector(`[data-testid="${dialog}-close"]`).click()
      await flushPromises()
      expect(inBody(dialog)).toBeNull()
    }
  })

  it('should go back to Library from the glossary and the dictionaries', async () => {
    await mountLibrary('/library/dictionaries')

    const back = byTestId('dictionaries-back')
    expect(back.text()).toContain('Library')
    await back.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/library')
  })
})

// Ported from tests/settings-page.test.js (the ConfigurePage shell): the
// cards Settings showed, the About rows and the help rows
describe('LibraryPage — ported from Settings', () => {
  it('should show the Settings cards and no dictionary catalog', async () => {
    Storage.set('dictionaries', [
      { id: 1, name: 'Hopkins2015', position: 2, enabled: true },
      { id: 2, name: 'RangjungYeshe', position: 1, enabled: true },
    ])
    await mountLibrary()
    const settings = byTestId('library-settings')
    expect(settings.find('[data-testid="appearance-card"]').exists()).toBe(true)
    expect(settings.find('[data-testid="dictionary-preferences"]').exists()).toBe(true)
    expect(wrapper.find('.dictionary-catalog').exists()).toBe(false)
  })

  // Settings showed them in a browser too, marked online only: Library keeps
  // them there, under Settings, since a browser has no "this device" section
  it('should show the scanned dictionaries and audio cards under Settings in a browser', async () => {
    await mountLibrary()
    const settings = byTestId('library-settings')
    expect(byTestId('library-device').exists()).toBe(false)
    expect(settings.find('[data-testid="scanned-card"]').exists()).toBe(true)
    expect(settings.find('[data-testid="audio-card"]').exists()).toBe(true)
  })

  it('should show the scanned dictionaries and audio cards on the device in the app', async () => {
    env.tauri = true
    await mountLibrary()
    const device = byTestId('library-device')
    expect(device.find('[data-testid="scanned-card"]').exists()).toBe(true)
    expect(device.find('[data-testid="audio-card"]').exists()).toBe(true)
    expect(byTestId('library-settings').find('[data-testid="scanned-card"]').exists()).toBe(false)
    expect(byTestId('library-settings').find('[data-testid="audio-card"]').exists()).toBe(false)
  })

  it('should leave out the app-only cards in a browser', async () => {
    await mountLibrary()
    expect(byTestId('global-lookup-card').exists()).toBe(false)
    expect(byTestId('pack-manager-card').exists()).toBe(false)
    expect(byTestId('about-whats-new-row').exists()).toBe(false)
  })

  it('should list What’s new, the update check and the credits as rows in the app', async () => {
    env.tauri = true
    await mountLibrary()
    expect(byTestId('about-whats-new-row').text()).toContain('Tibetan Translator 1.12.0')
    expect(byTestId('about-check-row').exists()).toBe(true)
    expect(byTestId('about-credits-row').text()).toContain('Christian Steinert')
  })

  it('should show no help button of its own next to the help rows', async () => {
    await mountLibrary()
    expect(wrapper.find('.help-button').exists()).toBe(false)
    expect(document.body.querySelector('[aria-label^="How to use the"]')).toBeNull()
  })
})
