/**
 * UiSegmented: a radio group drawn as a segmented control (the བོད / EN
 * switch of Lookup).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UiSegmented from '../../src/ui/UiSegmented.vue'

const OPTIONS = [
  { value: 'bo', label: 'བོད', ariaLabel: 'Tibetan', tibetan: true },
  { value: 'en', label: 'EN', ariaLabel: 'English' },
]

let wrapper
const mountSegmented = (modelValue = 'bo') => {
  wrapper = mount(UiSegmented, {
    props: { modelValue, options: OPTIONS, label: 'Typing' },
    attachTo: document.body,
  })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('UiSegmented', () => {
  it('should mark the chosen option checked', () => {
    mountSegmented('bo')
    const group = wrapper.get('[role="radiogroup"]')
    expect(group.attributes('aria-label')).toBe('Typing')
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual(['true', 'false'])
    expect(radios.map((radio) => radio.attributes('aria-label'))).toEqual(['Tibetan', 'English'])
    expect(radios.map((radio) => radio.attributes('tabindex'))).toEqual(['0', '-1'])
    expect(radios[0].classes()).toContain('ui-segmented__option--tibetan')
  })

  it('should emit the option clicked', async () => {
    mountSegmented('bo')
    await wrapper.findAll('[role="radio"]')[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['en']])
  })

  it('should move with the arrow keys', async () => {
    mountSegmented('bo')
    const radios = wrapper.findAll('[role="radio"]')
    await radios[0].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['en'])
    expect(document.activeElement).toBe(radios[1].element)

    await wrapper.setProps({ modelValue: 'en' })
    await radios[1].trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['bo'])
    expect(document.activeElement).toBe(radios[0].element)
  })
})
