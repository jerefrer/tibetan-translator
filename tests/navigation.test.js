import { describe, it, expect } from 'vitest'
import {
  NAV_ITEMS,
  navItemsFor,
  activeNavId,
  routeSegment,
  shortcutPaths,
} from '../src/config/navigation.js'

describe('navigation config', () => {
  it('should list Define, Search and Split before Glossary, Dictionaries and Settings on desktop', () => {
    const ids = navItemsFor(false).map((item) => item.id)
    expect(ids).toEqual(['define', 'search', 'segment', 'glossary', 'dictionaries', 'settings'])
  })

  it('should keep only Define, Search, Split and Settings on a phone', () => {
    const ids = navItemsFor(true).map((item) => item.id)
    expect(ids).toEqual(['define', 'search', 'segment', 'settings'])
  })

  it('should read the first path segment of a route', () => {
    expect(routeSegment('/define/%E0%BD%80')).toBe('define')
    expect(routeSegment('/')).toBe('')
  })

  it('should highlight the item matching the route on desktop', () => {
    expect(activeNavId('/glossary/custom-a/1', false)).toBe('glossary')
    expect(activeNavId('/dictionaries', false)).toBe('dictionaries')
    expect(activeNavId('/segment', false)).toBe('segment')
  })

  it('should highlight Settings on a phone while Glossary or Dictionaries is open', () => {
    expect(activeNavId('/glossary', true)).toBe('settings')
    expect(activeNavId('/dictionaries', true)).toBe('settings')
  })

  it('should highlight nothing for a route that has no entry', () => {
    expect(activeNavId('/tests', false)).toBe('')
  })

  it('should keep the existing keyboard shortcuts D, S, T and G', () => {
    expect(shortcutPaths()).toEqual({
      d: '/define',
      s: '/search',
      t: '/segment',
      g: '/settings',
    })
  })

  it('should give every item a unique id and path', () => {
    expect(new Set(NAV_ITEMS.map((item) => item.id)).size).toBe(NAV_ITEMS.length)
    expect(new Set(NAV_ITEMS.map((item) => item.path)).size).toBe(NAV_ITEMS.length)
  })
})
