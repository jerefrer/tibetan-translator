<script>
import PackManager from '../services/pack-manager';
import DictionariesDetails from '../services/dictionaries-details';
import db from '../services/sql-database';
import { PACK_DEFINITIONS } from '../config/pack-definitions';
import { supportsModularPacks } from '../config/platform';
import {
  buildCatalog,
  filterCatalog,
  matchedKeywords,
} from '../services/dictionary-catalog';

// Without a search or filter the list would be 65 rows long; show a first page.
const COLLAPSED_ROW_COUNT = 10;

const CATALOG = buildCatalog(DictionariesDetails, PACK_DEFINITIONS);

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'installed', label: 'Installed' },
  { value: 'available', label: 'Not installed' },
];

const LANGUAGE_OPTIONS = [
  { value: 'all', label: 'Any' },
  { value: 'tib-only', label: 'Tibetan only' },
  { value: 'en', label: 'English' },
  { value: 'skt', label: 'Sanskrit' },
  { value: 'zh', label: 'Chinese' },
  { value: 'other', label: 'Other' },
];

export default {
  name: 'DictionaryCatalog',
  inject: ['snackbar'],
  props: {
    // Set by the "not searched" notice, so a click on it lands on a useful view
    initialQuery: { type: String, default: '' },
    initialStatus: { type: String, default: 'all' },
  },
  data() {
    return {
      query: this.initialQuery,
      status: this.initialStatus,
      language: 'all',
      packId: 'all',
      showAll: false,
      installTarget: null, // { pack, entry } while the confirmation is open
      installDialogOpen: false,
    };
  },
  computed: {
    catalog() {
      return CATALOG;
    },
    modular() {
      return supportsModularPacks();
    },
    // Until the pack manager has loaded, which packs are installed is unknown
    canInstall() {
      return this.modular && PackManager.isInitialized;
    },
    filterGroups() {
      const packOptions = [
        { value: 'all', label: 'Any' },
        ...Object.values(PACK_DEFINITIONS).map((pack) => ({
          value: pack.id,
          label: pack.name,
        })),
      ];
      const groups = [
        { key: 'language', label: 'Language', options: LANGUAGE_OPTIONS },
        { key: 'packId', label: 'Pack', options: packOptions },
      ];
      // On the web every dictionary is bundled, so install status says nothing
      if (this.modular) {
        groups.unshift({ key: 'status', label: 'Status', options: STATUS_OPTIONS });
      }
      return groups;
    },
    results() {
      return filterCatalog(
        this.catalog,
        {
          query: this.query || '',
          status: this.status,
          language: this.language,
          packId: this.packId,
        },
        this.isPackInstalled
      );
    },
    isUnfiltered() {
      return (
        !this.query &&
        this.status === 'all' &&
        this.language === 'all' &&
        this.packId === 'all'
      );
    },
    visibleResults() {
      if (this.isUnfiltered && !this.showAll) {
        return this.results.slice(0, COLLAPSED_ROW_COUNT);
      }
      return this.results;
    },
    hiddenCount() {
      return this.results.length - this.visibleResults.length;
    },
    packCount() {
      return Object.keys(PACK_DEFINITIONS).length;
    },
  },
  watch: {
    initialQuery(value) {
      this.query = value;
      this.bringIntoView();
    },
    initialStatus(value) {
      this.status = value;
    },
  },
  methods: {
    isPackInstalled(packId) {
      if (!this.modular) return true;
      return (
        !!PACK_DEFINITIONS[packId]?.included ||
        PackManager.installedPacks.includes(packId)
      );
    },
    isDownloading(packId) {
      return !!PackManager.downloadingPacks[packId];
    },
    downloadPercent(packId) {
      return Math.round(PackManager.downloadingPacks[packId]?.percentage || 0);
    },
    highlightedKeywords(entry) {
      return matchedKeywords(entry, this.query);
    },
    setFilter(key, value) {
      // v-chip-group is mandatory, but still reports null when re-clicked
      if (value != null) this[key] = value;
      this.showAll = false;
    },
    bringIntoView() {
      this.$nextTick(() => {
        this.$el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      });
    },
    askInstall(entry) {
      this.installTarget = { pack: PACK_DEFINITIONS[entry.packId], entry };
      this.installDialogOpen = true;
    },
    async confirmInstall() {
      const target = this.installTarget;
      this.installDialogOpen = false;
      if (!target) return;

      const { pack } = target;
      try {
        await PackManager.downloadPack(pack.id);
        await PackManager.waitForDownload(pack.id);
        await db.reloadPack(pack.id);
        this.snackbar.open(`${pack.name} installed`);
      } catch (e) {
        console.error('Download failed:', e);
        this.snackbar.open(`Could not install ${pack.name}.`);
      }
      this.installTarget = null;
    },
  },
};
</script>

