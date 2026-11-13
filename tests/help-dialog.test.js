/**
 * HelpDialog: one help for the whole app, opened on the topic of the screen,
 * searchable, with examples that can be tried. Ported from the Define, Search
 * and Reader help dialogs it replaces.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

const env = vi.hoisted(() => ({ app: false, phone: false, mac: true }))

vi.mock('../src/config/platform', async (importOriginal) => ({
  ...(await importOriginal()),
  isTauri: () => env.app,
  supportsModularPacks: () => env.app,
  isMacOS: () => env.mac,
}))

vi.mock('../src/services/resize-service', () => ({
  default: { isMobile: () => env.phone, subscribe: vi.fn(), unsubscribe: vi.fn() },
}))

vi.mock('../src/services/global-lookup', () => ({
  default: {
    isSupported: () => env.app && !env.phone,
    getHotkey: () => 'CommandOrControl+Shift+D',
    formatHotkeyForDisplay: () => '⌘⇧D',
  },
}))

import HelpDialog from '../src/components/help/HelpDialog.vue'
import { closeHelp, helpState, openHelp } from '../src/services/help'

let wrapper
let router

async function mountHelp() {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/define/:term?', component: { template: '<div />' } },
      { path: '/search', component: { template: '<div />' } },
      { path: '/settings', component: { template: '<div />' } },
      { path: '/reader', component: { template: '<div />' } },
    ],
  })
  router.push('/define')
  await router.isReady()
  wrapper = mount(HelpDialog, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

async function open(topic = null) {
  openHelp(topic)
  await flushPromises()
}

// The dialog is teleported to <body>
const $ = (selector) => document.body.querySelector(selector)
const $$ = (selector) => [...document.body.querySelectorAll(selector)]
const titles = () => $$('[data-testid="help-topic-toggle"]').map((button) => button.textContent.trim())
const shownTopic = () => $('[data-testid^="help-topic-"]:not([data-testid="help-topic-toggle"])')?.dataset.testid.replace('help-topic-', '')
const search = async (text) => {
  const input = $('[data-testid="help-search"] input')
  input.value = text
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}
const click = async (element) => {
  element.click()
  await flushPromises()
}
const tryButton = (label) => $$('[data-testid="help-dialog"] .help__content [data-testid="help-try"]').find((button) => button.textContent.trim() === label)

beforeEach(() => {
  env.app = false
  env.phone = false
  env.mac = true
  closeHelp()
})

afterEach(() => {
  wrapper?.unmount()
  closeHelp()
  document.body.innerHTML = ''
})

describe('HelpDialog', () => {
  it('should stay hidden until opened', async () => {
    await mountHelp()
    expect($('[data-testid="help-dialog"]')).toBeNull()
    await open()
    expect($('.ui-dialog__title').textContent).toBe('Help')
  })

  it('should list its topics, Quick lookup only in the desktop app', async () => {
    await mountHelp()
    await open()
    expect(titles()).toEqual([
      'Typing Tibetan and Wylie', 'Looking up a word', 'Searching the definitions', 'Reading a text',
      'Dictionaries', 'My glossary', 'Saved and recent terms', 'Keyboard shortcuts',
    ])
    wrapper.unmount()
    closeHelp()
    document.body.innerHTML = ''

    env.app = true
    await mountHelp()
    await open()
    expect(titles()).toContain('Quick lookup')
  })

  it('should show the topic asked for, the first one otherwise, and another when chosen', async () => {
    await mountHelp()
    await open('reader')
    expect(shownTopic()).toBe('reader')
    await click($$('[data-testid="help-topic-toggle"]').find((button) => button.textContent.includes('Dictionaries')))
    expect(shownTopic()).toBe('dictionaries')
    closeHelp()
    await open()
    expect(shownTopic()).toBe('typing')
  })

  it('should find the topics that mention what is searched, even in other words, and say when none does', async () => {
    await mountHelp()
    await open()
    await search('pronounced')
    expect(titles()).toEqual(['Searching the definitions'])
    expect(shownTopic()).toBe('search')
    await search('phonetic')
    expect(titles()).toEqual(['Searching the definitions'])
    await search('csv')
    expect(titles()).toContain('My glossary')
    await search('zzzz')
    expect($('[data-testid="help-no-match"]')).not.toBeNull()
  })

  it('should explain the search syntax, each example ready to try, closing the help to show it', async () => {
    await mountHelp()
    await open('search')
    const labels = $$('.help__content [data-testid="help-try"]').map((button) => button.textContent.trim())
    expect(labels).toEqual(expect.arrayContaining(['wisdom', 'seven & limbs', "(dga' ba)", '[trenpa]', '{jom ten te}']))
    await click(tryButton('{jom ten te}'))
    expect(router.currentRoute.value.path).toBe('/search')
    expect(router.currentRoute.value.query).toEqual({ q: '{jom ten te}' })
    expect(helpState.open).toBe(false)
  })

  it('should try a Tibetan term in Define', async () => {
    await mountHelp()
    await open('typing')
    await click(tryButton('sangs rgyas'))
    expect(router.currentRoute.value.path).toBe('/define/' + encodeURIComponent('སངས་རྒྱས་'))
  })

  it('should show the Quick lookup shortcut actually set', async () => {
    env.app = true
    await mountHelp()
    await open('quick')
    expect($('[data-testid="help-topic-quick"]').textContent).toContain('⌘⇧D')
  })

  it('should list the shortcuts with the keys of this system', async () => {
    env.mac = false
    await mountHelp()
    await open('shortcuts')
    const text = $('[data-testid="help-topic-shortcuts"]').textContent
    expect(text).toContain('Define a Tibetan term')
    expect(text).toContain('Ctrl')
    expect(text).not.toContain('⌘')
  })

  it('should close with its button', async () => {
    await mountHelp()
    await open()
    await click($('[data-testid="help-close"]'))
    expect(helpState.open).toBe(false)
  })

  describe('on a phone', () => {
    beforeEach(() => {
      env.phone = true
    })

    it('should list the topics, without keyboard shortcuts, and open one with a way back', async () => {
      await mountHelp()
      await open()
      expect(titles()).not.toContain('Keyboard shortcuts')
      expect(shownTopic()).toBeUndefined()
      await click($$('[data-testid="help-topic-toggle"]')[3])
      expect(shownTopic()).toBe('reader')
      expect(titles()).toEqual([])
      await click($('[data-testid="help-back"]'))
      expect(titles()).toHaveLength(7)
    })

    it('should open straight on the topic asked for', async () => {
      await mountHelp()
      await open('lookup')
      expect(shownTopic()).toBe('lookup')
    })
  })
})

describe('HelpButton', () => {
  it('should open the help on the topic of the screen', async () => {
    const { default: HelpButton } = await import('../src/components/help/HelpButton.vue')
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/reader', component: { template: '<div />' } }] })
    router.push('/reader')
    await router.isReady()
    const button = mount(HelpButton, { global: { plugins: [router] } })
    await button.trigger('click')
    expect(helpState).toMatchObject({ open: true, topic: 'reader' })
    button.unmount()
  })
})

describe('HelpDialog — focus', () => {
  it('should take the focus on desktop, so that Escape closes it rather than a field behind it', async () => {
    await mountHelp()
    const field = document.createElement('input')
    document.body.appendChild(field)
    field.focus()
    await open('search')
    await vi.waitFor(() => expect(document.activeElement).toBe($('[data-testid="help-search"] input')))
  })
})
