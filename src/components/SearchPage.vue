<script>
import _ from 'underscore';

import TibetanRegExps from 'tibetan-regexps';

import {
  MAX_ENTRIES_PER_REQUEST,
  ENTRIES_BATCH_SIZE,
  MAX_PREVIOUS_QUERIES,
  INFINITE_SCROLL_ROOT_MARGIN_LARGE,
} from '../config/constants';
import Decorator from '../services/decorator';
import PhoneticSearch from '../services/phonetic-search';
import SqlDatabase from '../services/sql-database';
import Storage from '../services/storage';
import { mayNeedLegacyRepair } from '../services/legacy-to-unicode';
import { supportsModularPacks } from '../config/platform';
import {
  convertWylieInParentheses,
  phoneticsLooseFor,
  phoneticsStrictFor,
  replaceTibetanGroups,
  syllablesFor,
} from '../utils.js';
import { UiButton, UiIcon, UiSpinner, UiTextField, UiTooltip } from '../ui';
import DictionariesMenuMixin from './DictionariesMenuMixin';
import InfiniteScrollMixin from './mixins/InfiniteScrollMixin';
import MobileResponsiveMixin from './mixins/MobileResponsiveMixin';

import DictionaryAboutDialog from './DictionaryAboutDialog.vue';
import QuickAddDialog from './QuickAddDialog.vue';
import UninstalledPacksNotice from './UninstalledPacksNotice.vue';
import ResultsAndPaginationAndDictionaries from './ResultsAndPaginationAndDictionaries.vue';
import ScanViewer from './ScanViewer.vue';
import SearchBuilder from './SearchBuilder.vue';
import { getScanInfo } from '../services/scan-service';

