/**
 * The Settings cards, which Settings shows (tests/settings-page-layout.test.js covers
 * the page around them).
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
  return { default: mocks.globalLookup, DEFAULT_HOTKEY: 'CommandOrControl+Shift+C' }
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
    cancelScanDownload: vi.fn(async () => {}),
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
    cancelAudioDownload: vi.fn(async () => {}),
    deleteAudio: vi.fn(async () => {}),
  }
  return { ...mocks.audio, default: mocks.audio }
})

import Storage from '../src/services/storage'
import AudioCard from '../src/components/settings/AudioCard.vue'
import AppearanceCard from '../src/components/settings/AppearanceCard.vue'
import GlobalLookupCard, { DEFAULT_HOTKEY } from '../src/components/settings/GlobalLookupCard.vue'
import AboutCard from '../src/components/settings/AboutCard.vue'
import ScannedDictionariesCard, { estimatedScanSize } from '../src/components/settings/ScannedDictionariesCard.vue'
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
const theme = (label) => wrapper.findAll('[data-testid="theme"] [role="radio"]').find((radio) => radio.text() === label)
const inBody = (testid) => document.body.querySelector(`[data-testid="${testid}"]`)

beforeEach(() => {
  env.tauri = false
  env.mobile = false
  localStorage.clear()
  snackbar = { open: vi.fn() }
  vi.clearAllMocks()
  Object.assign(mocks.update.state, { updateReady: false, version: null, notes: null, downloading: false, downloadProgress: 0 })
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

describe('AppearanceCard', () => {
  it('saves and applies the chosen theme', async () => {
    await mountWith(AppearanceCard)
    await theme('Dark').trigger('click')
    expect(Storage.get('themePreference')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(theme('Dark').attributes('aria-checked')).toBe('true')
  })

  it('follows the system preference', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    await mountWith(AppearanceCard)
    await theme('System').trigger('click')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('switches back to light', async () => {
    await mountWith(AppearanceCard)
    await theme('Dark').trigger('click')
    await theme('Light').trigger('click')
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

  it('resets the hotkey to the one the app starts with', async () => {
    await mountWith(GlobalLookupCard)
    await byTestId('hotkey-reset').trigger('click')
    expect(DEFAULT_HOTKEY).toBe('CommandOrControl+Shift+C')
    expect(mocks.globalLookup.updateHotkey).toHaveBeenCalledWith('CommandOrControl+Shift+C')
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

describe('ScannedDictionariesCard', () => {
  it('estimates the download size', () => {
    expect(estimatedScanSize(2)).toBe('400 KB')
    expect(estimatedScanSize(695)).toBe('136 MB')
  })

  it('reads scans online in a browser, folded under their summary, with no download', async () => {
    await mountWith(ScannedDictionariesCard)
    expect(byTestId('scanned-toggle').text()).toContain('read online')
    expect(byTestId('scan-das').exists()).toBe(false)

    await byTestId('scanned-toggle').trigger('click')
    expect(byTestId('scanned-toggle').attributes('aria-expanded')).toBe('true')
    expect(byTestId('scan-das').text()).toContain('Chandra Das')
    expect(byTestId('scan-das').text()).not.toContain('scanned dictionary')
    expect(byTestId('scan-das').text()).toContain('read online')
    expect(byTestId('scan-download').exists()).toBe(false)
    expect(byTestId('scan-web-note').exists()).toBe(true)
  })

  it('opens the scans in the desktop app, and counts those on this device', async () => {
    env.tauri = true
    mocks.scans.isScanDownloaded.mockResolvedValueOnce(true)
    await mountWith(ScannedDictionariesCard)
    expect(byTestId('scanned-toggle').text()).toContain('1 of 1 on this device')
    expect(byTestId('scan-das').text()).toContain('on this device')
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
    await nextTick()
    expect(mocks.scans.deleteScan).not.toHaveBeenCalled()
    expect(inBody('ui-dialog').textContent).toContain('Delete downloaded pages?')
    inBody('delete-confirm').click()
    await flushPromises()
    expect(mocks.scans.deleteScan).toHaveBeenCalledWith('das')
    expect(snackbar.open).toHaveBeenCalledWith('Deleted successfully')
  })

  it('should delete nothing when the scan deletion is cancelled', async () => {
    env.tauri = true
    mocks.scans.isScanDownloaded.mockResolvedValueOnce(true)
    await mountWith(ScannedDictionariesCard)
    await byTestId('scan-delete').trigger('click')
    await nextTick()
    inBody('delete-cancel').click()
    await flushPromises()
    expect(mocks.scans.deleteScan).not.toHaveBeenCalled()
  })

  it('should cancel a scan download, and offer it again', async () => {
    env.tauri = true
    let reject
    mocks.scans.downloadScan.mockImplementationOnce(() => new Promise((resolve, fail) => { reject = fail }))
    await mountWith(ScannedDictionariesCard)
    await byTestId('scan-download').trigger('click')
    await flushPromises()
    await byTestId('scan-cancel').trigger('click')
    expect(mocks.scans.cancelScanDownload).toHaveBeenCalledWith('das')
    // Tauri rejects the download with "cancelled"
    reject('cancelled')
    await flushPromises()
    expect(snackbar.open).toHaveBeenCalledWith('Download cancelled')
    expect(snackbar.open).not.toHaveBeenCalledWith(expect.stringContaining('failed'))
    expect(byTestId('scan-download').exists()).toBe(true)
    expect(byTestId('scan-das').text()).toContain('read online')
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

describe('AudioCard', () => {
  it('should list each dictionary with its number of recordings and download size', async () => {
    await mountWith(AudioCard)
    await byTestId('audio-toggle').trigger('click')
    const row = byTestId('audio-hotl1')
    expect(row.text()).toContain('Heart of Tibetan Language 1')
    expect(row.text()).toContain('1,742 recordings · 63 MB · played online')
  })

  it('should play recordings online in a browser, folded under their summary, with no download', async () => {
    await mountWith(AudioCard)
    expect(byTestId('audio-toggle').text()).toContain('played online')
    await byTestId('audio-toggle').trigger('click')
    expect(byTestId('audio-download').exists()).toBe(false)
  })

  it('should download a dictionary’s recordings in the app', async () => {
    env.tauri = true
    await mountWith(AudioCard)
    await byTestId('audio-download').trigger('click')
    await flushPromises()
    expect(mocks.audio.downloadAudio).toHaveBeenCalledWith('hotl1')
    expect(snackbar.open).toHaveBeenCalledWith('Download complete!')
    expect(byTestId('audio-delete').exists()).toBe(true)
  })

  it('should delete downloaded recordings', async () => {
    env.tauri = true
    mocks.audio.isAudioDownloaded.mockResolvedValueOnce(true)
    await mountWith(AudioCard)
    await byTestId('audio-delete').trigger('click')
    await nextTick()
    expect(mocks.audio.deleteAudio).not.toHaveBeenCalled()
    expect(inBody('ui-dialog').textContent).toContain('Delete downloaded recordings?')
    inBody('delete-confirm').click()
    await flushPromises()
    expect(mocks.audio.deleteAudio).toHaveBeenCalledWith('hotl1')
    expect(byTestId('audio-download').exists()).toBe(true)
  })

  it('should delete nothing when the recordings deletion is cancelled', async () => {
    env.tauri = true
    mocks.audio.isAudioDownloaded.mockResolvedValueOnce(true)
    await mountWith(AudioCard)
    await byTestId('audio-delete').trigger('click')
    await nextTick()
    inBody('delete-cancel').click()
    await flushPromises()
    expect(mocks.audio.deleteAudio).not.toHaveBeenCalled()
  })

  it('should cancel a recordings download, and offer it again', async () => {
    env.tauri = true
    let reject
    mocks.audio.downloadAudio.mockImplementationOnce(() => new Promise((resolve, fail) => { reject = fail }))
    await mountWith(AudioCard)
    await byTestId('audio-download').trigger('click')
    await flushPromises()
    await byTestId('audio-cancel').trigger('click')
    expect(mocks.audio.cancelAudioDownload).toHaveBeenCalledWith('hotl1')
    reject('cancelled')
    await flushPromises()
    expect(snackbar.open).toHaveBeenCalledWith('Download cancelled')
    expect(byTestId('audio-download').exists()).toBe(true)
  })

  it('should report a failed download and offer it again', async () => {
    env.tauri = true
    mocks.audio.downloadAudio.mockRejectedValueOnce('connection reset')
    await mountWith(AudioCard)
    await byTestId('audio-download').trigger('click')
    await flushPromises()
    expect(snackbar.open).toHaveBeenCalledWith('Download failed: connection reset')
    expect(byTestId('audio-download').exists()).toBe(true)
  })
})
