/**
 * LookupField: Lookup's one field, Tibetan (UiTibetanField, Wylie converted),
 * with the typed echo and how the input was read under it.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LookupField from '../src/components/lookup/LookupField.vue'

const CHOGYAL_SANGS_RGYAS = '<$<-{<-' // སངས་རྒྱས་ in the TibetanChogyal encoding

beforeAll(async () => {
  const { convertLegacyPaste } = await import('../src/services/legacy-to-unicode.js')
  await convertLegacyPaste({ text: CHOGYAL_SANGS_RGYAS })
})

let wrapper
const mountField = (props = {}) => {
  wrapper = mount(LookupField, {
    props: { modelValue: '', typedWylie: '', readAs: '', ...props },
    attachTo: document.body,
  })
  return wrapper
}
const input = () => wrapper.find('[data-testid="lookup-field"] input')
const lastValue = () => wrapper.emitted('update:modelValue')?.at(-1)?.[0]

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('LookupField', () => {
  it('should convert Wylie on space', async () => {
    mountField()
    await input().setValue('sangs rgyas ')
    await input().trigger('keyup', { key: ' ' })
    expect(lastValue()).toBe('སངས་རྒྱས་')
  })

  it('should show the typed Wylie on a phone too', () => {
    window.innerWidth = 390
    mountField({ modelValue: 'སངས་རྒྱས་', typedWylie: 'sangs rgyas' })
    const typed = wrapper.get('[data-testid="lookup-typed"]')
    expect(typed.text()).toBe('typed sangs rgyas')
  })

  it('should show how the input was read', () => {
    mountField({ modelValue: 'བཅོམ་', readAs: 'Wylie bcom → བཅོམ་ · 5 terms' })
    expect(wrapper.get('[data-testid="lookup-read-as"]').text()).toBe('Wylie bcom → བཅོམ་ · 5 terms')
  })

  it('should show nothing under the field when there is nothing to say', () => {
    mountField()
    expect(wrapper.find('[data-testid="lookup-typed"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="lookup-read-as"]').exists()).toBe(false)
  })

  it('should carry no mode switch, no Advanced and no query builder', () => {
    mountField({ modelValue: 'ཀ་' })
    expect(wrapper.find('[data-testid="lookup-mode"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="lookup-advanced"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="search-builder"]').exists()).toBe(false)
  })

  it('should pass keys on and clear', async () => {
    mountField({ modelValue: 'ཀ་' })
    await input().trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('keydown')).toHaveLength(1)
    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('should carry a placeholder and a search key', () => {
    mountField()
    expect(input().attributes('placeholder')).toBe('Type Tibetan or Wylie')
    expect(input().attributes('enterkeyhint')).toBe('search')
  })
})
