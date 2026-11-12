<script>
import {
  SEARCH_GROUPS_BATCH_SIZE,
  SEARCH_OPEN_DEFINITIONS_LIMIT,
  MAX_PREVIOUS_QUERIES,
  INFINITE_SCROLL_ROOT_MARGIN_LARGE,
} from '../config/constants';
import Decorator from '../services/decorator';
import SqlDatabase from '../services/sql-database';
import Storage from '../services/storage';
import { mayNeedLegacyRepair } from '../services/legacy-to-unicode';
import { supportsModularPacks } from '../config/platform';
import {
  buildSearchSql,
  containsTibetan,
  groupSearchEntries,
  highlightSearchTerms,
  isPlainTibetanQuery,
  parseSearchQuery,
} from '../services/search-query';
import { UiButton, UiIcon, UiSpinner, UiTextField, UiTooltip } from '../ui';
import DictionariesMenuMixin from './DictionariesMenuMixin';
import InfiniteScrollMixin from './mixins/InfiniteScrollMixin';
import MobileResponsiveMixin from './mixins/MobileResponsiveMixin';

import DictionaryAboutDialog from './DictionaryAboutDialog.vue';
import QuickAddDialog from './QuickAddDialog.vue';
import UninstalledPacksNotice from './UninstalledPacksNotice.vue';
import ResultsAndPaginationAndDictionaries from './ResultsAndPaginationAndDictionaries.vue';
import TermEntries from './TermEntries.vue';
import SearchBuilder from './SearchBuilder.vue';
import { getScanInfo } from '../services/scan-service';

// Board "B · Search" (and its Empty, query builder, Dictionaries and Phone
// variants): the query field on top, the query builder under it when shown,
// then the results in one card, or the recent searches before any search.
function initialBuilderVisible() {
  const stored = Storage.get('searchBuilderVisible');
  if (stored === true || stored === false) return stored;
  return window.innerWidth > 600;
}

