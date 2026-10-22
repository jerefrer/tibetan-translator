/**
 * Invisible hit areas (hardening report, D5): small controls get a larger,
 * transparent ::before so a finger reaches them, without any visual change.
 * The sizes are layout, which happy-dom does not compute, so the rules are
 * read from the sources; they were measured in Chromium at 390 and 1440 px.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const source = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8')

describe('Hit areas', () => {
  it('should give the field clear button (36px) a 44px hit area', () => {
    const css = source('src/ui/UiTextField.vue')
    expect(css).toMatch(/\.ui-field__clear \{\n  position: relative;/)
    expect(css).toContain(".ui-field__clear::before {\n  content: '';\n  position: absolute;\n  inset: min(0px, calc((2.25rem - 44px) / 2));\n}")
  })

  it('should give the slider thumb (18px with its border) a 44px hit area', () => {
    const css = source('src/ui/UiSlider.vue')
    expect(css).toMatch(/\.ui-slider__thumb \{\n  position: relative;/)
    expect(css).toContain('inset: min(0px, calc((1.125rem - 44px) / 2 - 2px));')
  })

  it("should give Split's merge buttons (28px) a hit area 44px tall and 30px wide, the spacing of the lanes", () => {
    const css = source('src/components/SegmentPage.vue')
    expect(css).toMatch(/const MERGE_LANE_WIDTH = 30;/)
    expect(css).toContain("  &::before\n    content ''\n    position absolute\n    top -9.5px\n    bottom -9.5px\n    left -2.5px\n    right -2.5px")
  })
})
