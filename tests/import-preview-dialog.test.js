/**
 * ImportPreviewDialog — what the user is shown before a spreadsheet is written.
 *
 * The detection and diff rules themselves are covered in lexicon-import.test.js.
 * What this file pins is the promise the dialog makes: that the recap matches
 * what will actually be written, and that unchecking a conflict really does
 * keep it out of the payload.
 *
 * Follows the mounting idiom quick-add-dialog.test.js established — attachTo,
 * an injected snackbar, and lookups through document.body, since v-dialog
 * teleports its content out of the wrapper's own subtree.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

const entriesMock = vi.fn();
const applyImportMock = vi.fn();

vi.mock('../src/services/lexicon', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual.default,
      entries: (...args) => entriesMock(...args),
      applyImport: (...args) => applyImportMock(...args),
    },
  };
});

import ImportPreviewDialog from '../src/components/ImportPreviewDialog.vue';

const vuetify = createVuetify({ components, directives });
const snackbar = { open: vi.fn() };

const GRID = {
  sheetName: 'Sheet1',
  headers: ['A', 'B', 'C'],
  rows: [
    ['Terme', 'Traduction', 'Notes'],
    ['སངས་རྒྱས་', 'awakened one', 'n.'],
    ['བླ་མ་', 'lama', ''],
    ['', 'orphan', ''],
  ],
};

describe('ImportPreviewDialog', () => {
  beforeEach(() => {
    entriesMock.mockReset().mockResolvedValue({
      total: 1,
      entries: [{ id: 1, term: 'སངས་རྒྱས་', definition: 'buddha' }],
    });
    applyImportMock.mockReset().mockResolvedValue({ inserted: 1, updated: 1 });
    snackbar.open.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const mountDialog = (props = {}) =>
    mount(ImportPreviewDialog, {
      props: {
        modelValue: true,
        grid: GRID,
        packId: 'custom-notes',
        dictionaryId: 1,
        dictionaryName: 'My notes',
        ...props,
      },
      global: { plugins: [vuetify], provide: { snackbar } },
      attachTo: document.body,
    });

  const text = () => document.body.textContent;
  const findButton = (label) =>
    Array.from(document.body.querySelectorAll('button')).find((button) =>
      button.textContent.trim().includes(label)
    );

  it('recaps what the import will do', async () => {
    mountDialog();
    await flushPromises();
    expect(text()).toContain('1 new');
    expect(text()).toContain('1 modified');
    expect(text()).toContain('1 row ignored');
  });

  it('lists a modified entry old to new', async () => {
    mountDialog();
    await flushPromises();
    const entry = document.body.querySelector('[data-test="modified-entry"]');
    expect(entry.textContent).toContain('buddha');
    expect(entry.textContent).toContain('awakened one');
  });

  it('never renders unchanged entries', async () => {
    entriesMock.mockResolvedValue({
      total: 2,
      entries: [
        { id: 1, term: 'སངས་རྒྱས་', definition: 'awakened one' },
        { id: 2, term: 'བླ་མ་', definition: 'lama' },
      ],
    });
    mountDialog();
    await flushPromises();
    expect(text()).toContain('2 unchanged');
    expect(document.body.querySelectorAll('[data-test="modified-entry"]')).toHaveLength(0);
  });

  it('names the columns it is going to ignore', async () => {
    mountDialog();
    await flushPromises();
    expect(document.body.querySelector('[data-test="ignored-columns"]').textContent).toContain(
      'Notes'
    );
  });

  it('sends both new and modified entries when nothing is unchecked', async () => {
    mountDialog();
    await flushPromises();
    findButton('Import').click();
    await flushPromises();
    const [, , rows] = applyImportMock.mock.calls[0];
    expect(rows).toHaveLength(2);
  });

  it('excludes a conflict the user unchecked', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    wrapper.vm.toggle(1, false); // row 1 is the modified one
    await flushPromises();
    findButton('Import').click();
    await flushPromises();
    const [, , rows] = applyImportMock.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].term).toBe('བླ་མ་');
  });

  it('emits what was written', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    findButton('Import').click();
    await flushPromises();
    expect(wrapper.emitted('imported')[0][0]).toEqual({ inserted: 1, updated: 1 });
  });

  it('opens on the mapping step when it finds no Tibetan column', async () => {
    mountDialog({ grid: { sheetName: 'S', headers: ['A'], rows: [['one'], ['two']] } });
    await flushPromises();
    expect(document.body.querySelector('[data-test="mapping-step"]')).toBeTruthy();
    expect(text()).toMatch(/couldn't tell which column/i);
  });

  it('refuses to continue from the mapping step without a term column', async () => {
    mountDialog({ grid: { sheetName: 'S', headers: ['A'], rows: [['one'], ['two']] } });
    await flushPromises();
    expect(findButton('Continue').disabled).toBe(true);
  });

  it('treats every row as new when there is no dictionary to diff against', async () => {
    // The "create a dictionary from this file" flow: no packId yet, so there is
    // nothing to conflict with and no lookup to make.
    mountDialog({ packId: null });
    await flushPromises();
    expect(entriesMock).not.toHaveBeenCalled();
    expect(text()).toContain('2 new');
    expect(document.body.querySelectorAll('[data-test="modified-entry"]')).toHaveLength(0);
  });

  it('asks its parent to create the dictionary rather than creating one itself', async () => {
    const wrapper = mountDialog({ packId: null });
    await flushPromises();
    findButton('Import').click();
    await flushPromises();
    expect(wrapper.emitted('create-requested')).toBeTruthy();
    expect(applyImportMock).not.toHaveBeenCalled();
  });
});

describe('the recap in create mode', () => {
  beforeEach(() => {
    entriesMock.mockReset().mockResolvedValue({ total: 0, entries: [] });
    applyImportMock.mockReset().mockResolvedValue({ inserted: 0, updated: 0 });
  });

  it('omits the modified count when there is no dictionary to modify', async () => {
    mount(ImportPreviewDialog, {
      props: {
        modelValue: true,
        grid: GRID,
        packId: null,
        dictionaryId: 1,
        dictionaryName: '',
      },
      global: { plugins: [vuetify], provide: { snackbar } },
      attachTo: document.body,
    });
    await flushPromises();
    expect(document.body.textContent).toContain('2 new');
    expect(document.body.textContent).not.toContain('modified');
  });
});
