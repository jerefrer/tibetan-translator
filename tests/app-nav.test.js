import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppNav from '../src/components/AppNav.vue'
import { recordTerm } from '../src/services/history'
import { toggleSaved } from '../src/services/saved-terms'

const stub = { template: '<div />' }

async function mountNav(path, props = {}, slots = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/lookup', '/reader', '/library', '/library/glossary', '/library/dictionaries'].map(
      (route) => ({ path: route, component: stub })
    ),
  })
  router.push(path)
  await router.isReady()
  const wrapper = mount(AppNav, { props, slots, global: { plugins: [router] } })
  return { wrapper, router }
}

describe('AppNav', () => {
  it('should ask Library to scroll back when the Settings link is followed on #settings', async () => {
    const { wrapper, router } = await mountNav('/library#settings')
    const spy = vi.spyOn(window, 'dispatchEvent')

    await wrapper.find('[data-testid="nav-settings"]').trigger('click')
    await flushPromises()

    expect(spy.mock.calls.some(([e]) => e.type === 'route-refollowed')).toBe(true)
    expect(router.currentRoute.value.fullPath).toBe('/library#settings')
    spy.mockRestore()
  })

  it('should navigate to Library settings from another page without asking to scroll', async () => {
    const { wrapper, router } = await mountNav('/lookup')
    const spy = vi.spyOn(window, 'dispatchEvent')

    await wrapper.find('[data-testid="nav-settings"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/library#settings')
    expect(spy.mock.calls.some(([e]) => e.type === 'route-refollowed')).toBe(false)
    spy.mockRestore()
  })

  beforeEach(() => {
    localStorage.clear()
  })

  it('should show the three destinations on desktop and phone', async () => {
    const desktop = await mountNav('/lookup')
    const ids = (w) => w.findAll('[data-testid^="nav-"][href]').map((a) => a.attributes('data-testid'))
    expect(ids(desktop.wrapper).slice(0, 3)).toEqual(['nav-lookup', 'nav-reader', 'nav-library'])
    expect(desktop.wrapper.classes()).toContain('app-nav--sidebar')
    const phone = await mountNav('/lookup', { isMobile: true })
    expect(ids(phone.wrapper)).toEqual(['nav-lookup', 'nav-reader', 'nav-library'])
    expect(phone.wrapper.find('[role="separator"]').exists()).toBe(false)
  })

  it('should keep the bottom bar class the dictionaries menu relies on', async () => {
    const { wrapper } = await mountNav('/lookup', { isMobile: true })
    expect(wrapper.classes()).toContain('app-nav--bar')
    expect(wrapper.classes()).not.toContain('app-nav--sidebar')
  })

  it('should list recent lookups and refresh when one is recorded', async () => {
    recordTerm('བདེ་བ་')
    const { wrapper } = await mountNav('/lookup')
    const rows = () => wrapper.findAll('[data-testid="nav-recent"] a')
    expect(rows().map((a) => a.text())).toEqual(['བདེ་བ་'])
    expect(rows()[0].attributes('href')).toBe('/lookup/' + encodeURIComponent('བདེ་བ་'))
    recordTerm('སེམས་ཅན་')
    window._triggerEvent('recents-updated')
    await flushPromises()
    expect(rows().map((a) => a.text())).toEqual(['སེམས་ཅན་', 'བདེ་བ་'])
  })

  it('should show only the first eight recent lookups', async () => {
    for (let i = 0; i < 10; i++) recordTerm('བཀ' + 'ཀཁགངཅཆཇཉཏཐ'[i] + 'འ')
    const { wrapper } = await mountNav('/lookup')
    expect(wrapper.findAll('[data-testid="nav-recent"] a')).toHaveLength(8)
  })

  it('should hide Saved when nothing is saved, and show it once a term is', async () => {
    const { wrapper } = await mountNav('/lookup')
    expect(wrapper.find('[data-testid="nav-saved"]').exists()).toBe(false)
    toggleSaved('སངས་རྒྱས་')
    window._triggerEvent('saved-terms-updated')
    await flushPromises()
    expect(wrapper.find('[data-testid="nav-saved"]').text()).toContain('སངས་རྒྱས་')
  })

  it('should put the update dot on Settings (desktop) and Library (phone)', async () => {
    const desktop = await mountNav('/lookup', { updateReady: true })
    const dot = desktop.wrapper.find('[data-testid="nav-update-dot"]')
    expect(desktop.wrapper.find('[data-testid="nav-settings"]').element.contains(dot.element)).toBe(true)
    expect(desktop.wrapper.find('[data-testid="nav-library"] [data-testid="nav-update-dot"]').exists()).toBe(false)
    expect(desktop.wrapper.find('[data-testid="nav-settings"]').attributes('href')).toBe('/library#settings')
    const phone = await mountNav('/lookup', { isMobile: true, updateReady: true })
    expect(phone.wrapper.find('[data-testid="nav-library"] [data-testid="nav-update-dot"]').exists()).toBe(true)
  })

  it('should mark the current page with aria-current', async () => {
    const { wrapper } = await mountNav('/reader')
    expect(wrapper.find('[data-testid="nav-reader"]').attributes('aria-current')).toBe('page')
    expect(wrapper.find('[data-testid="nav-lookup"]').attributes('aria-current')).toBeUndefined()
  })

  it('should highlight Library on a phone while Glossary is open', async () => {
    const { wrapper } = await mountNav('/library/glossary/custom-a/1', { isMobile: true })
    expect(wrapper.find('[data-testid="nav-library"]').attributes('aria-current')).toBe('page')
  })

  it('should show the app icon as the logo on the desktop sidebar only', async () => {
    const desktop = await mountNav('/lookup')
    expect(desktop.wrapper.find('img.app-nav__logo').attributes('src')).toBe('/img/app-icon.png')
    const phone = await mountNav('/lookup', { isMobile: true })
    expect(phone.wrapper.find('.app-nav__logo').exists()).toBe(false)
  })

  it('should navigate when an entry is clicked', async () => {
    const { wrapper, router } = await mountNav('/lookup')
    await wrapper.find('[data-testid="nav-reader"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/reader')
  })
})
