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

  it('should set data-theme on <html>', () => {
    expect(applyDocumentTheme('dark')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('should replace the previous theme when switching', () => {
    applyDocumentTheme('dark')
    applyDocumentTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('should treat anything but dark as light', () => {
    expect(applyDocumentTheme('sepia')).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
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
