<template>
  <div class="lexicon-page-wrapper" :class="{ 'is-phone': isPhone }" data-testid="lexicon-page">
    <div class="lexicon-page">
      <!-- On a phone the glossary is a row of Settings; the desktop sidebar
           lists it directly -->
      <div v-if="isPhone" class="phone-bar">
        <button
          type="button"
          class="back-link"
          data-testid="lexicon-back"
          @click="$router.push('/settings')"
        >
          <ui-icon name="chevron-left" :size="22" :stroke-width="2.4" />
          Settings
        </button>
        <ui-menu v-if="selected" :items="moreItems" align="end" @select="onMoreMenu">
          <button type="button" class="phone-bar__more" aria-label="Import, export" data-testid="lexicon-more">
            <ui-icon name="ellipsis" :size="22" />
          </button>
        </ui-menu>
      </div>

      <div v-if="!isSupported" class="unsupported" data-testid="lexicon-unsupported">
        Your own glossaries live in the desktop and mobile apps.
      </div>

      <template v-else>
        <header v-if="dictionaryOptions.length" class="page-header">
          <div class="page-header__titles">
            <h1 class="page-title">
              <ui-menu :items="glossaryMenuItems" @select="onGlossaryMenu">
                <button type="button" class="glossary-picker" aria-haspopup="menu" data-testid="lexicon-picker">
                  {{ selected ? selected.name : 'My glossary' }}
                  <ui-icon name="chevron-down" :size="isPhone ? 20 : 20" :stroke-width="2.6" class="glossary-picker__chevron" />
                </button>
              </ui-menu>
            </h1>
            <p v-if="selected" class="page-summary" data-testid="lexicon-count">{{ summary }}</p>
          </div>

          <div v-if="selected && !isPhone" class="page-header__actions">
            <ui-button variant="outline" size="sm" data-testid="lexicon-import" @click="importSpreadsheet">
              <ui-icon name="file-input" :size="15" />
              Import
            </ui-button>
            <ui-menu :items="exportItems" align="end" @select="onExport">
              <ui-button variant="outline" size="sm" data-testid="lexicon-export">
                <ui-icon name="download" :size="15" />
                Export
                <ui-icon name="chevron-down" :size="13" :stroke-width="2.4" />
              </ui-button>
            </ui-menu>
            <ui-button size="sm" data-testid="lexicon-add" @click="openAdd">
              <ui-icon name="plus" :size="15" :stroke-width="2.4" />
              Add an entry
            </ui-button>
          </div>
        </header>

        <glossary-actions ref="actions" :show-empty="!dictionaryOptions.length" />

        <template v-if="selected">
          <ui-text-field
            v-model="search"
            placeholder="Search a term or a definition"
            prepend-icon="search"
            clearable
            type="search"
            enterkeyhint="search"
            class="search-field"
            data-testid="lexicon-search"
            @update:model-value="onSearchInput"
          />

          <template v-if="entries.length">
            <div v-if="isPhone" class="entry-group" data-testid="lexicon-entries">
              <button
                v-for="row in entries"
                :key="row.id"
                type="button"
                class="entry-item"
                :aria-label="`Edit ${row.term}`"
                data-testid="lexicon-entry"
                @click="openEdit(row)"
              >
                <span class="entry-item__text">
                  <span class="entry-term">{{ row.term }}</span>
                  <span class="entry-definition">{{ row.definition }}</span>
                </span>
                <ui-icon name="chevron-right" :size="16" :stroke-width="2" class="entry-item__chevron" />
              </button>
            </div>

            <div v-else class="entry-table" role="table" aria-label="Entries" data-testid="lexicon-entries">
              <div class="entry-row entry-row--head" role="row">
                <span role="columnheader">Tibetan</span>
                <span role="columnheader">Definition</span>
                <span role="columnheader" class="ui-visually-hidden">Actions</span>
              </div>
              <div
                v-for="row in entries"
                :key="row.id"
                class="entry-row"
                role="row"
                data-testid="lexicon-entry"
              >
                <span class="entry-term" role="cell">{{ row.term }}</span>
                <p class="entry-definition" role="cell">{{ row.definition }}</p>
                <span class="entry-actions" role="cell">
                  <ui-tooltip text="Edit">
                    <ui-button
                      variant="ghost"
                      size="sm"
                      icon
                      :aria-label="'Edit ' + row.term"
                      class="row-action"
                      data-testid="lexicon-edit"
                      @click="openEdit(row)"
                    >
                      <ui-icon name="pencil" :size="16" />
                    </ui-button>
                  </ui-tooltip>
                  <ui-tooltip text="Delete">
                    <ui-button
                      variant="ghost"
                      size="sm"
                      icon
                      :aria-label="'Delete ' + row.term"
                      class="row-action row-action--delete"
                      data-testid="lexicon-delete"
                      @click="promptRemove(row)"
                    >
                      <ui-icon name="trash-2" :size="16" />
                    </ui-button>
                  </ui-tooltip>
                </span>
              </div>
            </div>
          </template>

          <div v-else class="entries-empty" data-testid="lexicon-empty-list">
            <template v-if="search">No entry matches this search.</template>
            <template v-else>
              This glossary is empty.
              <button type="button" class="entries-empty__add" @click="openAdd">Add its first entry</button>
            </template>
          </div>

          <footer v-if="entries.length || dropHint" class="page-footer">
            <span class="page-footer__text">
              <template v-if="entries.length">{{ rangeText }}</template><template v-if="entries.length && dropHint"> · </template><template v-if="dropHint">drop a spreadsheet anywhere on the window to import it</template>
            </span>
            <ui-pagination
              v-if="pageCount > 1"
              v-model="page"
              :length="pageCount"
              :visible="isPhone ? 5 : 7"
              class="pagination"
              @update:model-value="load"
            />
          </footer>
        </template>

        <div v-if="selected && isPhone" class="add-bar">
          <ui-button class="add-bar__button" data-testid="lexicon-add" @click="openAdd">
            <ui-icon name="plus" :size="18" :stroke-width="2.6" />
            Add an entry
          </ui-button>
        </div>

        <LexiconEntryDialog
          v-if="selected"
          v-model="dialogOpen"
          :pack-id="selected.packId"
          :dictionary-id="selected.dictionaryId"
          :entry="editing"
          :deletable="isPhone"
          @saved="onSaved"
          @delete="promptRemove"
        />

        <spreadsheet-drop-dialog
          v-if="selected"
          v-model="importChooserOpen"
          :title="'Import into ' + selected.name"
          @path="openImportFor"
          @file="openImportForFile"
        />

        <ImportPreviewDialog
          v-if="selected && importGrid"
          v-model="importOpen"
          :grid="importGrid"
          :pack-id="selected.packId"
          :dictionary-id="selected.dictionaryId"
          :dictionary-name="selected.name"
          @imported="onImported"
        />

        <ui-dialog v-model="removeOpen" title="Delete this entry?" :max-width="520">
          <template v-if="removeTarget">
            <p class="remove-entry">
              <span class="remove-entry__term">{{ removeTarget.term }}</span>
              <span class="remove-entry__definition">{{ removeTarget.definition }}</span>
            </p>
            <p class="remove-warning">This cannot be undone.</p>
          </template>
          <template #actions>
            <ui-button variant="outline" @click="removeOpen = false">Cancel</ui-button>
            <ui-button variant="danger" data-testid="lexicon-confirm-delete" @click="confirmRemove">
              <ui-icon name="trash-2" :size="16" />
              Delete
            </ui-button>
          </template>
        </ui-dialog>
      </template>
    </div>
  </div>
