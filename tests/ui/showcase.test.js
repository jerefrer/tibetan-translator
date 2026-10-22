import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import * as ui from '../../src/ui/index.js'
import UiShowcasePage from '../../src/ui/UiShowcasePage.vue'

const COMPONENTS = [
  'UiAccordion', 'UiAlert', 'UiBadge', 'UiButton', 'UiCard', 'UiCheckbox', 'UiChip',
  'UiDialog', 'UiDivider', 'UiIcon', 'UiList', 'UiListItem', 'UiMenu', 'UiPagination',
  'UiProgress', 'UiSelect', 'UiSlider', 'UiSpinner', 'UiSwitch', 'UiTable', 'UiTabs',
  'UiTextField', 'UiToast', 'UiToolbar', 'UiTooltip',
]

describe('src/ui index', () => {
  it('should export every component and the intersect directive', () => {
    COMPONENTS.forEach((name) => expect(ui[name], name).toBeTruthy())
    expect(ui.vIntersect).toBeTruthy()
  })
})

describe('UiShowcasePage', () => {
  it('should render every component once per theme', () => {
    const wrapper = mount(UiShowcasePage, { attachTo: document.body })
    const panes = wrapper.findAll('.showcase__pane')
    expect(panes.map((pane) => pane.attributes('data-theme'))).toEqual(['light', 'dark'])
    for (const pane of panes) {
      for (const testid of [
        'ui-button', 'ui-chip', 'ui-alert', 'ui-spinner', 'ui-progress', 'ui-badge',
        'ui-text-field', 'ui-select', 'ui-switch', 'ui-checkbox', 'ui-slider', 'ui-tabs',
        'ui-card', 'ui-toolbar', 'ui-list', 'ui-divider', 'ui-table', 'ui-pagination',
        'ui-accordion', 'ui-icon',
      ]) {
        expect(pane.find(`[data-testid="${testid}"]`).exists(), testid).toBe(true)
      }
    }
    wrapper.unmount()
  })

  it('should switch the document theme from its toggle', async () => {
    const wrapper = mount(UiShowcasePage, { attachTo: document.body })
    wrapper.vm.setPageTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    wrapper.vm.setPageTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    wrapper.unmount()
  })
})
