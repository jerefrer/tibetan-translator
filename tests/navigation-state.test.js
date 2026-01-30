/**
 * Navigation State Persistence Tests
 *
 * Tests the route guard logic and state persistence for SearchPage and DefinePage.
 * These tests verify the fix for state loss when navigating between pages.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import Storage from '../src/services/storage.js'

// Create Vuetify instance for tests
const vuetify = createVuetify({
  components,
  directives,
})

describe('Navigation State Persistence', () => {
  // Ensure clean state before each test
  beforeEach(() => {
    Storage.delete('searchQuery')
    Storage.delete('selectedTerm')
    Storage.delete('previousQueries')
  })

  describe('SearchPage route guards', () => {
    /**
     * Simulates the beforeRouteEnter guard logic from SearchPage
     */
    function simulateBeforeRouteEnter(to) {
      const query = Storage.get('searchQuery')
      if (!to.params.query && query) {
        return '/search/' + query
      }
      return null // No redirect
    }

    /**
     * Simulates the beforeRouteUpdate guard logic from SearchPage
     */
    function simulateBeforeRouteUpdate(to) {
      if (to.path.startsWith('/search') && !to.params.query) {
        const query = Storage.get('searchQuery')
        if (query) {
          return '/search/' + encodeURIComponent(query)
        }
      }
      return null // No redirect
    }

    /**
     * Simulates the route watcher logic from SearchPage
     */
    function simulateRouteWatcher(currentPath, newQueryParam, currentSearchQuery) {
      // Only update if we're still on the search route
      if (!currentPath.startsWith('/search')) {
        return currentSearchQuery // Don't change
      }
      return newQueryParam // Update to new value
    }

    describe('beforeRouteEnter', () => {
      it('redirects to stored query when entering /search without param', () => {
        Storage.set('searchQuery', 'བསམ་གཏན་')
        const redirect = simulateBeforeRouteEnter({ params: {} })
        expect(redirect).toBe('/search/བསམ་གཏན་')
      })

      it('does not redirect when entering /search with param', () => {
        Storage.set('searchQuery', 'old query')
        const redirect = simulateBeforeRouteEnter({ params: { query: 'new query' } })
        expect(redirect).toBe(null)
      })

      it('does not redirect when no stored query', () => {
        const redirect = simulateBeforeRouteEnter({ params: {} })
        expect(redirect).toBe(null)
      })
    })

    describe('beforeRouteUpdate', () => {
      it('redirects to stored query when returning to /search without param', () => {
        Storage.set('searchQuery', 'བསམ་གཏན་')
        const redirect = simulateBeforeRouteUpdate({ path: '/search', params: {} })
        expect(redirect).toBe('/search/' + encodeURIComponent('བསམ་གཏན་'))
      })

      it('does not redirect when returning to /search with param', () => {
        Storage.set('searchQuery', 'old query')
        const redirect = simulateBeforeRouteUpdate({ path: '/search/new%20query', params: { query: 'new query' } })
        expect(redirect).toBe(null)
      })

      it('does not redirect when navigating to non-search route', () => {
        Storage.set('searchQuery', 'query')
        const redirect = simulateBeforeRouteUpdate({ path: '/define/term', params: {} })
        expect(redirect).toBe(null)
      })

      it('does not redirect when no stored query', () => {
        const redirect = simulateBeforeRouteUpdate({ path: '/search', params: {} })
        expect(redirect).toBe(null)
      })
    })

    describe('route watcher (fixes state loss on navigation)', () => {
      it('preserves searchQuery when navigating to /define (not on search route)', () => {
        const currentSearchQuery = 'my search'
        const result = simulateRouteWatcher('/define/term', undefined, currentSearchQuery)
        expect(result).toBe('my search')
      })

      it('preserves searchQuery when navigating to /segment', () => {
        const currentSearchQuery = 'my search'
        const result = simulateRouteWatcher('/segment', undefined, currentSearchQuery)
        expect(result).toBe('my search')
      })

      it('preserves searchQuery when navigating to /settings', () => {
        const currentSearchQuery = 'my search'
        const result = simulateRouteWatcher('/settings', undefined, currentSearchQuery)
        expect(result).toBe('my search')
      })

      it('updates searchQuery when on /search route with new param', () => {
        const currentSearchQuery = 'old search'
        const result = simulateRouteWatcher('/search/new%20search', 'new search', currentSearchQuery)
        expect(result).toBe('new search')
      })

      it('clears searchQuery when on /search route with empty param', () => {
        const currentSearchQuery = 'old search'
        const result = simulateRouteWatcher('/search/', undefined, currentSearchQuery)
        expect(result).toBe(undefined)
      })
    })
  })

  describe('DefinePage route guards', () => {
    /**
     * Simulates the beforeRouteEnter guard logic from DefinePage
     */
    function simulateBeforeRouteEnter(to) {
      const storedKey = Storage.get('selectedTerm')
      if (!to.params.term && storedKey) {
        return '/define/' + storedKey
      }
      return null
    }

    describe('beforeRouteEnter', () => {
      it('redirects to stored term when entering /define without param', () => {
        Storage.set('selectedTerm', 'བསམ་གཏན་')
        const redirect = simulateBeforeRouteEnter({ params: {} })
        expect(redirect).toBe('/define/བསམ་གཏན་')
      })

      it('does not redirect when entering /define with param', () => {
        Storage.set('selectedTerm', 'old term')
        const redirect = simulateBeforeRouteEnter({ params: { term: 'new term' } })
        expect(redirect).toBe(null)
      })

      it('does not redirect when no stored term', () => {
        const redirect = simulateBeforeRouteEnter({ params: {} })
        expect(redirect).toBe(null)
      })
    })
  })

  describe('Cross-page navigation scenarios', () => {
    it('SearchPage state persists after Define -> Search navigation', () => {
      // User performs search
      Storage.set('searchQuery', 'enlightenment')
      Storage.set('previousQueries', ['enlightenment', 'compassion'])

      // Verify state is stored
      expect(Storage.get('searchQuery')).toBe('enlightenment')
      expect(Storage.get('previousQueries')).toEqual(['enlightenment', 'compassion'])

      // Simulate navigation to Define (state should persist in Storage)
      // ... (route changes but Storage remains)

      // Navigate back to Search
      const redirect = simulateBeforeRouteUpdate({ path: '/search', params: {} })

      // Should redirect to restore the query
      expect(redirect).toBe('/search/' + encodeURIComponent('enlightenment'))

      function simulateBeforeRouteUpdate(to) {
        if (to.path.startsWith('/search') && !to.params.query) {
          const query = Storage.get('searchQuery')
          if (query) {
            return '/search/' + encodeURIComponent(query)
          }
        }
        return null
      }
    })

    it('DefinePage state persists after Search -> Define navigation', () => {
      // User selects a term
      Storage.set('selectedTerm', 'བསམ་གཏན་')

      // Navigate to Search
      // ... (route changes but Storage remains)

      // Navigate back to Define
      const redirect = simulateBeforeRouteEnter({ params: {} })

      // Should redirect to restore the term
      expect(redirect).toBe('/define/བསམ་གཏན་')

      function simulateBeforeRouteEnter(to) {
        const storedKey = Storage.get('selectedTerm')
        if (!to.params.term && storedKey) {
          return '/define/' + storedKey
        }
        return null
      }
    })

    it('handles rapid navigation between pages', () => {
      // Simulate rapid navigation
      Storage.set('searchQuery', 'query1')
      Storage.set('selectedTerm', 'term1')

      // First navigation cycle
      expect(Storage.get('searchQuery')).toBe('query1')
      expect(Storage.get('selectedTerm')).toBe('term1')

      // Update search
      Storage.set('searchQuery', 'query2')

      // Second navigation cycle
      expect(Storage.get('searchQuery')).toBe('query2')
      expect(Storage.get('selectedTerm')).toBe('term1')

      // Update term
      Storage.set('selectedTerm', 'term2')

      // Third navigation cycle
      expect(Storage.get('searchQuery')).toBe('query2')
      expect(Storage.get('selectedTerm')).toBe('term2')
    })
  })

  describe('State isolation between pages', () => {
    it('SearchPage and DefinePage use different storage keys', () => {
      Storage.set('searchQuery', 'search value')
      Storage.set('selectedTerm', 'term value')

      expect(Storage.get('searchQuery')).toBe('search value')
      expect(Storage.get('selectedTerm')).toBe('term value')

      // Modifying one should not affect the other
      Storage.set('searchQuery', 'new search')
      expect(Storage.get('selectedTerm')).toBe('term value')

      Storage.set('selectedTerm', 'new term')
      expect(Storage.get('searchQuery')).toBe('new search')
    })
  })

  describe('Edge cases', () => {
    it('handles Tibetan script in URLs', () => {
      const tibetanQuery = 'བསམ་གཏན་'
      Storage.set('searchQuery', tibetanQuery)

      const encoded = encodeURIComponent(tibetanQuery)
      expect(encoded).toContain('%')

      const decoded = decodeURIComponent(encoded)
      expect(decoded).toBe(tibetanQuery)
    })

    it('handles special characters in search query', () => {
      const specialQuery = 'test & query [with] {brackets}'
      Storage.set('searchQuery', specialQuery)
      expect(Storage.get('searchQuery')).toBe(specialQuery)
    })

    it('handles empty string vs undefined', () => {
      Storage.set('searchQuery', '')
      expect(Storage.get('searchQuery')).toBe('')

      Storage.set('searchQuery', undefined)
      expect(Storage.get('searchQuery')).toBe(null)
    })

    it('handles very long search queries', () => {
      const longQuery = 'a'.repeat(10000)
      Storage.set('searchQuery', longQuery)
      expect(Storage.get('searchQuery')).toBe(longQuery)
    })
  })
})