</template>

<script>
import { save } from '@tauri-apps/plugin-dialog';
import _ from 'underscore';
import Lexicon, { messageForError } from '../services/lexicon';
import LexiconEntryDialog from './LexiconEntryDialog.vue';
import ImportPreviewDialog from './ImportPreviewDialog.vue';
import GlossaryActions from './GlossaryActions.vue';
import SpreadsheetDropDialog, { SPREADSHEET_EXTENSIONS } from './SpreadsheetDropDialog.vue';
import { resolveIcon } from '../ui/icons';
import PackManager from '../services/pack-manager';
import ResizeService from '../services/resize-service';
import { isMobile, supportsModularPacks } from '../config/platform';
import {
  UiButton,
  UiDialog,
  UiIcon,
  UiMenu,
  UiPagination,
  UiTextField,
  UiTooltip,
} from '../ui';

const PAGE_SIZE = 50;

// My glossary (boards DesktopGlossary, MobileGlossary): the entries of one of
// the user's glossaries, to search, add, edit, delete, import and export.
// The title is the glossary picker: its menu lists the glossaries and holds
// what is done to them as a whole (GlossaryActions: new, from a spreadsheet,
// a .tibdict file, remove). With no glossary yet, the page offers those three
// ways to start. Phone: the rows open the entry dialog, import and export
// are under the ⋯ menu, Add an entry floats above the list.
export default {
  name: 'LexiconPage',
  components: {
    LexiconEntryDialog,
    ImportPreviewDialog,
    GlossaryActions,
    SpreadsheetDropDialog,
    UiButton,
    UiDialog,
    UiIcon,
    UiMenu,
    UiPagination,
    UiTextField,
    UiTooltip,
  },
  inject: ['snackbar'],
  data() {
    return {
      search: '',
      page: 1,
      total: 0,
      entries: [],
      dialogOpen: false,
      editing: null,
      removeOpen: false,
      removeTarget: null,
      importOpen: false,
      importGrid: null,
      // The dialog to drop or choose a spreadsheet in
      importChooserOpen: false,
      // The page is the one shown (<keep-alive> keeps it mounted elsewhere)
      shown: false,
      // Phone layout (the app-wide 600 px breakpoint), kept in sync on resize
      isPhone: ResizeService.isMobile(),
      exportItems: [
        { key: 'tibdict', label: 'Dictionary file', description: 'To share, or to reinstall later', icon: 'file-archive' },
        { key: 'xlsx', label: 'Spreadsheet', description: 'To edit in Excel and import back', icon: 'file-spreadsheet' },
      ],
      // Assigned in created() so the template's @update:model-value="onSearchInput"
      // binding always resolves to the debounced call, even on the very first render.
      onSearchInput: null,
    };
  },
  computed: {
    isSupported() {
      return supportsModularPacks();
    },
    dictionaryOptions() {
      return Lexicon.editableDictionaries().map((dictionary) => ({
        ...dictionary,
        key: `${dictionary.packId}:${dictionary.dictionaryId}`,
        label: dictionary.name,
      }));
    },
    // The route is the ONLY source of truth for which dictionary is shown —
    // not a separate `selectedKey` data field. A round of review found that
    // mirroring the route into local state and reconciling the two with a
    // '$route.params.packId' watcher was unsound: the watcher only sees the
    // immediately preceding value, so a round trip through an unrelated
    // route (e.g. /glossary/A -> /settings -> /glossary/A) looks identical,
    // from that one watcher's perspective, to a fresh navigation back to A —
    // there is no way to tell "the user pressed back" apart from "the user
    // clicked Manage entries on A again" from route state alone. Deriving
    // `selected` straight from $route.params removes the second source of
    // truth instead of trying to arbitrate between them.
    selected() {
      const options = this.dictionaryOptions;
      const packId = this.$route.params.packId;
      if (!packId) return null;
      const dictionaryId = this.$route.params.dictionaryId;
      if (dictionaryId) {
        return (
          options.find(
            (option) =>
              option.packId === packId && String(option.dictionaryId) === String(dictionaryId)
          ) || null
        );
      }
      // No dictionaryId in the route — e.g. Settings' "Manage entries" button
      // only knows about packs, not individual dictionaries within one.
      // Default to that pack's first dictionary.
      return options.find((option) => option.packId === packId) || null;
    },
    selectedKey() {
      return this.selected ? this.selected.key : null;
    },
    // The title's menu: the glossaries, then what is done to them as a whole
    glossaryMenuItems() {
      const glossaries = this.dictionaryOptions.map((option) => ({
        key: 'select:' + option.key,
        label: option.label,
        description: `${option.entriesCount || 0} ${option.entriesCount === 1 ? 'entry' : 'entries'}`,
        icon: option.key === this.selectedKey ? 'check' : this.packIcon(option.packId),
      }));
      const items = [
        ...glossaries,
        { separator: true },
        { key: 'new', label: 'New glossary…', icon: 'plus' },
        { key: 'sheet', label: 'New glossary from a spreadsheet…', icon: 'file-spreadsheet' },
        { key: 'tibdict', label: 'Add a .tibdict file…', icon: 'file-up' },
      ];
      if (this.selected) {
        items.push({ separator: true }, {
          key: 'remove',
          label: `Remove “${this.selected.packName}”…`,
          icon: 'trash-2',
          danger: true,
        });
      }
      return items;
    },
    // Phone: the ⋯ menu, import and export
    moreItems() {
      return [
        { key: 'import', label: 'Import a spreadsheet…', icon: 'file-input' },
        { separator: true },
        ...this.exportItems.map((item) => ({ ...item, label: `Export as a ${item.label.toLowerCase()}` })),
      ];
    },
    summary() {
      return this.search ? this.entriesLabel : `${this.entriesLabel} · searched along with your other dictionaries`;
    },
    rangeText() {
      const first = (this.page - 1) * PAGE_SIZE + 1;
      const last = first + this.entries.length - 1;
      return `${first}–${last} of ${this.total}`;
    },
    // Where a spreadsheet can be dropped on the window (desktop app)
    dropHint() {
      return supportsModularPacks() && !isMobile() && !this.isPhone;
    },
    spreadsheetPattern() {
      return new RegExp(`\\.(${SPREADSHEET_EXTENSIONS.join('|')})$`, 'i');
    },
    pageCount() {
      return Math.max(1, Math.ceil(this.total / PAGE_SIZE));
    },
    entriesLabel() {
      const noun = this.total === 1 ? 'entry' : 'entries';
      if (!this.search) return `${this.total} ${noun}`;
      return `${this.total} ${noun} matching`;
    },
  },
  watch: {
    selectedKey() {
      this.page = 1;
      this.load();
    },
  },
  created() {
    this.onSearchInput = _.debounce(() => {
      this.page = 1;
      this.load();
    }, 250);
  },
  async activated() {
    // syncSelection() returns its navigation promise specifically so this can
    // be awaited: Vue discards whatever a lifecycle hook returns, so this
    // changes no runtime behaviour, but it removes an unhandled floating
    // promise and makes the ordering (settle the route, then load) explicit
    // instead of relying on the selectedKey watcher to paper over a load()
    // that ran before the route had actually settled.
    this.shown = true;
    await this.syncSelection();
    this.load();
  },
  mounted() {
    // mounted()/beforeUnmount() each fire exactly once per component instance,
    // even under App.vue's <keep-alive> (only activated()/deactivated() repeat
    // on navigation), so a single add here can never double-register — same
    // pattern as LookupPage.vue's 'all-terms-updated' listener.
    window.addEventListener('dictionaries-updated', this.syncSelection);
    ResizeService.subscribe('lexicon-page', () => {
      this.isPhone = ResizeService.isMobile();
    });
    this.listenForDroppedSpreadsheets();
  },
  deactivated() {
    // <keep-alive> keeps the page mounted elsewhere: its drops stop here
    this.shown = false;
  },
  beforeUnmount() {
    window.removeEventListener('dictionaries-updated', this.syncSelection);
    window.removeEventListener('drop', this.onWindowDrop);
    ResizeService.unsubscribe('lexicon-page');
  },
  methods: {
    // Falls back to the first available dictionary — and navigates so the
    // route reflects that fallback — when the route names nothing, names a
    // pack/dictionary that isn't installed, or names one that was just
    // deleted. When the route already names a valid, installed dictionary,
    // `selected` is already correct and there is nothing to do here.
    // Returns the navigation's promise (or undefined when there's nothing to
    // do) so callers that need to know the route has actually settled — the
    // test suite, in particular — can await it deterministically instead of
    // guessing how many microtask/scheduler ticks vue-router needs.
    syncSelection() {
      if (this.selected) return;
      const options = this.dictionaryOptions;
      if (!options.length) return;
      return this.navigateTo(options[0]);
    },
    // Manifests name an `mdi-*` icon; fall back when there is no Lucide match
    packIcon(packId) {
      const icon = PackManager.customPacks.find((pack) => pack.id === packId)?.manifest?.icon;
      return icon && resolveIcon(icon) ? icon : 'notebook-text';
    },
    onGlossaryMenu(item) {
      if (item.key.startsWith('select:')) return this.onSelectDictionary(item.key.slice('select:'.length));
      const actions = this.$refs.actions;
      if (item.key === 'new') return actions.onCreate();
      if (item.key === 'sheet') return actions.onCreateFromSpreadsheet();
      if (item.key === 'tibdict') return actions.onImportClick();
      if (item.key === 'remove') {
        const pack = PackManager.customPacks.find((candidate) => candidate.id === this.selected?.packId);
        if (pack) actions.onRemove(pack);
      }
    },
    onMoreMenu(item) {
      if (item.key === 'import') return this.importSpreadsheet();
      return this.onExport(item);
    },
    onSelectDictionary(key) {
      const option = this.dictionaryOptions.find((o) => o.key === key);
      if (option) return this.navigateTo(option);
    },
    navigateTo(option) {
      const path = `/glossary/${option.packId}/${option.dictionaryId}`;
      if (this.$route.path === path) return; // avoid a redundant-navigation warning
      return this.$router.replace(path);
    },
    async load() {
      if (!this.selected) {
        this.entries = [];
        this.total = 0;
        return;
      }
      try {
        const fetchPage = () =>
          Lexicon.entries(this.selected.packId, this.selected.dictionaryId, {
            search: this.search || '',
            limit: PAGE_SIZE,
            offset: (this.page - 1) * PAGE_SIZE,
          });
        let response = await fetchPage();
        // `total` is a plain COUNT(*), independent of the requested offset,
        // and an out-of-range offset returns zero rows rather than an error
        // — so deleting the last entry on the last page (or switching to a
        // smaller dictionary while on a later page) leaves `page` pointing
        // past the end. Clamp and re-fetch once instead of stranding the
        // user on an empty page with no pagination control left to escape
        // it (v-pagination only renders when pageCount > 1). Bounded to a
        // single retry by construction — no recursive self-call, so this
        // cannot loop.
        const lastValidPage = Math.max(1, Math.ceil(response.total / PAGE_SIZE));
        if (this.page > lastValidPage) {
          this.page = lastValidPage;
          response = await fetchPage();
        }
        this.entries = response.entries;
        this.total = response.total;
      } catch (e) {
        console.error('[LexiconPage] load failed:', e);
        this.snackbar.open(messageForError(e, 'Could not read this glossary.'));
      }
    },
    openAdd() {
      this.editing = null;
      this.dialogOpen = true;
    },
    openEdit(row) {
      this.editing = row;
      this.dialogOpen = true;
    },
    onSaved() {
      this.load();
    },
    promptRemove(row) {
      this.removeTarget = row;
      this.removeOpen = true;
    },
    async confirmRemove() {
      const row = this.removeTarget;
      if (!row) return;
      try {
        await Lexicon.deleteEntry(this.selected.packId, row.id);
        this.removeOpen = false;
        this.snackbar.open('Entry removed');
        this.load();
      } catch (e) {
        console.error('[LexiconPage] delete failed:', e);
        this.snackbar.open(messageForError(e, 'Could not remove this entry.'));
      }
    },
    /** Read a spreadsheet and open the preview on it.
     *
     * Reads through plugin-fs rather than handing Rust the path: the picker
     * returns a content:// URI on Android and a file:// URI on iOS, and only
     * plugin-fs understands all three platforms' formats. */
    async openImportFor(path) {
      await this.previewSpreadsheet(async () => {
        const { readFile } = await import('@tauri-apps/plugin-fs');
        return { bytes: await readFile(path), name: String(path).split(/[\\/]/).pop() };
      });
    },
    /** A spreadsheet dropped on the window or on the import dialog. */
    async openImportForFile(file) {
      await this.previewSpreadsheet(async () => ({
        bytes: new Uint8Array(await file.arrayBuffer()),
        name: file.name,
      }));
    },
    async previewSpreadsheet(read) {
      try {
        const { bytes, name } = await read();
        this.importGrid = await Lexicon.readSpreadsheet(Array.from(bytes), name);
        this.importOpen = true;
      } catch (e) {
        console.error('[LexiconPage] could not read the spreadsheet:', e);
        this.snackbar.open(messageForError(e, 'Could not read this file.'));
      }
    },
    importSpreadsheet() {
      this.importChooserOpen = true;
    },
    onExport(item) {
      if (item.key === 'tibdict') return this.exportLexicon();
      if (item.key === 'xlsx') return this.exportXlsx();
    },
    async onImported({ inserted, updated }) {
      this.importOpen = false;
      await this.load();
      this.snackbar.open(`${inserted} added, ${updated} updated`);
    },
    /** Accept a spreadsheet dropped anywhere on the window, desktop only.
     *
     * HTML5 drop events, as App.vue's .tibdict drop: Tauri's own drag and
     * drop is off (dragDropEnabled, tauri.conf.json) so that dragging rows
     * keeps working. App.vue already lets files be dragged over the window. */
    listenForDroppedSpreadsheets() {
      window.removeEventListener('drop', this.onWindowDrop);
      if (this.dropHint) window.addEventListener('drop', this.onWindowDrop);
    },
    onWindowDrop(event) {
      // Only while the glossary is shown and no dialog is open (the drop
      // dialogs have their own zone)
      if (!this.shown || !this.selected || document.querySelector('[role="dialog"]')) return;
      const files = Array.from(event.dataTransfer?.files || []);
      // A .tibdict is App.vue's to install
      if (files.some((candidate) => /\.tibdict$/i.test(candidate.name))) return;
      const file = files.find((candidate) => this.spreadsheetPattern.test(candidate.name));
      if (!file) return;
      event.preventDefault();
      this.openImportForFile(file);
    },
    /** Write the dictionary out as xlsx.
     *
     * The bytes come from Rust and are written here through plugin-fs, which
     * understands the URI the save dialog returns on iOS and Android where
     * std::fs would not. */
    async exportXlsx() {
      try {
        const destPath = await save({
          defaultPath: `${this.selected.name}.xlsx`,
          filters: [{ name: 'Spreadsheet', extensions: ['xlsx'] }],
        });
        if (!destPath) return;
        const bytes = await Lexicon.exportXlsx(
          this.selected.packId,
          this.selected.dictionaryId
        );
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        await writeFile(destPath, new Uint8Array(bytes));
        this.snackbar.open('Exported as a spreadsheet');
      } catch (e) {
        console.error('[LexiconPage] xlsx export failed:', e);
        this.snackbar.open(messageForError(e, 'Could not export this dictionary.'));
      }
    },
    async exportLexicon() {
      try {
        const destPath = await save({
          defaultPath: `${this.selected.packName}.tibdict`,
          filters: [{ name: 'Tibetan dictionary', extensions: ['tibdict'] }],
        });
        if (!destPath) return;
        const outcome = await Lexicon.export(this.selected.packId, destPath);
        this.snackbar.open(`Exported as v${outcome.version}`);
      } catch (e) {
        console.error('[LexiconPage] export failed:', e);
        this.snackbar.open(messageForError(e, 'Could not export this dictionary.'));
      }
    },
  },
};
</script>

