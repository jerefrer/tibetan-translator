<template>
  <div class="lexicon-page-wrapper" :class="{ 'is-phone': isPhone }" data-testid="lexicon-page">
    <div class="lexicon-page">
      <button
        v-if="isPhone"
        type="button"
        class="back-link"
        data-testid="lexicon-back"
        @click="$router.push('/settings')"
      >
        <span class="back-link__icon"><ui-icon name="chevron-left" :size="22" :stroke-width="2.4" /></span>
        Settings
      </button>

      <div v-if="!isSupported" class="unsupported" data-testid="lexicon-unsupported">
        Editing dictionaries is only available in the desktop and mobile apps.
      </div>

      <template v-else>
        <span v-if="!isPhone" class="eyebrow">My glossary</span>

        <header class="page-header">
          <h1 class="page-title">{{ selected ? selected.name : 'My glossary' }}</h1>

          <ui-select
            v-if="!isPhone && dictionaryOptions.length > 1"
            :model-value="selectedKey || undefined"
            :options="switcherOptions"
            class="dictionary-switcher"
            data-testid="lexicon-switcher"
            @update:model-value="onSelectDictionary"
          />

          <template v-if="selected">
            <div class="ui-spacer" />
            <ui-button
              variant="outline"
              :size="isPhone ? 'md' : 'sm'"
              class="header-button"
              data-testid="lexicon-import"
              @click="importSpreadsheet"
            >
              Import
            </ui-button>
            <ui-menu :items="exportItems" align="end" @select="onExport">
              <ui-button
                variant="outline"
                :size="isPhone ? 'md' : 'sm'"
                class="header-button"
                data-testid="lexicon-export"
              >
                Export
                <ui-icon name="chevron-down" :size="12" :stroke-width="2.4" />
              </ui-button>
            </ui-menu>
            <ui-button v-if="!isPhone" data-testid="lexicon-add" @click="openAdd">
              Add an entry
            </ui-button>
          </template>
        </header>

        <ui-select
          v-if="isPhone && dictionaryOptions.length > 1"
          :model-value="selectedKey || undefined"
          :options="switcherOptions"
          class="dictionary-switcher dictionary-switcher--phone"
          data-testid="lexicon-switcher"
          @update:model-value="onSelectDictionary"
        />

        <template v-if="selected">
          <ui-text-field
            v-model="search"
            placeholder="Search in this dictionary"
            prepend-icon="search"
            clearable
            type="search"
            enterkeyhint="search"
            class="search-field"
            data-testid="lexicon-search"
            @update:model-value="onSearchInput"
          />

          <template v-if="entries.length">
            <div v-if="isPhone" class="entry-cards" data-testid="lexicon-entries">
              <button
                v-for="row in entries"
                :key="row.id"
                type="button"
                class="entry-card"
                :aria-label="`Edit ${row.term}`"
                data-testid="lexicon-entry"
                @click="openEdit(row)"
              >
                <span class="entry-card__text">
                  <span class="entry-term">{{ row.term }}</span>
                  <span class="entry-definition">{{ row.definition }}</span>
                </span>
                <ui-icon name="chevron-right" :size="18" :stroke-width="2" class="entry-card__chevron" />
              </button>
            </div>

            <div v-else class="entry-table" data-testid="lexicon-entries">
              <article
                v-for="row in entries"
                :key="row.id"
                class="entry-row"
                data-testid="lexicon-entry"
              >
                <span class="entry-term">{{ row.term }}</span>
                <p class="entry-definition">{{ row.definition }}</p>
                <span class="entry-actions">
                  <ui-tooltip text="Edit">
                    <ui-button
                      variant="ghost"
                      size="sm"
                      icon
                      aria-label="Edit"
                      class="row-action"
                      data-testid="lexicon-edit"
                      @click="openEdit(row)"
                    >
                      <ui-icon name="pencil" :size="18" />
                    </ui-button>
                  </ui-tooltip>
                  <ui-tooltip text="Delete">
                    <ui-button
                      variant="ghost"
                      size="sm"
                      icon
                      aria-label="Delete"
                      class="row-action row-action--delete"
                      data-testid="lexicon-delete"
                      @click="promptRemove(row)"
                    >
                      <ui-icon name="trash-2" :size="18" />
                    </ui-button>
                  </ui-tooltip>
                </span>
              </article>
            </div>
          </template>

          <div v-else class="entries-empty" data-testid="lexicon-empty-list">
            {{ search ? 'No entry matches this search.' : 'This dictionary is empty — add your first word.' }}
          </div>

          <ui-pagination
            v-if="pageCount > 1"
            v-model="page"
            :length="pageCount"
            :visible="isPhone ? 5 : 7"
            class="pagination"
            @update:model-value="load"
          />

          <p class="page-note" data-testid="lexicon-count">
            {{ entriesLabel }}. Your entries are searched along with the others and shown with
            the name of this dictionary.
          </p>
        </template>

        <CustomPackSection class="own-dictionaries" />

        <div v-if="selected && isPhone" class="add-bar">
          <ui-button block class="add-bar__button" data-testid="lexicon-add" @click="openAdd">
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
              Delete
            </ui-button>
          </template>
        </ui-dialog>
      </template>
    </div>
  </div>
