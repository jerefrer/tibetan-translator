/**
 * Back and Forward: which locations are entries, when the arrows can go, and
 * how historyState follows the router. createMemoryHistory writes no
 * window.history.state, so trackHistory is fed by replacing that property.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'

import {
  goBack,
  goForward,
  historyState,
  isEntryLocation,
  trackHistory,
} from '../src/services/navigation-history'

const stub = { template: '<div />' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: ['/a', '/b'].map((path) => ({ path, component: stub })),
  })
}

let fakeState
const original = Object.getOwnPropertyDescriptor(window.history, 'state')

function stubWindowState(state) {
  fakeState = state
  Object.defineProperty(window.history, 'state', { configurable: true, get: () => fakeState })
}

beforeEach(() => {
  historyState.back = null
  historyState.forward = null
})

afterEach(() => {
  delete window.history.state
  if (original) Object.defineProperty(window.history, 'state', original)
})

describe('isEntryLocation', () => {
  it('should be true when the location is a Lookup term', () => {
    expect(isEntryLocation('/lookup/' + encodeURIComponent('ཀ་'))).toBe(true)
  })

  it('should be false when the location is a bare Lookup', () => {
    expect(isEntryLocation('/lookup')).toBe(false)
  })

  it('should be true when the location is Search with an open term', () => {
    expect(isEntryLocation('/search?q=buddha&term=' + encodeURIComponent('ཀ་'))).toBe(true)
  })

  it('should be false when the location is Search without a term', () => {
    expect(isEntryLocation('/search?q=buddha')).toBe(false)
  })

  it('should ignore the hash when the location is a Lookup term', () => {
    expect(isEntryLocation('/lookup/abc#top')).toBe(true)
  })

  it('should ignore a term that is only in the hash when the location is Search', () => {
    expect(isEntryLocation('/search?q=x#term=y')).toBe(false)
  })

  it('should be false when the location is another page', () => {
    expect(isEntryLocation('/reader?term=x')).toBe(false)
  })

  it('should be false when the location is not a string', () => {
    expect(isEntryLocation(null)).toBe(false)
    expect(isEntryLocation(undefined)).toBe(false)
  })
})

describe('goBack and goForward', () => {
  it('should do nothing when there is nowhere to go', () => {
    const router = { back: vi.fn(), forward: vi.fn() }
    goBack(router)
    goForward(router)
    expect(router.back).not.toHaveBeenCalled()
    expect(router.forward).not.toHaveBeenCalled()
  })

  it('should call router.back when a previous place is known', () => {
    const router = { back: vi.fn(), forward: vi.fn() }
    historyState.back = '/a'
    goBack(router)
    expect(router.back).toHaveBeenCalledTimes(1)
    expect(router.forward).not.toHaveBeenCalled()
  })

  it('should call router.forward when a next place is known', () => {
    const router = { back: vi.fn(), forward: vi.fn() }
    historyState.forward = '/b'
    goForward(router)
    expect(router.forward).toHaveBeenCalledTimes(1)
    expect(router.back).not.toHaveBeenCalled()
  })
})

describe('trackHistory', () => {
  it('should read the state of the current entry when it starts', () => {
    stubWindowState({ back: '/a', forward: null })
    const stop = trackHistory(makeRouter())
    expect(historyState).toMatchObject({ back: '/a', forward: null })
    stop()
  })

  it('should mirror back and forward after a navigation', async () => {
    const router = makeRouter()
    await router.push('/a')
    stubWindowState({ back: null, forward: null })
    const stop = trackHistory(router)

    fakeState = { back: '/a', forward: '/c' }
    await router.push('/b')

    expect(historyState).toMatchObject({ back: '/a', forward: '/c' })
    stop()
  })

  it('should mirror the state on popstate', () => {
    stubWindowState({ back: null, forward: null })
    const stop = trackHistory(makeRouter())

    fakeState = { back: '/x', forward: '/y' }
    window._triggerEvent('popstate')

    expect(historyState).toMatchObject({ back: '/x', forward: '/y' })
    stop()
  })

  it('should reset to null when the entry has no usable state', () => {
    stubWindowState({ back: '/a', forward: '/b' })
    const stop = trackHistory(makeRouter())
    fakeState = null
    window._triggerEvent('popstate')
    expect(historyState).toMatchObject({ back: null, forward: null })
    stop()
  })

  it('should stop following the router and popstate when its stop function is called', async () => {
    const router = makeRouter()
    await router.push('/a')
    stubWindowState({ back: null, forward: null })
    const stop = trackHistory(router)
    stop()

    fakeState = { back: '/a', forward: '/c' }
    await router.push('/b')
    window._triggerEvent('popstate')

    expect(historyState).toMatchObject({ back: null, forward: null })
  })
})