<style lang="stylus" scoped>
.lexicon-page-wrapper
  box-sizing border-box
  height 100%
  overflow-y auto
  background var(--bg)
  color var(--ink)
  font-family var(--font-ui)
  font-size var(--text-base)

// Desktop: a centred column up to 61rem (board DesktopGlossary)
.lexicon-page
  box-sizing border-box
  min-height 100%
  max-width 61rem
  margin 0 auto
  display flex
  flex-direction column
  gap 18px
  padding 28px 40px 40px

.page-header
  display flex
  align-items flex-start
  justify-content space-between
  flex-wrap wrap
  gap var(--space-4)

.page-header__titles
  min-width 0
  display flex
  flex-direction column
  gap var(--space-1)

.page-header__actions
  flex none
  display flex
  gap var(--space-2)
  padding-top var(--space-1)

.page-title
  margin 0
  font-size var(--text-heading)
  font-weight 700
  letter-spacing -0.01em
  line-height 1.25
  min-width 0

// The title is the glossary picker: it looks like a title until hovered
.glossary-picker
  display inline-flex
  align-items center
  gap var(--space-2)
  max-width 100%
  margin 0 0 0 calc(-1 * var(--space-2))
  padding 2px var(--space-2)
  border 0
  border-radius var(--radius-lg)
  background transparent
  font inherit
  letter-spacing inherit
  text-align left
  color inherit
  cursor pointer
  transition background-color 0.15s ease

  &:hover,
  &[data-state='open']
    background var(--soft)

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset 1px

