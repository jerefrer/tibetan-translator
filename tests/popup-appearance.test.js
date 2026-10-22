/**
 * Theme and text size of the quick lookup window (src/services/popup-appearance.js),
 * which shares theme.js with the main window and reads the same settings.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import Storage from '../src/services/storage'
import { applyFontSize, applyPopupAppearance, watchPopupAppearance } from '../src/services/popup-appearance'

const root = document.documentElement

afterEach(() => {
  Storage.delete('themePreference')
  Storage.delete('fontSize')
  root.removeAttribute('data-theme')
  root.className = ''
  root.style.fontSize = ''
  root.style.removeProperty('--app-font-size')
})

describe('applyPopupAppearance', () => {
  it('should apply the stored theme the way the main window does', () => {
    Storage.set('themePreference', 'dark')
    expect(applyPopupAppearance().theme).toBe('dark')
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(root.classList.contains('theme--dark')).toBe(true)
  })

  it('should follow the system for the "system" preference', () => {
    Storage.set('themePreference', 'system')
    const matchMedia = window.matchMedia
    window.matchMedia = () => ({ matches: true })
    try {
      expect(applyPopupAppearance().theme).toBe('dark')
    } finally {
      window.matchMedia = matchMedia
    }
  })

  it('should apply the Text size setting to the root font size', () => {
    Storage.set('fontSize', 125)
    applyPopupAppearance()
    expect(root.style.fontSize).toBe('125%')
    expect(root.style.getPropertyValue('--app-font-size')).toBe('125%')
  })

  it('should default to 100 %', () => {
    expect(applyFontSize()).toBe(100)
    expect(root.style.fontSize).toBe('100%')
  })
})

describe('watchPopupAppearance', () => {
  it('should re-apply when the main window changes the theme or the text size', () => {
    const stop = watchPopupAppearance()
    Storage.set('fontSize', 150)
    window._triggerEvent('storage', { key: Storage.scopedKey('fontSize') })
    expect(root.style.fontSize).toBe('150%')

    Storage.set('fontSize', 90)
    window._triggerEvent('storage', { key: Storage.scopedKey('dictionaries') })
    expect(root.style.fontSize).toBe('150%')

    stop()
    expect(window.removeEventListener).toHaveBeenCalledWith('storage', expect.any(Function))
  })

  it('should re-apply when the system theme changes', () => {
    const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    const matchMedia = window.matchMedia
    window.matchMedia = () => media
    try {
      const stop = watchPopupAppearance()
      Storage.set('themePreference', 'system')
      media.matches = true
      media.addEventListener.mock.calls[0][1]()
      expect(root.getAttribute('data-theme')).toBe('dark')
      stop()
      expect(media.removeEventListener).toHaveBeenCalled()
    } finally {
      window.matchMedia = matchMedia
    }
  })
})