</template>

<script>
import { open, save } from '@tauri-apps/plugin-dialog';
import _ from 'underscore';
import Lexicon, { messageForError } from '../services/lexicon';
import LexiconEntryDialog from './LexiconEntryDialog.vue';
import ImportPreviewDialog from './ImportPreviewDialog.vue';
import CustomPackSection from './CustomPackSection.vue';
import ResizeService from '../services/resize-service';
import { isMobile, supportsModularPacks } from '../config/platform';
import {
  UiButton,
  UiDialog,
  UiIcon,
  UiMenu,
  UiPagination,
  UiSelect,
  UiTextField,
  UiTooltip,
} from '../ui';

const PAGE_SIZE = 50;

export default {
  name: 'LexiconPage',
  components: {
    LexiconEntryDialog,
    ImportPreviewDialog,
    CustomPackSection,
    UiButton,
    UiDialog,
    UiIcon,
    UiMenu,
    UiPagination,
    UiSelect,
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
      unlistenDrop: null,
      // Phone layout (the app-wide 600 px breakpoint), kept in sync on resize
      isPhone: ResizeService.isMobile(),
      exportItems: [
        { key: 'tibdict', label: 'Dictionary file', description: 'To share, or to reinstall later' },
        { key: 'xlsx', label: 'Spreadsheet', description: 'To edit in Excel and import back' },
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
    switcherOptions() {
      return this.dictionaryOptions.map((option) => ({ value: option.key, label: option.label }));
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
    await this.syncSelection();
    this.load();
  },
  mounted() {
    // mounted()/beforeUnmount() each fire exactly once per component instance,
    // even under App.vue's <keep-alive> (only activated()/deactivated() repeat
    // on navigation), so a single add here can never double-register — same
    // pattern as DefinePage.vue's 'all-terms-updated' listener.
    window.addEventListener('dictionaries-updated', this.syncSelection);
    ResizeService.subscribe('lexicon-page', () => {
      this.isPhone = ResizeService.isMobile();
    });
    this.listenForDroppedSpreadsheets();
  },
  beforeUnmount() {
    window.removeEventListener('dictionaries-updated', this.syncSelection);
    ResizeService.unsubscribe('lexicon-page');
    this.unlistenDrop?.();
    this.unlistenDrop = null;
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
        this.snackbar.open(messageForError(e, 'Could not read this dictionary.'));
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
      try {
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const data = await readFile(path);
        const fileName = String(path).split(/[\\/]/).pop();
        this.importGrid = await Lexicon.readSpreadsheet(Array.from(data), fileName);
        this.importOpen = true;
      } catch (e) {
        console.error('[LexiconPage] could not read the spreadsheet:', e);
        this.snackbar.open(messageForError(e, 'Could not read this file.'));
      }
    },
    async importSpreadsheet() {
      const path = await open({
        multiple: false,
        filters: [
          { name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'ods', 'csv', 'tsv'] },
        ],
      });
      if (path) await this.openImportFor(path);
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
    /** Accept a spreadsheet dropped anywhere on the window.
     *
     * Desktop only: there is no drag-and-drop on iOS or Android, so the
     * listener would never fire there. Registered from mounted() rather than
     * activated() for the reason spelled out above — activated() repeats on
     * every navigation back to this page and would stack a listener each time. */
    async listenForDroppedSpreadsheets() {
      if (!supportsModularPacks() || isMobile()) return;
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        this.unlistenDrop = await getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type !== 'drop') return;
          const path = (event.payload.paths || []).find((candidate) =>
            /\.(xlsx|xls|ods|csv|tsv)$/i.test(candidate)
          );
          if (path) this.openImportFor(path);
        });
      } catch (e) {
        console.error('[LexiconPage] could not listen for dropped files:', e);
      }
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

.lexicon-page
  box-sizing border-box
  min-height 100%
  display flex
  flex-direction column
  gap 18px
  padding 28px 40px 40px