.glossary-picker__chevron
  flex none
  color var(--muted)

.page-summary
  margin 0
  font-size var(--text-base)
  color var(--muted)

.unsupported
  padding var(--space-8) 0
  text-align center
  color var(--muted)

.search-field
  width 100%
  max-width 32.5rem

  :deep(.ui-field__control)
    min-height 2.5rem
    border-radius var(--radius-md)

  // The clear button is ours; hide the browser's own on type="search"
  :deep(.ui-field__input::-webkit-search-cancel-button)
    display none

// Desktop: a table, Edit and Delete showing on the row the pointer is on
.entry-row
  display grid
  // The term column stops at 30% of the row: at a fixed width it kept too
  // much room for the term on a narrow window and squeezed the definition
  grid-template-columns minmax(0, unquote('min(14rem, 30%)')) minmax(0, 1fr) 4.5rem
  gap 20px
  align-items center
  min-height 3.625rem
  padding 6px var(--space-3)
  border-bottom 1px solid var(--line-soft)
  transition background-color 0.15s ease

  &:not(.entry-row--head):hover,
  &:focus-within
    background var(--bg-quiet)

.entry-row--head
  min-height 2rem
  font-size var(--text-xs)
  font-weight 600
  letter-spacing 0.06em
  text-transform uppercase
  color var(--muted)

