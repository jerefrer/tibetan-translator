/**
 * LookupPage state: the field, the བོད / EN mode, the route and what is
 * remembered. Mounted the way App.vue mounts it (a <keep-alive> around the
 * <router-view>) with the app's own route table, so the redirects from the
 * old /define and /search links are the real ones.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { h, KeepAlive, nextTick } from 'vue'

import appRouter from '../src/router.js'
import LookupPage from '../src/components/lookup/LookupPage.vue'
import Storage from '../src/services/storage'

const KA = 'ཀ་'
const SANGS_RGYAS = 'སངས་རྒྱས་'
const CHOGYAL_SANGS_RGYAS = '<$<-{<-' // སངས་རྒྱས་ in the TibetanChogyal encoding

beforeAll(async () => {
  const { convertLegacyPaste } = await import('../src/services/legacy-to-unicode.js')
  await convertLegacyPaste({ text: CHOGYAL_SANGS_RGYAS })
})

const Shell = {
  render: () =>
    h(RouterView, null, {
      default: ({ Component }) => h(KeepAlive, null, [Component ? h(Component) : null]),
    }),
}

let wrapper
let router

async function mountAt(path) {
  router = createRouter({ history: createMemoryHistory(), routes: appRouter.options.routes })
  router.push(path)
  await router.isReady()
  wrapper = mount(Shell, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const page = () => wrapper.findComponent(LookupPage)
const input = () => wrapper.find('[data-testid="lookup-field"] input')
const radios = () => wrapper.findAll('[data-testid="lookup-mode"] [role="radio"]')
const checkedMode = () =>
  radios().find((radio) => radio.attributes('aria-checked') === 'true')?.attributes('aria-label')
const typed = () => wrapper.find('[data-testid="lookup-typed"]')

async function typeWylie(value) {
  await input().setValue(value)
  await input().trigger('keyup', { key: value.at(-1) })
  await nextTick()
}

async function chooseMode(label) {
  await radios()
    .find((radio) => radio.attributes('aria-label') === label)
    .trigger('click')
  await flushPromises()
}

async function go(path) {
  await router.push(path)
  await flushPromises()
}

function pasteEvent({ text = '', html = '' } = {}) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  event.clipboardData = { getData: (type) => (type === 'text/html' ? html : text) }
  return event
}

beforeEach(() => {
  // Storage writes localStorage properties, which the setup's clear() keeps
  Storage.delete('lookupState')
  Storage.delete('searchBuilderVisible')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('Lookup — route', () => {
  it('should fill the field with the term of the route', async () => {
    await mountAt('/lookup/' + encodeURIComponent(SANGS_RGYAS))
    expect(input().element.value).toBe(SANGS_RGYAS)
    expect(checkedMode()).toBe('Tibetan')
  })

  it('should fill the field from an old Define link with a percent-encoded term', async () => {
    await mountAt('/define/' + encodeURIComponent(SANGS_RGYAS))
    expect(router.currentRoute.value.path).toBe('/lookup/' + encodeURIComponent(SANGS_RGYAS))
    expect(input().element.value).toBe(SANGS_RGYAS)
    expect(checkedMode()).toBe('Tibetan')
  })

  it('should open in English mode with the query of an old Search link', async () => {
    await mountAt('/search/wisdom')
    expect(checkedMode()).toBe('English')
    expect(input().element.value).toBe('wisdom')
  })

  it('should decode a percent-encoded query from an old Search link', async () => {
    await mountAt('/search/' + encodeURIComponent('buddha nature & (ye shes)'))
    expect(checkedMode()).toBe('English')
    expect(input().element.value).toBe('buddha nature & (ye shes)')
  })

  it('should keep the start typed when the route selects a longer term', async () => {
    await mountAt('/lookup')
    await typeWylie('sangs ')
    expect(page().vm.text).toBe('སངས་')
    await go('/lookup/' + encodeURIComponent(SANGS_RGYAS))
    expect(input().element.value).toBe('སངས་')
  })

  it('should open a definition link in Tibetan mode while in English mode', async () => {
    await mountAt('/search/wisdom')
    await go('/define/' + encodeURIComponent(KA))
    expect(checkedMode()).toBe('Tibetan')
    expect(input().element.value).toBe(KA)
  })

  it('should run an English search from the field with Enter', async () => {
    await mountAt('/lookup?mode=en')
    await input().setValue('buddha nature')
    await input().trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const route = router.currentRoute.value
    expect(route.path).toBe('/lookup')
    expect(route.query).toEqual({ mode: 'en', q: 'buddha nature' })
  })

  it('should ignore routes of other pages while it is kept alive', async () => {
    await mountAt('/lookup/' + encodeURIComponent(KA))
    const vm = page().vm
    await go('/reader?mode=en&q=wisdom')
    expect(vm.text).toBe(KA)
    expect(vm.mode).toBe('bo')
    expect(Storage.get('lookupState')).toMatchObject({ mode: 'bo', term: KA })
  })
})

describe('Lookup — modes', () => {
  it('should carry the typed Wylie to English and back', async () => {
    await mountAt('/lookup')
    await typeWylie('sangs rgyas ')
    expect(input().element.value).toBe(SANGS_RGYAS)
    expect(typed().text()).toBe('typed sangs rgyas')

    await chooseMode('English')
    expect(input().element.value).toBe('sangs rgyas')
    expect(router.currentRoute.value.query.mode).toBe('en')

    await chooseMode('Tibetan')
    expect(input().element.value).toBe(SANGS_RGYAS)
    expect(typed().text()).toBe('typed sangs rgyas')
    expect(router.currentRoute.value.query.mode).toBe('bo')
  })

  it('should switch to English with the Tibetan as is when no Wylie was typed', async () => {
    await mountAt('/lookup/' + encodeURIComponent(KA))
    await chooseMode('English')
    expect(input().element.value).toBe(KA)
  })

  it('should switch to English with the shortcut route', async () => {
    await mountAt('/lookup')
    await typeWylie('sangs rgyas ')
    await go('/lookup?mode=en')
    expect(checkedMode()).toBe('English')
    expect(input().element.value).toBe('sangs rgyas')
  })
})

describe('Lookup — remembering', () => {
  it('should restore the last mode and term when opened bare', async () => {
    Storage.set('lookupState', { mode: 'bo', term: KA, query: 'wisdom' })
    await mountAt('/lookup')
    expect(router.currentRoute.value.path).toBe('/lookup/' + encodeURIComponent(KA))
    expect(checkedMode()).toBe('Tibetan')
    expect(input().element.value).toBe(KA)
  })

  it('should restore the last English query when opened bare', async () => {
    Storage.set('lookupState', { mode: 'en', term: KA, query: 'wisdom' })
    await mountAt('/lookup')
    expect(router.currentRoute.value.query).toEqual({ mode: 'en', q: 'wisdom' })
    expect(checkedMode()).toBe('English')
    expect(input().element.value).toBe('wisdom')
  })

  it('should restore the term of the mode an old Define link asks for', async () => {
    Storage.set('lookupState', { mode: 'en', term: KA, query: 'wisdom' })
    await mountAt('/define')
    expect(checkedMode()).toBe('Tibetan')
    expect(input().element.value).toBe(KA)
  })

  it('should remember the mode, the term and the query', async () => {
    await mountAt('/lookup/' + encodeURIComponent(KA))
    expect(Storage.get('lookupState')).toMatchObject({ mode: 'bo', term: KA })
    await go('/search/wisdom')
    expect(Storage.get('lookupState')).toEqual({ mode: 'en', term: KA, query: 'wisdom' })
    await chooseMode('Tibetan')
    expect(Storage.get('lookupState').mode).toBe('bo')
  })

  it('should keep the field and mode when coming back', async () => {
    await mountAt('/lookup')
    await typeWylie('sangs rgyas ')
    await go('/reader')
    await go('/lookup')
    expect(checkedMode()).toBe('Tibetan')
    expect(input().element.value).toBe(SANGS_RGYAS)
    expect(typed().text()).toBe('typed sangs rgyas')

    await chooseMode('English')
    await go('/reader')
    await go('/lookup')
    expect(checkedMode()).toBe('English')
    expect(input().element.value).toBe('sangs rgyas')
  })

  it('should forget the term when the field is cleared', async () => {
    await mountAt('/lookup/' + encodeURIComponent(KA))
    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    await flushPromises()
    expect(input().element.value).toBe('')
    expect(router.currentRoute.value.params.term).toBeFalsy()
    expect(Storage.get('lookupState').term).toBe('')
  })
})

describe('Lookup — field', () => {
  it('should focus the field on focus-lookup', async () => {
    await mountAt('/lookup')
    input().element.blur()
    expect(document.activeElement).not.toBe(input().element)
    window._triggerEvent('focus-lookup')
    await nextTick()
    expect(document.activeElement).toBe(input().element)
  })

  it('should refuse a second tsheg and repair a legacy-font paste', async () => {
    await mountAt('/lookup/' + encodeURIComponent(KA))
    const keydown = new KeyboardEvent('keydown', { key: '་', cancelable: true })
    input().element.dispatchEvent(keydown)
    expect(keydown.defaultPrevented).toBe(true)

    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    await flushPromises()
    input().element.dispatchEvent(pasteEvent({ text: CHOGYAL_SANGS_RGYAS }))
    await vi.waitFor(() => expect(page().vm.text).toBe(SANGS_RGYAS))
    await nextTick()
    expect(input().element.value).toBe(SANGS_RGYAS)
  })
})