export default {
  mixins: [DictionariesMenuMixin, InfiniteScrollMixin, MobileResponsiveMixin],
  components: {
    DictionaryAboutDialog,
    QuickAddDialog,
    UninstalledPacksNotice,
    ResultsAndPaginationAndDictionaries,
    SearchBuilder,
    TermEntries,
    UiButton,
    UiIcon,
    UiSpinner,
    UiTextField,
    UiTooltip,
  },
  data() {
    return {
      loading: false,
      entries: undefined,
      // Counted in terms (groups of definitions), not in definitions
      displayedCount: SEARCH_GROUPS_BATCH_SIZE,
      batchSize: SEARCH_GROUPS_BATCH_SIZE,
      // The rows opened, until the next search. All start collapsed: an open
      // first row with long definitions hid the other terms
      openTerms: {},
      // The terms with more definitions than an open row shows, unfolded
      // with "Show N more", until the next search
      expandedTerms: {},
      searchQuery: this.$route.params.query,
      previousQueries: Storage.get('previousQueries', []),
      // Cached highlight terms - only updated on search, not on input change
      cachedRegularTerms: [],
      cachedPhoneticsStrictTerms: [],
      cachedPhoneticsLooseTerms: [],
      // Search builder state
      // Open by default, except on a phone (a third of the screen) until the
      // user has chosen; an explicit choice is remembered
      builderVisible: initialBuilderVisible(),
      quickAddOpen: false,
      // The query whose route this page pushed itself (see the route watcher)
      pushedQuery: null,
      aboutDictionary: '',
      aboutOpen: false,
    };
  },
  watch: {
    '$route.params.query'(value) {
      // Only update searchQuery if we're still on the search route
      // (prevents clearing when navigating to other pages like /define)
      if (!this.$route.path.startsWith('/search')) return;

      this.searchQuery = value;
      Storage.set('searchQuery', value);
      // A search from the page pushes its own route: it has run already
      const pushedQuery = this.pushedQuery;
      this.pushedQuery = null;
      if (value && value === pushedQuery) return;
      // Back from another page to the query already shown: its results, and
      // their scroll, stay as they were unless they are out of date
      if (value && value === this.shownQuery && !this.shownResultsAreStale()) return;
      if (value) this.performSearch({ query: value, fromNavigation: true });
    },
    previousQueries(value) {
      Storage.set('previousQueries', value);
    },
    builderVisible(value) {
      // The help promises the choice is remembered
      Storage.set('searchBuilderVisible', value);
      // Hide and "Query builder" each disappear when pressed: carry the
      // focus over to the other one's side instead of losing it
      this.$nextTick(() => {
        const active = document.activeElement;
        const lost = !active || active === document.body;
        if (value) {
          if (lost) this.$refs.builder?.focusFirstRow();
        } else if (lost || active.closest?.('[data-testid="search-builder"]')) {
          this.$refs.builderToggle?.focus();
        }
      });
    },
    displayedCount() {
      // A new observer reports at once if the sentinel is still in view
      this.setupInfiniteScroll();
    },
    isMobile() {
      // The scrolling element changes with the layout
      this.setupInfiniteScroll();
    },
  },
  beforeRouteEnter(to, from, next) {
    var query = Storage.get('searchQuery');
    if (!to.params.query && query) next('/search/' + query);
    else next();
  },
  beforeRouteUpdate(to, from, next) {
    // When navigating back to search page without a query param (e.g., via tabs),
    // restore the stored query if available
    if (to.path.startsWith('/search') && !to.params.query) {
      var query = Storage.get('searchQuery');
      if (query) {
        next('/search/' + encodeURIComponent(query));
        return;
      }
    }
    next();
  },
  computed: {
    canAddToLexicon() {
      return supportsModularPacks();
    },
    /** The current query, or '' when it isn't a single plain Tibetan term
     *  (multi-term '&' queries and phonetic [..]/{..} syntax stay editable
     *  in the dialog's own field instead of being pre-filled here). */
    quickAddTerm() {
      return isPlainTibetanQuery(this.searchQuery) ? this.searchQuery.trim() : '';
    },
    // InfiniteScrollMixin configuration
    infiniteScrollRootMargin() {
      return INFINITE_SCROLL_ROOT_MARGIN_LARGE;
    },
    // The results card scrolls on a desktop, the whole page on a phone
    infiniteScrollRoot() {
      return this.isMobile ? 'page' : 'resultsList';
    },
    canSearch() {
      return !!this.searchQuery?.trim();
    },
    // Entries in any dictionary, on or off: the header and its Dictionaries
    // button stay while every dictionary is turned off, or the menu would
    // close under the user the moment they press None
    hasEntries() {
      return !!this.entries?.length;
    },
    hasMore() {
      return this.displayedCount < this.groups.length;
    },
    // The entries grouped by Tibetan term. The groups come most relevant
    // first; inside a group the entries follow the user's dictionary order.
    groups() {
      // Use cached terms to avoid re-sorting on input change (only on search)
      return groupSearchEntries(this.entries, {
        dictionaries: this.dictionaries,
        regular: this.cachedRegularTerms,
        phoneticsStrict: this.cachedPhoneticsStrictTerms,
        phoneticsLoose: this.cachedPhoneticsLooseTerms,
      });
    },
    visibleGroups() {
      // Decorate here, not in the template: a computed only re-runs when its
      // dependencies change, whereas template method calls re-ran on every
      // keystroke (searchQuery is a render dependency). This depends on the
      // cached terms (frozen at search time), never on searchQuery.
      //
      // Only the groups shown, and in them the definitions shown, are
      // decorated, each once per search: loading the next batch only
      // decorates the new ones.
      const terms = [this.cachedRegularTerms, this.cachedPhoneticsStrictTerms, this.cachedPhoneticsLooseTerms];
      if (!this._decorated || terms.some((list, i) => list !== this._decoratedFor[i])) {
        this._decorated = new WeakMap();
        this._decoratedTerms = new Map();
        this._decoratedFor = terms;
      }
      const limit = SEARCH_OPEN_DEFINITIONS_LIMIT;
      return this.groups.slice(0, this.displayedCount).map((group) => {
        const open = !!this.openTerms[group.term];
        let decoratedTerm = this._decoratedTerms.get(group.term);
        if (decoratedTerm === undefined) {
          decoratedTerm = this.highlightSearchTerms(group.term);
          this._decoratedTerms.set(group.term, decoratedTerm);
        }
        // Only a term with definitions held back can unfold
        const expanded = !!this.expandedTerms[group.term] && group.entries.length > limit;
        // A collapsed row only needs its first definition, for the preview;
        // an open one the definitions shown
        return {
          term: group.term,
          decoratedTerm,
          open,
          preview: open ? null : this.decoratedEntry(group.entries[0]),
          entries: open ? group.entries.slice(0, expanded ? undefined : limit).map((entry) => this.decoratedEntry(entry)) : [],
          totalEntries: group.entries.length,
          expanded,
        };
      });
    },
    totalNumberOfEntriesForEnabledDictionaries() {
      return this.entriesForEnabledDictionaries?.length || 0;
    },
    // What the query means: its terms, regular and phonetic
    parsedQuery() {
      return parseSearchQuery(this.searchQuery);
    },
    regularSearchTerms() {
      return this.parsedQuery.regular;
    },
    phoneticsStrictSearchTerms() {
      // Raw terms - spaceless processing happens in the search service
      return this.parsedQuery.phoneticsStrict;
    },
    phoneticsLooseSearchTerms() {
      return this.parsedQuery.phoneticsLoose;
    },
  },
  methods: {
    decoratedEntry(entry) {
      let decorated = this._decorated.get(entry);
      if (!decorated) {
        // Scanned dictionaries keep their page number as the definition
        const decoratedDefinition = this.isScannedDictionary(entry)
          ? ''
          : this.highlightSearchTerms(Decorator.decorate(entry));
        decorated = {
          ...entry,
          decoratedDefinition,
          definition: this.isScannedDictionary(entry) ? entry.definition : decoratedDefinition,
        };
        this._decorated.set(entry, decorated);
      }
      return decorated;
    },
    openTerm(term) {
      this.$router.push('/define/' + encodeURIComponent(term));
    },
    toggleOpen(term) {
      this.openTerms = { ...this.openTerms, [term]: !this.openTerms[term] };
    },
    toggleTerm(term) {
      this.expandedTerms = { ...this.expandedTerms, [term]: !this.expandedTerms[term] };
    },
    containsTibetan(text) {
      return containsTibetan(text);
    },
    wrapAllTibetanWithSpansAndAddTshekIfMissing(definition) {
      return Decorator.wrapAllTibetanWithSpansAndAddTshekIfMissing(definition);
    },
    highlightSearchTerms(definition) {
      // Use cached terms (frozen at search time) to avoid re-rendering on input change
      return highlightSearchTerms(definition, {
        regular: this.cachedRegularTerms,
        phoneticsStrict: this.cachedPhoneticsStrictTerms,
        phoneticsLoose: this.cachedPhoneticsLooseTerms,
      });
    },
    async onPaste(event) {
      const clipboard = {
        text: event.clipboardData?.getData('text/plain') || '',
        html: event.clipboardData?.getData('text/html') || '',
      };
      // Text set in a pre-Unicode Tibetan font arrives as Latin gibberish. This
      // field deliberately applies no Wylie conversion — the query syntax only
      // converts Wylie inside parentheses — so repairing is all it does, and
      // every other paste is left to the browser.
      if (!mayNeedLegacyRepair(clipboard)) return;

      event.preventDefault();
      const input = event.target;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const current = this.searchQuery || '';

      const { repairPasteInto } = await import('../services/legacy-to-unicode');
      // The repair can still decline once the font tables are loaded — styled
      // text in an ordinary font reaches this far. preventDefault() has already
      // happened by then, so the raw text has to be inserted by hand.
      const result = (await repairPasteInto(clipboard, {
        value: current,
        start,
        end,
      })) || {
        value: current.substring(0, start) + clipboard.text + current.substring(end),
        caret: start + clipboard.text.length,
      };

      this.searchQuery = result.value;
      this.$nextTick(() => input.setSelectionRange(result.caret, result.caret));
    },
    // The enabled dictionaries in Settings, to tell whether they changed
    // since the results shown were searched
    enabledDictionariesInSettings() {
      return (Storage.get('dictionaries') || [])
        .filter((dictionary) => dictionary.enabled)
        .map((dictionary) => dictionary.id)
        .sort()
        .join(',');
    },
    shownResultsAreStale() {
      return (
        this.entries == undefined ||
        this.packsChangedSinceSearch ||
        this.shownDictionaries !== this.enabledDictionariesInSettings()
      );
    },
    clear() {
      this.shownQuery = null;
      this.searchQuery = '';
      Storage.delete('searchQuery');
      this.pushRoute();
      this.entries = undefined;
      this.cachedRegularTerms = [];
      this.cachedPhoneticsStrictTerms = [];
      this.cachedPhoneticsLooseTerms = [];
    },
    clearPreviousQueries() {
      this.previousQueries = [];
      this.focusInput();
    },
    // The recent searches give way to the results: the focus goes to the
    // field rather than being lost with the button
    searchRecent(query) {
      this.performSearch({ query });
      this.focusInput();
    },
    onLexiconEntrySaved() {
      // Re-run the current search so the new definition shows immediately.
      if (this.searchQuery) this.performSearch({ query: this.searchQuery, fromNavigation: true });
    },
    focusInput(options) {
      this.$refs.input?.focus(options);
    },

    storeQuery() {
      this.previousQueries = this.previousQueries.filter(
        (query) => query != this.searchQuery
      );
      this.previousQueries.unshift(this.searchQuery);
      if (this.previousQueries.length > MAX_PREVIOUS_QUERIES)
        this.previousQueries = this.previousQueries.slice(0, MAX_PREVIOUS_QUERIES);
    },
    pushRoute({ searched = false } = {}) {
      var path = '/search/' + encodeURIComponent(this.searchQuery);
      if (path != this.$route.path) {
        if (searched) this.pushedQuery = this.searchQuery;
        // A push that goes nowhere (same route) never reaches the watcher
        this.$router.push({ path: path }).then((failure) => {
          if (failure) this.pushedQuery = null;
        });
      }
    },
    performSearch(options = {}) {
      this.searchQuery = options.query || this.searchQuery;
      if (this.searchQuery?.trim()) {
        this.loading = true;
        this.shownQuery = this.searchQuery;
        this.shownDictionaries = this.enabledDictionariesInSettings();
        this.packsChangedSinceSearch = false;
        if (!options.fromNavigation) {
          this.storeQuery();
          this.pushRoute({ searched: true });
        }
        // Cache highlight terms at search time to avoid re-rendering on input changes
        this.cachedRegularTerms = [...this.regularSearchTerms];
        this.cachedPhoneticsStrictTerms = [...this.phoneticsStrictSearchTerms];
        this.cachedPhoneticsLooseTerms = [...this.phoneticsLooseSearchTerms];

        const query = buildSearchSql({
          regular: this.regularSearchTerms,
          strictVariants: this.phoneticsStrictSearchTerms,
          looseVariants: this.phoneticsLooseSearchTerms,
        });
        if (!query) {
          // No valid search terms
          this.entries = [];
          this.loading = false;
          return;
        }
        const params = [];
        SqlDatabase.exec(query, params)
          .then((rows) => {
            this.entries = rows;
            this.displayedCount = this.batchSize; // Reset to initial batch
            this.expandedTerms = {};
            this.openTerms = {};
            this.resetDictionariesToDefaultAndSetNumberOfEntries();
          })
          .finally(() => {
            this.$nextTick(() => {
              this.loading = false;
              this.setupInfiniteScroll();
            });
          });
      } else this.clear();
    },
    loadMore() {
      if (this.hasMore) {
        this.displayedCount += this.batchSize;
      }
    },
    openDictionaryAbout(dictionary) {
      this.aboutDictionary = dictionary;
      this.aboutOpen = true;
    },
    isScannedDictionary(entry) {
      return !!getScanInfo(entry.dictionary);
    },
    showBuilder() {
      this.builderVisible = true;
    },
  },
  mounted() {
    this._onPacksChanged = () => { this.packsChangedSinceSearch = true; };
    window.addEventListener('all-terms-updated', this._onPacksChanged);
    window.addEventListener('dictionaries-updated', this._onPacksChanged);
    if (this.searchQuery) this.performSearch();
  },
  activated() {
    // The Dictionaries menu was just read again from Settings, without the
    // counts of the results kept from before
    if (this.entries && !this.loading) this.resetDictionariesToDefaultAndSetNumberOfEntries();
    // Without scrolling: on a phone the field scrolls with the results kept
    this.$nextTick(() => this.focusInput({ preventScroll: true }));
  },
  beforeUnmount() {
    window.removeEventListener('all-terms-updated', this._onPacksChanged);
    window.removeEventListener('dictionaries-updated', this._onPacksChanged);
  },
};
</script>