.entry-term
  font-family var(--font-tibetan)
  font-size var(--text-tibetan-sm)
  line-height 1.7
  color var(--rubric)
  overflow-wrap anywhere

// Definitions are often several lines long; keep the user's line breaks
.entry-definition
  margin 0
  font-family var(--font-serif)
  font-size var(--text-md)
  line-height 1.5
  white-space pre-wrap
  overflow-wrap anywhere

.entry-actions
  display flex
  justify-content flex-end
  gap 2px
  opacity 0
  transition opacity 0.15s ease

.entry-row:hover .entry-actions,
.entry-row:focus-within .entry-actions
  opacity 1

// No hover on a touch screen: the actions stay visible
@media (hover: none)
  .entry-actions
    opacity 1

.row-action
  color var(--muted)

  &:hover:not(:disabled)
    color var(--ink)
    background var(--soft)

.row-action--delete:hover:not(:disabled)
  color var(--danger-ink)
  background var(--danger-soft)

.entries-empty
  padding var(--space-8) var(--space-4)
  text-align center
  color var(--muted)
  border 1px dashed var(--line-strong)
  border-radius var(--radius-card)

.entries-empty__add
  padding 0
  border 0
  background none
  font inherit
  color var(--accent)
  cursor pointer

.page-footer
  display flex
  align-items center
  justify-content space-between
  flex-wrap wrap
  gap var(--space-3)

