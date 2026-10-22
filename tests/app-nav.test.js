import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppNav from '../src/components/AppNav.vue'

const stub = { template: '<div />' }

async function mountNav(path, props = {}, slots = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/define', '/search', '/segment', '/glossary', '/dictionaries', '/settings'].map(
      (route) => ({ path: route, component: stub })
    ),
  })
  router.push(path)
  await router.isReady()
  const wrapper = mount(AppNav, { props, slots, global: { plugins: [router] } })
  return { wrapper, router }
}

describe('AppNav', () => {
  it('should show six entries on desktop, with a divider between the groups', async () => {
    const { wrapper } = await mountNav('/define')
    const ids = wrapper.findAll('[data-testid^="nav-"][href]').map((a) => a.attributes('data-testid'))
    expect(ids).toEqual([
      'nav-define',
      'nav-search',
      'nav-segment',
      'nav-glossary',
      'nav-dictionaries',
      'nav-settings',
    ])
    expect(wrapper.find('[role="separator"]').exists()).toBe(true)
  })

  it('should show four tabs and no divider on a phone', async () => {
    const { wrapper } = await mountNav('/define', { isMobile: true })
    const ids = wrapper.findAll('[data-testid^="nav-"][href]').map((a) => a.attributes('data-testid'))
    expect(ids).toEqual(['nav-define', 'nav-search', 'nav-segment', 'nav-settings'])
    expect(wrapper.find('[role="separator"]').exists()).toBe(false)
    expect(wrapper.classes()).toContain('app-nav--bar')
  })

  it('should mark the current page with aria-current', async () => {
    const { wrapper } = await mountNav('/search')
    expect(wrapper.find('[data-testid="nav-search"]').attributes('aria-current')).toBe('page')
    expect(wrapper.find('[data-testid="nav-define"]').attributes('aria-current')).toBeUndefined()
  })

  it('should highlight Settings on a phone while Glossary is open', async () => {
    const { wrapper } = await mountNav('/glossary/custom-a/1', { isMobile: true })
    expect(wrapper.find('[data-testid="nav-settings"]').attributes('aria-current')).toBe('page')
  })

  it('should navigate when an entry is clicked', async () => {
    const { wrapper, router } = await mountNav('/define')
    await wrapper.find('[data-testid="nav-dictionaries"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/dictionaries')
  })

  it('should show an update dot on Settings only when an update is ready', async () => {
    const { wrapper } = await mountNav('/define')
    expect(wrapper.find('[data-testid="nav-update-dot"]').exists()).toBe(false)
    await wrapper.setProps({ updateReady: true })
    expect(wrapper.find('[data-testid="nav-update-dot"]').exists()).toBe(true)
  })

  it('should render the help slot on both layouts', async () => {
    const help = '<button data-testid="help-probe">?</button>'
    const desktop = await mountNav('/define', {}, { help })
    expect(desktop.wrapper.find('[data-testid="help-probe"]').exists()).toBe(true)
    const phone = await mountNav('/define', { isMobile: true }, { help })
    expect(phone.wrapper.find('[data-testid="help-probe"]').exists()).toBe(true)
  })
})