<template>
  <div
    ref="page"
    class="search-page"
    :class="{ 'is-phone': isMobile }"
    data-testid="search-page"
  >
    <h1 class="ui-visually-hidden">Search</h1>
    <div class="search-top">
      <ui-text-field
        ref="input"
        v-model="searchQuery"
        class="search-field"
        :class="{ 'has-tibetan': containsTibetan(searchQuery || '') }"
        placeholder="Type your query"
        aria-label="Search query"
        enterkeyhint="search"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        autofocus
        clearable
        :loading="loading"
        data-testid="search-field"
        @clear="clear"
        @paste="onPaste"
        @keyup.enter="performSearch()"
      >
        <template #append>
          <button
            type="button"
            class="search-button"
            aria-label="Search"
            title="Search"
            :disabled="!canSearch"
            data-testid="search-button"
            @click="performSearch()"
          >
            <ui-icon name="search" :size="20" :stroke-width="2.2" />
          </button>
        </template>
      </ui-text-field>

      <button
        v-if="!builderVisible"
        ref="builderToggle"
        type="button"
        class="builder-toggle"
        data-testid="search-builder-show"
        @click="showBuilder"
      >
        <ui-icon name="sliders-horizontal" :size="16" :stroke-width="2" />
        Query builder
      </button>
    </div>

    <SearchBuilder
      ref="builder"
      v-model="searchQuery"
      v-model:visible="builderVisible"
      @submit="performSearch()"
    />

    <!-- Results count, Dictionaries menu and Add my definition -->
    <div v-if="hasEntries" class="results-header">
      <span class="results-count" data-testid="search-count">
        Showing <b>{{ visibleGroups.length }}</b> of
        <b>{{ groups.length }}</b> {{ groups.length === 1 ? 'term' : 'terms' }}
        &middot; <b>{{ totalNumberOfEntriesForEnabledDictionaries }}</b>
        {{ totalNumberOfEntriesForEnabledDictionaries === 1 ? 'definition' : 'definitions' }}
      </span>
      <div class="ui-spacer" />
      <ResultsAndPaginationAndDictionaries
        :dictionaries="dictionariesForCurrentResults"
        :totalNumberOfEntries="entries.length"
        :hidePagination="true"
        @close:dictionariesMenu="focusInput"
      />
      <template v-if="canAddToLexicon && searchQuery">
        <ui-tooltip v-if="isMobile" text="Add my definition">
          <button
            type="button"
            class="header-button header-button--icon"
            aria-label="Add my definition"
            data-testid="search-add"
            @click="quickAddOpen = true"
          >
            <ui-icon name="book-plus" :size="20" />
          </button>
        </ui-tooltip>
        <button
          v-else
          type="button"
          class="header-button"
          data-testid="search-add"
          @click="quickAddOpen = true"
        >
          Add my definition
        </button>
      </template>
    </div>

    <template v-if="!loading">
      <!-- Before any search: recent searches and what can be searched -->
      <div v-if="entries == undefined" class="search-start" data-testid="search-start">
        <section
          v-if="previousQueries.length > 0"
          class="card recent-searches"
          aria-label="Recent searches"
          data-testid="search-recent"
        >
          <div class="card-header">
            <ui-icon name="history" :size="18" :stroke-width="2" />
            <span class="card-title">Recent searches</span>
            <div class="ui-spacer" />
            <button
              type="button"
              class="link-button"
              data-testid="search-clear-history"
              @click="clearPreviousQueries"
            >
              Clear history
            </button>
          </div>

          <transition-group name="ui-fade" tag="div" class="recent-list">
            <button
              v-for="query in previousQueries"
              :key="query"
              type="button"
              class="recent-query"
              data-testid="search-recent-query"
              @click="searchRecent(query)"
              v-html="wrapAllTibetanWithSpansAndAddTshekIfMissing(query)"
            />
          </transition-group>
        </section>

        <section class="card search-tips" aria-label="What you can search" data-testid="search-tips">
          <span class="card-title">What you can search</span>
          <div class="tips">
            <div class="tip">
              <span class="tip-title">Tibetan or Wylie</span>
              <span class="tip-text">
                Find entries where a headword or a definition contains it.
                Put Wylie in parentheses: (ye shes).
              </span>
            </div>
            <div class="tip">
              <span class="tip-title">English words</span>
              <span class="tip-text">
                Find every entry that mentions a word, in any dictionary you search.
              </span>
            </div>
            <div class="tip">
              <span class="tip-title">How it sounds</span>
              <span class="tip-text">
                Use the query builder to match terms that sound like a spelling.
              </span>
            </div>
          </div>
        </section>
      </div>

      <div
        v-else-if="visibleGroups.length"
        ref="resultsList"
        class="results-list"
        data-testid="search-results"
      >
        <term-entries
          v-for="group in visibleGroups"
          :key="group.term"
          :term="group.decoratedTerm"
          :open="group.open"
          :preview="group.preview"
          :entries="group.entries"
          :total="group.totalEntries"
          :expanded="group.expanded"
          title-testid="search-group-term"
          entry-testid="search-result"
          testid-prefix="search-group"
          data-testid="search-group"
          @toggle-open="toggleOpen(group.term)"
          @open-term="openTerm(group.term)"
          @toggle-more="toggleTerm(group.term)"
          @show-about="openDictionaryAbout"
        />
        <!-- Sentinel for infinite scroll -->
        <div ref="loadMoreSentinel" class="load-more-sentinel" data-testid="search-sentinel">
          <ui-spinner v-if="hasMore" :size="22" label="Loading more results" />
          <span v-else>All {{ groups.length }} {{ groups.length === 1 ? 'term' : 'terms' }} loaded</span>
        </div>
      </div>

      <div v-else class="card no-results" data-testid="search-no-results">No entries</div>

      <UninstalledPacksNotice
        v-if="entries != undefined"
        :result-count="totalNumberOfEntriesForEnabledDictionaries"
      />
    </template>

    <DictionaryAboutDialog v-model="aboutOpen" :dictionary="aboutDictionary" />

    <!-- Mounted at page level (not inside .results-header) so it survives
         that div's own v-if — e.g. entries clearing or a result count
         dropping to zero — while open, instead of being torn down and
         losing whatever the user typed. -->
    <QuickAddDialog
      v-model="quickAddOpen"
      :term="quickAddTerm"
      @saved="onLexiconEntrySaved"
    />
  </div>
