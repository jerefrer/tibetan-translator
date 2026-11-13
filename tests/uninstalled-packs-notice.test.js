/**
 * UninstalledPacksNotice: under thin results, the packs that were not
 * searched, and a way to the Dictionaries page filtered to them.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

let modular = true
let initialized = true
let installedPacks = ['core']

vi.mock('../src/config/platform.js', () => ({
  isTauri: () => modular,
  supportsModularPacks: () => modular,
}))

vi.mock('../src/services/pack-manager', () => ({
  default: {
    get isInitialized() {
      return initialized
    },
    get installedPacks() {
      return installedPacks
    },
  },
}))

import UninstalledPacksNotice from '../src/components/UninstalledPacksNotice.vue'

beforeEach(() => {
  modular = true
  initialized = true
  installedPacks = ['core']
})

describe('UninstalledPacksNotice', () => {
  const mountNotice = (resultCount) =>
    mount(UninstalledPacksNotice, {
      props: { resultCount },
      global: { mocks: { $router: { push: vi.fn() } } },
    })

  it('should name the packs that were not searched when results are few', () => {
    const wrapper = mountNotice(1)

    expect(wrapper.text()).toContain('2 packs were not searched')
    expect(wrapper.text()).toContain('Tibetan Monolingual')
    expect(wrapper.text()).toContain('Sanskrit & Academic')
  })

  it('should stay hidden when there are plenty of results', () => {
    expect(mountNotice(3).find('.uninstalled-notice').exists()).toBe(false)
  })

  it('should stay hidden when every pack is installed', () => {
    installedPacks = ['core', 'tibetan-monolingual', 'sanskrit-academic']
    expect(mountNotice(0).find('.uninstalled-notice').exists()).toBe(false)
  })

  it('should stay hidden before the pack manager has loaded', () => {
    initialized = false
    expect(mountNotice(0).find('.uninstalled-notice').exists()).toBe(false)
  })

  it('should stay hidden on the web, where every dictionary is bundled', () => {
    modular = false
    expect(mountNotice(0).find('.uninstalled-notice').exists()).toBe(false)
  })

  it('should say one pack when only one is missing', () => {
    installedPacks = ['core', 'sanskrit-academic']
    expect(mountNotice(0).text()).toContain('1 pack was not searched')
  })

  it('should send the user to the catalog, filtered to what is not installed', async () => {
    const push = vi.fn()
    const wrapper = mount(UninstalledPacksNotice, {
      props: { resultCount: 0 },
      global: { mocks: { $router: { push } } },
    })

    await wrapper.find('button').trigger('click')

    expect(push).toHaveBeenCalledWith({ path: '/dictionaries', query: { status: 'available' } })
  })
})