// Board "B · Search" (and its Empty, query builder, Dictionaries and Phone
// variants): the query field on top, the query builder under it when shown,
// then the results in one card, or the recent searches before any search.
export default {
  mixins: [DictionariesMenuMixin, InfiniteScrollMixin, MobileResponsiveMixin],
  components: {
    DictionaryAboutDialog,
    QuickAddDialog,
    UninstalledPacksNotice,
    ResultsAndPaginationAndDictionaries,
    ScanViewer,
    SearchBuilder,
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
      displayedCount: ENTRIES_BATCH_SIZE,
      batchSize: ENTRIES_BATCH_SIZE,
      searchQuery: this.$route.params.query,
      previousQueries: Storage.get('previousQueries', []),
      scanViewerEntry: null, // Entry for which scan viewer is open
      // Cached highlight terms - only updated on search, not on input change
      cachedRegularTerms: [],
      cachedPhoneticsStrictTerms: [],
      cachedPhoneticsLooseTerms: [],
      // Search builder state
      builderVisible: Storage.get('searchBuilderVisible') !== false,
      quickAddOpen: false,
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
      if (value) this.performSearch({ query: value, fromNavigation: true });
    },
    previousQueries(value) {
      Storage.set('previousQueries', value);
    },
    builderVisible(value) {
      // The help promises the choice is remembered
      Storage.set('searchBuilderVisible', value);
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
      const trimmed = (this.searchQuery || '').trim();
      if (!trimmed || trimmed.includes('&') || /[[\]{}]/.test(trimmed)) return '';
      return this.containsTibetan(trimmed) ? trimmed : '';
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
    hasResults() {
      return this.entries != undefined && this.visibleEntries.length > 0;
    },
    hasMore() {
      return this.displayedCount < this.totalNumberOfEntriesForEnabledDictionaries;
    },
    sortedEntries() {
      // Multi-factor sorting with BM25 relevance ranking
      // Priority: 1) starts with search term, 2) BM25 rank, 3) term length, 4) dictionary position
      // Use cached terms to avoid re-sorting on input change (only on search)
      const searchTermLower = this.cachedRegularTerms[0]?.toLowerCase() || '';

      // Read the user's customised dictionary order from localStorage (the same
      // order that drives DefinePage and the settings drag-drop). The SQL row's
      // `dictionaryPosition` is the build-time order, which doesn't reflect
      // user preferences.
      const userDictPositions = {};
      for (const d of this.dictionaries) userDictPositions[d.id] = d.position;

      return _.chain(this.entriesForEnabledDictionaries)
        .sortBy((entry) => {
          // Factor 1: Does term START WITH the search query? (0 = yes, 1 = no)
          const startsWithBonus = entry.term
            .toLowerCase()
            .startsWith(searchTermLower)
            ? 0
            : 1;

          // Factor 2: User-preferred dictionary position. Promoted above BM25
          // so reordering dictionaries in Settings actually reorders results,
          // even when BM25 scores differ slightly across packs.
          const dictPos = userDictPositions[entry.dictionaryId] || 999;

          // Factor 3: BM25 rank (negative values, closer to 0 = better match)
          // Add offset to make all values positive for string comparison
          const rankScore = (entry.rank || 0) + 1000;

          // Factor 4: Term length (shorter = more specific match)
          const termLength = entry.term.length;

          return [startsWithBonus, dictPos, rankScore, termLength].map((x) =>
            x.toString().padStart(10, '0')
          );
        })
        .value();
    },
    visibleEntries() {
      // Decorate here, not in the template: a computed only re-runs when its
      // dependencies change, whereas template method calls re-ran on every
      // keystroke (searchQuery is a render dependency). This depends on the
      // cached terms (frozen at search time), never on searchQuery.
      return this.sortedEntries.slice(0, this.displayedCount).map((entry) => ({
        ...entry,
        decoratedTerm: this.highlightSearchTerms(entry.term),
        // Scanned dictionaries show a page number instead of a definition
        decoratedDefinition: this.isScannedDictionary(entry)
          ? ''
          : this.highlightSearchTerms(Decorator.decorate(entry)),
      }));
    },
    totalNumberOfEntriesForEnabledDictionaries() {
      return this.entriesForEnabledDictionaries?.length || 0;
    },
    searchTerms() {
      if (!this.searchQuery) return [];
      else
        return _.compact(
          this.substituteWylieTerms(this.searchQuery)
            .split('&')
            .map((t) => t.trim())
        );
    },
    regularSearchTerms() {
      return this.searchTerms.filter((term) => !term.match(/^[\[\{].*[\]\}]$/));
    },
    phoneticsStrictSearchTerms() {
      // Return raw terms - spaceless processing happens in performSearch
      return this.phoneticsTerms(/^\[.*\]$/, phoneticsStrictFor);
    },
    phoneticsLooseSearchTerms() {
      // Return raw terms - spaceless processing happens in performSearch
      return this.phoneticsTerms(/^\{.*\}$/, phoneticsLooseFor);
    },
  },
  methods: {
    containsTibetan(text) {
      // Check if text contains any Tibetan Unicode characters
      return TibetanRegExps.tibetanGroups.test(text);
    },
    substituteWylieTerms(text) {
      return convertWylieInParentheses(text);
    },
    phoneticsTerms(regexp, convert) {
      return _.chain(this.searchTerms.map((term) => term.match(regexp)))
        .compact()
        .flatten()
        .value()
        .map((term) => term.slice(1, -1))
        .map((term) =>
          replaceTibetanGroups(term, (tibetan) => convert(tibetan) + ' ')
        );
    },
    wrapAllTibetanWithSpansAndAddTshekIfMissing(definition) {
      return Decorator.wrapAllTibetanWithSpansAndAddTshekIfMissing(definition);
    },
    highlightSearchTerms(definition) {
      // Split by HTML tags - the regex captures tags so they're included in the result
      const parts = definition.split(/(<[^>]+>)/);

      return parts
        .map((part) => {
          // Skip HTML tags - only process text nodes
          if (part.startsWith('<') && part.endsWith('>')) {
            return part;
          }
          // Apply highlighting to text nodes only
          // Use cached terms (frozen at search time) to avoid re-rendering on input change
          let highlighted = part;
          this.cachedRegularTerms.forEach((term) => {
            var escapedTerm = this.escapeForRegExp(term);
            var regexp = new RegExp('(' + escapedTerm + ')', 'ig');
            highlighted = highlighted.replace(regexp, '<em>$1</em>');
          });
          this.cachedPhoneticsStrictTerms.forEach((term) => {
            highlighted = this.highlightTibetanMatchingPhonetics(
              highlighted,
              term,
              phoneticsStrictFor
            );
          });
          this.cachedPhoneticsLooseTerms.forEach((term) => {
            highlighted = this.highlightTibetanMatchingPhonetics(
              highlighted,
              term,
              phoneticsLooseFor
            );
          });
          return highlighted;
        })
        .join('');
    },
    highlightTibetanMatchingPhonetics(definition, term, convert) {
      var numberOfSyllablesForTerm = term.split(' ').length;
      return replaceTibetanGroups(definition, (group) => {
        var combinations = this.everySyllablesCombinationsOfGivenLengthFor(
          group,
          numberOfSyllablesForTerm
        );
        var match = combinations.find((subgroup) => {
          var groupInPhonetics = convert(subgroup);
          return groupInPhonetics.includes(term);
        });
        if (match) {
          var matchWithoutEndingTshek = match.replace(/་$/, '');
          return group.replace(
            new RegExp(`(${matchWithoutEndingTshek}[་།༎༑༔]?)`, 'g'),
            '<em>$1</em>'
          );
        } else return group;
      });
    },
    everySyllablesCombinationsOfGivenLengthFor(
      source,
      numberOfSyllablesForTerm
    ) {
      var syllables = syllablesFor(source);
      var numberOfSyllables = syllables.length;
      var combinations = [];
      for (var i = 0; i + numberOfSyllablesForTerm <= numberOfSyllables; i++) {
        var slice = syllables.slice(i, i + numberOfSyllablesForTerm);
        combinations.push(slice.join('་') + '་');
      }
      return _.chain(combinations).uniq().sortBy('length').value();
    },
    escapeForRegExp(text) {
      return (
        text
          .replace(/([\[\]\{\}\.\*\?])/g, '\\$1')
          // Treat ASCII apostrophe and curly right-single-quote as interchangeable
          // so "d'après" highlights "d'après" in the text and vice-versa.
          .replace(/['’]/g, "['’]")
      );
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
    clear() {
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
    onLexiconEntrySaved() {
      // Re-run the current search so the new definition shows immediately.
      if (this.searchQuery) this.performSearch({ query: this.searchQuery, fromNavigation: true });
    },
    focusInput() {
      this.$refs.input?.focus();
    },

    prepareTerm(term) {
      return `"${term.replace(/'/g, "''").replace(/"/g, '""')}"`;
    },
    prepareTermForLike(term) {
      // Escape special SQL LIKE characters and single quotes
      return term.replace(/'/g, "''").replace(/%/g, '\\%').replace(/_/g, '\\_');
    },
    storeQuery() {
      this.previousQueries = this.previousQueries.filter(
        (query) => query != this.searchQuery
      );
      this.previousQueries.unshift(this.searchQuery);
      if (this.previousQueries.length > MAX_PREVIOUS_QUERIES)
        this.previousQueries = this.previousQueries.slice(0, MAX_PREVIOUS_QUERIES);
    },
    pushRoute() {
      var path = '/search/' + encodeURIComponent(this.searchQuery);
      if (path != this.$route.path) {
        this.$router.push({ path: path });
      }
    },
    performSearch(options = {}) {
      this.searchQuery = options.query || this.searchQuery;
      if (this.searchQuery?.trim()) {
        this.loading = true;
        if (!options.fromNavigation) {
          this.storeQuery();
          this.pushRoute();
        }
        // Cache highlight terms at search time to avoid re-rendering on input changes
        this.cachedRegularTerms = [...this.regularSearchTerms];
        this.cachedPhoneticsStrictTerms = [...this.phoneticsStrictSearchTerms];
        this.cachedPhoneticsLooseTerms = [...this.phoneticsLooseSearchTerms];

        var params = [];

        // Hybrid search: FTS for English/phonetics, LIKE for Tibetan
        // FTS unicode61 tokenizer strips Tibetan combining characters, causing incorrect matches
        // LIKE preserves exact Tibetan text for accurate results

        // Split regular terms into Tibetan and non-Tibetan
        const tibetanRegularTerms = this.regularSearchTerms.filter((t) =>
          this.containsTibetan(t)
        );
        const nonTibetanRegularTerms = this.regularSearchTerms.filter(
          (t) => !this.containsTibetan(t)
        );

        // Build FTS conditions for non-Tibetan regular terms
        var ftsConditions = [];
        nonTibetanRegularTerms.forEach((term) => {
          ftsConditions.push(
            `(entries_fts MATCH 'term:${this.prepareTerm(
              term
            )} OR definition:${this.prepareTerm(term)}')`
          );
        });

        // Add phonetic search conditions to FTS
        this.phoneticsStrictSearchTerms.forEach((rawTerm) => {
          // First generate spaceless variants if input has no spaces
          const variants = rawTerm.includes(' ')
            ? [rawTerm]
            : PhoneticSearch.processSpacelessPhoneticSearch(rawTerm);

          // Then apply prepareTermForStrictMatching to each variant and build OR conditions
          const termConditions = variants
            .map((variant) => PhoneticSearch.prepareTermForStrictMatching(variant))
            .map((prepared) => `termPhoneticsStrict:${this.prepareTerm(prepared)}`)
            .join(' OR ');

          ftsConditions.push(
            `(entries_fts MATCH '(${termConditions}) OR definitionPhoneticsWordsStrict:${this.prepareTerm(
              PhoneticSearch.prepareTermForStrictMatching(rawTerm)
            )}')`
          );
        });
        this.phoneticsLooseSearchTerms.forEach((rawTerm) => {
          // First generate spaceless variants if input has no spaces
          const variants = rawTerm.includes(' ')
            ? [rawTerm]
            : PhoneticSearch.processSpacelessPhoneticSearch(rawTerm);

          // Then apply prepareTermForLooseMatching to each variant and build OR conditions
          const termConditions = variants
            .map((variant) => PhoneticSearch.prepareTermForLooseMatching(variant))
            .map((prepared) => `termPhoneticsLoose:${this.prepareTerm(prepared)}`)
            .join(' OR ');

          ftsConditions.push(
            `(entries_fts MATCH '(${termConditions}) OR definitionPhoneticsWordsLoose:${this.prepareTerm(
              PhoneticSearch.prepareTermForLooseMatching(rawTerm)
            )}')`
          );
        });

        // Build LIKE conditions for Tibetan terms (searches both term and definition)
        var likeConditions = [];
        tibetanRegularTerms.forEach((term) => {
          const escaped = this.prepareTermForLike(term);
          likeConditions.push(
            `(entries.term LIKE '%${escaped}%' ESCAPE '\\' OR entries.definition LIKE '%${escaped}%' ESCAPE '\\')`
          );
        });

        // Build the appropriate query based on what types of conditions we have
        const hasFtsConditions = ftsConditions.length > 0;
        var query;

        if (!hasFtsConditions && likeConditions.length > 0) {
          // Pure Tibetan search - use LIKE only (no FTS join needed)
          // Sort by term length (shorter = more specific match) and dictionary position
          query = `
            SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition, 0 AS rank
            FROM entries
            INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
            WHERE ${likeConditions.join(' AND ')}
            ORDER BY length(entries.term), dictionaryPosition
            LIMIT ${MAX_ENTRIES_PER_REQUEST}
          `;
        } else if (hasFtsConditions) {
          // Has FTS conditions - use FTS with optional LIKE additions for mixed searches
          // BM25 column weights: term(10), termPhoneticsStrict(8), termPhoneticsLoose(8),
          // definition(1), definitionPhoneticsWordsStrict(1), definitionPhoneticsWordsLoose(1)
          // Higher weights = more important for ranking. Term matches weighted 10x over definition.
          const allConditions = [...ftsConditions, ...likeConditions];
          query = `
            SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition,
                   bm25(entries_fts, 10.0, 8.0, 8.0, 1.0, 1.0, 1.0) AS rank
            FROM entries
            INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
            INNER JOIN entries_fts ON entries.id = entries_fts.rowid
            WHERE ${allConditions.join(' AND ')}
            ORDER BY rank
            LIMIT ${MAX_ENTRIES_PER_REQUEST}
          `;
        } else {
          // No valid search terms
          this.entries = [];
          this.loading = false;
          return;
        }
        SqlDatabase.exec(query, params)
          .then((rows) => {
            this.entries = rows;
            this.displayedCount = this.batchSize; // Reset to initial batch
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
    shortDictionaryLabelFor(entry) {
      return this.dictionaryLabelFor(entry.dictionary, { short: true });
    },
    openDictionaryAbout(entry) {
      this.aboutDictionary = entry.dictionary;
      this.aboutOpen = true;
    },
    // Scanned dictionary methods
    isScannedDictionary(entry) {
      return !!getScanInfo(entry.dictionary);
    },
    getScanPageNumber(entry) {
      if (!this.isScannedDictionary(entry)) return null;
      const pageStr = entry.definition?.replace('?', '').trim();
      const page = parseInt(pageStr, 10);
      return isNaN(page) ? null : page;
    },
    isApproximatePage(entry) {
      return !!entry.definition?.includes('?');
    },
    openScanViewer(entry) {
      this.scanViewerEntry = entry;
    },
    closeScanViewer() {
      this.scanViewerEntry = null;
    },
    showBuilder() {
      this.builderVisible = true;
    },
  },
  mounted() {
    if (this.searchQuery) this.performSearch();
  },
  activated() {
    this.$nextTick(() => this.focusInput());
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
    <div class="search-top">
      <ui-text-field
        ref="input"
        v-model="searchQuery"
        class="search-field"
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
      v-model="searchQuery"
      v-model:visible="builderVisible"
      @submit="performSearch()"
    />

    <!-- Results count, Dictionaries menu and Add my definition -->
    <div v-if="hasResults" class="results-header">
      <span class="results-count" data-testid="search-count">
        Showing <b>{{ visibleEntries.length }}</b> of
        <b>{{ totalNumberOfEntriesForEnabledDictionaries }}</b> results
      </span>
      <div class="ui-spacer" />
      <ResultsAndPaginationAndDictionaries
        :dictionaries="dictionariesForCurrentResults"
        :totalNumberOfEntries="totalNumberOfEntriesForEnabledDictionaries"
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
              class="text-button"
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
              @click="performSearch({ query: query })"
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
        v-else-if="visibleEntries.length"
        ref="resultsList"
        class="card results-list"
        data-testid="search-results"
      >
        <article
          v-for="(entry, index) in visibleEntries"
          :key="`${entry.term}-${entry.dictionaryId}-${index}`"
          class="result"
          data-testid="search-result"
        >
          <div
            class="result-term tibetan"
            data-testid="search-result-term"
            v-html="entry.decoratedTerm"
          />
          <div class="result-dictionary">
            <button
              type="button"
              class="dictionary-label"
              title="About this dictionary"
              data-testid="search-result-dictionary"
              @click="openDictionaryAbout(entry)"
              v-html="shortDictionaryLabelFor(entry)"
            />
          </div>
          <!-- Regular dictionary: the definition -->
          <div
            v-if="!isScannedDictionary(entry)"
            class="result-definition definition"
            data-testid="search-result-definition"
            v-html="entry.decoratedDefinition"
          />
          <!-- Scanned dictionary: the page and a button to the scan -->
          <div v-else class="result-definition scanned-entry" data-testid="search-result-scan">
            <span class="page-info">
              Page {{ getScanPageNumber(entry) }}
              <span v-if="isApproximatePage(entry)" class="uncertain">(approximate)</span>
            </span>
            <ui-button
              variant="outline"
              size="sm"
              class="view-scan-button"
              data-testid="search-result-view-scan"
              @click="openScanViewer(entry)"
            >
              <ui-icon name="book-open-text" :size="16" />
              View scan
            </ui-button>
          </div>
        </article>

        <!-- Sentinel for infinite scroll -->
        <div ref="loadMoreSentinel" class="load-more-sentinel" data-testid="search-sentinel">
          <ui-spinner v-if="hasMore" :size="22" label="Loading more results" />
          <span v-else>All {{ totalNumberOfEntriesForEnabledDictionaries }} results loaded</span>
        </div>
      </div>

      <div v-else class="card no-results" data-testid="search-no-results">No entries</div>

      <UninstalledPacksNotice
        v-if="entries != undefined"
        :result-count="totalNumberOfEntriesForEnabledDictionaries"
      />
    </template>

    <ScanViewer
      v-if="scanViewerEntry"
      :model-value="!!scanViewerEntry"
      @update:model-value="closeScanViewer"
      :dictionary-id="scanViewerEntry?.dictionary"
      :initial-page="getScanPageNumber(scanViewerEntry)"
      :approximate="isApproximatePage(scanViewerEntry)"
    />

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

.text-button
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

// The field: 60px, accent ring when focused (UiTextField does the focus)
.search-top
  flex none
  display flex
  align-items center
  gap 16px

.search-field
  flex 1
  max-width 55rem

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

  .text-button
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

// Results: rows in one card (term, dictionary, definition)
.results-list
  flex 0 1 auto
  min-height 0
  margin-bottom 28px
  overflow-y auto
  overscroll-behavior contain

.result
  display grid
  grid-template-columns 18.75rem 9.375rem minmax(0, 1fr)
  gap 20px
  align-items baseline
  padding 14px 24px
  border-bottom 1px solid var(--soft)

.result-term
  min-width 0
  font-family var(--font-tibetan)
  font-size var(--text-tibetan-md)
  line-height 1.7
  color var(--rubric)
  overflow-wrap anywhere

.result-dictionary
  min-width 0

.dictionary-label
  max-width 100%
  border 0
  border-radius var(--radius-sm)
  padding 3px 9px
  background var(--accent-soft)
  color var(--accent)
  font 600 var(--text-chip) / 1.35 var(--font-ui)
  text-align left
  white-space nowrap
  overflow hidden
  text-overflow ellipsis
  cursor pointer

  &:hover
    background var(--accent-line)

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset 1px

  // Tibetan inside a label (wrapped in spans by the decorator)
  :deep(.tibetan)
    font-size 1.15em
    line-height 1

.result-definition
  min-width 0
  margin 0
  font-family var(--font-serif)
  font-size var(--text-entry)
  line-height 1.5
  overflow-wrap anywhere

  // Tibetan in a definition links to its own lookup
  :deep(a[href])
    color var(--rubric)
    text-decoration none

// The hits: Latin on yellow, Tibetan underlined in yellow
.result :deep(em)
  font-style normal
  background var(--logo-bg)
  color #2A1F1A
  border-radius 2px

.result-term :deep(em),
.result :deep(.tibetan em)
  background none
  color inherit
  text-decoration underline var(--logo-bg) 3px
  text-underline-offset 4px

.scanned-entry
  display flex
  align-items center
  flex-wrap wrap
  gap 14px
  font-family var(--font-ui)

.page-info
  font-size var(--text-body)

.uncertain
  color var(--muted)

.view-scan-button
  color var(--accent)
  border-color var(--accent)
  font-weight 600

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

// A narrow window: tighter columns
@media (max-width: 1100px)
  .result
    grid-template-columns 12rem 8rem minmax(0, 1fr)
    gap 16px
    padding 12px 18px

// Phone (board "B · Search on a phone"): the whole page scrolls, each
// result is a card of its own, the dictionary beside the term and the
// definition under them.
.search-page.is-phone
  gap 14px
  padding 16px 16px 0
  overflow-y auto
  -webkit-overflow-scrolling touch

  .search-field
    max-width none

    :deep(.ui-field__control)
      min-height 3.375rem
      padding 0 6px 0 16px

    :deep(.ui-field__input)
      font-size 1.25rem

  .builder-toggle
    padding 8px 0

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
    display flex
    flex-direction column
    gap 10px
    margin-bottom 0
    overflow visible
    background none
    border 0
    border-radius 0
    box-shadow none

  .result
    grid-template-columns auto minmax(0, 1fr)
    grid-template-areas "dictionary term" "definition definition"
    gap 6px 10px
    align-items center
    padding 12px 16px
    background var(--surface)
    border 1px solid var(--line)
    border-radius var(--radius-card)
    box-shadow var(--shadow-card)

  .result-dictionary
    grid-area dictionary

  .result-term
    grid-area term
    justify-self end
    text-align right
    font-size 1.25rem

  .result-definition
    grid-area definition
    font-size 1.0313rem
    line-height 1.45

  .view-scan-button
    height 2.75rem

  .load-more-sentinel
    min-height 3rem

  :deep(.uninstalled-notice)
    margin 0 0 16px

  .no-results
    margin-bottom 16px
</style>
