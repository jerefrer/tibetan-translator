/**
 * The help button and dialog of the Split page (H1 in
 * docs/redesign/reports/split.md).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const platform = vi.hoisted(() => ({ mac: false }))
vi.mock('../src/config/platform.js', () => ({
  isTauri: () => true,
  isMacOS: () => platform.mac,
  isMobile: () => false,
}))

import SplitPageHelpDialogWithButton from '../src/components/SplitPageHelpDialogWithButton.vue'

let wrapper
const desktopWidth = window.innerWidth
const body = (testid) => document.body.querySelector(`[data-testid="${testid}"]`)
const tabLabels = () =>
  Array.from(document.body.querySelectorAll('.ui-tabs__trigger')).map((tab) => tab.textContent.trim())

async function openHelp(path = '/segment') {
  wrapper = mount(SplitPageHelpDialogWithButton, {
    attachTo: document.body,
    global: { mocks: { $route: { path } } },
  })
  const button = wrapper.find('[data-testid="split-help-button"]')
  if (button.exists()) {
    await button.trigger('click')
    await flushPromises()
  }
  return wrapper
}

async function showNavigation() {
  wrapper.vm.tab = 'navigation'
  await flushPromises()
  return body('split-help').textContent
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  platform.mac = false
  window.innerWidth = desktopWidth
})

describe('Split help', () => {
  it('should only show its button on the Split page', async () => {
    await openHelp('/define/ཀ་')
    expect(wrapper.find('[data-testid="split-help-button"]').exists()).toBe(false)
  })

  it('should be a labelled button in the navigation style', async () => {
    wrapper = mount(SplitPageHelpDialogWithButton, { global: { mocks: { $route: { path: '/segment' } } } })

    const button = wrapper.find('[data-testid="split-help-button"]')
    expect(button.attributes('aria-label')).toBe('How to use the Split page')
    expect(button.classes()).toContain('help-button')
  })

  it('should open on the dictionaries filter, with a Navigation tab on a desktop', async () => {
    await openHelp()

    expect(document.body.querySelector('.ui-dialog__title').textContent).toBe('How to use the Split page')
    expect(tabLabels()).toEqual(['Dictionaries filter', 'Navigation'])
    expect(body('dictionaries-menu-help').textContent).toContain('Ctrl + click on a dictionary')
  })

  it('should leave out Navigation on a phone, and explain the long press', async () => {
    window.innerWidth = 390
    await openHelp()

    expect(tabLabels()).toEqual(['Dictionaries filter'])
    expect(body('dictionaries-menu-help').textContent).toContain('Long press on a dictionary')
  })

  it('should list Up/Down, Ctrl+Enter, Space, Shift+Space and the page shortcuts under Navigation', async () => {
    await openHelp()
    const text = await showNavigation()

    expect(text).toContain('Select previous word in results')
    expect(text).toContain('Select next word in results')
    expect(text).toContain('Split the text into words')
    expect(text).toContain('Types a tsheg in the text')
    expect(text).toContain('Types a space, which separates two words')
    for (const page of ['Define', 'Search', 'Split', 'Settings']) expect(text).toContain(`Go to ${page} page`)
    expect(text).toContain('Ctrl')
  })

  it('should show ⌘ instead of Ctrl on a Mac', async () => {
    platform.mac = true
    await openHelp()
    const text = await showNavigation()

    expect(text).toContain('⌘')
    expect(text).not.toContain('Ctrl')
  })

  it('should close with Close', async () => {
    await openHelp()
    body('split-help-close').click()
    await flushPromises()

    expect(body('split-help')).toBeNull()
  })
})
