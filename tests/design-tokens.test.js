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

const light = block("[data-theme='light']")
const dark = block("[data-theme='dark']")

describe('design tokens', () => {
  it('should use palette 6 in light', () => {
    expect(light['--bg']).toBe('#F5F5F4')
    expect(light['--surface']).toBe('#FFFFFF')
    expect(light['--accent']).toBe('#1F5BB8')
    expect(light['--rail-bg']).toBe('#FFFFFF')
    expect(light['--rail-active-ink']).toBe('#1F5BB8')
    expect(light['--amber-solid']).toBe('#8F6200')
  })

  it('should use palette 6 in dark', () => {
    expect(dark['--bg']).toBe('#161618')
    expect(dark['--surface']).toBe('#202023')
    expect(dark['--accent']).toBe('#7AA7F0')
    expect(dark['--rail-bg']).toBe('#1C1C1F')
  })

  it('should highlight Search hits in the logo yellow in light and in the amber of notices in dark', () => {
    expect(light['--hit-bg']).toBe('#FFC107')
    expect(light['--on-hit-bg']).toBe('#18181B')
    expect(dark['--hit-bg']).toBe('var(--amber-solid)')
    expect(dark['--on-hit-bg']).toBe('var(--on-amber-solid)')
  })

  it('should draw the Search hits with those tokens', () => {
    const search = fs.readFileSync(path.resolve(__dirname, '../src/components/SearchPage.vue'), 'utf8')
    expect(search).toContain('background var(--hit-bg)\n  color var(--on-hit-bg)')
    expect(search).not.toContain('--logo-bg')
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
