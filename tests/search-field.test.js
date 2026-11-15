/**
 * SearchField: Search's plain field, with how the query was read under it and
 * the query builder behind its button.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SearchField from '../src/components/search/SearchField.vue'
import Storage from '../src/services/storage'

const CHOGYAL_SANGS_RGYAS = '<$<-{<-' // སངས་རྒྱས་ in the TibetanChogyal encoding

beforeAll(async () => {
  const { convertLegacyPaste } = await import('../src/services/legacy-to-unicode.js')
  await convertLegacyPaste({ text: CHOGYAL_SANGS_RGYAS })
})

let wrapper
const mountField = (props = {}) => {
  wrapper = mount(SearchField, {
    props: { modelValue: '', readAs: '', ...props },
    attachTo: document.body,
  })
  return wrapper
}
const input = () => wrapper.find('[data-testid="search-field"] input')
const lastValue = () => wrapper.emitted('update:modelValue')?.at(-1)?.[0]

function pasteEvent({ text = '', html = '' } = {}) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  event.clipboardData = { getData: (type) => (type === 'text/html' ? html : text) }
  return event
}

beforeEach(() => {
  Storage.delete('searchBuilderVisible')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('SearchField', () => {
  it('should show a query in Tibetan alone in the Tibetan colour', () => {
    mountField({ modelValue: 'སངས་རྒྱས་' })
    expect(wrapper.find('[data-testid="search-field"]').classes()).toContain('search-field__input--tibetan')
  })

  it('should leave a query with Latin in it in the ordinary colour', async () => {
    mountField({ modelValue: 'སངས་རྒྱས་ buddha' })
    expect(wrapper.find('[data-testid="search-field"]').classes()).not.toContain('search-field__input--tibetan')
    await wrapper.setProps({ modelValue: '{chin kyi lob}' })
    expect(wrapper.find('[data-testid="search-field"]').classes()).not.toContain('search-field__input--tibetan')
  })

  it('should not convert what is typed', async () => {
    mountField()
    await input().setValue('sangs rgyas ')
    await input().trigger('keyup', { key: ' ' })
    expect(lastValue()).toBe('sangs rgyas ')
  })

  it('should show how the query was read', () => {
    mountField({ modelValue: 'wisdom', readAs: 'Terms whose definitions say “wisdom” · 5 terms' })
    expect(wrapper.get('[data-testid="search-read-as"]').text()).toBe(
      'Terms whose definitions say “wisdom” · 5 terms'
    )
  })

  it('should show no reading before a query', () => {
    mountField()
    expect(wrapper.find('[data-testid="search-read-as"]').exists()).toBe(false)
  })

  it('should open the query builder with its button, which then gives way to the builder', async () => {
    mountField()
    const open = wrapper.get('[data-testid="search-advanced"]')
    expect(open.text()).toBe('Query builder')
    expect(wrapper.find('[data-testid="search-builder"]').exists()).toBe(false)

    await open.trigger('click')
    expect(wrapper.find('[data-testid="search-builder"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="search-advanced"]').exists()).toBe(false)
    expect(Storage.get('searchBuilderVisible')).toBe(true)
  })

  it('should open the query builder when it was left open', () => {
    Storage.set('searchBuilderVisible', true)
    mountField()
    expect(wrapper.find('[data-testid="search-builder"]').exists()).toBe(true)
  })

  it('should repair a legacy-font paste', async () => {
    mountField()
    input().element.dispatchEvent(pasteEvent({ text: CHOGYAL_SANGS_RGYAS }))
    for (let attempt = 0; attempt < 10 && !wrapper.emitted('update:modelValue'); attempt++) {
      await flushPromises()
    }
    expect(lastValue()).toBe('སངས་རྒྱས་')
  })

  it('should pass keys on and clear', async () => {
    mountField({ modelValue: 'wisdom' })
    await input().trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('keydown')).toHaveLength(1)
    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('should carry a placeholder, a search key and no spelling aids', () => {
    mountField()
    expect(input().attributes('placeholder')).toBe('Search the definitions')
    expect(input().attributes('enterkeyhint')).toBe('search')
    expect(input().attributes('spellcheck')).toBe('false')
    expect(input().attributes('autocomplete')).toBe('off')
    expect(input().attributes('autocapitalize')).toBe('off')
    expect(input().attributes('autocorrect')).toBe('off')
  })

  it('should leave an ordinary paste to the browser', async () => {
    mountField()
    const event = pasteEvent({ text: 'wisdom' })
    input().element.dispatchEvent(event)
    await flushPromises()
    expect(event.defaultPrevented).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('should give the query builder the query and take its rows back', async () => {
    Storage.set('searchBuilderVisible', true)
    mountField({ modelValue: '(ye shes) & wakefulness' })
    await flushPromises()
    const terms = () => wrapper.findAll('[data-testid="search-builder-term"]')
    expect(terms().map((term) => term.element.value)).toEqual(['ye shes', 'wakefulness'])

    await terms()[1].setValue('wisdom')
    await flushPromises()
    expect(lastValue()).toBe('(ye shes) & wisdom')
  })

  it('should submit the query on Enter in a row of the builder', async () => {
    Storage.set('searchBuilderVisible', true)
    mountField({ modelValue: 'wakefulness' })
    await wrapper.get('[data-testid="search-builder-term"]').trigger('keyup', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('should close the builder with its Hide button and remember it', async () => {
    Storage.set('searchBuilderVisible', true)
    mountField()
    await wrapper.get('[data-testid="search-builder-hide"]').trigger('click')
    expect(wrapper.find('[data-testid="search-builder"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="search-advanced"]').exists()).toBe(true)
    expect(Storage.get('searchBuilderVisible')).toBe(false)
  })
})
