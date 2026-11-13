/**
 * The Settings page: the glossary and dictionaries rows (phone), its groups
 * (General, Quick lookup, Offline content, About, Help) with the index that
 * leads to them on desktop, and the help dialogs.
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

const Stub = { template: '<div />' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings', component: SettingsPage },
      { path: '/glossary/:packId?/:dictionaryId?', component: Stub },
      { path: '/dictionaries', component: Stub },
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
const groupTitles = () => wrapper.findAll('.settings-group__title').map((title) => title.text())

beforeEach(() => {
  env.tauri = false
  env.mobile = false
  localStorage.clear()
  vi.clearAllMocks()
  scrolled.length = 0
  Element.prototype.scrollIntoView = function scrollIntoView() {
    scrolled.push(this.id)
  }
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('SettingsPage — groups', () => {
  it('should list General, Offline content and Help in a browser, nothing about dictionaries', async () => {
    await mountSettings()
    expect(wrapper.find('h1').text()).toBe('Settings')
    expect(groupTitles()).toEqual(['General', 'Offline content', 'Help'])
    expect(wrapper.find('[data-testid="dictionary-list"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dictionary-packs"]').exists()).toBe(false)
  })

  it('should add Quick lookup and About in the desktop app', async () => {
    env.tauri = true
    await mountSettings()
    expect(groupTitles()).toEqual(['General', 'Quick lookup', 'Offline content', 'About', 'Help'])
  })

  it('should keep the scanned dictionaries and the recordings together under Offline content', async () => {
    for (const tauri of [false, true]) {
      env.tauri = tauri
      await mountSettings()
      const offline = byTestId('settings-offline')
      expect(offline.find('[data-testid="scanned-card"]').exists()).toBe(true)
      expect(offline.find('[data-testid="audio-card"]').exists()).toBe(true)
      wrapper.unmount()
    }
  })

  it('should say where dictionary packs and their order went, with a link', async () => {
    await mountSettings()
    const note = byTestId('settings-offline').find('.settings-page__note')
    expect(note.text()).toContain('Dictionary packs, their order and which ones lookups use are in Dictionaries')
    await note.find('a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/dictionaries')
  })

  it('should list the version, What’s new and the credits as rows in the app', async () => {
    env.tauri = true
    await mountSettings()
    expect(byTestId('about-card').text()).toContain('Tibetan Translator 1.12.0')
    expect(byTestId('about-check').exists()).toBe(true)
    expect(byTestId('about-whats-new').text()).toContain('What’s new')
    expect(byTestId('about-credits').text()).toContain('Christian Steinert')
  })

  it('should open the help panel on the topic of each help row', async () => {
    const { helpState, closeHelp } = await import('../src/services/help')
    await mountSettings()
    const help = byTestId('settings-help')
    const cases = [
      ['typing', 'Typing Tibetan and Wylie', 'typing'],
      ['lookup', 'Looking up a word', 'lookup'],
      ['search', 'Searching the definitions', 'search'],
      ['reader', 'Reading a text', 'reader'],
      ['all', 'All help topics', null],
    ]
    for (const [id, title, topic] of cases) {
      closeHelp()
      const row = help.find(`[data-testid="settings-help-${id}"]`)
      expect(row.text()).toContain(title)
      await row.trigger('click')
      expect(helpState).toMatchObject({ open: true, topic })
    }
    closeHelp()
  })

  it('should show no help button of its own next to the help rows', async () => {
    await mountSettings()
    expect(wrapper.find('.help-button').exists()).toBe(false)
    expect(document.body.querySelector('[aria-label^="How to use the"]')).toBeNull()
  })
})

describe('SettingsPage — index (desktop)', () => {
  it('should list the groups shown, in their order', async () => {
    env.tauri = true
    await mountSettings()
    expect(byTestId('settings-index').findAll('a').map((link) => link.text())).toEqual([
      'General', 'Quick lookup', 'Offline content', 'About', 'Help',
    ])
  })

  it('should take the reader to a group and mark it as the current one', async () => {
    await mountSettings()
    const link = byTestId('settings-index').findAll('a').find((anchor) => anchor.text() === 'Help')
    await link.trigger('click')
    expect(scrolled).toEqual(['settings-help'])
    expect(link.attributes('aria-current')).toBe('true')
  })

  it('should leave the index out on a phone', async () => {
    env.mobile = true
    await mountSettings()
    expect(byTestId('settings-index').exists()).toBe(false)
  })
})

describe('SettingsPage — on a phone', () => {
  beforeEach(() => {
    env.mobile = true
  })

  it('should leave the glossary and the dictionaries to the sidebar on desktop', async () => {
    env.mobile = false
    await mountSettings()
    expect(byTestId('settings-collections').exists()).toBe(false)
  })

  it('should open with the glossary and the dictionaries, the latter with how many are on', async () => {
    Storage.set('dictionaries', [
      { id: 1, name: 'Hopkins2015', position: 1, enabled: true },
      { id: 2, name: 'RangjungYeshe', position: 2, enabled: false },
    ])
    await mountSettings()
    expect(byTestId('settings-row-glossary').text()).toContain('My glossary')
    expect(byTestId('settings-row-dictionaries').text()).toContain('1 of 2 on')

    await byTestId('settings-row-glossary').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/glossary')

    await router.push('/settings')
    await flushPromises()
    await byTestId('settings-row-dictionaries').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/dictionaries')
  })
})

describe('SettingsPage — links to a group', () => {
  it('should land on a group from a link to it', async () => {
    await mountSettings('/settings#settings-help')
    expect(scrolled).toContain('settings-help')
  })

  it('should land on a group when Settings is already alive and the link is followed', async () => {
    await mountSettings('/settings')
    expect(scrolled).not.toContain('settings-help')
    await router.push('/settings#settings-help')
    await flushPromises()
    expect(scrolled).toContain('settings-help')
  })

  it('should scroll back to the group when its link is followed again from further down', async () => {
    await mountSettings('/settings#settings-help')
    scrolled.length = 0
    window._triggerEvent('route-refollowed')
    await flushPromises()
    expect(scrolled).toEqual(['settings-help'])
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
    await mountSettings('/settings#settings-help')
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
    // Read as a selector, it would also match the help group (and a browser
    // throws on most quotes)
    await router.push('/settings#x"],[id="settings-help')
    await flushPromises()
    await expect(wrapper.findComponent(SettingsPage).vm.scrollToHash()).resolves.toBeUndefined()
    expect(scrolled).toEqual([])
  })
})
