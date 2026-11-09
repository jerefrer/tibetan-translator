import { describe, it, expect, vi } from 'vitest'
import { computeKeyboardInset, startKeyboardInset } from '../src/services/keyboard-inset'

describe('computeKeyboardInset', () => {
  it('should return the height covered by the keyboard when the visual viewport shrinks', () => {
    expect(computeKeyboardInset(800, { height: 500, offsetTop: 0 })).toBe(300)
  })

  it('should subtract the viewport offset when the page is scrolled inside it', () => {
    expect(computeKeyboardInset(800, { height: 500, offsetTop: 100 })).toBe(200)
  })

  it('should never return a negative inset when the viewport is larger than the window', () => {
    expect(computeKeyboardInset(800, { height: 810, offsetTop: 0 })).toBe(0)
  })
})

describe('startKeyboardInset', () => {
  it('should do nothing when visualViewport is not available', () => {
    expect(startKeyboardInset({ innerHeight: 800 }, document.documentElement)).toBeNull()
  })

  it('should publish the CSS variables and update them on resize', () => {
    const listeners = {}
    const vv = {
      height: 500,
      offsetTop: 0,
      addEventListener: vi.fn((name, fn) => { listeners[name] = fn }),
    }
    const root = document.createElement('div')
    startKeyboardInset({ innerHeight: 800, visualViewport: vv }, root)
    expect(root.style.getPropertyValue('--keyboard-inset')).toBe('300px')
    expect(root.style.getPropertyValue('--visible-height')).toBe('500px')
    vv.height = 800
    listeners.resize()
    expect(root.style.getPropertyValue('--keyboard-inset')).toBe('0px')
  })
})
