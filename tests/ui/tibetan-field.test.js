/**
 * UiTibetanField, which replaced TibetanTextField (a v-text-field).
 *
 * Wylie conversion, legacy paste repair, caret-aware insertion, multi-line
 * paste and the keyboard rules. tests/legacy-paste-wiring.test.js pins the
 * paste paths in more detail.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import UiTibetanField from '../../src/ui/UiTibetanField.vue'

const CHOGYAL_SANGS_RGYAS = '<$<-{<-' // སངས་རྒྱས་ in the TibetanChogyal encoding

beforeAll(async () => {
  const { convertLegacyPaste } = await import('../../src/services/legacy-to-unicode.js')
  await convertLegacyPaste({ text: CHOGYAL_SANGS_RGYAS })
})

const mountField = (props = {}) => mount(UiTibetanField, { props: { modelValue: '', ...props } })

function pasteEvent({ text = '', html = '' } = {}) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  event.clipboardData = { getData: (type) => (type === 'text/html' ? html : text) }
  return event
}

async function settle(wrapper, event) {
  for (let attempt = 0; attempt < 10; attempt++) {
    await flushPromises()
    if (wrapper.emitted(event)) return
  }
}

async function paste(wrapper, clipboard) {
  wrapper.find('input').element.dispatchEvent(pasteEvent(clipboard))
  await settle(wrapper, 'update:modelValue')
  return wrapper.emitted('update:modelValue')?.at(-1)?.[0]
}

describe('UiTibetanField', () => {
  it('should render a Tibetan text field with its label, placeholder and error', () => {
    const wrapper = mountField({ label: 'Tibetan term', error: 'A Tibetan term is required.' })
    expect(wrapper.find('[data-testid="ui-tibetan-field"]').classes()).toContain('ui-field--tibetan')
    expect(wrapper.find('label').text()).toBe('Tibetan term')
    expect(wrapper.find('input').attributes('placeholder')).toBe('བོད་ཡིག་')
    expect(wrapper.text()).toContain('A Tibetan term is required.')
  })

  it('should convert Wylie when a space is typed', async () => {
    const wrapper = mountField()
    const input = wrapper.find('input')
    await input.setValue('sangs rgyas ')
    await input.trigger('keyup', { key: ' ' })
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toBe('སངས་རྒྱས་')
  })

  it('should leave Wylie alone while letters are typed', async () => {
    const wrapper = mountField()
    const input = wrapper.find('input')
    await input.setValue('sang')
    await input.trigger('keyup', { key: 'g' })
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toBe('sang')
  })

  it('should refuse a second trailing tsheg', async () => {
    const wrapper = mountField({ modelValue: 'ཀ་' })
    const event = new KeyboardEvent('keydown', { key: '་', cancelable: true })
    wrapper.find('input').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('keydown')).toBeFalsy()
  })

  it('should pass other keys on as keydown', async () => {
    const wrapper = mountField({ modelValue: 'ཀ་' })
    await wrapper.find('input').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('keydown')).toHaveLength(1)
  })

  it('should repair text pasted in a legacy Tibetan font', async () => {
    expect(await paste(mountField(), { text: CHOGYAL_SANGS_RGYAS })).toBe('སངས་རྒྱས་')
  })

  it('should convert a pasted Wylie term', async () => {
    expect(await paste(mountField(), { text: 'sangs rgyas' })).toBe('སངས་རྒྱས་')
  })

  it('should insert a paste at the caret', async () => {
    const wrapper = mountField({ modelValue: 'ཨ་' })
    const input = wrapper.find('input')
    input.element.setSelectionRange(2, 2)
    input.element.dispatchEvent(pasteEvent({ text: CHOGYAL_SANGS_RGYAS }))
    await settle(wrapper, 'update:modelValue')
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toBe('ཨ་སངས་རྒྱས་')
  })

  it('should emit paste:multiple for a multi-line paste', async () => {
    const wrapper = mountField()
    wrapper.find('input').element.dispatchEvent(pasteEvent({ text: 'sangs rgyas\nbde legs' }))
    await settle(wrapper, 'paste:multiple')
    expect(wrapper.emitted('paste:multiple')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')).toBeFalsy()
  })

  it('should drop a space an Android keyboard adds after a tsheg', async () => {
    const wrapper = mountField()
    await wrapper.find('input').setValue('ཀ་ ')
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.text).toBe('ཀ་')
  })
})
