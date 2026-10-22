/**
 * The help button and dialog of the Define page.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const platform = vi.hoisted(() => ({ tauri: true }))
vi.mock('../src/config/platform.js', () => ({
  isTauri: () => platform.tauri,
  isMacOS: () => false,
  isMobile: () => false,
}))

import DefinePageHelpDialogWithButton from '../src/components/DefinePageHelpDialogWithButton.vue'

let wrapper
const body = (testid) => document.body.querySelector(`[data-testid="${testid}"]`)
const tabLabels = () =>
  Array.from(document.body.querySelectorAll('.ui-tabs__trigger')).map((tab) => tab.textContent.trim())

async function openHelp(path = '/define/ཀ་') {
  wrapper = mount(DefinePageHelpDialogWithButton, {
    attachTo: document.body,
    global: { mocks: { $route: { path } } },
  })
  const button = wrapper.find('[data-testid="define-help-button"]')
  if (button.exists()) {
    await button.trigger('click')
    await flushPromises()
  }
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  platform.tauri = true
})

describe('Define help', () => {
  it('should only show its button on the Define page', async () => {
    await openHelp('/search/x')
    expect(wrapper.find('[data-testid="define-help-button"]').exists()).toBe(false)
  })

  it('should open on the dictionaries filter, with the Quick Lookup and Navigation tabs in the desktop app', async () => {
    await openHelp()

    expect(document.body.querySelector('.ui-dialog__title').textContent).toBe('How to use the Define page')
    expect(tabLabels()).toEqual(['Dictionaries filter', 'Quick Lookup', 'Navigation'])
    expect(body('dictionaries-menu-help').textContent).toContain('Ctrl + click on a dictionary')
    expect(body('dictionaries-menu-help').textContent).toContain('Keyboard shortcuts')
  })

  it('should leave out Quick Lookup outside the desktop app', async () => {
    platform.tauri = false
    await openHelp()
    expect(tabLabels()).toEqual(['Dictionaries filter', 'Navigation'])
  })

  it('should leave out Navigation and keyboard shortcuts on a phone, and explain the long press', async () => {
    window.innerWidth = 390
    await openHelp()

    expect(tabLabels()).not.toContain('Navigation')
    expect(body('dictionaries-menu-help').textContent).toContain('Long press on a dictionary')
    expect(body('dictionaries-menu-help').textContent).not.toContain('Keyboard shortcuts')
  })

  it('should list Up/Down and the page shortcuts under Navigation', async () => {
    await openHelp()
    wrapper.vm.tab = 'navigation'
    await flushPromises()

    const text = body('define-help').textContent
    expect(text).toContain('Select previous entry in results')
    expect(text).toContain('Go to Define page')
    expect(text).toContain('Go to Settings page')
  })

  it('should close from its Close button', async () => {
    await openHelp()
    body('define-help-close').click()
    await flushPromises()
    expect(body('define-help')).toBeNull()
  })
})