</template>

<style lang="stylus" scoped>
.search-page
  box-sizing border-box
  height 100%
  display flex
  flex-direction column
  gap 18px
  padding 28px 40px 0
  overflow hidden
  background var(--bg)
  color var(--ink)
  font-family var(--font-ui)
  font-size var(--text-base)

.card
  background var(--surface)
  border 1px solid var(--line)
  border-radius var(--radius-card)
  box-shadow var(--shadow-card)

.link-button
  border 0
  background none
  padding 8px
  color var(--accent)
  font 600 var(--text-sm-plus) var(--font-ui)
  cursor pointer

  &:hover
    text-decoration underline

  &:focus-visible
    outline 2px solid var(--accent)
    border-radius var(--radius-sm)

// One column: the field, the builder, the results header and the results
// share their left and right edges. Wide, as the results' own columns (term,
// dictionary, definition) keep the definitions' lines short enough to read.
// Centred on a wider window.
.search-page > :not(.ui-visually-hidden)
  width 100%
  max-width 80rem
  margin-inline auto

// The field: 60px, accent ring when focused (UiTextField does the focus)
.search-top
  flex none
  display flex
  align-items center
  gap 16px

.search-field
  flex 1

  :deep(.ui-field__control)
    min-height var(--control-lg)
    padding 0 8px 0 18px
    border-radius var(--radius-card)

  // Latin in Source Serif; Tibetan falls through to DDC Uchen
  :deep(.ui-field__input)
    font-family 'Source Serif 4', var(--font-tibetan)
    font-size 1.375rem
    line-height 1.5

  :deep(.ui-field__input::placeholder)
    font-family var(--font-serif)

  // DDC Uchen reads small at the Latin size
  &.has-tibetan :deep(.ui-field__input)
    font-size var(--text-tibetan-lg)

