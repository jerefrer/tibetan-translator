import { describe, it, expect, beforeEach } from 'vitest'
import Storage from '../src/services/storage.js'
import {
  resolveTheme,
  applyDocumentTheme,
  initDocumentTheme,
} from '../src/services/theme.js'

describe('theme service', () => {
  beforeEach(() => {
    Storage.delete('themePreference')
    const root = document.documentElement
    root.removeAttribute('data-theme')
    root.classList.remove('theme--dark', 'theme--light')
  })

  it('should follow the system when the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('should ignore the system when a theme is chosen explicitly', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('should fall back to light for an unknown preference', () => {
    expect(resolveTheme(undefined, true)).toBe('light')
    expect(resolveTheme('sepia', true)).toBe('light')
  })

  it('should set data-theme and the legacy class together', () => {
    applyDocumentTheme('dark')
    const root = document.documentElement
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(root.classList.contains('theme--dark')).toBe(true)
    expect(root.classList.contains('theme--light')).toBe(false)
  })

  it('should replace the previous theme class when switching', () => {
    applyDocumentTheme('dark')
    applyDocumentTheme('light')
    const root = document.documentElement
    expect(root.getAttribute('data-theme')).toBe('light')
    expect(root.classList.contains('theme--dark')).toBe(false)
    expect(root.classList.contains('theme--light')).toBe(true)
  })

  it('should apply the stored dark preference at start-up', () => {
    Storage.set('themePreference', 'dark')
    expect(initDocumentTheme()).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('should default to light when nothing is stored', () => {
    expect(initDocumentTheme()).toBe('light')
  })
})
