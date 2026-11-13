import { describe, it, expect } from 'vitest'
import {
  NAV_ITEMS,
  navItemsFor,
  activeNavId,
  routeSegment,
  shortcutPaths,
} from '../src/config/navigation.js'

describe('navigation config', () => {
  it('should list Lookup, Reader, the glossary and the dictionaries on desktop, Settings apart', () => {
    const ids = navItemsFor(false).map((item) => item.id)
    expect(ids).toEqual(['lookup', 'reader', 'glossary', 'dictionaries'])
  })

  it('should keep three destinations on a phone, the glossary and dictionaries inside Settings', () => {
    const ids = navItemsFor(true).map((item) => item.id)
    expect(ids).toEqual(['lookup', 'reader', 'settings'])
  })

  it('should read the first path segment of a route', () => {
    expect(routeSegment('/lookup/%E0%BD%80')).toBe('lookup')
    expect(routeSegment('/')).toBe('')
  })

  it('should highlight the item matching the route on desktop', () => {
    expect(activeNavId('/lookup/abc', false)).toBe('lookup')
    expect(activeNavId('/reader', false)).toBe('reader')
    expect(activeNavId('/settings', false)).toBe('settings')
  })

  it('should highlight the glossary or the dictionaries on desktop while one is open', () => {
    expect(activeNavId('/glossary/custom-a/1', false)).toBe('glossary')
    expect(activeNavId('/dictionaries', false)).toBe('dictionaries')
  })

  it('should highlight Settings on a phone while the glossary or the dictionaries are open', () => {
    expect(activeNavId('/dictionaries', true)).toBe('settings')
    expect(activeNavId('/glossary', true)).toBe('settings')
    expect(activeNavId('/glossary/custom-a/1', true)).toBe('settings')
  })

  it('should group the glossary and the dictionaries apart from Lookup and Reader', () => {
    const groups = navItemsFor(false).map((item) => item.group)
    expect(groups).toEqual(['tools', 'tools', 'collections', 'collections'])
  })

  it('should highlight nothing for a route that has no entry', () => {
    expect(activeNavId('/tests', false)).toBe('')
  })

  it('should keep the existing shortcuts D, T and G pointing at the new destinations', () => {
    const paths = shortcutPaths()
    expect(paths.d).toBe('/lookup?mode=bo')
    expect(paths.t).toBe('/reader')
    expect(paths.g).toBe('/settings')
  })

  it('should map Cmd+D to Lookup in Tibetan mode', () => {
    expect(shortcutPaths().d).toBe('/lookup?mode=bo')
  })

  it('should map Cmd+S to Lookup in English mode', () => {
    expect(shortcutPaths().s).toBe('/lookup?mode=en')
  })

  it('should map Cmd+K to focusing Lookup', () => {
    expect(shortcutPaths().k).toBe('focus-lookup')
  })

  it('should give every item a unique id and path', () => {
    expect(new Set(NAV_ITEMS.map((item) => item.id)).size).toBe(NAV_ITEMS.length)
    expect(new Set(NAV_ITEMS.map((item) => item.path)).size).toBe(NAV_ITEMS.length)
  })

  it('should highlight Lookup on a phone on the Saved page, and nothing in the sidebar', () => {
    expect(activeNavId('/saved', true)).toBe('lookup')
    expect(activeNavId('/saved', false)).toBe('')
  })
})
