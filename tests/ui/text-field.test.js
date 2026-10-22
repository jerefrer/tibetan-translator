import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiTextField from '../../src/ui/UiTextField.vue'

describe('UiTextField', () => {
  it('should show the value and emit update:modelValue while typing', async () => {
    const wrapper = mount(UiTextField, { props: { modelValue: 'ye' } })
    const input = wrapper.get('[data-testid="ui-text-field-input"]')
    expect(input.element.value).toBe('ye')
    await input.setValue('ye shes')
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['ye shes'])
  })

  it('should link the label to the input', () => {
    const wrapper = mount(UiTextField, { props: { label: 'Term' } })
    const label = wrapper.get('label')
    expect(wrapper.get('input').attributes('id')).toBe(label.attributes('for'))
  })

  it('should clear and emit clear when the clear button is pressed', async () => {
    const wrapper = mount(UiTextField, { props: { modelValue: 'abc', clearable: true } })
    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([''])
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('should not offer to clear an empty field', () => {
    const wrapper = mount(UiTextField, { props: { modelValue: '', clearable: true } })
    expect(wrapper.find('[data-testid="ui-text-field-clear"]').exists()).toBe(false)
  })

  it('should flag an invalid field and describe it with the error message', () => {
    const wrapper = mount(UiTextField, { props: { error: 'Required' } })
    const input = wrapper.get('input')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('[data-testid="ui-text-field-message"]').text()).toBe('Required')
    expect(input.attributes('aria-describedby')).toBe(
      wrapper.get('[data-testid="ui-text-field-message"]').attributes('id')
    )
  })

  it('should put unknown attributes on the input and data-testid on the wrapper', () => {
    const wrapper = mount(UiTextField, {
      attrs: { placeholder: 'Search', 'data-testid': 'term-field' },
    })
    expect(wrapper.attributes('data-testid')).toBe('term-field')
    expect(wrapper.get('input').attributes('placeholder')).toBe('Search')
  })

  it('should render a textarea when multiline', () => {
    const wrapper = mount(UiTextField, { props: { multiline: true, rows: 4 } })
    expect(wrapper.find('textarea').attributes('rows')).toBe('4')
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('should switch to the Tibetan style', () => {
    expect(mount(UiTextField, { props: { tibetan: true } }).classes()).toContain('ui-field--tibetan')
  })

  it('should disable the input', () => {
    expect(mount(UiTextField, { props: { disabled: true } }).get('input').attributes('disabled')).toBeDefined()
  })
})
