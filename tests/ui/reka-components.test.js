import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import UiDialog from '../../src/ui/UiDialog.vue'
import UiTooltip from '../../src/ui/UiTooltip.vue'
import UiTabs from '../../src/ui/UiTabs.vue'
import UiMenu from '../../src/ui/UiMenu.vue'
import UiSelect from '../../src/ui/UiSelect.vue'
import UiSwitch from '../../src/ui/UiSwitch.vue'
import UiCheckbox from '../../src/ui/UiCheckbox.vue'
import UiSlider from '../../src/ui/UiSlider.vue'
import UiToast from '../../src/ui/UiToast.vue'
import UiDivider from '../../src/ui/UiDivider.vue'
import UiPagination from '../../src/ui/UiPagination.vue'
import UiAccordion from '../../src/ui/UiAccordion.vue'
import UiProgress from '../../src/ui/UiProgress.vue'
import { vIntersect } from '../../src/ui/intersect.js'

let wrapper
function mountAttached(component, options) {
  wrapper = mount(component, { attachTo: document.body, ...options })
  return wrapper
}
const body = (testid) => document.body.querySelector(`[data-testid="${testid}"]`)

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('UiDialog', () => {
  it('should render nothing while closed', () => {
    mountAttached(UiDialog, { props: { modelValue: false, title: 'Remove pack?' } })
    expect(body('ui-dialog')).toBeNull()
  })

  it('should show its title, description, body and actions when open', async () => {
    mountAttached(UiDialog, {
      props: { modelValue: true, title: 'Remove pack?', description: 'It can be downloaded again.' },
      slots: { default: '<p id="b">Body</p>', actions: '<button id="a">Remove</button>' },
    })
    await nextTick()
    const dialog = body('ui-dialog')
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.textContent).toContain('Remove pack?')
    expect(dialog.textContent).toContain('It can be downloaded again.')
    expect(dialog.querySelector('#b')).not.toBeNull()
    expect(body('ui-dialog-actions').querySelector('#a')).not.toBeNull()
  })

  it('should ask to close when Escape is pressed', async () => {
    const view = mountAttached(UiDialog, { props: { modelValue: true, title: 'T' } })
    await nextTick()
    // tests/setup.js replaces window.addEventListener with a recorder
    window._triggerEvent('keydown', new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    await nextTick()
    expect(view.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('should ignore Escape when persistent', async () => {
    const view = mountAttached(UiDialog, { props: { modelValue: true, persistent: true, title: 'T' } })
    await nextTick()
    // tests/setup.js replaces window.addEventListener with a recorder
    window._triggerEvent('keydown', new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    await nextTick()
    expect(view.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('UiTooltip', () => {
  it('should show its text beside the trigger when open', async () => {
    mountAttached(UiTooltip, {
      props: { text: 'Copy definition', open: true },
      slots: { default: '<button>Copy</button>' },
    })
    await nextTick()
    expect(body('ui-tooltip').textContent).toContain('Copy definition')
  })

  it('should not show the tip while closed', () => {
    mountAttached(UiTooltip, { props: { text: 'x', open: false }, slots: { default: '<button>Copy</button>' } })
    expect(body('ui-tooltip')).toBeNull()
  })
})

describe('UiTabs', () => {
  const items = [
    { value: 'one', label: 'One' },
    { value: 'two', label: 'Two' },
  ]
  const slots = { 'panel-one': 'First panel', 'panel-two': 'Second panel' }

  it('should select the first tab when none is given', () => {
    mountAttached(UiTabs, { props: { items }, slots })
    expect(body('ui-tab-one').getAttribute('data-state')).toBe('active')
    expect(body('ui-tab-panel-one').textContent).toContain('First panel')
  })

  it('should show the panel of the selected tab only', () => {
    mountAttached(UiTabs, { props: { items, modelValue: 'two' }, slots })
    expect(body('ui-tab-panel-two').textContent).toContain('Second panel')
    expect(document.body.textContent).not.toContain('First panel')
  })

  it('should emit update:modelValue when a tab is activated', async () => {
    const view = mountAttached(UiTabs, { props: { items, modelValue: 'one' }, slots })
    const trigger = body('ui-tab-two')
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    trigger.focus()
    await nextTick()
    expect(view.emitted('update:modelValue')?.at(-1)).toEqual(['two'])
  })
})

describe('UiMenu', () => {
  const items = [
    { key: 'copy', label: 'Copy' },
    { separator: true },
    { key: 'delete', label: 'Delete', danger: true },
  ]

  it('should list its items when open', async () => {
    mountAttached(UiMenu, { props: { items, open: true }, slots: { default: '<button>Menu</button>' } })
    await nextTick()
    expect(body('ui-menu-item-copy').textContent).toContain('Copy')
    expect(body('ui-menu-item-delete').classList.contains('ui-menu__item--danger')).toBe(true)
  })

  it('should emit select with the chosen item', async () => {
    const view = mountAttached(UiMenu, { props: { items, open: true }, slots: { default: '<button>Menu</button>' } })
    await nextTick()
    body('ui-menu-item-copy').click()
    await nextTick()
    expect(view.emitted('select')?.[0][0]).toMatchObject({ key: 'copy' })
  })

  it('should show an item\'s description under its label', async () => {
    const described = [
      { key: 'file', label: 'Dictionary file', description: 'To share, or to reinstall later' },
    ]
    mountAttached(UiMenu, { props: { items: described, open: true }, slots: { default: '<button>Menu</button>' } })
    await nextTick()
    const item = body('ui-menu-item-file')
    expect(item.querySelector('.ui-menu__label').textContent).toBe('Dictionary file')
    expect(item.querySelector('.ui-menu__description').textContent).toBe('To share, or to reinstall later')
    expect(body('ui-menu').classList.contains('ui-menu--described')).toBe(true)
  })

  it('should keep plain items on one line', async () => {
    mountAttached(UiMenu, { props: { items, open: true }, slots: { default: '<button>Menu</button>' } })
    await nextTick()
    expect(body('ui-menu-item-copy').querySelector('.ui-menu__description')).toBeNull()
    expect(body('ui-menu').classList.contains('ui-menu--described')).toBe(false)
  })
})

describe('UiSelect', () => {
  const options = [
    { value: 'core', label: 'Core Dictionaries' },
    { value: 'tibetan', label: 'Tibetan Monolingual' },
  ]

  it('should show the label of the selected option', () => {
    mountAttached(UiSelect, { props: { options, modelValue: 'tibetan' } })
    expect(body('ui-select-trigger').textContent).toContain('Tibetan Monolingual')
  })

  it('should show the placeholder when nothing is selected', () => {
    mountAttached(UiSelect, { props: { options, placeholder: 'Pick a pack' } })
    expect(body('ui-select-trigger').textContent).toContain('Pick a pack')
  })

  it('should list the options when open', async () => {
    mountAttached(UiSelect, { props: { options, modelValue: 'core', open: true } })
    await nextTick()
    expect(body('ui-select-option-tibetan')).not.toBeNull()
  })

  it('should name the trigger with aria-label when it has no visible label', () => {
    mountAttached(UiSelect, { props: { options, modelValue: 'core' }, attrs: { 'aria-label': 'Pack' } })
    expect(body('ui-select-trigger').getAttribute('aria-label')).toBe('Pack')
    expect(body('ui-select').hasAttribute('aria-label')).toBe(false)
  })

  it('should be disabled when asked', () => {
    mountAttached(UiSelect, { props: { options, disabled: true } })
    expect(body('ui-select-trigger').hasAttribute('disabled')).toBe(true)
  })
})

describe('UiSwitch', () => {
  it('should reflect its state and label', () => {
    mountAttached(UiSwitch, { props: { modelValue: true, label: 'Global lookup' } })
    expect(body('ui-switch-control').getAttribute('aria-checked')).toBe('true')
    expect(body('ui-switch').textContent).toContain('Global lookup')
  })

  it('should put aria-label on the switch itself, not on its wrapper', () => {
    mountAttached(UiSwitch, { props: { modelValue: true }, attrs: { 'aria-label': 'Hopkins 2015' } })
    expect(body('ui-switch-control').getAttribute('aria-label')).toBe('Hopkins 2015')
    expect(body('ui-switch').hasAttribute('aria-label')).toBe(false)
  })

  it('should emit the new state when toggled', async () => {
    const view = mountAttached(UiSwitch, { props: { modelValue: false } })
    body('ui-switch-control').click()
    await nextTick()
    expect(view.emitted('update:modelValue')?.at(-1)).toEqual([true])
  })

  it('should not toggle when disabled', async () => {
    const view = mountAttached(UiSwitch, { props: { modelValue: false, disabled: true } })
    body('ui-switch-control').click()
    await nextTick()
    expect(view.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('UiCheckbox', () => {
  it('should reflect its state', () => {
    mountAttached(UiCheckbox, { props: { modelValue: true, label: 'Keep longest only' } })
    expect(body('ui-checkbox-control').getAttribute('aria-checked')).toBe('true')
  })

  it('should emit a boolean when toggled', async () => {
    const view = mountAttached(UiCheckbox, { props: { modelValue: false } })
    body('ui-checkbox-control').click()
    await nextTick()
    expect(view.emitted('update:modelValue')?.at(-1)).toEqual([true])
  })
})

describe('UiSlider', () => {
  it('should expose its value and bounds to assistive technology', async () => {
    mountAttached(UiSlider, { props: { modelValue: 120, min: 80, max: 160, step: 5, label: 'Text size' } })
    await nextTick()
    const thumb = body('ui-slider-thumb')
    expect(thumb.getAttribute('role')).toBe('slider')
    expect(thumb.getAttribute('aria-valuenow')).toBe('120')
    expect(thumb.getAttribute('aria-valuemin')).toBe('80')
    expect(thumb.getAttribute('aria-valuemax')).toBe('160')
  })

  it('should emit a number when moved with the keyboard', async () => {
    const view = mountAttached(UiSlider, { props: { modelValue: 100, min: 80, max: 160, step: 5 } })
    body('ui-slider-thumb').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await nextTick()
    expect(view.emitted('update:modelValue')?.at(-1)).toEqual([105])
  })
})

describe('UiToast', () => {
  it('should show its message and a Close button when open', async () => {
    mountAttached(UiToast, { props: { modelValue: true }, slots: { default: 'Update ready' } })
    await nextTick()
    expect(body('ui-toast').textContent).toContain('Update ready')
    expect(body('ui-toast-close').textContent).toBe('Close')
  })

  it('should emit update:modelValue false when closed', async () => {
    const view = mountAttached(UiToast, { props: { modelValue: true }, slots: { default: 'x' } })
    await nextTick()
    body('ui-toast-close').click()
    await nextTick()
    expect(view.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('should render nothing while closed', () => {
    mountAttached(UiToast, { props: { modelValue: false }, slots: { default: 'x' } })
    expect(body('ui-toast')).toBeNull()
  })
})

describe('UiDivider', () => {
  it('should be horizontal unless vertical is set', () => {
    expect(mountAttached(UiDivider).attributes('data-orientation')).toBe('horizontal')
    wrapper.unmount()
    expect(mountAttached(UiDivider, { props: { vertical: true } }).attributes('data-orientation')).toBe('vertical')
  })
})

describe('UiPagination', () => {
  it('should mark the current page and show the page count', () => {
    mountAttached(UiPagination, { props: { modelValue: 2, length: 5 } })
    expect(body('ui-pagination-page-2').hasAttribute('data-selected')).toBe(true)
    expect(body('ui-pagination-page-5')).not.toBeNull()
  })

  it('should go to the next page', async () => {
    const view = mountAttached(UiPagination, { props: { modelValue: 2, length: 5 } })
    body('ui-pagination-next').click()
    await nextTick()
    expect(view.emitted('update:modelValue')?.at(-1)).toEqual([3])
  })

  it('should disable Previous on the first page', () => {
    mountAttached(UiPagination, { props: { modelValue: 1, length: 5 } })
    expect(body('ui-pagination-prev').hasAttribute('disabled')).toBe(true)
  })

  it('should show only the current page when visible is 0', () => {
    mountAttached(UiPagination, { props: { modelValue: 3, length: 9, visible: 0 } })
    expect(body('ui-pagination-page-3')).not.toBeNull()
    expect(body('ui-pagination-page-4')).toBeNull()
  })
})

describe('UiAccordion', () => {
  const items = [{ value: 'a', title: '3 rows ignored' }]

  it('should hide the panel until opened', () => {
    mountAttached(UiAccordion, { props: { items }, slots: { 'item-a': 'Row 4' } })
    expect(body('ui-accordion-trigger-a').getAttribute('aria-expanded')).toBe('false')
    expect(document.body.textContent).not.toContain('Row 4')
  })

  it('should show the panel when opened', () => {
    mountAttached(UiAccordion, { props: { items, modelValue: 'a' }, slots: { 'item-a': 'Row 4' } })
    expect(body('ui-accordion-trigger-a').getAttribute('aria-expanded')).toBe('true')
    expect(document.body.textContent).toContain('Row 4')
  })
})

describe('UiProgress', () => {
  it('should report its value', () => {
    mountAttached(UiProgress, { props: { value: 60 } })
    expect(body('ui-progress').getAttribute('aria-valuenow')).toBe('60')
  })

  it('should be indeterminate without a value', () => {
    mountAttached(UiProgress)
    expect(body('ui-progress').querySelector('.is-indeterminate')).not.toBeNull()
  })
})

describe('vIntersect', () => {
  it('should call the handler with the intersection state', () => {
    const calls = []
    const el = document.createElement('div')
    vIntersect.mounted(el, { value: (isIntersecting) => calls.push(isIntersecting), modifiers: {} })
    el._uiIntersect._trigger(true)
    expect(calls).toEqual([true])
    vIntersect.unmounted(el)
    expect(el._uiIntersect).toBeUndefined()
  })

  it('should skip the first call with the quiet modifier', () => {
    const calls = []
    const el = document.createElement('div')
    vIntersect.mounted(el, { value: (v) => calls.push(v), modifiers: { quiet: true } })
    el._uiIntersect._trigger(true)
    el._uiIntersect._trigger(false)
    expect(calls).toEqual([false])
  })
})
