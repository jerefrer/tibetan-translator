import { describe, it, expect } from 'vitest'
import router from '../src/router.js'

describe('router', () => {
  it('should redirect the old glossary route, keeping pack and dictionary', async () => {
    await router.push('/lexicon/custom-a/2')
    expect(router.currentRoute.value.fullPath).toBe('/glossary/custom-a/2')
  })

  it('should redirect the bare old glossary route', async () => {
    await router.push('/lexicon')
    expect(router.currentRoute.value.path).toBe('/glossary')
  })

  it('should keep the query string when redirecting', async () => {
    await router.push('/lexicon/custom-a?x=1')
    expect(router.currentRoute.value.fullPath).toBe('/glossary/custom-a?x=1')
  })

  it('should open Lookup when the app starts at the root', async () => {
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/lookup')
  })

  it('should open Lookup on the term when an old Define link is followed', async () => {
    await router.push('/define/abc')
    const route = router.currentRoute.value
    expect(route.path).toBe('/lookup/abc')
    expect(route.query.mode).toBe('bo')
  })

  it('should open bare Lookup in Tibetan mode when the old Define page is followed', async () => {
    await router.push('/define')
    expect(router.currentRoute.value.path).toBe('/lookup')
    expect(router.currentRoute.value.query.mode).toBe('bo')
  })

  it('should keep the query and hash when an old Define link is followed', async () => {
    await router.push('/define/abc?x=1#top')
    const route = router.currentRoute.value
    expect(route.query.x).toBe('1')
    expect(route.hash).toBe('#top')
  })

  it('should open Lookup in English mode on the query when an old Search link is followed', async () => {
    await router.push('/search/bliss')
    const route = router.currentRoute.value
    expect(route.path).toBe('/lookup')
    expect(route.query).toEqual({ mode: 'en', q: 'bliss' })
  })

  it('should open Lookup in English mode when the bare old Search page is followed', async () => {
    await router.push('/search')
    const route = router.currentRoute.value
    expect(route.path).toBe('/lookup')
    expect(route.query.mode).toBe('en')
    expect(route.query.q).toBeUndefined()
  })

  it('should open the Reader when an old Split link is followed', async () => {
    await router.push('/segment')
    expect(router.currentRoute.value.path).toBe('/reader')
  })

  it('should keep the Settings page at /settings', async () => {
    await router.push('/settings')
    expect(router.currentRoute.value.fullPath).toBe('/settings')
  })

  it('should open Dictionaries, where the order now is, when the old preferences view is followed', async () => {
    // beforeEnter only runs when entering the route, not when already on it
    await router.push('/lookup')
    await router.push('/settings?view=preferences')
    const route = router.currentRoute.value
    expect(route.path).toBe('/dictionaries')
    expect(route.query.view).toBeUndefined()
  })

  it('should open Dictionaries when a link to the old dictionary order section is followed', async () => {
    await router.push('/lookup')
    await router.push('/settings#dictionary-order')
    expect(router.currentRoute.value.fullPath).toBe('/dictionaries')
  })

  it('should open the dictionaries page with the filters when old Settings links carry them', async () => {
    // beforeEnter only runs when entering the route, not when already on it
    await router.push('/lookup')
    await router.push('/settings?find=abc&status=installed')
    const route = router.currentRoute.value
    expect(route.path).toBe('/dictionaries')
    expect(route.query).toEqual({ find: 'abc', status: 'installed' })
  })

  it('should open Settings when the former Library routes are followed', async () => {
    await router.push('/library')
    expect(router.currentRoute.value.fullPath).toBe('/settings')
    await router.push('/library/settings?x=1#settings-about')
    expect(router.currentRoute.value.fullPath).toBe('/settings?x=1#settings-about')
  })

  it('should open the glossary when the former Library glossary route is followed', async () => {
    await router.push('/library/glossary/x/1')
    expect(router.currentRoute.value.fullPath).toBe('/glossary/x/1')
    await router.push('/library/glossary?x=1')
    expect(router.currentRoute.value.fullPath).toBe('/glossary?x=1')
  })

  it('should open the dictionaries when the former Library dictionaries route is followed', async () => {
    await router.push('/library/dictionaries?find=a&status=installed')
    const route = router.currentRoute.value
    expect(route.path).toBe('/dictionaries')
    expect(route.query).toEqual({ find: 'a', status: 'installed' })
  })

  it('should resolve the page routes', () => {
    for (const path of ['/lookup', '/lookup/abc', '/reader', '/settings', '/dictionaries', '/glossary', '/glossary/a/1', '/tests']) {
      expect(router.resolve(path).matched.length, path).toBe(1)
    }
  })
})
