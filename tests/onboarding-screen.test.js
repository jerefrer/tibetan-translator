/**
 * First-launch screen (OnboardingScreen).
 *
 * PackManager, the database and the global lookup service are mocked; the pack
 * definitions, the dictionary labels and the highlights helper are the real
 * ones. `env` switches between desktop and phone (mobile platform) and macOS.
 * Each test names the behaviour it covers from docs/redesign/reports/onboarding.md.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const env = vi.hoisted(() => ({ mobile: false, mac: false }))
const mocks = vi.hoisted(() => ({ packs: null, db: null, hotkey: 'CommandOrControl+Shift+C' }))

vi.mock('../src/config/platform', () => ({
  isTauri: () => true,
  isMobile: () => env.mobile,
  isMacOS: () => env.mac,
  supportsModularPacks: () => true,
}))

vi.mock('../src/services/pack-manager', async () => {
  const { reactive } = await import('vue')
  const state = reactive({ installedPacks: ['core'], downloadingPacks: {} })
  mocks.packs = {
    state,
    get installedPacks() { return state.installedPacks },
    get downloadingPacks() { return state.downloadingPacks },
    isInstalled: vi.fn((id) => state.installedPacks.includes(id)),
    downloadPack: vi.fn(async () => {}),
    waitForDownload: vi.fn(async (id) => { state.installedPacks.push(id) }),
    completeOnboarding: vi.fn(),
  }
  return { default: mocks.packs, PackManager: mocks.packs }
})

vi.mock('../src/services/sql-database', () => {
  mocks.db = { reloadPack: vi.fn(async () => {}) }
  return { default: mocks.db }
})

vi.mock('../src/services/global-lookup', async () => {
  const actual = await vi.importActual('../src/services/global-lookup')
  return {
    default: {
      getHotkey: () => mocks.hotkey,
      formatHotkeyForDisplay: actual.formatHotkeyForDisplay,
    },
  }
})

import OnboardingScreen, { parsePackSize } from '../src/components/OnboardingScreen.vue'
import { PACK_DEFINITIONS } from '../src/config/pack-definitions'

let wrapper

async function mountScreen() {
  wrapper = mount(OnboardingScreen, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

const byTestId = (testid) => wrapper.find(`[data-testid="${testid}"]`)
const pack = (id) => byTestId(`onboarding-pack-${id}`)
const text = (testid) => byTestId(testid).text().replace(/\s+/g, ' ').trim()

async function click(testid) {
  await byTestId(testid).trigger('click')
  await flushPromises()
}

async function tick(id) {
  await pack(id).trigger('click')
  await flushPromises()
}

// A download that stays in flight until `finish()` or `fail()` is called
function pendingDownload(id) {
  let finish
  let fail
  mocks.packs.waitForDownload.mockImplementationOnce(() => new Promise((resolve, reject) => {
    finish = () => {
      delete mocks.packs.state.downloadingPacks[id]
      mocks.packs.state.installedPacks.push(id)
      resolve()
    }
    fail = (error) => reject(error)
  }))
  return { finish: () => finish(), fail: (error) => fail(error) }
}

beforeEach(() => {
  env.mobile = false
  env.mac = false
  mocks.hotkey = 'CommandOrControl+Shift+C'
  vi.clearAllMocks()
  mocks.packs.state.installedPacks = ['core']
  mocks.packs.state.downloadingPacks = {}
  window.matchMedia = vi.fn(() => ({ matches: false }))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('parsePackSize', () => {
  it('reads the download and installed sizes from estimatedSize', () => {
    expect(parsePackSize('65 MB download, 285 MB installed')).toEqual({ download: 65, installed: 285 })
    expect(parsePackSize('146 MB installed')).toEqual({ download: null, installed: 146 })
    expect(parsePackSize(undefined)).toEqual({ download: null, installed: null })
  })
})

describe('pack choice', () => {
  it('P1 shows the logo and the welcome title, as a modal dialog', async () => {
    await mountScreen()
    const root = byTestId('onboarding')
    expect(root.attributes('role')).toBe('dialog')
    expect(root.attributes('aria-modal')).toBe('true')
    expect(root.attributes('aria-labelledby')).toBe('onboarding-title')
    expect(wrapper.find('.onboarding__logo').text()).toBe('ཀ')
    expect(wrapper.find('h1').text()).toBe('Welcome to Tibetan Translator')
  })

  it('P2/P3 says how many dictionaries are included, naming some, and that more can come later', async () => {
    await mountScreen()
    expect(text('onboarding-welcome')).toBe(
      `${PACK_DEFINITIONS.core.dictionaries.length} dictionaries are already on your device and work offline, ` +
      'among them Rangjung Yeshe, Hopkins 2015 and Berzin. You can add more now or later in Settings.',
    )
    expect(PACK_DEFINITIONS.core.dictionaries.length).toBe(35)
  })

  it('P4 lists every optional pack in order with its name, description, highlights and sizes', async () => {
    await mountScreen()
    const cards = wrapper.findAll('.onboarding-pack')
    expect(cards.map((card) => card.find('.onboarding-pack__name').text())).toEqual(['Tibetan Monolingual', 'Sanskrit & Academic'])

    const monolingual = pack('tibetan-monolingual')
    expect(monolingual.text()).toContain('Tibetan-to-Tibetan dictionaries for advanced users.')
    expect(monolingual.find('[data-testid="onboarding-pack-highlights"]').text()).toBe(
      'Includes bod rgya tshig mdzod chen mo, Brda dkrol gser gyi me long, sGom sde tshig mdzod chen mo, Dag yig gsar bsgrigs, and 17 more.',
    )
    expect(monolingual.find('[data-testid="onboarding-pack-size"]').text()).toBe('65 MB')
    expect(monolingual.find('[data-testid="onboarding-pack-installed"]').text()).toBe('285 MB on this device once installed')

    const sanskrit = pack('sanskrit-academic')
    expect(sanskrit.find('[data-testid="onboarding-pack-highlights"]').text()).toBe(
      'Includes Mahāvyutpatti, Lokesh Chandra, Negi, Yogacharabhumi Glossary, and 5 more.',
    )
    expect(sanskrit.find('[data-testid="onboarding-pack-size"]').text()).toBe('26 MB')
    expect(sanskrit.find('[data-testid="onboarding-pack-installed"]').text()).toBe('109 MB on this device once installed')
  })

  it('P5 a click anywhere on a card toggles it, and so does its checkbox (once)', async () => {
    await mountScreen()
    const checkbox = () => pack('tibetan-monolingual').find('[data-testid="ui-checkbox-control"]')
    expect(checkbox().attributes('data-state')).toBe('unchecked')

    await pack('tibetan-monolingual').find('.onboarding-pack__description').trigger('click')
    expect(checkbox().attributes('data-state')).toBe('checked')
    expect(pack('tibetan-monolingual').classes()).toContain('is-selected')

    await checkbox().trigger('click')
    await flushPromises()
    expect(checkbox().attributes('data-state')).toBe('unchecked')
    expect(pack('tibetan-monolingual').classes()).not.toContain('is-selected')

    await pack('tibetan-monolingual').find('.ui-checkbox__label').trigger('click')
    await flushPromises()
    expect(checkbox().attributes('data-state')).toBe('checked')
  })

  it('P6/P9 starts with nothing ticked and a single Continue button (desktop)', async () => {
    await mountScreen()
    expect(wrapper.findAll('[data-state="checked"]')).toHaveLength(0)
    expect(text('onboarding-continue')).toBe('Continue')
    expect(byTestId('onboarding-download').exists()).toBe(false)
    expect(byTestId('onboarding-skip').exists()).toBe(false)
  })

  it('P8 the single button reads Get started on a phone', async () => {
    env.mobile = true
    await mountScreen()
    expect(text('onboarding-continue')).toBe('Get started')
  })

  it('P8 with packs ticked, offers Download with their total size, and Skip for now', async () => {
    await mountScreen()
    await tick('tibetan-monolingual')
    expect(text('onboarding-download')).toBe('Download 65 MB')
    expect(text('onboarding-skip')).toBe('Skip for now')
    await tick('sanskrit-academic')
    expect(text('onboarding-download')).toBe('Download 91 MB')
    await tick('tibetan-monolingual')
    expect(text('onboarding-download')).toBe('Download 26 MB')
  })

  it('P6/S1 phone: Get started without packs completes onboarding and downloads nothing', async () => {
    env.mobile = true
    await mountScreen()
    await click('onboarding-continue')
    expect(mocks.packs.downloadPack).not.toHaveBeenCalled()
    expect(mocks.packs.completeOnboarding).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('P6 phone: Skip for now completes onboarding without downloading the ticked packs', async () => {
    env.mobile = true
    await mountScreen()
    await tick('sanskrit-academic')
    await click('onboarding-skip')
    expect(mocks.packs.downloadPack).not.toHaveBeenCalled()
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('P6/Q1 desktop: Continue and Skip for now go to Quick lookup without downloading', async () => {
    await mountScreen()
    await click('onboarding-continue')
    expect(byTestId('onboarding-lookup').exists()).toBe(true)
    expect(wrapper.emitted('complete')).toBeUndefined()

    wrapper.unmount()
    await mountScreen()
    await tick('sanskrit-academic')
    await click('onboarding-skip')
    expect(byTestId('onboarding-lookup').exists()).toBe(true)
    expect(mocks.packs.downloadPack).not.toHaveBeenCalled()
    expect(byTestId('onboarding-lookup-download').exists()).toBe(false)
  })
})

describe('Quick lookup (desktop)', () => {
  it('Q1 is never shown on a phone', async () => {
    env.mobile = true
    await mountScreen()
    await tick('sanskrit-academic')
    await click('onboarding-download')
    expect(byTestId('onboarding-lookup').exists()).toBe(false)
    expect(byTestId('onboarding-download-step').exists()).toBe(true)
  })

  it('Q2/Q4 explains the three steps with Ctrl keys off a Mac', async () => {
    await mountScreen()
    await click('onboarding-continue')
    expect(wrapper.find('h1').text()).toBe('Quick lookup')
    const steps = wrapper.findAll('.onboarding-lookup__step-title').map((step) => step.text())
    expect(steps).toEqual(['Copy Tibetan text', 'Press the lookup hotkey', 'See the definition'])
    expect(wrapper.findAll('.onboarding-lookup__step')[0].findAll('kbd').map((key) => key.text())).toEqual(['Ctrl', 'C'])
    expect(byTestId('onboarding-hotkey').findAll('kbd').map((key) => key.text())).toEqual(['Ctrl', 'Shift', 'C'])
    expect(text('onboarding-hotkey')).toContain('You can change it in Settings.')
  })

  it('Q4/Q5 shows the stored hotkey, with Mac symbols on a Mac', async () => {
    env.mac = true
    mocks.hotkey = 'CommandOrControl+Alt+K'
    await mountScreen()
    await click('onboarding-continue')
    expect(wrapper.findAll('.onboarding-lookup__step')[0].findAll('kbd').map((key) => key.text())).toEqual(['⌘', 'C'])
    expect(byTestId('onboarding-hotkey').findAll('kbd').map((key) => key.text())).toEqual(['⌘', '⌥', 'K'])
  })

  it('Q3 keeps the demo video, playing muted in a loop', async () => {
    await mountScreen()
    await click('onboarding-continue')
    const video = wrapper.find('video')
    expect(video.attributes('src')).toBe('/img/global-lookup-demo.mp4')
    expect(video.element.loop).toBe(true)
    expect(video.element.muted).toBe(true)
    expect(video.element.autoplay).toBe(true)
    expect(video.attributes('controls')).toBeUndefined()
  })

  it('Q3 does not autoplay the video when reduced motion is asked for, and gives it controls', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true }))
    await mountScreen()
    await click('onboarding-continue')
    const video = wrapper.find('video')
    expect(video.element.autoplay).toBe(false)
    expect(video.attributes('controls')).toBeDefined()
  })

  it('Q6 Done without packs completes onboarding', async () => {
    await mountScreen()
    await click('onboarding-continue')
    await click('onboarding-lookup-done')
    expect(mocks.packs.completeOnboarding).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('P8/Q6 Download starts at once and its progress shows under the steps', async () => {
    await mountScreen()
    await tick('tibetan-monolingual')
    const download = pendingDownload('tibetan-monolingual')
    await click('onboarding-download')

    expect(byTestId('onboarding-lookup').exists()).toBe(true)
    expect(mocks.packs.downloadPack).toHaveBeenCalledWith('tibetan-monolingual')
    expect(text('onboarding-lookup-download')).toContain('Starting the download…')

    mocks.packs.state.downloadingPacks['tibetan-monolingual'] = { packId: 'tibetan-monolingual', percentage: 42.4, status: 'downloading' }
    await flushPromises()
    expect(text('onboarding-lookup-download')).toContain('Downloading Tibetan Monolingual… 42%')
    expect(byTestId('onboarding-lookup-download').find('[data-testid="ui-progress"]').exists()).toBe(true)

    mocks.packs.state.downloadingPacks['tibetan-monolingual'].status = 'extracting'
    await flushPromises()
    expect(text('onboarding-lookup-download')).toContain('Unpacking Tibetan Monolingual…')

    download.finish()
    await flushPromises()
    expect(text('onboarding-lookup-download')).toBe('Packs downloaded and installed.')
  })

  it('Q6 Done while the download runs moves to the download step', async () => {
    await mountScreen()
    await tick('tibetan-monolingual')
    const download = pendingDownload('tibetan-monolingual')
    await click('onboarding-download')
    await click('onboarding-lookup-done')
    expect(byTestId('onboarding-download-step').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('Downloading dictionaries')
    expect(wrapper.emitted('complete')).toBeUndefined()

    download.finish()
    await flushPromises()
    expect(wrapper.find('h1').text()).toBe('You’re all set')
  })

  it('Q6 Done once the download has finished completes onboarding', async () => {
    await mountScreen()
    await tick('tibetan-monolingual')
    await click('onboarding-download')
    await click('onboarding-lookup-done')
    expect(wrapper.emitted('complete')).toHaveLength(1)
    expect(mocks.packs.completeOnboarding).toHaveBeenCalledTimes(1)
  })

  it('D4 a failure during Quick lookup is announced there, and Done leads to the retry', async () => {
    await mountScreen()
    await tick('tibetan-monolingual')
    mocks.packs.downloadPack.mockRejectedValueOnce('Download failed: HTTP 503')
    await click('onboarding-download')
    expect(text('onboarding-lookup-download')).toBe('The download failed. You can retry after this step.')
    await click('onboarding-lookup-done')
    expect(wrapper.find('h1').text()).toBe('Download failed')
    expect(byTestId('onboarding-retry').exists()).toBe(true)
  })
})

describe('download step', () => {
  async function startPhoneDownload(...ids) {
    env.mobile = true
    await mountScreen()
    for (const id of ids) await tick(id)
    await click('onboarding-download')
  }

  it('D1 downloads the ticked packs one after the other, in pack order, and loads each into the database', async () => {
    const calls = []
    mocks.packs.downloadPack.mockImplementation(async (id) => calls.push(`download ${id}`))
    mocks.packs.waitForDownload.mockImplementation(async (id) => {
      calls.push(`wait ${id}`)
      mocks.packs.state.installedPacks.push(id)
    })
    mocks.db.reloadPack.mockImplementation(async (id) => calls.push(`reload ${id}`))
    await startPhoneDownload('sanskrit-academic', 'tibetan-monolingual')
    expect(calls).toEqual([
      'download tibetan-monolingual', 'wait tibetan-monolingual', 'reload tibetan-monolingual',
      'download sanskrit-academic', 'wait sanskrit-academic', 'reload sanskrit-academic',
    ])
  })

  it('D1 skips a pack that is already installed', async () => {
    mocks.packs.state.installedPacks = ['core', 'tibetan-monolingual']
    await startPhoneDownload('tibetan-monolingual', 'sanskrit-academic')
    expect(mocks.packs.downloadPack).toHaveBeenCalledTimes(1)
    expect(mocks.packs.downloadPack).toHaveBeenCalledWith('sanskrit-academic')
  })

  it('D2 shows one row per pack: waiting, percentage, unpacking, installed', async () => {
    const first = pendingDownload('tibetan-monolingual')
    await startPhoneDownload('tibetan-monolingual', 'sanskrit-academic')
    expect(wrapper.find('h1').text()).toBe('Downloading dictionaries')
    expect(wrapper.text()).toContain('This may take a few minutes depending on your connection.')
    const status = (id) => byTestId(`onboarding-download-${id}`).find('[data-testid="onboarding-download-status"]').text()

    mocks.packs.state.downloadingPacks['tibetan-monolingual'] = { packId: 'tibetan-monolingual', percentage: 12.6, status: 'downloading' }
    await flushPromises()
    expect(status('tibetan-monolingual')).toBe('13%')
    expect(status('sanskrit-academic')).toBe('Waiting')
    expect(byTestId('onboarding-download-tibetan-monolingual').find('[data-testid="ui-progress"]').exists()).toBe(true)

    mocks.packs.state.downloadingPacks['tibetan-monolingual'].status = 'extracting'
    await flushPromises()
    expect(status('tibetan-monolingual')).toBe('Unpacking…')

    first.finish()
    await flushPromises()
    expect(status('tibetan-monolingual')).toBe('Installed')
    expect(status('sanskrit-academic')).toBe('Installed')
  })

  it('D2 offers no button while downloading', async () => {
    pendingDownload('sanskrit-academic')
    await startPhoneDownload('sanskrit-academic')
    expect(wrapper.find('.onboarding__actions').exists()).toBe(false)
  })

  it('D3 when done, says so and Get started completes onboarding', async () => {
    await startPhoneDownload('sanskrit-academic')
    expect(wrapper.find('h1').text()).toBe('You’re all set')
    expect(wrapper.text()).toContain('The new dictionaries are installed and ready to use.')
    expect(mocks.packs.completeOnboarding).not.toHaveBeenCalled()
    await click('onboarding-finish')
    expect(mocks.packs.completeOnboarding).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('D4 shows the error Tauri rejects with (a plain string), and marks the failed pack', async () => {
    mocks.packs.downloadPack.mockRejectedValueOnce('Download failed: HTTP 503')
    await startPhoneDownload('sanskrit-academic')
    expect(wrapper.find('h1').text()).toBe('Download failed')
    const alert = byTestId('onboarding-error')
    expect(alert.text()).toBe('Download failed: HTTP 503')
    expect(alert.attributes('role')).toBe('alert')
    expect(wrapper.text()).toContain('Check your internet connection and try again.')
    expect(byTestId('onboarding-download-sanskrit-academic').classes()).toContain('is-failed')
    expect(byTestId('onboarding-download-sanskrit-academic').text()).toContain('Failed')
  })

  it('D4 shows an Error’s message, or a fallback when there is none', async () => {
    mocks.packs.downloadPack.mockRejectedValueOnce(new Error('Disk full'))
    await startPhoneDownload('sanskrit-academic')
    expect(byTestId('onboarding-error').text()).toBe('Disk full')

    wrapper.unmount()
    mocks.packs.downloadPack.mockRejectedValueOnce({})
    await startPhoneDownload('sanskrit-academic')
    expect(byTestId('onboarding-error').text()).toBe('Download failed. Please check your internet connection.')
  })

  it('D4 Retry download starts again, skipping packs already installed, and can succeed', async () => {
    mocks.packs.downloadPack
      .mockImplementationOnce(async () => {})
      .mockRejectedValueOnce('Network unreachable')
    await startPhoneDownload('tibetan-monolingual', 'sanskrit-academic')
    expect(byTestId('onboarding-error').text()).toBe('Network unreachable')
    expect(byTestId('onboarding-download-tibetan-monolingual').text()).toContain('Installed')

    await click('onboarding-retry')
    expect(mocks.packs.downloadPack).toHaveBeenLastCalledWith('sanskrit-academic')
    expect(mocks.packs.downloadPack).toHaveBeenCalledTimes(3)
    expect(wrapper.find('h1').text()).toBe('You’re all set')
    expect(byTestId('onboarding-error').exists()).toBe(false)
  })

  it('D5 Skip for now after a failure completes onboarding without the pack', async () => {
    mocks.packs.downloadPack.mockRejectedValueOnce('offline')
    await startPhoneDownload('sanskrit-academic')
    await click('onboarding-error-skip')
    expect(mocks.packs.completeOnboarding).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('D6 a failing database reload does not fail the download', async () => {
    mocks.db.reloadPack.mockRejectedValueOnce(new Error('not ready'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await startPhoneDownload('sanskrit-academic')
    expect(wrapper.find('h1').text()).toBe('You’re all set')
    warn.mockRestore()
  })

  it('S2 nothing is stored before the last button', async () => {
    pendingDownload('sanskrit-academic')
    await startPhoneDownload('sanskrit-academic')
    expect(mocks.packs.completeOnboarding).not.toHaveBeenCalled()
    expect(wrapper.emitted('complete')).toBeUndefined()
  })
})

describe('keyboard and focus', () => {
  it('L3 focuses the title when the screen opens and on each step', async () => {
    await mountScreen()
    expect(document.activeElement).toBe(wrapper.find('h1').element)
    await click('onboarding-continue')
    expect(document.activeElement).toBe(wrapper.find('h1').element)
    expect(wrapper.find('h1').text()).toBe('Quick lookup')
  })

  it('L3 the checkboxes are named by their pack', async () => {
    await mountScreen()
    const control = pack('tibetan-monolingual').find('[data-testid="ui-checkbox-control"]')
    const label = pack('tibetan-monolingual').find('label')
    expect(label.attributes('for')).toBe(control.attributes('id'))
    expect(label.text()).toBe('Tibetan Monolingual')
  })

  it('L3 Tab from the last control comes back to the first, Shift+Tab from the first goes to the last', async () => {
    await mountScreen()
    const controls = wrapper.findAll('button')
    const first = controls[0].element
    const last = controls[controls.length - 1].element

    last.focus()
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    last.dispatchEvent(forward)
    expect(forward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)

    const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    first.dispatchEvent(backward)
    expect(backward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)

    wrapper.find('h1').element.focus()
    const fromTitle = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    wrapper.find('h1').element.dispatchEvent(fromTitle)
    expect(document.activeElement).toBe(last)
  })

  it('L3 Tab in the middle is left to the browser', async () => {
    await mountScreen()
    const first = wrapper.findAll('button')[0].element
    first.focus()
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    first.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('no Vuetify', () => {
  it('renders no Vuetify component on any step', async () => {
    env.mobile = true
    await mountScreen()
    expect(wrapper.html()).not.toMatch(/v-(btn|card|checkbox|alert|icon|img|chip|progress)/)
    await tick('sanskrit-academic')
    mocks.packs.downloadPack.mockRejectedValueOnce('offline')
    await click('onboarding-download')
    expect(wrapper.html()).not.toMatch(/class="[^"]*\bv-/)
  })
})