<template>
  <v-card class="dictionary-catalog mb-4">
    <v-toolbar>
      <v-icon size="x-large" color="grey">mdi-book-search</v-icon>
      <v-toolbar-title>
        Find a dictionary
        <div class="text-caption text-grey">
          {{ catalog.length }} dictionaries in {{ packCount }} packs
        </div>
      </v-toolbar-title>
    </v-toolbar>

    <v-card-text>
      <v-text-field
        v-model="query"
        class="catalog-search"
        label="Search by name, subject or language"
        placeholder="archaic, spelling, verbs, Sanskrit"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        density="comfortable"
        clearable
        hide-details
        autocomplete="off"
        spellcheck="false"
        @update:model-value="showAll = false"
      />

      <div v-for="group in filterGroups" :key="group.key" class="filter-row">
        <span class="filter-label text-caption text-grey">{{ group.label }}</span>
        <v-chip-group
          :model-value="$data[group.key]"
          mandatory
          color="primary"
          @update:model-value="setFilter(group.key, $event)"
        >
          <v-chip
            v-for="option in group.options"
            :key="option.value"
            :value="option.value"
            size="small"
            variant="outlined"
            filter
          >
            {{ option.label }}
          </v-chip>
        </v-chip-group>
      </div>

      <div class="catalog-count text-caption text-grey" aria-live="polite">
        {{ results.length }} of {{ catalog.length }} dictionaries
      </div>
    </v-card-text>

    <v-list v-if="visibleResults.length" lines="three" class="catalog-list">
      <v-list-item
        v-for="entry in visibleResults"
        :key="entry.id"
        class="catalog-row"
      >
        <v-list-item-title class="catalog-title">{{ entry.label }}</v-list-item-title>
        <v-list-item-subtitle class="catalog-summary">
          {{ entry.summary }}
        </v-list-item-subtitle>

        <div class="catalog-tags">
          <v-chip size="x-small" color="primary" variant="tonal" label>
            {{ entry.packName }}
          </v-chip>
          <v-chip
            v-for="name in entry.languageNames"
            :key="name"
            size="x-small"
            variant="outlined"
            label
          >
            {{ name }}
          </v-chip>
          <v-chip
            v-for="keyword in entry.keywords"
            :key="keyword"
            size="x-small"
            color="warning"
            :variant="highlightedKeywords(entry).includes(keyword) ? 'flat' : 'tonal'"
            label
          >
            {{ keyword }}
          </v-chip>
        </div>

        <template v-slot:append>
          <div class="catalog-status">
            <span v-if="isPackInstalled(entry.packId)" class="installed-label">
              <v-icon color="success" size="small">mdi-check-circle</v-icon>
              Installed
            </span>
            <v-progress-circular
              v-else-if="isDownloading(entry.packId)"
              :model-value="downloadPercent(entry.packId)"
              size="32"
              width="3"
              color="primary"
            />
            <v-btn
              v-else-if="canInstall"
              size="small"
              variant="tonal"
              color="primary"
              @click="askInstall(entry)"
            >
              Install
            </v-btn>
          </div>
        </template>
      </v-list-item>
    </v-list>

    <v-card-text v-else class="catalog-empty text-grey">
      No dictionary matches. Clear the search or one of the filters.
    </v-card-text>

    <v-card-actions v-if="hiddenCount > 0">
      <v-btn variant="text" size="small" @click="showAll = true">
        Show all {{ results.length }} dictionaries
      </v-btn>
    </v-card-actions>

    <v-dialog v-model="installDialogOpen" max-width="440">
      <v-card v-if="installTarget">
        <v-card-title>Install {{ installTarget.pack.name }}?</v-card-title>
        <v-card-text>
          <strong>{{ installTarget.entry.label }}</strong> is part of this pack.
          Installing adds all {{ installTarget.pack.dictionaries.length }} of its
          dictionaries to every lookup
          ({{ installTarget.pack.estimatedSize }}).
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="installDialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" variant="elevated" @click="confirmInstall">
            Install pack
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<style lang="stylus" scoped>
.dictionary-catalog
  width 100%

  // Align the header icon with the rows below, as the pack card does
  :deep(.v-toolbar__content > .v-icon)
    margin-inline-start 16px
    margin-inline-end 16px

  .filter-row
    display flex
    align-items center
    gap 12px
    margin-top 8px

  .filter-label
    flex 0 0 64px

  .catalog-count
    margin-top 12px

  .catalog-title
    white-space normal

  .catalog-summary
    white-space normal
    display -webkit-box
    -webkit-line-clamp 2
    -webkit-box-orient vertical
    overflow hidden

  .catalog-tags
    display flex
    flex-wrap wrap
    gap 4px
    margin-top 6px

  .catalog-status
    display flex
    align-items center
    min-width 96px
    justify-content flex-end

  .installed-label
    display inline-flex
    align-items center
    gap 4px
    font-size 0.8125rem

@media (max-width: 600px)
  .dictionary-catalog
    .filter-row
      flex-direction column
      align-items flex-start
      gap 0
</style>
