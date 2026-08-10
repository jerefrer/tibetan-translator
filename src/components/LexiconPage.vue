<template>
  <div class="lexicon-page pa-4">
    <div v-if="!isSupported" class="text-center text-grey py-8">
      Editing dictionaries is only available in the desktop and mobile apps.
    </div>

    <template v-else>
      <div class="d-flex align-center mb-4">
        <v-select
          v-model="selectedKey"
          :items="dictionaryOptions"
          item-title="label"
          item-value="key"
          label="Dictionary"
          density="comfortable"
          hide-details
          style="max-width: 340px"
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
      selectedKey: null,
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
    selected() {
      return this.dictionaryOptions.find((option) => option.key === this.selectedKey) || null;
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
  activated() {
    this.syncSelection();
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
    syncSelection() {
      const routePackId = this.$route.params.packId;
      const options = this.dictionaryOptions;
      if (!options.length) {
        this.selectedKey = null;
        return;
      }
      const stillThere = options.some((option) => option.key === this.selectedKey);
      if (stillThere) return;
      const fromRoute = routePackId && options.find((option) => option.packId === routePackId);
      this.selectedKey = (fromRoute || options[0]).key;
    },
    async load() {
      if (!this.selected) {
        this.entries = [];
        this.total = 0;
        return;
      }
      try {
        const page = await Lexicon.entries(this.selected.packId, this.selected.dictionaryId, {
          search: this.search || '',
          limit: PAGE_SIZE,
          offset: (this.page - 1) * PAGE_SIZE,
        });
        this.entries = page.entries;
        this.total = page.total;
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