.search-button
  flex none
  display inline-flex
  align-items center
  justify-content center
  width 2.75rem
  height 2.75rem
  border 0
  border-radius var(--radius-lg)
  background var(--accent)
  color var(--on-accent)
  cursor pointer

  &:hover:not(:disabled)
    opacity 0.9

  &:disabled
    opacity 0.45
    cursor default

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset 2px

.builder-toggle
  flex none
  display inline-flex
  align-items center
  gap 6px
  padding 8px
  border 0
  background none
  color var(--accent)
  font 600 var(--text-sm-plus) var(--font-ui)
  cursor pointer

  &:hover
    text-decoration underline

  &:focus-visible
    outline 2px solid var(--accent)
    border-radius var(--radius-sm)

// "Showing 12 of 147 results", Dictionaries, Add my definition
.results-header
  flex none
  display flex
  align-items center
  gap 14px
  margin-bottom -4px

.results-count
  font-size var(--text-base)
  color var(--muted)

  b
    color var(--ink)
    font-weight 600

.header-button
  box-sizing border-box
  display inline-flex
  align-items center
  justify-content center
  height 2.25rem
  padding 0 14px
  border 1.5px solid var(--line-strong)
  border-radius var(--radius-lg)
  background var(--surface)
  color var(--ink)
  font 500 var(--text-sm-plus) var(--font-ui)
  cursor pointer

  &:hover
    border-color var(--accent)

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset 2px

