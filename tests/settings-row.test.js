/**
 * SettingsRow: one setting, with an optional icon tile before its title.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsRow from '../src/components/settings/SettingsRow.vue'

describe('SettingsRow', () => {
  it('should show its icon on a tile before the title', () => {
    const wrapper = mount(SettingsRow, { props: { title: 'Theme', icon: 'sun-moon' } })
    const tile = wrapper.get('.settings-row__icon')
    expect(tile.attributes('aria-hidden')).toBe('true')
    expect(tile.find('svg').exists()).toBe(true)
    expect(tile.element.nextElementSibling.classList).toContain('settings-row__text')
  })

  it('should show the icon on a row that leads somewhere too', () => {
    const wrapper = mount(SettingsRow, { props: { title: 'Dictionaries', icon: 'book-open', clickable: true } })
    expect(wrapper.find('.settings-row__icon').exists()).toBe(true)
  })

  it('should show no tile without an icon', () => {
    const wrapper = mount(SettingsRow, { props: { title: 'Bodong' } })
    expect(wrapper.find('.settings-row__icon').exists()).toBe(false)
  })
})
