/**
 * The help panel's state: open or not, on which topic, and the topic that
 * fits the screen the user is on.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { closeHelp, helpState, openHelp, toggleHelp, topicForRoute } from '../src/services/help'

beforeEach(() => closeHelp())

describe('help', () => {
  it('should open on a topic, and close', () => {
    openHelp('reader')
    expect(helpState).toMatchObject({ open: true, topic: 'reader' })
    closeHelp()
    expect(helpState.open).toBe(false)
  })

  it('should toggle: open on the topic, then closed', () => {
    toggleHelp('search')
    expect(helpState).toMatchObject({ open: true, topic: 'search' })
    toggleHelp('search')
    expect(helpState.open).toBe(false)
  })

  it('should close when toggled while open on another topic', () => {
    openHelp('lookup')
    toggleHelp('reader')
    expect(helpState.open).toBe(false)
  })

  it('should move to another topic when asked to open it while open', () => {
    openHelp('lookup')
    openHelp('reader')
    expect(helpState).toMatchObject({ open: true, topic: 'reader' })
  })

  it('should pick the topic of the screen', () => {
    expect(topicForRoute({ path: '/lookup', query: { mode: 'en' } })).toBe('search')
    expect(topicForRoute({ path: '/lookup', query: { q: 'wisdom' } })).toBe('search')
    expect(topicForRoute({ path: '/lookup/ཀ་', query: {} })).toBe('lookup')
    expect(topicForRoute({ path: '/reader', query: {} })).toBe('reader')
    expect(topicForRoute({ path: '/dictionaries', query: {} })).toBe('dictionaries')
    expect(topicForRoute({ path: '/glossary/x/1', query: {} })).toBe('glossary')
    expect(topicForRoute({ path: '/saved', query: {} })).toBe('saved')
    expect(topicForRoute({ path: '/settings', query: {} })).toBe(null)
  })
})
