/**
 * ResizableDivider.vue: the bars between Split's panes (R1–R3 in
 * docs/redesign/reports/split.md).
 */

import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ResizableDivider from '../src/components/ResizableDivider.vue'

let wrapper

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

function mouse(type, x, y) {
  return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true })
}

describe('ResizableDivider', () => {
  it('should expose its position, as a focusable separator must', () => {
    wrapper = mount(ResizableDivider, { props: { value: 24.6, min: 15, max: 70 } })
    expect(wrapper.attributes('aria-valuenow')).toBe('25')
    expect(wrapper.attributes('aria-valuemin')).toBe('15')
    expect(wrapper.attributes('aria-valuemax')).toBe('70')
  })

  it('should emit the vertical distance dragged by a horizontal bar, step by step', async () => {
    wrapper = mount(ResizableDivider, { props: { direction: 'horizontal' } })

    await wrapper.trigger('mousedown', { clientX: 0, clientY: 100 })
    document.dispatchEvent(mouse('mousemove', 50, 130))
    document.dispatchEvent(mouse('mousemove', 50, 120))
    document.dispatchEvent(mouse('mouseup', 50, 120))
    document.dispatchEvent(mouse('mousemove', 50, 200))

    expect(wrapper.emitted('resize')).toEqual([[30], [-10]])
  })

  it('should emit the horizontal distance dragged by a vertical bar', async () => {
    wrapper = mount(ResizableDivider, { props: { direction: 'vertical' } })

    await wrapper.trigger('mousedown', { clientX: 300, clientY: 0 })
    document.dispatchEvent(mouse('mousemove', 340, 90))
    document.dispatchEvent(mouse('mouseup', 340, 90))

    expect(wrapper.emitted('resize')).toEqual([[40]])
  })

  it('should follow a touch drag', async () => {
    wrapper = mount(ResizableDivider, { props: { direction: 'horizontal' } })

    await wrapper.trigger('touchstart', { touches: [{ clientX: 0, clientY: 10 }] })
    const move = new Event('touchmove')
    move.touches = [{ clientX: 0, clientY: 35 }]
    document.dispatchEvent(move)
    document.dispatchEvent(new Event('touchend'))

    expect(wrapper.emitted('resize')).toEqual([[25]])
  })

  it('should show the resize cursor on the whole page and stop text selection while dragging', async () => {
    wrapper = mount(ResizableDivider, { props: { direction: 'vertical' } })

    await wrapper.trigger('mousedown', { clientX: 0, clientY: 0 })
    expect(document.body.style.cursor).toBe('col-resize')
    expect(document.body.style.userSelect).toBe('none')
    expect(wrapper.classes()).toContain('dragging')

    document.dispatchEvent(mouse('mouseup', 0, 0))
    await wrapper.vm.$nextTick()
    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')
    expect(wrapper.classes()).not.toContain('dragging')
  })

  it('should be a focusable separator with its orientation and label', () => {
    wrapper = mount(ResizableDivider, { props: { direction: 'vertical', label: 'Resize the terms' } })

    expect(wrapper.attributes('role')).toBe('separator')
    expect(wrapper.attributes('tabindex')).toBe('0')
    expect(wrapper.attributes('aria-orientation')).toBe('vertical')
    expect(wrapper.attributes('aria-label')).toBe('Resize the terms')
  })

  it('should move with the arrow keys of its axis only, without letting them reach the page', async () => {
    wrapper = mount(ResizableDivider, { props: { direction: 'horizontal' }, attachTo: document.body })
    let reachedDocument = 0
    const listener = () => reachedDocument++
    document.addEventListener('keydown', listener)

    for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft'])
      wrapper.element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

    document.removeEventListener('keydown', listener)
    expect(wrapper.emitted('resize')).toEqual([[16], [-16]])
    // ArrowLeft is not this bar's axis, so it goes through
    expect(reachedDocument).toBe(1)
  })

  it('should use Left/Right when vertical', async () => {
    wrapper = mount(ResizableDivider, { props: { direction: 'vertical' } })

    await wrapper.trigger('keydown', { key: 'ArrowRight' })
    await wrapper.trigger('keydown', { key: 'ArrowLeft' })
    await wrapper.trigger('keydown', { key: 'ArrowDown' })

    expect(wrapper.emitted('resize')).toEqual([[16], [-16]])
  })

  it('should stop listening when removed in the middle of a drag', async () => {
    const resized = []
    wrapper = mount(ResizableDivider, { props: { direction: 'horizontal', onResize: (delta) => resized.push(delta) } })
    await wrapper.trigger('mousedown', { clientX: 0, clientY: 0 })
    wrapper.unmount()
    wrapper = undefined

    document.dispatchEvent(mouse('mousemove', 0, 50))
    expect(document.body.style.cursor).toBe('')
    expect(resized).toEqual([])
  })
})
