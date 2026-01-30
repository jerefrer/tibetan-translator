/**
 * Test Setup
 *
 * Global mocks and configuration for Vitest tests.
 */

import { vi, beforeEach } from 'vitest'

// Create a fresh localStorage mock that properly tracks state
function createLocalStorageMock() {
  let store = {}
  return {
    getItem(key) {
      return store[key] !== undefined ? store[key] : null
    },
    setItem(key, value) {
      store[key] = String(value)
    },
    removeItem(key) {
      delete store[key]
    },
    clear() {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key(i) {
      return Object.keys(store)[i] || null
    },
    // For testing - direct store access
    get _store() {
      return store
    },
  }
}

// Create initial mock
const localStorageMock = createLocalStorageMock()

// Override the global localStorage
// Note: happy-dom provides localStorage, so we need to fully replace it
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

// Also set on window if it exists
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  })
}

// Mock document.cookie
let cookieStore = ''
Object.defineProperty(document, 'cookie', {
  get: () => cookieStore,
  set: (value) => {
    const [cookiePart] = value.split(';')
    const [key] = cookiePart.split('=')
    const cookies = cookieStore.split('; ').filter((c) => c && !c.startsWith(key + '='))
    if (!value.includes('expires=Thu, 01 Jan 1970')) {
      cookies.push(cookiePart)
    }
    cookieStore = cookies.filter(Boolean).join('; ')
  },
  configurable: true,
})

// Mock window.innerWidth for mobile detection
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
})

// Mock window event listeners
const eventListeners = new Map()
const originalAddEventListener = window.addEventListener
const originalRemoveEventListener = window.removeEventListener

window.addEventListener = vi.fn((event, handler, options) => {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set())
  }
  eventListeners.get(event).add(handler)
})

window.removeEventListener = vi.fn((event, handler, options) => {
  if (eventListeners.has(event)) {
    eventListeners.get(event).delete(handler)
  }
})

// Helper to trigger events in tests
window._triggerEvent = (event, data) => {
  if (eventListeners.has(event)) {
    eventListeners.get(event).forEach((handler) => handler(data))
  }
}

window._clearEventListeners = () => {
  eventListeners.clear()
}

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback
    this.options = options
    this.elements = new Set()
  }
  observe(element) {
    this.elements.add(element)
  }
  unobserve(element) {
    this.elements.delete(element)
  }
  disconnect() {
    this.elements.clear()
  }
  // Helper for tests to trigger intersection
  _trigger(isIntersecting) {
    const entries = Array.from(this.elements).map((element) => ({
      isIntersecting,
      target: element,
      intersectionRatio: isIntersecting ? 1 : 0,
    }))
    if (entries.length > 0) {
      this.callback(entries)
    }
  }
}

window.IntersectionObserver = MockIntersectionObserver

// Mock Tauri API
window.__TAURI__ = undefined
window.__TAURI_INTERNALS__ = undefined

// Reset state before each test
beforeEach(() => {
  // Clear localStorage
  localStorageMock.clear()
  // Clear cookies
  cookieStore = ''
  // Clear event listeners
  window._clearEventListeners()
  // Reset innerWidth
  window.innerWidth = 1024
  // Clear mock call history but keep implementations
  vi.clearAllMocks()
})
