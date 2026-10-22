/**
 * CustomPackConflictModal: asked before an imported .tibdict replaces an
 * installed dictionary of the same id.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CustomPackConflictModal from '../src/components/CustomPackConflictModal.vue'

const EXISTING = { name: 'My Lexicon', version: '1.0.0' }

afterEach(() => {
  document.body.innerHTML = ''
})

const mountModal = (props) =>
  mount(CustomPackConflictModal, {
    props: { modelValue: true, existingManifest: EXISTING, incomingManifest: EXISTING, ...props },
    attachTo: document.body,
  })

const findButton = (label) =>
  Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent.trim() === label)

describe('CustomPackConflictModal', () => {
  it('names the dictionary and its installed version', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(document.body.textContent).toContain('Replace dictionary?')
    expect(document.body.textContent).toContain('My Lexicon')
    expect(document.body.textContent).toContain('(v1.0.0)')
    expect(document.body.textContent).not.toContain('The new file is version')
    wrapper.unmount()
  })

  it('mentions the new version only when it differs', async () => {
    const wrapper = mountModal({ incomingManifest: { name: 'My Lexicon', version: '1.1.0' } })
    await flushPromises()
    expect(document.body.textContent).toContain('The new file is version v1.1.0.')
    wrapper.unmount()
  })

  it('warns that local edits will be lost', async () => {
    const wrapper = mountModal({ existingManifest: { ...EXISTING, modifiedAt: '2026-01-01' } })
    await flushPromises()
    expect(document.body.textContent).toContain('Replacing it will discard your changes.')
    wrapper.unmount()
  })

  it('emits confirm or cancel from its buttons', async () => {
    const wrapper = mountModal()
    await flushPromises()
    findButton('Replace').click()
    findButton('Cancel').click()
    await flushPromises()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    wrapper.unmount()
  })
})
