<template>
  <div class="lexicon-page pa-4">
    <div v-if="!isSupported" class="text-center text-grey py-8">
      Editing dictionaries is only available in the desktop and mobile apps.
    </div>

    <template v-else>
      <div class="d-flex align-center mb-4">
        <v-select
          :model-value="selectedKey"
          :items="dictionaryOptions"
          item-title="label"
          item-value="key"
          label="Dictionary"
          density="comfortable"
          hide-details
          style="max-width: 340px"
          @update:model-value="onSelectDictionary"
        />
        <v-spacer />
        <v-btn
          v-if="selected"
          variant="tonal"
          color="primary"
          class="mr-2"
          @click="openAdd"
        >
          <v-icon start>mdi-plus</v-icon>
          Add an entry
        </v-btn>
        <v-btn v-if="selected" variant="text" @click="exportLexicon">
          <v-icon start>mdi-export</v-icon>
          Export
        </v-btn>
      </div>

      <div v-if="!dictionaryOptions.length" class="text-center text-grey py-8">
        No custom dictionary yet. Create one from Settings.
      </div>

      <template v-else-if="selected">
        <v-text-field
          v-model="search"
          label="Search in this dictionary"
          prepend-inner-icon="mdi-magnify"
          density="comfortable"
          clearable
          hide-details
          class="mb-3"
          @update:model-value="onSearchInput"
        />

        <div class="text-caption text-grey mb-2">{{ total }} entries</div>

        <v-list v-if="entries.length" density="comfortable">
          <v-list-item v-for="row in entries" :key="row.id" class="entry-row">
            <v-list-item-title class="tibetan">{{ row.term }}</v-list-item-title>
            <v-list-item-subtitle class="definition">{{ row.definition }}</v-list-item-subtitle>
            <template v-slot:append>
              <v-btn icon variant="text" size="small" @click="openEdit(row)">
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
              <v-btn icon variant="text" size="small" color="error" @click="remove(row)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-list-item>
        </v-list>

        <div v-else class="text-center text-grey py-8">
          {{ search ? 'No entry matches this search.' : 'This dictionary is empty.' }}
        </div>

        <v-pagination
          v-if="pageCount > 1"
          v-model="page"
          :length="pageCount"
          density="comfortable"
          class="mt-4"
          @update:model-value="load"
        />
      </template>

      <LexiconEntryDialog
        v-if="selected"
        v-model="dialogOpen"
        :pack-id="selected.packId"
        :dictionary-id="selected.dictionaryId"
        :entry="editing"
        @saved="onSaved"
      />
    </template>
  </div>
</template>

<script>
import { save } from '@tauri-apps/plugin-dialog';
import _ from 'underscore';
import Lexicon from '../services/lexicon';
import LexiconEntryDialog from './LexiconEntryDialog.vue';
import { supportsModularPacks } from '../config/platform';

const PAGE_SIZE = 50;

export default {
  name: 'LexiconPage',
  components: { LexiconEntryDialog },
  inject: ['snackbar'],
  data() {
    return {
      search: '',
      page: 1,
      total: 0,
      entries: [],
      dialogOpen: false,
      editing: null,
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
  },
  beforeUnmount() {
    window.removeEventListener('dictionaries-updated', this.syncSelection);
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
        this.snackbar.open('Could not read this dictionary.');
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
    async remove(row) {
      try {
        await Lexicon.deleteEntry(this.selected.packId, row.id);
        this.snackbar.open('Entry removed');
        this.load();
      } catch (e) {
        console.error('[LexiconPage] delete failed:', e);
        this.snackbar.open('Could not remove this entry.');
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
        this.snackbar.open('Could not export this dictionary.');
      }
    },
  },
};
</script>

<style lang="stylus" scoped>
.lexicon-page
  max-width 900px
  margin 0 auto

.entry-row
  border-bottom thin solid rgba(128, 128, 128, 0.2)

  .definition
    white-space pre-wrap
</style>
