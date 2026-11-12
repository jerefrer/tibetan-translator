/**
 * UiResizeHandle: the divider between two panes, dragged with the pointer or
 * moved with the arrow keys, emitting the width of the pane it resizes.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import UiResizeHandle from '../../src/ui/UiResizeHandle.vue'

function mountHandle(props = {}) {
  return mount(UiResizeHandle, {
    props: { modelValue: 400, min: 300, max: 600, label: 'Resize the results', ...props },
  })
}

const pointer = (type, clientX) => new PointerEvent(type, { clientX, pointerId: 1, bubbles: true })
const lastWidth = (wrapper) => wrapper.emitted('update:modelValue').at(-1)[0]

async function drag(wrapper, from, to) {
  const handle = wrapper.find('[data-testid="ui-resize-handle"]').element
  handle.dispatchEvent(pointer('pointerdown', from))
  handle.dispatchEvent(pointer('pointermove', to))
  handle.dispatchEvent(pointer('pointerup', to))
  await wrapper.vm.$nextTick()
}

describe('UiResizeHandle', () => {
  it('should widen the pane before it when dragged to the right', async () => {
    const wrapper = mountHandle()
    await drag(wrapper, 500, 560)
    expect(lastWidth(wrapper)).toBe(460)
  })

  it('should widen the pane after it when dragged to the left', async () => {
    const wrapper = mountHandle({ pane: 'after' })
    await drag(wrapper, 500, 440)
    expect(lastWidth(wrapper)).toBe(460)
  })

  it('should keep the width between its bounds', async () => {
    const wrapper = mountHandle()
    await drag(wrapper, 500, 1500)
    expect(lastWidth(wrapper)).toBe(600)
    await drag(wrapper, 500, 0)
    expect(lastWidth(wrapper)).toBe(300)
  })

  it('should ignore pointer moves once released', async () => {
    const wrapper = mountHandle()
    await drag(wrapper, 500, 520)
    wrapper.find('[data-testid="ui-resize-handle"]').element.dispatchEvent(pointer('pointermove', 900))
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
  })

  it('should move by 16px with the arrow keys, towards the pane it resizes', async () => {
    const wrapper = mountHandle({ pane: 'after' })
    const handle = wrapper.find('[data-testid="ui-resize-handle"]')
    await handle.trigger('keydown', { key: 'ArrowLeft' })
    expect(lastWidth(wrapper)).toBe(416)
    await handle.trigger('keydown', { key: 'ArrowRight' })
    expect(lastWidth(wrapper)).toBe(384)
  })

  it('should jump to its bounds with Home and End', async () => {
    const wrapper = mountHandle()
    const handle = wrapper.find('[data-testid="ui-resize-handle"]')
    await handle.trigger('keydown', { key: 'Home' })
    expect(lastWidth(wrapper)).toBe(300)
    await handle.trigger('keydown', { key: 'End' })
    expect(lastWidth(wrapper)).toBe(600)
  })

  it('should start from the width the pane has when none was chosen yet', async () => {
    const wrapper = mount(
      { template: '<div><aside style="width: 380px" /><ui-resize-handle :model-value="null" :min="300" :max="600" @update:model-value="$emit(\'width\', $event)" /></div>', components: { UiResizeHandle } },
      { attachTo: document.body },
    )
    const aside = wrapper.find('aside').element
    Object.defineProperty(aside, 'offsetWidth', { value: 380 })
    await wrapper.find('[data-testid="ui-resize-handle"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('width').at(-1)[0]).toBe(396)
    wrapper.unmount()
  })

  it('should leave the rest of the parent at least its reserve', async () => {
    const wrapper = mount(
      { template: '<div><aside /><ui-resize-handle :model-value="400" :min="300" :reserve="420" @update:model-value="$emit(\'width\', $event)" /></div>', components: { UiResizeHandle } },
      { attachTo: document.body },
    )
    Object.defineProperty(wrapper.element, 'clientWidth', { value: 1000 })
    await wrapper.find('[data-testid="ui-resize-handle"]').trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('width').at(-1)[0]).toBe(580)
    wrapper.unmount()
  })

  it('should ask for the default width on a double-click', async () => {
    const wrapper = mountHandle()
    await wrapper.find('[data-testid="ui-resize-handle"]').trigger('dblclick')
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('should be a focusable vertical separator carrying its value and bounds', () => {
    const handle = mountHandle().find('[data-testid="ui-resize-handle"]')
    expect(handle.attributes()).toMatchObject({
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-valuenow': '400',
      'aria-valuemin': '300',
      'aria-valuemax': '600',
      'aria-label': 'Resize the results',
      tabindex: '0',
    })
  })
})