.page-footer__text
  font-size var(--text-sm)
  color var(--muted)

.remove-entry
  margin 0
  display flex
  flex-direction column

.remove-entry__term
  font-family var(--font-tibetan)
  font-size var(--text-tibetan-lg)
  line-height 1.7
  color var(--rubric)

.remove-entry__definition
  white-space pre-wrap

.remove-warning
  margin 14px 0 0
  font-size var(--text-sm)
  color var(--muted)

@media (prefers-reduced-motion: reduce)
  .glossary-picker,
  .entry-row,
  .entry-actions
    transition none

// Phone (board MobileGlossary): a back link and ⋯ above a large title, the
// entries as one white group on the grey ground, Add an entry floating
.phone-bar
  display flex
  align-items center
  justify-content space-between
  min-height 2.75rem

.back-link
  display inline-flex
  align-items center
  gap 2px
  margin-left -8px
  padding 0 var(--space-2) 0 0
  min-height 2.75rem
  border 0
  background none
  color var(--accent)
  font var(--text-md) var(--font-ui)
  cursor pointer

  &:focus-visible
    outline 2px solid var(--accent)
    border-radius var(--radius-sm)

.phone-bar__more
  display inline-flex
  align-items center
  justify-content center
  width 2.75rem
  height 2.75rem
  margin-right -10px
  border 0
  border-radius var(--radius-pill)
  background none
  color var(--accent)
  cursor pointer

  &:focus-visible
    outline 2px solid var(--accent)

