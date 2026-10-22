<script>
import PackManager from '../services/pack-manager';
import DictionariesDetails from '../services/dictionaries-details';
import db from '../services/sql-database';
import { PACK_DEFINITIONS } from '../config/pack-definitions';
import { supportsModularPacks } from '../config/platform';
import {
  buildCatalog,
  filterCatalog,
  foldForSearch,
  matchedKeywords,
} from '../services/dictionary-catalog';
import { substituteLinksWithATags } from '../utils';
import { UiButton, UiChip, UiDialog, UiIcon, UiSpinner, UiTextField } from '../ui';

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

// Subject tags offered as shortcuts, from the mockup. A click searches for the
// tag; tags no dictionary carries are left out.
const PURPOSES = [
  'comprehensive',
  'Sanskrit equivalents',
  'definitions',
  'learning',
  'Mahāvyutpatti',
  'archaic',
  'synonyms',
  'scan',
];

// "65 MB download, 285 MB installed" -> "65 MB"
const shortSize = (estimatedSize) =>
  (String(estimatedSize || '').match(/\d+(?:\.\d+)?\s*[KMG]B/) || [''])[0];

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

export default {
  name: 'DictionaryCatalog',
  components: { UiButton, UiChip, UiDialog, UiIcon, UiSpinner, UiTextField },
  inject: ['snackbar'],
  props: {
    // Set by the "not searched" notice, so a click on it lands on a useful view
    initialQuery: { type: String, default: '' },
    initialStatus: { type: String, default: 'all' },
    // h1 when the catalog is the page (Dictionaries), h2 inside Settings
    headingTag: { type: String, default: 'h2' },
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
      aboutEntry: null,
      aboutDialogOpen: false,
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
    installedCount() {
      return this.catalog.filter((entry) => this.isPackInstalled(entry.packId)).length;
    },
    overline() {
      const parts = `${this.catalog.length} dictionaries in ${plural(this.packCount, 'pack')}`;
      return this.canInstall ? `${parts}, ${this.installedCount} installed` : parts;
    },
    filterGroups() {
      const packOptions = [
        { value: 'all', label: 'Any' },
        ...Object.values(PACK_DEFINITIONS).map((pack) => ({
          value: pack.id,
          label: pack.name,
        })),
      ];
      const groups = [{ key: 'packId', label: 'Pack', options: packOptions }];
      // On the web every dictionary is bundled, so install status says nothing
      if (this.modular) {
        groups.unshift({ key: 'status', label: 'Status', options: STATUS_OPTIONS });
      }
      return groups;
    },
    languageOptions() {
      return LANGUAGE_OPTIONS;
    },
    filters() {
      return {
        query: this.query || '',
        status: this.status,
        language: this.language,
        packId: this.packId,
      };
    },
    results() {
      return filterCatalog(this.catalog, this.filters, this.isPackInstalled);
    },
    // Each count is what a click on the tag would list, given the other filters
    purposes() {
      return PURPOSES.map((label) => ({
        label,
        count: filterCatalog(
          this.catalog,
          { ...this.filters, query: label },
          this.isPackInstalled
        ).length,
        selected: foldForSearch(this.query).trim() === foldForSearch(label),
      })).filter((purpose) => purpose.count > 0 || purpose.selected);
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
    trimmedQuery() {
      return (this.query || '').trim();
    },
    notInstalledResultCount() {
      if (!this.canInstall) return 0;
      return this.results.filter((entry) => !this.isPackInstalled(entry.packId)).length;
    },
    matchCountText() {
      const count = this.results.length;
      return count === 1 ? '1 dictionary matches' : `${count} dictionaries match`;
    },
    notInstalledText() {
      const count = this.notInstalledResultCount;
      if (!count) return '';
      if (count === 1) return '1 is in a pack you have not installed.';
      if (count === this.results.length) return 'All are in packs you have not installed.';
      return `${count} are in packs you have not installed.`;
    },
    aboutLines() {
      if (!this.aboutEntry) return [];
      return (DictionariesDetails[this.aboutEntry.id]?.about || '')
        .split('|')
        .map((line) => line.trim())
        .filter(Boolean);
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
    // The first line of "about" is the summary; the rest describes the source
    subtitleOf(entry) {
      return entry.summary.trim() === entry.label ? '' : entry.summary;
    },
    descriptionOf(entry) {
      const lines = (DictionariesDetails[entry.id]?.about || '')
        .split('|')
        .map((line) => line.trim())
        .filter(Boolean);
      return lines.slice(1).join(' ');
    },
    packNoteOf(entry) {
      const size = shortSize(PACK_DEFINITIONS[entry.packId]?.estimatedSize);
      return size ? `In ${entry.packName} · ${size}` : `In ${entry.packName}`;
    },
    linkify(line) {
      return substituteLinksWithATags(line);
    },
    setFilter(key, value) {
      this[key] = value;
      this.showAll = false;
    },
    onQueryInput(value) {
      this.query = value;
      this.showAll = false;
    },
    togglePurpose(purpose) {
      this.onQueryInput(purpose.selected ? '' : purpose.label);
    },
    bringIntoView() {
      this.$nextTick(() => {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        this.$el?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      });
    },
    askInstall(entry) {
      this.installTarget = { pack: PACK_DEFINITIONS[entry.packId], entry };
      this.installDialogOpen = true;
    },
    // From the Packs list of the Dictionaries page, where no dictionary is picked
    askInstallPack(packId) {
      this.installTarget = { pack: PACK_DEFINITIONS[packId], entry: null };
      this.installDialogOpen = true;
    },
    showAbout(entry) {
      this.aboutEntry = entry;
      this.aboutDialogOpen = true;
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
  <section class="dictionary-catalog" data-testid="dictionary-catalog">
    <header class="catalog-header">
      <span class="catalog-overline">Dictionaries · {{ overline }}</span>
      <component :is="headingTag" class="catalog-heading">
        <span class="catalog-heading__wide">Find a dictionary</span>
        <span class="catalog-heading__phone">Dictionaries</span>
      </component>
    </header>

    <div class="catalog-search-row">
      <ui-text-field
        :model-value="query"
        class="catalog-search"
        prepend-icon="search"
        aria-label="Search by name, subject or language"
        placeholder="archaic, spelling, verbs, Sanskrit"
        clearable
        autocomplete="off"
        spellcheck="false"
        data-testid="catalog-search"
        @update:model-value="onQueryInput"
      />
      <div class="catalog-chip-row" role="group" aria-label="Gives you">
        <span class="catalog-row-label">Gives you</span>
        <ui-chip
          v-for="option in languageOptions"
          :key="option.value"
          clickable
          variant="pill"
          :selected="language === option.value"
          data-testid="catalog-language"
          @click="setFilter('language', option.value)"
        >{{ option.label }}</ui-chip>
      </div>
    </div>

    <div class="catalog-body">
      <div class="catalog-results">
        <div class="catalog-filters">
          <div
            v-for="group in filterGroups"
            :key="group.key"
            class="catalog-chip-row"
            role="group"
            :aria-label="group.label"
            :data-testid="'catalog-filter-' + group.key"
          >
            <span class="catalog-row-label">{{ group.label }}</span>
            <ui-chip
              v-for="option in group.options"
              :key="option.value"
              clickable
              variant="pill"
              :selected="$data[group.key] === option.value"
              @click="setFilter(group.key, option.value)"
            >{{ option.label }}</ui-chip>
          </div>
        </div>

        <div
          v-if="purposes.length"
          class="catalog-chip-row"
          role="group"
          aria-label="By purpose"
          data-testid="catalog-purposes"
        >
          <span class="catalog-row-label">By purpose</span>
          <ui-chip
            v-for="purpose in purposes"
            :key="purpose.label"
            clickable
            variant="tag"
            tone="amber"
            :count="purpose.count"
            :selected="purpose.selected"
            @click="togglePurpose(purpose)"
          >{{ purpose.label }}</ui-chip>
        </div>

        <p class="catalog-count" aria-live="polite" data-testid="catalog-count">
          <template v-if="trimmedQuery">
            {{ matchCountText }} <b>{{ trimmedQuery }}</b>.
          </template>
          <template v-else>{{ results.length }} of {{ catalog.length }} dictionaries.</template>
          {{ notInstalledText }}
        </p>

        <div v-if="visibleResults.length" class="catalog-grid">
          <article
            v-for="entry in visibleResults"
            :key="entry.id"
            class="catalog-card"
            data-testid="catalog-card"
          >
            <div class="catalog-card__titles">
              <h2 class="catalog-card__title">{{ entry.label }}</h2>
              <span v-if="subtitleOf(entry)" class="catalog-card__subtitle">
                {{ subtitleOf(entry) }}
              </span>
            </div>
            <span v-if="descriptionOf(entry)" class="catalog-card__description">
              {{ descriptionOf(entry) }}
            </span>

            <div class="catalog-card__tags">
              <ui-chip tone="accent">{{ entry.packName }}</ui-chip>
              <ui-chip v-for="name in entry.languageNames" :key="name" tone="neutral">
                {{ name }}
              </ui-chip>
              <ui-chip
                v-for="keyword in entry.keywords"
                :key="keyword"
                tone="amber"
                :selected="highlightedKeywords(entry).includes(keyword)"
                data-testid="catalog-keyword"
              >{{ keyword }}</ui-chip>
            </div>

            <div class="catalog-card__footer">
              <template v-if="isPackInstalled(entry.packId)">
                <span class="catalog-installed" data-testid="catalog-installed">
                  <ui-icon name="circle-check" :size="16" :stroke-width="2.4" />
                  Installed
                </span>
                <ui-button variant="outline" size="sm" @click="showAbout(entry)">
                  About
                </ui-button>
              </template>
              <template v-else-if="isDownloading(entry.packId)">
                <span class="catalog-downloading" data-testid="catalog-downloading">
                  Downloading {{ downloadPercent(entry.packId) }}%
                </span>
                <ui-spinner :size="22" :label="'Downloading ' + entry.packName" />
              </template>
              <template v-else>
                <span class="catalog-pack-note">{{ packNoteOf(entry) }}</span>
                <ui-button
                  v-if="canInstall"
                  size="sm"
                  data-testid="catalog-install"
                  @click="askInstall(entry)"
                >
                  Install pack
                </ui-button>
              </template>
            </div>
          </article>
        </div>

        <p v-else class="catalog-empty" data-testid="catalog-empty">
          No dictionary matches. Clear the search or one of the filters.
        </p>

        <div v-if="hiddenCount > 0" class="catalog-more">
          <ui-button variant="ghost" size="sm" data-testid="catalog-show-all" @click="showAll = true">
            Show all {{ results.length }} dictionaries
          </ui-button>
        </div>
      </div>

      <aside v-if="$slots.aside" class="catalog-aside">
        <slot name="aside" />
      </aside>
    </div>

    <ui-dialog
      v-model="installDialogOpen"
      :title="installTarget ? `Install ${installTarget.pack.name}?` : 'Install'"
      :max-width="440"
    >
      <p v-if="installTarget" class="catalog-dialog-text">
        <template v-if="installTarget.entry">
          <strong>{{ installTarget.entry.label }}</strong> is part of this pack.
          Installing adds all {{ installTarget.pack.dictionaries.length }} of its
          dictionaries to every lookup ({{ installTarget.pack.estimatedSize }}).
        </template>
        <template v-else>
          Installing adds its {{ installTarget.pack.dictionaries.length }}
          dictionaries to every lookup ({{ installTarget.pack.estimatedSize }}).
        </template>
      </p>
      <template #actions>
        <ui-button variant="ghost" @click="installDialogOpen = false">Cancel</ui-button>
        <ui-button data-testid="catalog-confirm-install" @click="confirmInstall">
          Install pack
        </ui-button>
      </template>
    </ui-dialog>

    <ui-dialog
      v-model="aboutDialogOpen"
      :title="aboutEntry ? aboutEntry.label : 'About'"
      :max-width="560"
    >
      <div v-if="aboutEntry" class="catalog-about" data-testid="catalog-about">
        <!-- eslint-disable-next-line vue/no-v-html -- bundled dictionary details -->
        <p v-for="(line, index) in aboutLines" :key="index" v-html="linkify(line)" />
        <div class="catalog-card__tags">
          <ui-chip tone="accent">{{ aboutEntry.packName }}</ui-chip>
          <ui-chip v-for="name in aboutEntry.languageNames" :key="name" tone="neutral">
            {{ name }}
          </ui-chip>
        </div>
      </div>
      <template #actions>
        <ui-button variant="ghost" @click="aboutDialogOpen = false">Close</ui-button>
      </template>
    </ui-dialog>
  </section>
</template>

<style lang="stylus" scoped>
clamp(lines)
  display -webkit-box
  -webkit-line-clamp lines
  -webkit-box-orient vertical
  overflow hidden

eyebrow()
  font-size var(--text-xs)
  font-weight 600
  letter-spacing 0.08em
  text-transform uppercase
  color var(--muted)

.dictionary-catalog
  display flex
  flex-direction column
  gap 22px
  width 100%
  font-family var(--font-ui)
  font-size var(--text-base)
  color var(--ink)

.catalog-header
  display flex
  flex-direction column
  gap 6px

.catalog-overline
  eyebrow()

.catalog-heading
  margin 0
  font-size 1.875rem
  font-weight 600
  letter-spacing -0.01em
  line-height 1.2

.catalog-heading__phone
  display none

.catalog-search-row
  display flex
  align-items center
  gap 24px
  flex-wrap wrap

.catalog-search
  flex 0 1 32.5rem
  min-width 0

  :deep(.ui-field__control)
    height 3.25rem

  :deep(.ui-field__input)
    font-size 1.0625rem

.catalog-chip-row
  display flex
  align-items center
  gap 8px
  flex-wrap wrap

.catalog-row-label
  eyebrow()
  flex none
  margin-right 2px
  white-space nowrap

.catalog-body
  display flex
  gap 32px
  align-items flex-start

.catalog-results
  flex 1
  min-width 0
  display flex
  flex-direction column
  gap 18px

.catalog-filters
  display flex
  flex-wrap wrap
  gap 12px 28px

.catalog-count
  margin 0
  font-size var(--text-base)
  color var(--muted)

  b
    font-weight 600
    color var(--ink)

.catalog-grid
  display grid
  grid-template-columns repeat(2, minmax(0, 1fr))
  gap 18px
  align-content start

.catalog-card
  box-sizing border-box
  min-width 0
  display flex
  flex-direction column
  gap 10px
  padding 20px 22px
  background var(--surface)
  border 1px solid var(--line)
  border-radius var(--radius-card)
  box-shadow var(--shadow-card)

.catalog-card__titles
  display flex
  flex-direction column
  gap 3px

.catalog-card__title
  margin 0
  font-family var(--font-serif)
  font-size 1.3125rem
  font-weight 600
  line-height 1.25

.catalog-card__subtitle
  font-family var(--font-serif)
  font-size 0.9375rem
  line-height 1.4
  color var(--muted)
  clamp(2)

.catalog-card__description
  font-size var(--text-sm)
  line-height 1.45
  color var(--muted)
  clamp(2)

.catalog-card__tags
  display flex
  flex-wrap wrap
  gap 6px

.catalog-card__footer
  display flex
  align-items center
  justify-content space-between
  gap 12px
  margin-top auto
  padding-top 12px
  border-top 1px solid var(--soft)

.catalog-installed
  display inline-flex
  align-items center
  gap 6px
  font-size var(--text-sm)
  font-weight 600
  color var(--success-ink)

.catalog-downloading
  font-size var(--text-sm)
  font-weight 600
  color var(--accent)

.catalog-pack-note
  font-size var(--text-sm)
  color var(--muted)

.catalog-empty
  margin 0
  padding 24px 0
  color var(--muted)

.catalog-more
  display flex
  justify-content center

.catalog-aside
  flex none
  width 23.75rem
  display flex
  flex-direction column
  gap 18px

.catalog-dialog-text
  margin 0

.catalog-about
  display flex
  flex-direction column
  gap 8px

  p
    margin 0
    overflow-wrap anywhere

  p:first-child
    font-weight 600

  :deep(a)
    color var(--accent)

// One column of cards once the Packs list no longer fits beside two
@media (max-width: 1180px)
  .catalog-body
    flex-direction column
    align-items stretch

  .catalog-aside
    width auto

@media (max-width: 860px)
  .catalog-grid
    grid-template-columns minmax(0, 1fr)

@media (max-width: 600px)
  .dictionary-catalog
    gap 14px

  // The phone board titles this sub-screen of Settings by its name
  .catalog-overline,
  .catalog-heading__wide
    display none

  .catalog-heading
    font-size 1.625rem

  .catalog-heading__phone
    display inline

  .catalog-search-row
    gap 14px

  .catalog-search
    flex 1 1 100%

    :deep(.ui-field__control)
      height 3.125rem

    :deep(.ui-field__input)
      font-size var(--text-md)

  // Chip rows scroll sideways to the screen edge instead of wrapping
  .catalog-chip-row
    flex-wrap nowrap
    overflow-x auto
    margin-right -16px
    padding-right 16px
    scrollbar-width none

    &::-webkit-scrollbar
      display none

    :deep(.ui-chip)
      flex none

    :deep(.ui-chip--pill)
      height var(--control-md)
      font-size var(--text-sm-plus)

  .catalog-filters
    flex-direction column
    flex-wrap nowrap
    gap 10px

  .catalog-count
    font-size var(--text-sm-plus)

  .catalog-grid
    gap 14px

  .catalog-card
    gap 8px
    padding 14px 16px

  .catalog-card__title
    font-size 1.125rem

  .catalog-card__subtitle
    font-family var(--font-ui)
    font-size var(--text-sm-plus)

  .catalog-card__description
    color var(--ink)

  .catalog-card__footer
    gap 10px
    margin-top 0
    padding-top 0
    border-top 0

    :deep(.ui-button)
      height 2.75rem
      padding 0 16px
      font-size var(--text-base)
</style>
