/**
 * The Settings page: the glossary and dictionaries rows (phone), the general
 * cards, the downloads, the dictionary preferences and the help dialogs.
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
import SettingsPage from '../src/components/settings/SettingsPage.vue'
import DictionariesPage from '../src/components/DictionariesPage.vue'
import { packSummary } from '../src/components/settings/pack-summary'

const Stub = { template: '<div />' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings', component: SettingsPage },
      { path: '/glossary/:packId?/:dictionaryId?', component: Stub },
      { path: '/dictionaries', component: DictionariesPage },
    ],
  })
}

let wrapper
let router
const scrolled = []

async function mountSettings(path = '/settings') {
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

describe('SettingsPage', () => {
  it('should leave the collections to the sidebar on desktop', async () => {
    await mountSettings()
    expect(byTestId('settings-collections').exists()).toBe(false)
  })

  it('should list the collections with their status on a phone', async () => {
    env.mobile = true
    Storage.set('dictionaries', [
      { id: 1, name: 'Hopkins2015', position: 1, enabled: true },
      { id: 2, name: 'RangjungYeshe', position: 2, enabled: true },
    ])
    await mountSettings()

    expect(wrapper.find('h1').text()).toBe('Settings')
    const collections = byTestId('settings-collections')
    expect(collections.find('[data-testid="settings-row-glossary"]').text()).toContain('My glossary')
    expect(collections.find('[data-testid="settings-row-glossary"]').text()).toContain('Your own definitions')
    expect(collections.find('[data-testid="settings-row-dictionaries"]').text()).toContain('2 on this device')

    await collections.find('[data-testid="settings-row-glossary"] button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/glossary')

    await router.push('/settings')
    await flushPromises()
    await byTestId('settings-row-dictionaries').find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/dictionaries')
  })

  it('should count the dictionaries of the installed packs in the app', async () => {
    env.tauri = true
    env.mobile = true
    await mountSettings()

    const { dictionaries } = packSummary(['core'])
    expect(byTestId('settings-row-dictionaries').text()).toContain(`${dictionaries} on this device`)
  })

  it('should show the pack manager under Downloads only where packs are supported', async () => {
    await mountSettings()
    const downloads = byTestId('settings-downloads')
    expect(downloads.find('[data-testid="pack-manager-card"]').exists()).toBe(false)
    expect(downloads.find('h2').text()).toBe('Scans and recordings')
    wrapper.unmount()

    env.tauri = true
    await mountSettings()
    const app = byTestId('settings-downloads')
    expect(app.find('[data-testid="pack-manager-card"]').exists()).toBe(true)
    expect(app.find('h2').text()).toBe('Downloads')
  })

  it('should show Quick lookup settings only in the desktop app', async () => {
    await mountSettings()
    expect(byTestId('global-lookup-card').exists()).toBe(false)
    wrapper.unmount()

    env.tauri = true
    await mountSettings()
    expect(byTestId('settings-general').find('[data-testid="global-lookup-card"]').exists()).toBe(true)
  })

  it('should land on the dictionary order from a link to its section', async () => {
    await mountSettings('/settings#dictionary-order')

    expect(byTestId('settings-dictionaries').find('#dictionary-order').exists()).toBe(true)
    expect(scrolled).toContain('dictionary-order')
  })

  it('should land on the dictionary order when Settings is already alive and the link is followed', async () => {
    await mountSettings('/settings')
    expect(scrolled).not.toContain('dictionary-order')

    await router.push('/settings#dictionary-order')
    await flushPromises()

    expect(scrolled).toContain('dictionary-order')
  })

  it('should scroll back to the section when its link is followed again from further down', async () => {
    await mountSettings('/settings#dictionary-order')
    scrolled.length = 0

    window._triggerEvent('route-refollowed')
    await flushPromises()

    expect(scrolled).toEqual(['dictionary-order'])
  })

  it('should scroll back to the top when the bare Settings link is followed again', async () => {
    await mountSettings('/settings')
    const page = byTestId('settings-page').element
    page.scrollTo = vi.fn()

    window._triggerEvent('route-refollowed')
    await flushPromises()

    expect(page.scrollTo).toHaveBeenCalledWith({ top: 0 })
  })

  it('should leave the scroll alone on a refollow while Settings is not the active route', async () => {
    await mountSettings('/settings#dictionary-order')
    await router.push('/glossary')
    await flushPromises()
    scrolled.length = 0

    window._triggerEvent('route-refollowed')
    await flushPromises()

    expect(scrolled).toEqual([])
  })

  it('should read a hash with quotes as an id, never as a selector', async () => {
    await mountSettings('/settings')
    scrolled.length = 0
    // Read as a selector, it would also match the dictionary order (and a
    // browser throws on most quotes)
    await router.push('/settings#x"],[id="dictionary-order')
    await flushPromises()

    await expect(wrapper.findComponent(SettingsPage).vm.scrollToHash()).resolves.toBeUndefined()
    expect(scrolled).toEqual([])
  })

  it('should list Appearance, then Downloads, then the dictionary order and help, top to bottom', async () => {
    env.tauri = true
    await mountSettings()
    const order = [...byTestId('settings-page').element.querySelectorAll(
      '[data-testid="appearance-card"], [data-testid="settings-downloads"], [data-testid="dictionary-preferences"], [data-testid="settings-help"]'
    )].map((el) => el.getAttribute('data-testid') || el.id)
    expect(order).toEqual(['appearance-card', 'settings-downloads', 'dictionary-preferences', 'settings-help'])
  })

  it('should put the dictionary preferences and the help in the same section', async () => {
    await mountSettings()
    const section = byTestId('settings-dictionaries')
    expect(section.find('h2').text()).toBe('Dictionaries')
    expect(section.find('#dictionary-order').exists()).toBe(true)
    expect(section.find('[data-testid="settings-help"]').text()).toContain('Help and about')
  })

  it('should open each help dialog', async () => {
    await mountSettings()
    const help = byTestId('settings-help')
    const cases = [
      ['lookup', 'Looking up a word', 'define-help'],
      ['search', 'Searching the definitions', 'search-help'],
      ['reader', 'Reading a text', 'split-help'],
    ]
    for (const [id, title, dialog] of cases) {
      const row = help.find(`[data-testid="settings-help-${id}"]`)
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

  it('should go back to Settings from the dictionaries on a phone', async () => {
    env.mobile = true
    await mountSettings('/dictionaries')

    const back = byTestId('dictionaries-back')
    expect(back.text()).toContain('Settings')
    await back.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/settings')
  })

  it('should not offer a way back to Settings on desktop, where the sidebar lists the dictionaries', async () => {
    await mountSettings('/dictionaries')
    expect(byTestId('dictionaries-back').exists()).toBe(false)
  })
})

// Ported from tests/settings-page.test.js (the ConfigurePage shell): the
// cards Settings showed, the About rows and the help rows
describe('SettingsPage — ported from the former Settings page', () => {
  it('should show the Settings cards and no dictionary catalog', async () => {
    Storage.set('dictionaries', [
      { id: 1, name: 'Hopkins2015', position: 2, enabled: true },
      { id: 2, name: 'RangjungYeshe', position: 1, enabled: true },
    ])
    await mountSettings()
    expect(byTestId('settings-general').find('[data-testid="appearance-card"]').exists()).toBe(true)
    expect(byTestId('settings-dictionaries').find('[data-testid="dictionary-preferences"]').exists()).toBe(true)
    expect(wrapper.find('.dictionary-catalog').exists()).toBe(false)
  })

  it('should show the scanned dictionaries and audio cards under Downloads in a browser and in the app', async () => {
    for (const tauri of [false, true]) {
      env.tauri = tauri
      await mountSettings()
      const downloads = byTestId('settings-downloads')
      expect(downloads.find('[data-testid="scanned-card"]').exists()).toBe(true)
      expect(downloads.find('[data-testid="audio-card"]').exists()).toBe(true)
      wrapper.unmount()
    }
  })

  it('should leave out the app-only cards in a browser', async () => {
    await mountSettings()
    expect(byTestId('global-lookup-card').exists()).toBe(false)
    expect(byTestId('pack-manager-card').exists()).toBe(false)
    expect(byTestId('about-whats-new-row').exists()).toBe(false)
  })

  it('should list What’s new, the update check and the credits as rows in the app', async () => {
    env.tauri = true
    await mountSettings()
    expect(byTestId('about-whats-new-row').text()).toContain('Tibetan Translator 1.12.0')
    expect(byTestId('about-check-row').exists()).toBe(true)
    expect(byTestId('about-credits-row').text()).toContain('Christian Steinert')
  })

  it('should show no help button of its own next to the help rows', async () => {
    await mountSettings()
    expect(wrapper.find('.help-button').exists()).toBe(false)
    expect(document.body.querySelector('[aria-label^="How to use the"]')).toBeNull()
  })
})
