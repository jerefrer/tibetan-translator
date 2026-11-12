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
  it('should use the Folio palette in light', () => {
    expect(light['--bg']).toBe('#FFFFFF')
    expect(light['--surface']).toBe('#FFFFFF')
    expect(light['--accent']).toBe('#1F5BB8')
    expect(light['--bg-quiet']).toBe('#F7F7F6')
    expect(light['--amber-solid']).toBe('#8F6200')
  })

  it('should use the Folio palette in dark', () => {
    expect(dark['--bg']).toBe('#161618')
    expect(dark['--surface']).toBe('#202023')
    expect(dark['--accent']).toBe('#7AA7F0')
    expect(dark['--bg-quiet']).toBe('#1C1C1F')
  })

  it('should highlight Search hits in the logo yellow in light and in the amber of notices in dark', () => {
    expect(light['--hit-bg']).toBe('#FFC107')
    expect(light['--on-hit-bg']).toBe('#18181B')
    expect(dark['--hit-bg']).toBe('var(--amber-solid)')
    expect(dark['--on-hit-bg']).toBe('var(--on-amber-solid)')
  })

  it('should draw the Search hits with those tokens', () => {
    // The hits of an English search are drawn in the entry (TermEntry)
    const entry = fs.readFileSync(path.resolve(__dirname, '../src/components/entry/TermEntry.vue'), 'utf8')
    expect(entry).toContain('background: var(--hit-bg);\n  color: var(--on-hit-bg)')
    expect(entry).not.toContain('--logo-bg')
    const results = fs.readFileSync(path.resolve(__dirname, '../src/components/lookup/DefinitionResults.vue'), 'utf8')
    expect(results).not.toContain('--logo-bg')
  })

  it('should keep the scan viewer dark in both themes, on the neutral dark ground', () => {
    expect(light['--scan-bg']).toBe(dark['--bg'])
    expect(light['--scan-ink']).toBe(dark['--ink'])
    expect(dark['--scan-bg']).toBe(light['--scan-bg'])
    expect(dark['--scan-ink']).toBe(light['--scan-ink'])
    const viewer = fs.readFileSync(path.resolve(__dirname, '../src/components/ScanViewer.vue'), 'utf8')
    expect(viewer.match(/#[0-9A-Fa-f]{6}\b/g)).toBeNull()
  })

  it('should use Inter for the interface', () => {
    expect(light['--font-ui']).toMatch(/^'Inter'/)
  })

  it('should define the Folio surfaces in both themes', () => {
    const all = ['--bg-quiet', '--bg-grouped', '--line-soft', '--sidebar-width', '--results-width',
      '--entry-max-width', '--reader-panel-width', '--text-large-title', '--text-headword-xl',
      '--text-headword-lg', '--text-result-tibetan', '--radius-group']
    all.forEach((name) => expect(light, name).toHaveProperty(name))
    ;['--bg-quiet', '--bg-grouped', '--line-soft'].forEach((name) => expect(dark, name).toHaveProperty(name))
    expect(light['--bg-quiet']).toBe('#F7F7F6')
    expect(dark['--line-soft']).toBe('#26262A')
  })

  it('should bundle Inter offline', () => {
    const fonts = fs.readFileSync(path.resolve(__dirname, '../src/css/fonts.css'), 'utf8')
    for (const w of [400, 500, 600, 700]) {
      expect(fonts).toContain(`@fontsource/inter/latin-${w}.css`)
      expect(fonts).toContain(`@fontsource/inter/latin-ext-${w}.css`)
    }
    expect(fonts).not.toContain('instrument-sans')
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
