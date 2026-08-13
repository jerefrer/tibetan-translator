<template>
  <div class="lexicon-page-wrapper">
    <v-container class="lexicon-page">
      <div v-if="!isSupported" class="text-center text-grey py-8">
        Editing dictionaries is only available in the desktop and mobile apps.
      </div>

      <template v-else>
        <v-card v-if="!dictionaryOptions.length" class="lexicon-card">
          <v-card-text class="text-center text-grey py-10">
            <v-icon size="48" color="grey-lighten-1" class="mb-3">mdi-notebook-outline</v-icon>
            <p class="mb-1">You don't have a dictionary of your own yet.</p>
            <p class="text-caption mb-0">
              Create one from the Settings page to start collecting your words.
            </p>
          </v-card-text>
        </v-card>

        <v-card v-else class="lexicon-card">
          <v-toolbar>
            <v-icon size="x-large" color="grey">mdi-notebook-edit-outline</v-icon>
            <v-toolbar-title>
              {{ selected ? selected.name : 'My dictionary' }}
              <div class="text-caption text-grey">{{ entriesLabel }}</div>
            </v-toolbar-title>

            <v-select
              v-if="dictionaryOptions.length > 1"
              :model-value="selectedKey"
              :items="dictionaryOptions"
              item-title="label"
              item-value="key"
              density="compact"
              variant="outlined"
              hide-details
              class="dictionary-switcher mr-4"
              @update:model-value="onSelectDictionary"
            />
          </v-toolbar>

          <template v-if="selected">
            <div class="actions-row">
              <v-text-field
                v-model="search"
                placeholder="Search in this dictionary"
                prepend-inner-icon="mdi-magnify"
                density="compact"
                variant="solo-filled"
                flat
                clearable
                hide-details
                class="search-field"
                @update:model-value="onSearchInput"
              />
              <v-btn variant="tonal" color="primary" class="ml-3" @click="openAdd">
                <v-icon start>mdi-plus</v-icon>
                Add an entry
              </v-btn>
              <v-btn variant="text" class="ml-1" @click="importSpreadsheet">
                <v-icon start>mdi-file-import-outline</v-icon>
                Import
              </v-btn>
              <v-btn variant="text" class="ml-1" @click="exportLexicon">
                <v-icon start>mdi-export-variant</v-icon>
                Export
              </v-btn>
            </div>

            <v-list v-if="entries.length" class="entry-list py-0">
              <v-list-item v-for="row in entries" :key="row.id" class="entry-row">
                <div class="entry-term tibetan">{{ row.term }}</div>
                <div class="entry-definition text-medium-emphasis">{{ row.definition }}</div>

                <template v-slot:append>
                  <div class="entry-actions">
                    <v-btn icon variant="text" size="small" @click="openEdit(row)">
                      <v-icon size="20">mdi-pencil-outline</v-icon>
                      <v-tooltip activator="parent" location="top">Edit</v-tooltip>
                    </v-btn>
                    <v-btn
                      icon
                      variant="text"
                      size="small"
                      class="delete-btn"
                      @click="promptRemove(row)"
                    >
                      <v-icon size="20">mdi-delete-outline</v-icon>
                      <v-tooltip activator="parent" location="top">Delete</v-tooltip>
                    </v-btn>
                  </div>
                </template>
              </v-list-item>
            </v-list>

            <v-card-text v-else class="text-center text-grey py-10">
              {{ search ? 'No entry matches this search.' : 'This dictionary is empty — add your first word.' }}
            </v-card-text>

            <div v-if="pageCount > 1" class="pagination-row">
              <v-pagination
                v-model="page"
                :length="pageCount"
                density="comfortable"
                :total-visible="7"
                @update:model-value="load"
              />
            </div>
          </template>
        </v-card>

        <LexiconEntryDialog
          v-if="selected"
          v-model="dialogOpen"
          :pack-id="selected.packId"
          :dictionary-id="selected.dictionaryId"
          :entry="editing"
          @saved="onSaved"
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

        <v-dialog v-model="removeOpen" max-width="420">
          <v-card v-if="removeTarget">
            <v-card-title>Delete this entry?</v-card-title>
            <v-card-text>
              <p class="tibetan mb-1">{{ removeTarget.term }}</p>
              <p class="text-body-2 text-grey mb-0">This cannot be undone.</p>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="removeOpen = false">Cancel</v-btn>
              <v-btn color="error" variant="elevated" @click="confirmRemove">Delete</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </template>
    </v-container>
  </div>
</template>

<script>
import { open, save } from '@tauri-apps/plugin-dialog';
import _ from 'underscore';
import Lexicon, { messageForError } from '../services/lexicon';
import LexiconEntryDialog from './LexiconEntryDialog.vue';
import ImportPreviewDialog from './ImportPreviewDialog.vue';
import { isMobile, supportsModularPacks } from '../config/platform';

const PAGE_SIZE = 50;

export default {
  name: 'LexiconPage',
  components: { LexiconEntryDialog, ImportPreviewDialog },
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
    // route (e.g. /lexicon/A -> /settings -> /lexicon/A) looks identical,
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
    this.listenForDroppedSpreadsheets();
  },
  beforeUnmount() {
    window.removeEventListener('dictionaries-updated', this.syncSelection);
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
      const path = `/lexicon/${option.packId}/${option.dictionaryId}`;
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
  height 100%
  overflow-y auto

.lexicon-page
  margin-top 30px
  padding-bottom 20px

// Align the toolbar icon + title with the list rows below, the same way
// ConfigurePage aligns its cards: 16px start padding on the toolbar content,
// 16px right margin on the icon.
.lexicon-card
  :deep(.v-toolbar__content)
    padding-inline-start 16px

  :deep(.v-toolbar__content > .v-icon)
    margin-inline 0 16px

  :deep(.v-toolbar-title)
    padding-inline-start 0
    margin-inline-start 0

  .v-toolbar__title, .v-toolbar__title .text-caption
    line-height 1em

  .v-toolbar__title .text-caption
    margin-top 5px

.dictionary-switcher
  max-width 260px
  flex 0 0 auto

.actions-row
  display flex
  align-items center
  padding 12px 16px
  border-bottom thin solid rgba(128, 128, 128, 0.2)

  .search-field
    flex 1 1 auto
    min-width 0

.entry-list
  .entry-row
    min-height 64px
    padding-top 10px
    padding-bottom 10px

    & + .entry-row
      border-top thin solid rgba(128, 128, 128, 0.16)

    // The term is what the eye should land on first: it is the thing the
    // user filed away, the definition is the payload.
    .entry-term
      font-size 1.35rem
      line-height 1.5
      margin-bottom 2px

    // Definitions are frequently multi-line; Vuetify's list subtitle would
    // clamp them to one line and hide the rest behind an ellipsis.
    // Colour comes from the .text-medium-emphasis utility so it follows the
    // theme — Stylus cannot evaluate Vuetify's CSS custom properties.
    .entry-definition
      white-space pre-wrap
      font-size 0.9rem
      line-height 1.4

    .entry-actions
      display flex
      gap 2px
      align-self flex-start
      opacity 0.55
      transition opacity 0.15s ease

    &:hover .entry-actions
      opacity 1

    .delete-btn:hover
      color unquote('rgb(var(--v-theme-error))')

.pagination-row
  display flex
  justify-content center
  padding 12px 16px
  border-top thin solid rgba(128, 128, 128, 0.2)
</style>