.is-phone
  background var(--bg-grouped)

  .lexicon-page
    gap 14px
    padding var(--space-3) var(--space-4) 0

  .page-title
    font-size 1.75rem

  .glossary-picker
    margin-left 0
    padding 0

    &:hover,
    &[data-state='open']
      background transparent

  .search-field
    max-width none

    :deep(.ui-field__control)
      min-height 2.5rem
      border 0
      background var(--soft)

    :deep(.ui-field__input)
      font-size var(--text-md)

  .entries-empty
    background var(--surface)
    border 0

.entry-group
  display flex
  flex-direction column
  border-radius var(--radius-group)
  background var(--surface)
  overflow hidden

.entry-item
  display flex
  align-items center
  gap var(--space-3)
  width 100%
  min-height 3.75rem
  padding var(--space-2) var(--space-3) var(--space-2) var(--space-4)
  border 0
  border-top 1px solid var(--soft)
  background none
  font inherit
  text-align left
  color var(--ink)
  cursor pointer
  -webkit-tap-highlight-color transparent

  &:first-child
    border-top 0

  &:active
    background var(--soft)

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset -2px

  .entry-term
    font-size var(--text-result-tibetan)
    line-height 1.6

  .entry-definition
    font-size 0.9375rem
    line-height 1.4
    color var(--muted)
    white-space nowrap
    overflow hidden
    text-overflow ellipsis

.entry-item__text
  flex 1
  min-width 0
  display flex
  flex-direction column

.entry-item__chevron
  flex none
  color var(--faint)

// Floats above the bottom bar while the list scrolls under it
.add-bar
  position sticky
  bottom 0
  display flex
  justify-content flex-end
  margin-top auto
  padding var(--space-3) 0 var(--space-4)
  pointer-events none

.add-bar__button
  height 3.125rem
  padding 0 var(--space-5)
  border-radius var(--radius-pill)
  font-size var(--text-md)
  box-shadow unquote('0 6px 18px color-mix(in srgb, var(--accent) 35%, transparent)')
  pointer-events auto
</style>
