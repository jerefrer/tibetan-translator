/**
 * App.vue: the start-up overlay, the app-level toast, the first-launch screen
 * over an inert shell, the theme at start-up, and the update message, all
 * without Vuetify.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'

const env = vi.hoisted(() => ({ modularPacks: false, onboarding: false }))
const mocks = vi.hoisted(() => ({ db: null, update: null, releaseDb: null }))

vi.mock('../src/config/platform', () => ({
  isTauri: () => env.modularPacks,
  isMobile: () => false,
  isMacOS: () => false,
  supportsModularPacks: () => env.modularPacks,
}))

vi.mock('../src/services/sql-database', () => {
  mocks.db = {
    allTerms: [],
    init: vi.fn(() => new Promise((resolve) => { mocks.releaseDb = resolve })),
    setAllTermsVariable: vi.fn(async () => {}),
  }
  return { default: mocks.db }
})

vi.mock('../src/services/pack-manager', () => ({
  default: {
    init: vi.fn(async () => {}),
    shouldShowOnboarding: vi.fn(() => env.onboarding),
  },
}))

vi.mock('../src/services/global-lookup', () => ({
  default: { isSupported: () => false, initialize: vi.fn(), cleanup: vi.fn() },
}))

vi.mock('../src/services/update-service', async () => {
  const { reactive } = await import('vue')
  mocks.update = {
    state: reactive({ updateReady: false }),
    checkAndDownload: vi.fn(),
  }
  return { default: mocks.update }
})

vi.mock('../src/services/audio-player-service', () => ({
  default: { initialize: vi.fn() },
}))

import App from '../src/components/App.vue'
import Storage from '../src/services/storage'

const Page = defineComponent({ render: () => h('div', { class: 'stub-page' }, 'page') })
const OnboardingStub = defineComponent({
  name: 'OnboardingScreen',
  emits: ['complete'],
  render() {
    return h('div', { class: 'onboarding-stub' }, [
      h('button', { class: 'finish', onClick: () => this.$emit('complete') }, 'Finish'),
    ])
  },
})

let wrapper
let snackbar

async function mountApp() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', redirect: '/define' },
      { path: '/define', component: Page },
      { path: '/search', component: Page },
    ],
  })
  router.push('/define')
  await router.isReady()
  snackbar = reactive({
    show: false,
    content: '',
    open(text) { this.content = text; this.show = true },
    close() { this.show = false },
  })
  wrapper = mount(App, {
    attachTo: document.body,
    global: {
      plugins: [router],
      provide: { snackbar },
      stubs: {
        OnboardingScreen: OnboardingStub,
        AppNav: true,
        SelectedTibetanEntriesPopup: true,
        DefinePageHelpDialogWithButton: true,
        SearchPageHelpDialogWithButton: true,
        SplitPageHelpDialogWithButton: true,
        CustomPackConflictModal: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

async function finishLoading() {
  mocks.releaseDb()
  await flushPromises()
}

beforeEach(() => {
  env.modularPacks = false
  env.onboarding = false
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('start-up overlay', () => {
  it('shows the logo and a spinner until the database is ready, then the shell', async () => {
    await mountApp()
    const overlay = wrapper.find('[data-testid="app-loading"]')
    expect(overlay.exists()).toBe(true)
    expect(overlay.find('img').attributes('src')).toBe('/img/logo.png')
    expect(overlay.find('[data-testid="ui-spinner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-shell"]').exists()).toBe(false)

    await finishLoading()
    await new Promise((r) => setTimeout(r, 300)) // leave transition
    expect(wrapper.find('[data-testid="app-loading"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-shell"]').exists()).toBe(true)
    expect(wrapper.find('.stub-page').exists()).toBe(true)
  })
})

describe('theme at start-up', () => {
  it('applies a stored dark preference to <html>', async () => {
    Storage.set('themePreference', 'dark')
    await mountApp()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('follows the system for the "system" preference', async () => {
    Storage.set('themePreference', 'system')
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    await mountApp()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('defaults to light', async () => {
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    await mountApp()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('follows an OS theme change without Settings having been opened', async () => {
    Storage.set('themePreference', 'system')
    const media = { matches: false, listeners: [], addEventListener: vi.fn((type, fn) => media.listeners.push(fn)), removeEventListener: vi.fn() }
    window.matchMedia = vi.fn(() => media)
    await mountApp()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    media.matches = true
    media.listeners.forEach((fn) => fn())
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('ignores an OS theme change when a theme is chosen', async () => {
    Storage.set('themePreference', 'light')
    const media = { matches: false, listeners: [], addEventListener: vi.fn((type, fn) => media.listeners.push(fn)), removeEventListener: vi.fn() }
    window.matchMedia = vi.fn(() => media)
    await mountApp()

    media.matches = true
    media.listeners.forEach((fn) => fn())
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('applies the stored text size', async () => {
    Storage.set('fontSize', 115)
    await mountApp()
    expect(document.documentElement.style.fontSize).toBe('115%')
  })
})

describe('app-level toast', () => {
  it('shows the snackbar content as HTML and closes on Close', async () => {
    await mountApp()
    await finishLoading()
    snackbar.open('Hello <a href="https://example.com">link</a>')
    await flushPromises()
    const toast = document.querySelector('[data-testid="ui-toast"]')
    expect(toast).not.toBeNull()
    expect(toast.querySelector('a').getAttribute('href')).toBe('https://example.com')
    expect(toast.textContent).toContain('Hello')

    document.querySelector('[data-testid="ui-toast-close"]').click()
    await flushPromises()
    expect(snackbar.show).toBe(false)
  })

  it('announces a downloaded update', async () => {
    await mountApp()
    await finishLoading()
    const onReady = mocks.update.checkAndDownload.mock.calls.at(-1)[0]
    onReady('2.0.0')
    await flushPromises()
    expect(snackbar.show).toBe(true)
    expect(snackbar.content).toBe('Update to v2.0.0 ready! Will install on restart.')
  })

  it('opens an abbreviation from a definition', async () => {
    await mountApp()
    await finishLoading()
    const definition = document.createElement('div')
    definition.className = 'definition'
    definition.innerHTML = '<abbr data-title="Padmakara">PK</abbr>'
    document.body.appendChild(definition)
    definition.querySelector('abbr').click()
    await flushPromises()
    expect(snackbar.show).toBe(true)
    expect(snackbar.content).toContain('Padmakara')
  })
})

describe('first-launch screen', () => {
  beforeEach(() => {
    env.modularPacks = true
    env.onboarding = true
  })

  it('makes the shell inert while it is shown, and refreshes the terms when done', async () => {
    await mountApp()
    await finishLoading()
    expect(wrapper.find('.onboarding-stub').exists()).toBe(true)
    const shell = wrapper.find('[data-testid="app-shell"]')
    expect(shell.attributes('inert')).toBeDefined()

    await wrapper.find('.finish').trigger('click')
    await flushPromises()
    expect(wrapper.find('.onboarding-stub').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-shell"]').attributes('inert')).toBeUndefined()
    expect(mocks.db.setAllTermsVariable).toHaveBeenCalled()
  })

  it('keeps the toast above it', async () => {
    await mountApp()
    await finishLoading()
    snackbar.open('Update to v2.0.0 ready! Will install on restart.')
    await flushPromises()
    const viewport = document.querySelector('.ui-toast__viewport')
    expect(viewport).not.toBeNull()
    // The first-launch screen sits at z-index 9999 (OnboardingScreen.vue).
    const css = await import('../src/ui/UiToast.vue?raw').then((m) => m.default)
    const z = Number(css.match(/\.ui-toast__viewport\s*\{[^}]*z-index:\s*(\d+)/)[1])
    expect(z).toBeGreaterThan(9999)
  })

  it('is not shown, and the shell is not inert, when onboarding is done', async () => {
    env.onboarding = false
    await mountApp()
    await finishLoading()
    expect(wrapper.find('.onboarding-stub').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-shell"]').attributes('inert')).toBeUndefined()
  })
})

describe('no Vuetify', () => {
  it('renders no Vuetify component', async () => {
    await mountApp()
    await finishLoading()
    expect(wrapper.html()).not.toMatch(/<v-|class="v-/)
    expect(document.body.innerHTML).not.toMatch(/class="v-/)
  })
})
