import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiIcon from '../../src/ui/UiIcon.vue'
import UiButton from '../../src/ui/UiButton.vue'
import UiCard from '../../src/ui/UiCard.vue'
import UiChip from '../../src/ui/UiChip.vue'
import UiAlert from '../../src/ui/UiAlert.vue'
import UiSpinner from '../../src/ui/UiSpinner.vue'
import UiTable from '../../src/ui/UiTable.vue'
import UiBadge from '../../src/ui/UiBadge.vue'
import UiList from '../../src/ui/UiList.vue'
import UiListItem from '../../src/ui/UiListItem.vue'
import UiToolbar from '../../src/ui/UiToolbar.vue'
import { ICONS, MDI_ALIASES, resolveIcon } from '../../src/ui/icons.js'

describe('UiIcon', () => {
  it('should render a Lucide icon from its name', () => {
    const wrapper = mount(UiIcon, { props: { name: 'search' } })
    expect(wrapper.find('[data-testid="ui-icon"]').element.tagName.toLowerCase()).toBe('svg')
  })

  it('should read an mdi name from the slot like v-icon does', () => {
    const wrapper = mount(UiIcon, { slots: { default: 'mdi-magnify' } })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.attributes('data-missing-icon')).toBeUndefined()
  })

  it('should size in rem so it follows the Text size setting', () => {
    const wrapper = mount(UiIcon, { props: { name: 'search', size: 24 } })
    expect(wrapper.attributes('width')).toBe('1.5rem')
    expect(wrapper.attributes('height')).toBe('1.5rem')
  })

  it('should hide a decorative icon from assistive technology', () => {
    expect(mount(UiIcon, { props: { name: 'search' } }).attributes('aria-hidden')).toBe('true')
  })

  it('should expose an icon with a label as an image', () => {
    const wrapper = mount(UiIcon, { props: { name: 'search', label: 'Search' } })
    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('Search')
  })

  it('should have the two-bar drag handle used by reorderable lists', () => {
    const wrapper = mount(UiIcon, { props: { name: 'equal' } })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.attributes('data-missing-icon')).toBeUndefined()
  })

  it('should mark an unknown icon instead of throwing', () => {
    const wrapper = mount(UiIcon, { props: { name: 'nope' } })
    expect(wrapper.attributes('data-missing-icon')).toBe('nope')
  })

  it('should map every mdi alias onto an icon in the registry', () => {
    const broken = Object.entries(MDI_ALIASES).filter(([, key]) => !ICONS[key])
    expect(broken).toEqual([])
    expect(resolveIcon('mdi-close')).toBe(ICONS['x'])
  })
})

