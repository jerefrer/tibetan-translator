import { describe, it, expect, beforeEach, vi } from 'vitest'
import { savedTerms, isSaved, toggleSaved } from '../src/services/saved-terms'
import Storage from '../src/services/storage'

beforeEach(() => Storage.delete('savedTerms'))

describe('saved terms', () => {
  it('should save a term and report it saved', () => {
    expect(toggleSaved('ཀ་')).toBe(true)
    expect(isSaved('ཀ་')).toBe(true)
  })

  it('should unsave it on a second toggle', () => {
    toggleSaved('ཀ་')
    expect(toggleSaved('ཀ་')).toBe(false)
    expect(isSaved('ཀ་')).toBe(false)
    expect(savedTerms()).toEqual([])
  })

  it('should keep the newest saved first', () => {
    toggleSaved('ཀ་')
    toggleSaved('ཁ་')
    expect(savedTerms()).toEqual(['ཁ་', 'ཀ་'])
  })

  it('should announce changes with saved-terms-updated', () => {
    const spy = vi.spyOn(window, 'dispatchEvent')
    toggleSaved('ཀ་')
    const events = spy.mock.calls.map(([e]) => e).filter((e) => e.type === 'saved-terms-updated')
    spy.mockRestore()
    expect(events).toHaveLength(1)
  })
})