.header-button--icon
  width 2.75rem
  height 2.75rem
  padding 0

// Before any search
.search-start
  flex 1
  min-height 0
  display flex
  flex-direction column
  gap 18px
  overflow-y auto
  padding-bottom 28px

.recent-searches,
.search-tips
  flex none
  padding 20px 24px

.card-header
  display flex
  align-items center
  gap 10px
  margin -8px 0
  color var(--muted)

  .link-button
    margin-right -8px

.card-title
  font-size var(--text-xs)
  font-weight 600
  letter-spacing 0.08em
  text-transform uppercase
  color var(--muted)

.recent-list
  display flex
  flex-wrap wrap
  gap 10px
  margin-top 16px

.recent-query
  box-sizing border-box
  min-height 2.5rem
  max-width 100%
  padding 0 16px
  border 1px solid var(--line)
  border-radius var(--radius-lg)
  background var(--surface)
  color var(--ink)
  font-family var(--font-serif)
  font-size 1.0625rem
  text-align left
  overflow-wrap anywhere
  cursor pointer

  &:hover
    border-color var(--line-strong)
    background var(--soft)

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset 1px

  // Tibetan, wrapped in spans by the decorator
  :deep(.tibetan)
    font-family var(--font-tibetan)
    font-size 1.25rem
    line-height 1.9