describe('UiButton', () => {
  it('should render its label and default to a non-submitting button', () => {
    const wrapper = mount(UiButton, { slots: { default: 'Save' } })
    expect(wrapper.get('[data-testid="ui-button"]').text()).toBe('Save')
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('should emit click when pressed', async () => {
    const wrapper = mount(UiButton)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('should not emit click when disabled', async () => {
    const wrapper = mount(UiButton, { props: { disabled: true } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('should be busy and unclickable while loading', () => {
    const wrapper = mount(UiButton, { props: { loading: true } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-testid="ui-spinner"]').exists()).toBe(true)
  })

  it('should apply the variant and size classes', () => {
    const wrapper = mount(UiButton, { props: { variant: 'danger', size: 'sm', icon: true } })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['ui-button--danger', 'ui-button--sm', 'ui-button--icon'])
    )
  })
})

describe('UiCard', () => {
  it('should render title, subtitle, body and actions', () => {
    const wrapper = mount(UiCard, {
      props: { title: 'Title', subtitle: 'Sub' },
      slots: { default: 'Body', actions: '<button>OK</button>' },
    })
    expect(wrapper.get('[data-testid="ui-card"]').text()).toContain('Title')
    expect(wrapper.text()).toContain('Sub')
    expect(wrapper.text()).toContain('Body')
    expect(wrapper.find('.ui-card__actions button').exists()).toBe(true)
  })

  it('should omit the header and footer when nothing is given', () => {
    const wrapper = mount(UiCard, { slots: { default: 'Body' } })
    expect(wrapper.find('.ui-card__header').exists()).toBe(false)
    expect(wrapper.find('.ui-card__actions').exists()).toBe(false)
  })
})

describe('UiChip', () => {
  it('should be a plain label by default', () => {
    const wrapper = mount(UiChip, { slots: { default: 'Berzin' } })
    expect(wrapper.get('[data-testid="ui-chip"]').element.tagName.toLowerCase()).toBe('span')
  })

  it('should toggle as a button and report its selected state', async () => {
    const wrapper = mount(UiChip, { props: { clickable: true, selected: true }, slots: { default: 'English' } })
    expect(wrapper.element.tagName.toLowerCase()).toBe('button')
    expect(wrapper.attributes('aria-pressed')).toBe('true')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('should emit remove without emitting click', async () => {
    const wrapper = mount(UiChip, { props: { removable: true, clickable: true } })
    await wrapper.get('[data-testid="ui-chip-remove"]').trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('should show the check only on the default toggle look', () => {
    const toggle = mount(UiChip, { props: { clickable: true, selected: true } })
    const pill = mount(UiChip, { props: { clickable: true, selected: true, variant: 'pill' } })
    expect(toggle.find('[data-testid="ui-icon"]').exists()).toBe(true)
    expect(pill.find('[data-testid="ui-icon"]').exists()).toBe(false)
    expect(pill.classes()).toContain('ui-chip--pill')
  })

  it('should show a count after the label of a subject tag', () => {
    const wrapper = mount(UiChip, {
      props: { clickable: true, variant: 'tag', tone: 'amber', count: 4 },
      slots: { default: 'archaic' },
    })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['ui-chip--tag', 'ui-chip--amber']))
    expect(wrapper.get('[data-testid="ui-chip-count"]').text()).toBe('4')
    expect(wrapper.text()).toBe('archaic4')
  })

  it('should not add a look class to a plain label', () => {
    const wrapper = mount(UiChip, { props: { variant: 'pill' } })
    expect(wrapper.classes()).not.toContain('ui-chip--pill')
  })

  it('should mark a highlighted plain label as selected without making it a button', () => {
    const wrapper = mount(UiChip, { props: { tone: 'amber', selected: true }, slots: { default: 'archaic' } })
    expect(wrapper.element.tagName.toLowerCase()).toBe('span')
    expect(wrapper.classes()).toContain('is-selected')
    expect(wrapper.attributes('aria-pressed')).toBeUndefined()
  })
})

describe('UiAlert', () => {
  it('should announce an error with role alert', () => {
    const wrapper = mount(UiAlert, { props: { type: 'error' }, slots: { default: 'Failed' } })
    expect(wrapper.get('[data-testid="ui-alert"]').attributes('role')).toBe('alert')
  })

  it('should announce information politely with role status', () => {
    expect(mount(UiAlert, { props: { type: 'info' } }).attributes('role')).toBe('status')
  })

  it('should show its title and message', () => {
    const wrapper = mount(UiAlert, { props: { title: 'Heads up' }, slots: { default: 'Message' } })
    expect(wrapper.text()).toContain('Heads up')
    expect(wrapper.text()).toContain('Message')
  })

  it('should emit dismiss only when dismissible', async () => {
    expect(mount(UiAlert).find('[data-testid="ui-alert-dismiss"]').exists()).toBe(false)
    const wrapper = mount(UiAlert, { props: { dismissible: true } })
    await wrapper.get('[data-testid="ui-alert-dismiss"]').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})

describe('UiSpinner', () => {
  it('should be a labelled status element sized in rem', () => {
    const wrapper = mount(UiSpinner, { props: { size: 32, label: 'Loading dictionaries' } })
    const root = wrapper.get('[data-testid="ui-spinner"]')
    expect(root.attributes('role')).toBe('status')
    expect(root.attributes('aria-label')).toBe('Loading dictionaries')
    expect(root.attributes('style')).toContain('2rem')
  })
})

describe('UiTable', () => {
  it('should render the table markup it is given', () => {
    const wrapper = mount(UiTable, {
      slots: { default: '<thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody>' },
    })
    expect(wrapper.get('[data-testid="ui-table"]').find('td').text()).toBe('1')
  })

  it('should apply the dense and hover modifiers', () => {
    const wrapper = mount(UiTable, { props: { dense: true, hover: true } })
    expect(wrapper.find('table').classes()).toEqual(
      expect.arrayContaining(['ui-table--dense', 'ui-table--hover'])
    )
  })
})

describe('UiBadge', () => {
  it('should show a dot when it has no content', () => {
    const wrapper = mount(UiBadge, { slots: { default: '<i />' } })
    expect(wrapper.get('[data-testid="ui-badge-mark"]').classes()).toContain('ui-badge__mark--dot')
  })

  it('should show a count', () => {
    const wrapper = mount(UiBadge, { props: { content: 3 } })
    expect(wrapper.get('[data-testid="ui-badge-mark"]').text()).toBe('3')
  })

  it('should hide the mark when show is false', () => {
    expect(mount(UiBadge, { props: { show: false } }).find('[data-testid="ui-badge-mark"]').exists()).toBe(false)
  })
})

describe('UiList and UiListItem', () => {
  it('should render rows with a title and subtitle', () => {
    const wrapper = mount(UiList, {
      slots: { default: '<li data-testid="row">x</li>' },
    })
    expect(wrapper.get('[data-testid="ui-list"]').find('[data-testid="row"]').exists()).toBe(true)
    const item = mount(UiListItem, { props: { title: 'Rangjung Yeshe', subtitle: 'comprehensive' } })
    expect(item.get('[data-testid="ui-list-item"]').text()).toContain('Rangjung Yeshe')
    expect(item.text()).toContain('comprehensive')
  })

  it('should emit click only when clickable', async () => {
    const plain = mount(UiListItem, { props: { title: 'A' } })
    await plain.get('.ui-list-item__row').trigger('click')
    expect(plain.emitted('click')).toBeUndefined()
    const clickable = mount(UiListItem, { props: { title: 'A', clickable: true } })
    await clickable.get('button').trigger('click')
    expect(clickable.emitted('click')).toHaveLength(1)
  })

  it('should mark the selected row as current', () => {
    const wrapper = mount(UiListItem, { props: { title: 'A', clickable: true, selected: true } })
    expect(wrapper.get('button').attributes('aria-current')).toBe('true')
  })
})

describe('UiToolbar', () => {
  it('should show its title, subtitle and actions', () => {
    const wrapper = mount(UiToolbar, {
      props: { title: 'My glossary', subtitle: '3 entries', icon: 'notebook-text' },
      slots: { default: '<button>Export</button>' },
    })
    expect(wrapper.get('[data-testid="ui-toolbar"]').text()).toContain('My glossary')
    expect(wrapper.text()).toContain('3 entries')
    expect(wrapper.find('.ui-toolbar__actions button').exists()).toBe(true)
  })
})
