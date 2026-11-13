import { describe, it, expect } from 'vitest'
import {
  NAV_ITEMS,
  navItemsFor,
  activeNavId,
  routeSegment,
  shortcutPaths,
  digitShortcutPaths,
} from '../src/config/navigation.js'

describe('navigation config', () => {
  it('should list Define, Search, Reader, the glossary and the dictionaries on desktop, Settings apart', () => {
    const ids = navItemsFor(false).map((item) => item.id)
    expect(ids).toEqual(['lookup', 'search', 'reader', 'glossary', 'dictionaries'])
  })

  it('should keep four destinations on a phone, the glossary and dictionaries inside Settings', () => {
    const ids = navItemsFor(true).map((item) => item.id)
    expect(ids).toEqual(['lookup', 'search', 'reader', 'settings'])
  })

  it('should read the first path segment of a route', () => {
    expect(routeSegment('/define/%E0%BD%80')).toBe('define')
    expect(routeSegment('/')).toBe('')
  })

  it('should highlight the item matching the route on desktop', () => {
    expect(activeNavId('/define/abc', false)).toBe('lookup')
    expect(activeNavId('/search', false)).toBe('search')
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

  it('should group the glossary and the dictionaries apart from Define, Search and Reader', () => {
    const groups = navItemsFor(false).map((item) => item.group)
    expect(groups).toEqual(['tools', 'tools', 'tools', 'collections', 'collections'])
  })

  it('should highlight nothing for a route that has no entry', () => {
    expect(activeNavId('/tests', false)).toBe('')
  })

  it('should map Cmd+E to Reader and Cmd+G to Settings', () => {
    const paths = shortcutPaths()
    expect(paths.e).toBe('/reader')
    expect(paths.g).toBe('/settings')
  })

  it('should no longer map Cmd+T, which a browser keeps for a new tab', () => {
    expect(shortcutPaths().t).toBeUndefined()
  })

  it('should map the digit keys 1, 2 and 3 to Define, Search and Reader, in the order of the menu', () => {
    expect(digitShortcutPaths()).toEqual({ Digit1: '/define', Digit2: '/search', Digit3: '/reader' })
  })

  it('should map Cmd+D to Define', () => {
    expect(shortcutPaths().d).toBe('/define')
  })

  it('should map Cmd+S to Search', () => {
    expect(shortcutPaths().s).toBe('/search')
  })

  it('should map Cmd+K to focusing Define', () => {
    expect(shortcutPaths().k).toBe('focus-lookup')
  })

  it('should give every item a unique id and path', () => {
    expect(new Set(NAV_ITEMS.map((item) => item.id)).size).toBe(NAV_ITEMS.length)
    expect(new Set(NAV_ITEMS.map((item) => item.path)).size).toBe(NAV_ITEMS.length)
  })

  it('should highlight Define on a phone on the Saved page, and nothing in the sidebar', () => {
    expect(activeNavId('/saved', true)).toBe('lookup')
    expect(activeNavId('/saved', false)).toBe('')
  })
})
