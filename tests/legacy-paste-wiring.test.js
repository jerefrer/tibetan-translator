/**
 * TibetanTextField paste wiring.
 *
 * The service in src/services/legacy-to-unicode.js is covered on its own in
 * legacy-to-unicode.test.js. What this file pins is that the field actually
 * consults it, and that doing so did not break the ordinary paste paths — the
 * handler now calls preventDefault() unconditionally, awaits mid-way, and has
 * to read the caret before that await rather than after it.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import TibetanTextField from '../src/components/TibetanTextField.vue';

const CHOGYAL_SANGS_RGYAS = '<$<-{<-'; // སངས་རྒྱས་ in the TibetanChogyal encoding
const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let vuetify;
beforeEach(() => {
  vuetify = createVuetify({ components, directives });
});

// The handler reaches the font tables through a dynamic import, and loading
// them the first time takes longer than the microtasks a paste assertion waits
// on. Warming it here keeps that one-off cost out of whichever test happens to
// run first; the retry in settle() covers the rest.
beforeAll(async () => {
  const { convertLegacyPaste } = await import('../src/services/legacy-to-unicode.js');
  await convertLegacyPaste({ text: CHOGYAL_SANGS_RGYAS });
});

const mountField = (modelValue = '') =>
  mount(TibetanTextField, {
    props: { modelValue },
    global: { plugins: [vuetify] },
  });

// happy-dom does not implement ClipboardEvent, and the handler only ever asks
// clipboardData for its two flavours.
function pasteEvent({ text = '', html = '' } = {}) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  event.clipboardData = { getData: (type) => (type === 'text/html' ? html : text) };
  return event;
}

// The handler is asynchronous, so give it several turns to land rather than
// assuming a single microtask drain is enough.
async function settle(wrapper, event) {
  for (let attempt = 0; attempt < 10; attempt++) {
    await flushPromises();
    if (wrapper.emitted(event)) return;
  }
}

async function paste(wrapper, clipboard) {
  wrapper.find('input').element.dispatchEvent(pasteEvent(clipboard));
  await settle(wrapper, 'update:modelValue');
  return wrapper.emitted('update:modelValue')?.at(-1)?.[0];
}

describe('pasting into TibetanTextField', () => {
  it('repairs legacy text the clipboard markup identifies by font', async () => {
    const value = await paste(mountField(), {
      text: CHOGYAL_SANGS_RGYAS,
      html: `<span style="font-family: TibetanChogyal">${escapeHtml(
        CHOGYAL_SANGS_RGYAS
      )}</span>`,
    });
    expect(value).toBe('སངས་རྒྱས་');
  });

  it('repairs legacy text with nothing but the plain-text flavour', async () => {
    const value = await paste(mountField(), { text: CHOGYAL_SANGS_RGYAS });
    expect(value).toBe('སངས་རྒྱས་');
  });

  it('still converts a pasted Wylie term', async () => {
    expect(await paste(mountField(), { text: 'sangs rgyas' })).toBe('སངས་རྒྱས་');
  });

  it('still accepts pasted Unicode Tibetan unchanged', async () => {
    expect(await paste(mountField(), { text: 'སངས་རྒྱས་' })).toBe('སངས་རྒྱས་');
  });

  it('still inserts at the caret rather than replacing the field', async () => {
    // The caret is read before the handler awaits; a regression that read it
    // afterwards would still pass on an empty field, so start from a full one.
    const wrapper = mountField('ཨ་');
    const input = wrapper.find('input');
    input.element.value = 'ཨ་';
    input.element.setSelectionRange(2, 2);
    input.element.dispatchEvent(pasteEvent({ text: CHOGYAL_SANGS_RGYAS }));
    await settle(wrapper, 'update:modelValue');
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toBe('ཨ་སངས་རྒྱས་');
  });

  it('still emits paste:multiple for a multi-line paste', async () => {
    const wrapper = mountField();
    wrapper
      .find('input')
      .element.dispatchEvent(pasteEvent({ text: 'sangs rgyas\nbde legs' }));
    await settle(wrapper, 'paste:multiple');
    expect(wrapper.emitted('paste:multiple')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });

  it('prevents the browser from inserting the raw text as well', async () => {
    const wrapper = mountField();
    const event = pasteEvent({ text: CHOGYAL_SANGS_RGYAS });
    wrapper.find('input').element.dispatchEvent(event);
    await settle(wrapper, 'update:modelValue');
    expect(event.defaultPrevented).toBe(true);
  });
});
