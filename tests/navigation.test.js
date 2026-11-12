import { describe, it, expect } from 'vitest'
import {
  NAV_ITEMS,
  navItemsFor,
  activeNavId,
  routeSegment,
  shortcutPaths,
} from '../src/config/navigation.js'

describe('navigation config', () => {
  it('should list Lookup, Reader and Library on desktop', () => {
    const ids = navItemsFor(false).map((item) => item.id)
    expect(ids).toEqual(['lookup', 'reader', 'library'])
  })

  it('should keep the same three destinations on a phone', () => {
    const ids = navItemsFor(true).map((item) => item.id)
    expect(ids).toEqual(['lookup', 'reader', 'library'])
  })

  it('should read the first path segment of a route', () => {
    expect(routeSegment('/lookup/%E0%BD%80')).toBe('lookup')
    expect(routeSegment('/')).toBe('')
  })

  it('should highlight the item matching the route on desktop', () => {
    expect(activeNavId('/lookup/abc', false)).toBe('lookup')
    expect(activeNavId('/reader', false)).toBe('reader')
    expect(activeNavId('/library/glossary/custom-a/1', false)).toBe('library')
  })

  it('should highlight Library on a phone while a library section is open', () => {
    expect(activeNavId('/library/dictionaries', true)).toBe('library')
  })

  it('should highlight nothing for a route that has no entry', () => {
    expect(activeNavId('/tests', false)).toBe('')
  })

  it('should keep the existing shortcuts D, T and G pointing at the new destinations', () => {
    const paths = shortcutPaths()
    expect(paths.d).toBe('/lookup')
    expect(paths.t).toBe('/reader')
    expect(paths.g).toBe('/library#settings')
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
})
