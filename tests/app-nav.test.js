import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppNav from '../src/components/AppNav.vue'

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
  it('should show the three destinations on desktop, with a divider between the groups', async () => {
    const { wrapper } = await mountNav('/lookup')
    const ids = wrapper.findAll('[data-testid^="nav-"][href]').map((a) => a.attributes('data-testid'))
    expect(ids).toEqual(['nav-lookup', 'nav-reader', 'nav-library'])
    expect(wrapper.find('[role="separator"]').exists()).toBe(true)
  })

  it('should show three tabs and no divider on a phone', async () => {
    const { wrapper } = await mountNav('/lookup', { isMobile: true })
    const ids = wrapper.findAll('[data-testid^="nav-"][href]').map((a) => a.attributes('data-testid'))
    expect(ids).toEqual(['nav-lookup', 'nav-reader', 'nav-library'])
    expect(wrapper.find('[role="separator"]').exists()).toBe(false)
    expect(wrapper.classes()).toContain('app-nav--bar')
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

  it('should show the app icon as the logo on the desktop rail only', async () => {
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

  it('should show an update dot on Library only when an update is ready', async () => {
    const { wrapper } = await mountNav('/lookup')
    expect(wrapper.find('[data-testid="nav-update-dot"]').exists()).toBe(false)
    await wrapper.setProps({ updateReady: true })
    expect(wrapper.find('[data-testid="nav-update-dot"]').exists()).toBe(true)
  })

  it('should render the help slot on the desktop rail only', async () => {
    const help = '<button data-testid="help-probe">?</button>'
    const desktop = await mountNav('/lookup', {}, { help })
    expect(desktop.wrapper.find('[data-testid="help-probe"]').exists()).toBe(true)
    const phone = await mountNav('/lookup', { isMobile: true }, { help })
    expect(phone.wrapper.find('[data-testid="help-probe"]').exists()).toBe(false)
    expect(phone.wrapper.find('[data-testid="nav-help"]').exists()).toBe(false)
  })
})
