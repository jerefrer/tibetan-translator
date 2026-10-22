import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(__dirname, '../src/css/tokens.css'), 'utf8')

function block(selector) {
  const start = css.indexOf(selector + ' {')
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n}', open)
  const body = css.slice(open + 1, close)
  const tokens = {}
  for (const match of body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim()
  }
  return tokens
}

const light = block(':root')
const dark = block(":root[data-theme='dark']")

describe('design tokens', () => {
  it('should take the light palette from the mockups', () => {
    expect(light['--bg']).toBe('#FAF3E0')
    expect(light['--surface']).toBe('#FFFDF8')
    expect(light['--accent']).toBe('#A30000')
    expect(light['--rail-bg']).toBe('#A30000')
    expect(light['--rail-active-ink']).toBe('#FFC107')
  })

  it('should take the dark palette from the dark mockup', () => {
    expect(dark['--bg']).toBe('#1E1815')
    expect(dark['--surface']).toBe('#2A211D')
    expect(dark['--accent']).toBe('#F0766A')
    expect(dark['--rail-bg']).toBe('#5A0000')
  })

  it('should override only tokens that exist in the light theme', () => {
    const unknown = Object.keys(dark).filter((name) => !(name in light))
    expect(unknown).toEqual([])
  })

  it('should define every colour token in both themes', () => {
    const colourNames = Object.keys(light).filter(
      (name) => /^#[0-9A-Fa-f]{6}$/.test(light[name])
    )
    const missing = colourNames.filter((name) => !(name in dark))
    expect(missing).toEqual([])
  })

  it('should express type sizes and control heights in rem so Text size applies', () => {
    const sized = Object.keys(light).filter((name) => /^--(text|control)-/.test(name))
    expect(sized.length).toBeGreaterThan(10)
    sized.forEach((name) => expect(light[name]).toMatch(/rem$/))
  })

  it('should declare the colour scheme of each theme for native controls', () => {
    expect(css).toMatch(/color-scheme: light/)
    expect(css).toMatch(/color-scheme: dark/)
  })
})
