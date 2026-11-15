/**
 * UiCollapse: opens and closes its content in place, height and opacity
 * together, and leaves no inline style behind once done.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import UiCollapse from '../../src/ui/UiCollapse.vue'

const Host = {
  components: { UiCollapse },
  props: { open: { type: Boolean, default: false } },
  template: '<div style="display:flex;flex-direction:column;row-gap:8px"><ui-collapse><p v-if="open" class="content">Shown</p></ui-collapse></div>',
}

let wrapper

// The real transition, not test-utils' stub; in the document, so the parent's
// gap is computed
const mountHost = (open) => {
  wrapper = mount(Host, { props: { open }, attachTo: document.body, global: { stubs: { transition: false } } })
  return wrapper
}

const reduceMotion = (reduce) => {
  window.matchMedia = vi.fn(() => ({ matches: reduce }))
}

afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
  delete window.matchMedia
})

describe('UiCollapse', () => {
  it('should remove the content at once when reduced motion is asked', async () => {
    reduceMotion(true)
    mountHost(true)
    await wrapper.setProps({ open: false })
    await nextTick()
    expect(wrapper.find('.content').exists()).toBe(false)
  })

  it('should fold the content to no height, taking back the gap, before removing it', async () => {
    vi.useFakeTimers()
    reduceMotion(false)
    mountHost(true)
    await wrapper.setProps({ open: false })
    await nextTick()
    const content = wrapper.get('.content').element
    expect(content.style.height).toBe('0px')
    expect(content.style.opacity).toBe('0')
    expect(content.style.marginTop).toBe('-8px')
    vi.advanceTimersByTime(300)
    await nextTick()
    expect(wrapper.find('.content').exists()).toBe(false)
  })

  it('should leave no inline style once the content is open', async () => {
    vi.useFakeTimers()
    reduceMotion(false)
    mountHost(false)
    await wrapper.setProps({ open: true })
    await nextTick()
    vi.advanceTimersByTime(300)
    await nextTick()
    expect(wrapper.get('.content').attributes('style') || '').toBe('')
  })
})
