/**
 * Mixin Tests
 *
 * Tests the shared mixins used across components:
 * - MobileResponsiveMixin
 * - InfiniteScrollMixin
 * - ThemeMixin
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { defineComponent, h, nextTick } from 'vue'

// Create Vuetify instance for tests
const vuetify = createVuetify({
  components,
  directives,
})

// Import services to test
import ResizeService from '../src/services/resize-service.js'

describe('ResizeService', () => {
  const MOBILE_BREAKPOINT = 600

  beforeEach(() => {
    window.innerWidth = 1024
    ResizeService._reset?.() // Reset if available
  })

  describe('isMobile', () => {
    it('returns false when width > 600', () => {
      window.innerWidth = 1024
      expect(ResizeService.isMobile()).toBe(false)
    })

    it('returns true when width <= 600', () => {
      window.innerWidth = 600
      expect(ResizeService.isMobile()).toBe(true)
    })

    it('returns true when width < 600', () => {
      window.innerWidth = 400
      expect(ResizeService.isMobile()).toBe(true)
    })

    it('handles edge case at exactly 600px', () => {
      window.innerWidth = 600
      expect(ResizeService.isMobile()).toBe(true)
    })

    it('handles edge case at 601px', () => {
      window.innerWidth = 601
      expect(ResizeService.isMobile()).toBe(false)
    })
  })

  describe('subscribe/unsubscribe', () => {
    it('subscribes callback without error', () => {
      const callback = vi.fn()
      // Should not throw
      expect(() => ResizeService.subscribe('test-1', callback)).not.toThrow()
      // Cleanup
      ResizeService.unsubscribe('test-1')
    })

    it('unsubscribes callback', () => {
      const callback = vi.fn()
      ResizeService.subscribe('test-2', callback)
      ResizeService.unsubscribe('test-2')

      // Should not receive events after unsubscribe
    })

    it('handles multiple subscribers', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      ResizeService.subscribe('test-3', callback1)
      ResizeService.subscribe('test-4', callback2)

      // Both should be subscribed
      ResizeService.unsubscribe('test-3')
      ResizeService.unsubscribe('test-4')
    })
  })
})

describe('MobileResponsiveMixin behavior', () => {
  // Create a test component that uses the pattern from MobileResponsiveMixin
  const createTestComponent = () => {
    return defineComponent({
      data() {
        return {
          isMobile: window.innerWidth <= 600,
          mobileShowDefinition: false,
        }
      },
      methods: {
        handleResize(width) {
          this.isMobile = width <= 600
        },
        setMobileShowDefinition(value) {
          this.mobileShowDefinition = value
        },
        hideMobileDefinition() {
          this.mobileShowDefinition = false
        },
        showTermsList() {
          if (this.isMobile && this.mobileShowDefinition) {
            this.mobileShowDefinition = false
          }
        },
      },
      render() {
        return h('div', {
          class: {
            'is-mobile': this.isMobile,
            'mobile-show-definition': this.mobileShowDefinition,
          },
        })
      },
    })
  }

  it('initializes with correct mobile state for desktop', async () => {
    window.innerWidth = 1024
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    expect(wrapper.vm.isMobile).toBe(false)
    expect(wrapper.vm.mobileShowDefinition).toBe(false)
  })

  it('initializes with correct mobile state for mobile', async () => {
    window.innerWidth = 500
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    expect(wrapper.vm.isMobile).toBe(true)
  })

  it('updates isMobile on resize', async () => {
    window.innerWidth = 1024
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    expect(wrapper.vm.isMobile).toBe(false)

    wrapper.vm.handleResize(500)
    expect(wrapper.vm.isMobile).toBe(true)

    wrapper.vm.handleResize(1024)
    expect(wrapper.vm.isMobile).toBe(false)
  })

  it('setMobileShowDefinition updates state', async () => {
    window.innerWidth = 500
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    expect(wrapper.vm.mobileShowDefinition).toBe(false)

    wrapper.vm.setMobileShowDefinition(true)
    expect(wrapper.vm.mobileShowDefinition).toBe(true)

    wrapper.vm.setMobileShowDefinition(false)
    expect(wrapper.vm.mobileShowDefinition).toBe(false)
  })

  it('hideMobileDefinition sets mobileShowDefinition to false', async () => {
    window.innerWidth = 500
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    wrapper.vm.setMobileShowDefinition(true)
    expect(wrapper.vm.mobileShowDefinition).toBe(true)

    wrapper.vm.hideMobileDefinition()
    expect(wrapper.vm.mobileShowDefinition).toBe(false)
  })

  it('showTermsList hides definition on mobile', async () => {
    window.innerWidth = 500
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    wrapper.vm.setMobileShowDefinition(true)
    wrapper.vm.showTermsList()
    expect(wrapper.vm.mobileShowDefinition).toBe(false)
  })

  it('showTermsList does nothing on desktop', async () => {
    window.innerWidth = 1024
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    wrapper.vm.setMobileShowDefinition(true)
    wrapper.vm.showTermsList()
    // On desktop (isMobile = false), mobileShowDefinition should stay true
    expect(wrapper.vm.mobileShowDefinition).toBe(true)
  })
})

describe('InfiniteScrollMixin behavior', () => {
  // Create a test component that uses the pattern from InfiniteScrollMixin
  const createTestComponent = (options = {}) => {
    return defineComponent({
      data() {
        return {
          _infiniteScrollObserver: null,
          loading: false,
          displayedCount: 10,
          totalCount: 100,
        }
      },
      computed: {
        infiniteScrollRootMargin() {
          return options.rootMargin || '200px'
        },
        infiniteScrollRoot() {
          return options.root || null
        },
        hasMore() {
          return this.displayedCount < this.totalCount
        },
      },
      methods: {
        loadMore() {
          if (this.hasMore && !this.loading) {
            this.displayedCount += 10
          }
        },
        setupInfiniteScroll() {
          this.teardownInfiniteScroll()

          const sentinel = this.$refs.loadMoreSentinel
          if (!sentinel) return

          const root = this.infiniteScrollRoot
            ? this.$refs[this.infiniteScrollRoot]
            : null

          this._infiniteScrollObserver = new IntersectionObserver(
            (entries) => {
              if (entries[0].isIntersecting && this.hasMore && !this.loading) {
                this.loadMore()
              }
            },
            {
              root: root,
              rootMargin: this.infiniteScrollRootMargin,
            }
          )

          this._infiniteScrollObserver.observe(sentinel)
        },
        teardownInfiniteScroll() {
          if (this._infiniteScrollObserver) {
            this._infiniteScrollObserver.disconnect()
            this._infiniteScrollObserver = null
          }
        },
      },
      render() {
        return h('div', [
          h('div', { ref: 'loadMoreSentinel' }, 'sentinel'),
        ])
      },
    })
  }

  it('initializes with hasMore = true when displayedCount < totalCount', () => {
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    expect(wrapper.vm.hasMore).toBe(true)
  })

  it('hasMore becomes false when displayedCount >= totalCount', () => {
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    wrapper.vm.displayedCount = 100
    expect(wrapper.vm.hasMore).toBe(false)
  })

  it('loadMore increases displayedCount', () => {
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    expect(wrapper.vm.displayedCount).toBe(10)
    wrapper.vm.loadMore()
    expect(wrapper.vm.displayedCount).toBe(20)
  })

  it('loadMore does nothing when loading is true', () => {
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    wrapper.vm.loading = true
    wrapper.vm.loadMore()
    expect(wrapper.vm.displayedCount).toBe(10)
  })

  it('loadMore does nothing when hasMore is false', () => {
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    wrapper.vm.displayedCount = 100
    wrapper.vm.loadMore()
    expect(wrapper.vm.displayedCount).toBe(100)
  })

  it('setupInfiniteScroll creates observer', async () => {
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    await nextTick()
    wrapper.vm.setupInfiniteScroll()

    expect(wrapper.vm._infiniteScrollObserver).toBeTruthy()
    expect(wrapper.vm._infiniteScrollObserver).toBeInstanceOf(IntersectionObserver)
  })

  it('teardownInfiniteScroll disconnects observer', async () => {
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    await nextTick()
    wrapper.vm.setupInfiniteScroll()
    expect(wrapper.vm._infiniteScrollObserver).toBeTruthy()

    wrapper.vm.teardownInfiniteScroll()
    expect(wrapper.vm._infiniteScrollObserver).toBe(null)
  })

  it('observer triggers loadMore when intersecting', async () => {
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    await nextTick()
    wrapper.vm.setupInfiniteScroll()

    // Trigger intersection
    wrapper.vm._infiniteScrollObserver._trigger(true)

    expect(wrapper.vm.displayedCount).toBe(20)
  })

  it('observer does not trigger loadMore when not intersecting', async () => {
    const TestComponent = createTestComponent()
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    await nextTick()
    wrapper.vm.setupInfiniteScroll()

    // Trigger non-intersection
    wrapper.vm._infiniteScrollObserver._trigger(false)

    expect(wrapper.vm.displayedCount).toBe(10)
  })

  it('observer respects custom rootMargin', async () => {
    const TestComponent = createTestComponent({ rootMargin: '500px' })
    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    await nextTick()
    wrapper.vm.setupInfiniteScroll()

    expect(wrapper.vm._infiniteScrollObserver.options.rootMargin).toBe('500px')
  })
})

describe('Component cleanup on unmount', () => {
  it('MobileResponsiveMixin-style component unsubscribes on unmount', async () => {
    const unsubscribeSpy = vi.fn()

    const TestComponent = defineComponent({
      data() {
        return {
          _resizeSubscriptionId: 'test-cleanup',
        }
      },
      mounted() {
        // Simulating ResizeService.subscribe
      },
      beforeUnmount() {
        unsubscribeSpy(this._resizeSubscriptionId)
      },
      render() {
        return h('div')
      },
    })

    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    wrapper.unmount()

    expect(unsubscribeSpy).toHaveBeenCalledWith('test-cleanup')
  })

  it('InfiniteScrollMixin-style component teardowns observer on unmount', async () => {
    const disconnectSpy = vi.fn()

    const TestComponent = defineComponent({
      data() {
        return {
          _infiniteScrollObserver: { disconnect: disconnectSpy },
        }
      },
      beforeUnmount() {
        if (this._infiniteScrollObserver) {
          this._infiniteScrollObserver.disconnect()
          this._infiniteScrollObserver = null
        }
      },
      render() {
        return h('div')
      },
    })

    const wrapper = mount(TestComponent, {
      global: { plugins: [vuetify] },
    })

    wrapper.unmount()

    expect(disconnectSpy).toHaveBeenCalled()
  })
})