.tips
  display grid
  grid-template-columns repeat(3, 1fr)
  gap 24px
  margin-top 14px

.tip
  display flex
  flex-direction column
  gap 4px

.tip-title
  font-size 0.9375rem
  font-weight 600

.tip-text
  font-size var(--text-sm-plus)
  line-height 1.5
  color var(--muted)

// Results: one card of rows that unfold (TermEntries), which scrolls on a desktop
.results-list
  flex 0 1 auto
  min-height 0
  display flex
  flex-direction column
  margin-bottom 28px
  overflow-y auto
  overscroll-behavior contain
  background var(--surface)
  border 1px solid var(--line)
  border-radius var(--radius-card)
  box-shadow var(--shadow-card)

.load-more-sentinel
  display flex
  justify-content center
  align-items center
  min-height 3.75rem
  padding 0 24px
  font-size var(--text-xs)
  color var(--muted)

.no-results
  flex none
  padding 16px 18px
  font-size var(--text-base)
  color var(--muted)

.search-page :deep(.uninstalled-notice)
  margin 0 0 28px

// Phone (board "B · Search on a phone"): the whole page scrolls, each
// term is a row of the results card.
.search-page.is-phone
  gap 14px
  // Room for the floating help button after the last result
  padding 16px 16px var(--phone-help-clearance)
  overflow-y auto
  -webkit-overflow-scrolling touch

  .search-field
    :deep(.ui-field__control)
      min-height 3.375rem
      padding 0 6px 0 16px

    :deep(.ui-field__input)
      font-size 1.25rem

    &.has-tibetan :deep(.ui-field__input)
      font-size var(--text-tibetan-md)

  // The toggle goes under the field, which keeps the whole width
  .search-top
    flex-wrap wrap
    gap 4px

  .search-field
    flex-basis 100%

  .builder-toggle
    padding 6px 0
    margin-bottom -6px

  .results-header
    gap 8px
    margin-bottom 0

  .results-count
    font-size var(--text-sm-plus)

  .search-start
    flex none
    overflow visible
    padding-bottom 16px

  .recent-searches,
  .search-tips
    padding 16px

  .tips
    grid-template-columns 1fr
    gap 14px

  .results-list
    flex none
    margin-bottom 0
    overflow visible

  .load-more-sentinel
    min-height 3rem

  :deep(.uninstalled-notice)
    margin 0 0 16px

  .no-results
    margin-bottom 16px
</style>
