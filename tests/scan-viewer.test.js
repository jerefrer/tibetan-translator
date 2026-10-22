/**
 * The scan viewer opened by "View scan" (Define, Search). Jäschke's scan
 * info: pages 3 to 697, displayed 26 lower than stored.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

vi.mock('../src/services/scan-service', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getScanUrl: vi.fn(async (scanId, page) => `https://example.org/${scanId}/${page}.png`),
  }
})

import ScanViewer from '../src/components/ScanViewer.vue'

let wrapper
const body = (testid) => document.body.querySelector(`[data-testid="${testid}"]`)

async function open(props = {}) {
  wrapper = mount(ScanViewer, {
    props: { modelValue: true, dictionaryId: 'Jaeschke_Scan', initialPage: 505, ...props },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('ScanViewer', () => {
  it('should render nothing while closed', async () => {
    await open({ modelValue: false })
    expect(body('scan-viewer')).toBeNull()
  })

  it('should title the page with the dictionary name and the displayed page number', async () => {
    await open()
    expect(body('scan-title').textContent).toBe('Jäschke · Page 479')
  })

  it('should say the page is approximate only on the page the entry pointed to', async () => {
    await open({ approximate: true })
    expect(body('scan-approximate')).not.toBeNull()

    body('scan-next').click()
    await flushPromises()

    expect(body('scan-approximate')).toBeNull()
    expect(body('scan-title').textContent).toBe('Jäschke · Page 480')
  })

  it('should load the image of the current page, then hide the spinner', async () => {
    await open()
    const img = document.body.querySelector('img.scan-image')
    expect(img.getAttribute('src')).toMatch(/\/505\.png\?_t=\d+$/)
    expect(body('scan-loading')).not.toBeNull()

    img.dispatchEvent(new Event('load'))
    await nextTick()

    expect(body('scan-loading')).toBeNull()
  })

  it('should show an error with Retry when the image fails, and load again on Retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await open()
    document.body.querySelector('img.scan-image').dispatchEvent(new Event('error'))
    await nextTick()

    expect(body('scan-error').textContent).toContain('Failed to load image')

    body('scan-retry').click()
    await flushPromises()

    expect(body('scan-error')).toBeNull()
    expect(body('scan-loading')).not.toBeNull()
  })

  it('should go to the previous and next page, and stop at both ends', async () => {
    await open({ initialPage: 3 })
    expect(body('scan-prev').disabled).toBe(true)

    body('scan-next').click()
    await flushPromises()
    expect(wrapper.vm.currentPage).toBe(4)

    body('scan-prev').click()
    await flushPromises()
    expect(wrapper.vm.currentPage).toBe(3)

    wrapper.unmount()
    document.body.innerHTML = ''
    await open({ initialPage: 697 })
    expect(body('scan-next').disabled).toBe(true)
  })

  it('should open at the first page when the entry has no page', async () => {
    await open({ initialPage: null })
    expect(wrapper.vm.currentPage).toBe(3)
  })

  it('should zoom in and out between 100% and 400%, and reset the zoom on a page change', async () => {
    await open()
    expect(body('scan-zoom').textContent).toBe('100%')
    expect(body('scan-zoom-out').disabled).toBe(true)

    body('scan-zoom-in').click()
    await nextTick()
    expect(body('scan-zoom').textContent).toBe('150%')

    for (let i = 0; i < 5; i++) body('scan-zoom-in').click()
    await nextTick()
    expect(body('scan-zoom').textContent).toBe('400%')
    expect(body('scan-zoom-in').disabled).toBe(true)

    body('scan-next').click()
    await flushPromises()
    expect(body('scan-zoom').textContent).toBe('100%')
  })

  it('should answer the keyboard: arrows turn pages, + - 0 zoom', async () => {
    await open()
    const key = (name) => wrapper.vm.handleKeydown({ key: name })

    key('ArrowRight')
    await flushPromises()
    expect(wrapper.vm.currentPage).toBe(506)
    key('ArrowLeft')
    await flushPromises()
    expect(wrapper.vm.currentPage).toBe(505)

    key('+')
    expect(wrapper.vm.scale).toBe(1.5)
    key('-')
    expect(wrapper.vm.scale).toBe(1)
    key('=')
    key('0')
    expect(wrapper.vm.scale).toBe(1)
  })

  it('should turn the page on a horizontal swipe, but not when zoomed in', async () => {
    await open()
    const swipe = (fromX, toX) => {
      wrapper.vm.onTouchStart({ touches: [{ clientX: fromX, clientY: 100 }] })
      wrapper.vm.onTouchEnd({ changedTouches: [{ clientX: toX, clientY: 100 }] })
    }

    swipe(300, 100)
    await flushPromises()
    expect(wrapper.vm.currentPage).toBe(506)

    wrapper.vm.zoomIn()
    swipe(300, 100)
    await flushPromises()
    expect(wrapper.vm.currentPage).toBe(506)
  })

  it('should take the focus when it opens, so Tab stays inside it', async () => {
    await open()
    await new Promise((r) => setTimeout(r, 0))
    await flushPromises()
    expect(document.activeElement).toBe(body('scan-viewer'))
  })

  it('should close from its close button', async () => {
    await open()
    body('scan-close').click()
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
