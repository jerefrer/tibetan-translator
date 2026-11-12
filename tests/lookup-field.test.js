/**
 * LookupField: Lookup's one field, Tibetan (UiTibetanField, Wylie converted)
 * or English (plain, with the query builder behind Advanced), and the
 * བོད / EN switch beside it.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LookupField from '../src/components/lookup/LookupField.vue'
import Storage from '../src/services/storage'

const CHOGYAL_SANGS_RGYAS = '<$<-{<-' // སངས་རྒྱས་ in the TibetanChogyal encoding

beforeAll(async () => {
  const { convertLegacyPaste } = await import('../src/services/legacy-to-unicode.js')
  await convertLegacyPaste({ text: CHOGYAL_SANGS_RGYAS })
})

let wrapper
const mountField = (props = {}) => {
  wrapper = mount(LookupField, {
    props: { mode: 'bo', modelValue: '', typedWylie: '', readAs: '', ...props },
    attachTo: document.body,
  })
  return wrapper
}
const input = () => wrapper.find('[data-testid="lookup-field"] input')
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

describe('LookupField', () => {
  it('should convert Wylie on space in Tibetan mode', async () => {
    mountField({ mode: 'bo' })
    await input().setValue('sangs rgyas ')
    await input().trigger('keyup', { key: ' ' })
    expect(lastValue()).toBe('སངས་རྒྱས་')
  })

  it('should not convert in English mode', async () => {
    mountField({ mode: 'en' })
    await input().setValue('sangs rgyas ')
    await input().trigger('keyup', { key: ' ' })
    expect(lastValue()).toBe('sangs rgyas ')
  })

  it('should show the typed Wylie on a phone too', () => {
    window.innerWidth = 390
    mountField({ mode: 'bo', modelValue: 'སངས་རྒྱས་', typedWylie: 'sangs rgyas' })
    const typed = wrapper.get('[data-testid="lookup-typed"]')
    expect(typed.text()).toBe('typed sangs rgyas')
  })

  it('should not show a typed echo in English mode', () => {
    mountField({ mode: 'en', modelValue: 'sangs rgyas', typedWylie: 'sangs rgyas' })
    expect(wrapper.find('[data-testid="lookup-typed"]').exists()).toBe(false)
  })

  it('should show how the input was read', () => {
    mountField({ mode: 'bo', modelValue: 'བཅོམ་', readAs: 'Wylie bcom → བཅོམ་ · 5 terms' })
    expect(wrapper.get('[data-testid="lookup-read-as"]').text()).toBe('Wylie bcom → བཅོམ་ · 5 terms')
  })

  it('should toggle the query builder with Advanced in English mode only', async () => {
    mountField({ mode: 'bo' })
    expect(wrapper.find('[data-testid="lookup-advanced"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="search-builder"]').exists()).toBe(false)

    await wrapper.setProps({ mode: 'en' })
    const advanced = wrapper.get('[data-testid="lookup-advanced"]')
    expect(advanced.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-testid="search-builder"]').exists()).toBe(false)

    await advanced.trigger('click')
    expect(wrapper.find('[data-testid="search-builder"]').exists()).toBe(true)
    expect(advanced.attributes('aria-expanded')).toBe('true')
    expect(Storage.get('searchBuilderVisible')).toBe(true)

    await wrapper.setProps({ mode: 'bo' })
    expect(wrapper.find('[data-testid="search-builder"]').exists()).toBe(false)

    await wrapper.setProps({ mode: 'en' })
    await wrapper.get('[data-testid="lookup-advanced"]').trigger('click')
    expect(wrapper.find('[data-testid="search-builder"]').exists()).toBe(false)
    expect(Storage.get('searchBuilderVisible')).toBe(false)
  })

  it('should open the query builder when it was left open', () => {
    Storage.set('searchBuilderVisible', true)
    mountField({ mode: 'en' })
    expect(wrapper.find('[data-testid="search-builder"]').exists()).toBe(true)
  })

  it('should emit the mode chosen with the switch', async () => {
    mountField({ mode: 'bo' })
    const radios = wrapper.findAll('[data-testid="lookup-mode"] [role="radio"]')
    expect(radios.map((radio) => radio.text())).toEqual(['བོད', 'EN'])
    expect(radios.map((radio) => radio.attributes('aria-label'))).toEqual(['Tibetan', 'English'])
    await radios[1].trigger('click')
    expect(wrapper.emitted('update:mode')).toEqual([['en']])
  })

  it('should repair a legacy-font paste in English mode', async () => {
    mountField({ mode: 'en' })
    input().element.dispatchEvent(pasteEvent({ text: CHOGYAL_SANGS_RGYAS }))
    for (let attempt = 0; attempt < 10 && !wrapper.emitted('update:modelValue'); attempt++) {
      await flushPromises()
    }
    expect(lastValue()).toBe('སངས་རྒྱས་')
  })

  it('should pass keys on and clear', async () => {
    mountField({ mode: 'en', modelValue: 'wisdom' })
    await input().trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('keydown')).toHaveLength(1)
    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })
})