.eyebrow
  font-size var(--text-xs)
  font-weight 600
  letter-spacing 0.08em
  text-transform uppercase
  color var(--muted)

.page-header
  display flex
  align-items center
  flex-wrap wrap
  gap 14px

.page-title
  margin 0
  font-size 1.875rem
  font-weight 600
  letter-spacing -0.01em
  line-height 1.2
  min-width 0
  overflow-wrap anywhere

.dictionary-switcher
  width 13.75rem

  :deep(.ui-select__trigger)
    min-height 2.25rem
    border-radius 8px
    font-weight 400
    font-size var(--text-sm-plus)

.unsupported
  padding var(--space-8) 0
  text-align center
  color var(--muted)

.search-field
  width 100%
  max-width 26.25rem

  :deep(.ui-field__control)
    min-height 2.75rem
    padding-left 14px
    border-radius var(--radius-lg)

  :deep(.ui-field__input)
    font-size var(--text-body)

  // The clear button is ours; hide the browser's own on type="search"
  :deep(.ui-field__input::-webkit-search-cancel-button)
    display none

// Desktop: one card, three columns per row
.entry-table
  background var(--surface)
  border 1px solid var(--line)
  border-radius var(--radius-card)
  box-shadow var(--shadow-card)
  overflow hidden

.entry-row
  display grid
  grid-template-columns minmax(0, 18.75rem) minmax(0, 1fr) auto
  gap 20px
  align-items center
  padding 12px 24px

  & + .entry-row
    border-top 1px solid var(--soft)

.entry-term
  font-family var(--font-tibetan)
  font-size var(--text-tibetan-md)
  line-height 1.7
  // DDC Uchen sits high in its line box; nudge it level with the definition
  padding-top 0.25rem
  color var(--rubric)
  overflow-wrap anywhere

// Definitions are often several lines long; keep the user's line breaks
.entry-definition
  margin 0
  font-family var(--font-serif)
  font-size var(--text-entry)
  line-height 1.5
  white-space pre-wrap
  overflow-wrap anywhere

.entry-actions
  display flex
  gap 4px

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
  background var(--surface)
  border 1px solid var(--line)
  border-radius var(--radius-card)

.pagination
  align-self center

.page-note
  margin 0
  font-size var(--text-sm)
  color var(--muted)

.own-dictionaries
  margin-top var(--space-4)

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

// Phone: the GlossaryPhone board
.back-link
  display flex
  align-items center
  gap 6px
  align-self flex-start
  margin 0 -6px
  padding 0 var(--space-2) 0 0
  border 0
  background none
  color var(--accent)
  font 600 0.9375rem var(--font-ui)
  cursor pointer

  &:focus-visible
    outline 2px solid var(--accent)
    border-radius var(--radius-lg)

.back-link__icon
  width 44px
  height 44px
  display flex
  align-items center
  justify-content center

.is-phone
  .lexicon-page
    gap 14px
    padding 16px 16px 0

  .page-header
    gap 8px

  .page-title
    font-size 1.625rem
    flex 1 1 auto

  .header-button
    height 2.75rem
    padding 0 14px
    font-weight 500

  .dictionary-switcher--phone
    width 100%

  .search-field
    max-width none

    :deep(.ui-field__control)
      min-height 3.125rem
      border-radius var(--radius-xl)

    :deep(.ui-field__input)
      font-size 0.9688rem

  .entry-term
    font-size var(--text-tibetan-sm)

  .entry-definition
    font-size 1.0313rem
    line-height 1.4

  .page-note
    margin-bottom var(--space-2)

.entry-cards
  display flex
  flex-direction column
  gap 14px

.entry-card
  display flex
  align-items center
  gap 12px
  width 100%
  padding 12px 16px
  text-align left
  background var(--surface)
  color var(--ink)
  border 1px solid var(--line)
  border-radius var(--radius-card)
  box-shadow var(--shadow-card)
  font inherit
  cursor pointer
  -webkit-tap-highlight-color transparent

  &:active
    background var(--soft)

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset 2px

.entry-card__text
  flex 1
  min-width 0
  display flex
  flex-direction column
  gap 2px

.entry-card__chevron
  color var(--faint)

// Stays above the bottom bar while the list scrolls under it
.add-bar
  position sticky
  bottom 0
  margin-top auto
  padding 8px 0 12px
  background linear-gradient(to bottom, transparent, var(--bg) 10px)

.add-bar__button
  height 3.25rem
  border-radius var(--radius-card)
  font-size 0.9688rem
</style>
