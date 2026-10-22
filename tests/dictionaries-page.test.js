/**
 * DictionariesPage: the catalog with the Packs list and My glossary beside it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'

let modular = true
let initialized = true
const packState = {
  installedPacks: ['core'],
  downloadingPacks: {},
  updatingPacks: {},
}
const downloadPackMock = vi.fn()

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
      return packState.installedPacks
    },
    get downloadingPacks() {
      return packState.downloadingPacks
    },
    get updatingPacks() {
      return packState.updatingPacks
    },
    downloadPack: (...args) => downloadPackMock(...args),
    waitForDownload: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../src/services/sql-database', () => ({
  default: { reloadPack: vi.fn().mockResolvedValue(undefined) },
}))

import DictionariesPage from '../src/components/DictionariesPage.vue'

const push = vi.fn()

const mountPage = (query = {}) =>
  mount(DictionariesPage, {
    global: {
      provide: { snackbar: { open: vi.fn() } },
      mocks: { $route: { query }, $router: { push } },
      stubs: { RouterLink: RouterLinkStub },
    },
    attachTo: document.body,
  })

beforeEach(() => {
  modular = true
  initialized = true
  packState.installedPacks = ['core']
  packState.downloadingPacks = {}
  packState.updatingPacks = {}
  downloadPackMock.mockReset().mockResolvedValue(undefined)
  push.mockReset()
})

afterEach(() => {
  document.body.innerHTML = ''
})

const packRow = (wrapper, name) =>
  wrapper.findAll('[data-testid="pack-row"]').find((row) => row.text().startsWith(name))

describe('DictionariesPage', () => {
  it('should open the catalog on the search and status given in the address', () => {
    const wrapper = mountPage({ find: 'verbs', status: 'available' })

    const catalog = wrapper.findComponent({ name: 'DictionaryCatalog' })
    expect(catalog.vm.query).toBe('verbs')
    expect(catalog.vm.status).toBe('available')
    expect(wrapper.get('h1 .catalog-heading__wide').text()).toBe('Find a dictionary')

    wrapper.unmount()
  })

  it('should list every pack with what it holds and whether it is installed', () => {
    const wrapper = mountPage()

    expect(wrapper.findAll('[data-testid="pack-row"]')).toHaveLength(3)
    expect(packRow(wrapper, 'Core Dictionaries').text()).toContain('Installed')
    expect(packRow(wrapper, 'Core Dictionaries').text()).toContain('35 dictionaries')
    expect(packRow(wrapper, 'Tibetan Monolingual').find('[data-testid="pack-install"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('should show the progress of a pack being downloaded', () => {
    packState.downloadingPacks = { 'tibetan-monolingual': { percentage: 42 } }
    const wrapper = mountPage()

    const row = packRow(wrapper, 'Tibetan Monolingual')
    expect(row.text()).toContain('Downloading 42%')
    expect(row.find('[data-testid="ui-progress"]').exists()).toBe(true)
    expect(row.find('[data-testid="pack-install"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('should show the progress of a pack being updated', () => {
    packState.updatingPacks = { core: { percentage: 10 } }
    const wrapper = mountPage()

    expect(packRow(wrapper, 'Core Dictionaries').text()).toContain('Updating 10%')

    wrapper.unmount()
  })

  it('should ask before installing a pack from the Packs list', async () => {
    const wrapper = mountPage()

    await packRow(wrapper, 'Sanskrit & Academic').get('[data-testid="pack-install"]').trigger('click')
    await flushPromises()

    expect(downloadPackMock).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Install Sanskrit & Academic?')

    wrapper.unmount()
  })

  it('should not offer to install before the pack manager knows what is installed', () => {
    initialized = false
    const wrapper = mountPage()

    expect(wrapper.find('[data-testid="pack-install"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('should open My glossary', async () => {
    const wrapper = mountPage()

    await wrapper.get('[data-testid="open-glossary"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/glossary')

    wrapper.unmount()
  })

  it('should leave out packs and the glossary on the web, where neither exists', () => {
    modular = false
    const wrapper = mountPage()

    expect(wrapper.find('[data-testid="dictionaries-packs"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="open-glossary"]').exists()).toBe(false)
    expect(wrapper.find('.catalog-aside').exists()).toBe(false)

    wrapper.unmount()
  })

  it('should link back to Settings, which a phone shows above the title', () => {
    const wrapper = mountPage()

    const back = wrapper
      .findAllComponents(RouterLinkStub)
      .find((link) => link.text() === 'Settings')
    expect(back.props('to')).toBe('/settings')

    wrapper.unmount()
  })
})
