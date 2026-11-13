<script>
import _ from 'underscore';

import { DEBOUNCE_SEARCH_MS } from '../../config/constants';
import SqlDatabase from '../../services/sql-database';
import { cleanDictionaryLabel } from '../../services/copy-service';
import { recordTerm } from '../../services/history';
import { TIBETAN_CHAR_RE, plural } from '../../services/quick-lookup';
import { highlightSearchTerms, parseSearchQuery } from '../../services/search-query';
import { readLookupState, storePreviousQuery, writeLookupState } from '../../services/lookup-state';
import { tibetanLookupKey } from '../../utils';
import { UiButton, UiIcon, UiResizeHandle } from '../../ui';
import MobileResponsiveMixin from '../mixins/MobileResponsiveMixin';
import PaneWidthMixin from '../mixins/PaneWidthMixin';
import ResultsFreshnessMixin from '../mixins/ResultsFreshnessMixin';
import TermEntry from '../entry/TermEntry.vue';
import DefinitionResults from '../lookup/DefinitionResults.vue';
import HelpButton from '../help/HelpButton.vue';
import SearchField from './SearchField.vue';

// Search: the definitions searched for a query, and the entry of the term
// chosen among the results, opened here rather than in Lookup so the results
// stay in view.
// The route carries the query: /search?q=<query>; `dict=<name>` keeps it to
// one dictionary's definitions (Dictionaries' "Search its definitions") until
// its ×. The old /search/<query> and /lookup?mode=en links are redirected
// here by the router. The last query is kept in `lookupState`.
// The query runs on Enter or after a pause. A query that is a Tibetan term
// offers to look it up in Lookup; nothing is converted from one page to the
// other.
//
// Layout: as Lookup (lookup-layout.css). Desktop: the results column with the
// field on top, and the entry pane, the divider between them draggable. Phone:
// the title, the field and the results (the queries searched before while
// there is no query); a tapped result shows its entry full screen with a back
// link.
// Keyboard: Up/Down move through the results, Enter opens the one moved to
// (or searches a query changed since), Escape clears the field.
export default {
  name: 'SearchPage',
  mixins: [
    MobileResponsiveMixin,
    ResultsFreshnessMixin,
    PaneWidthMixin({ storageKey: 'lookupResultsWidth', cssVariable: '--results-width', min: 300, reserve: 420 }),
  ],
  components: {
    DefinitionResults,
    HelpButton,
    SearchField,
    TermEntry,
    UiButton,
    UiIcon,
    UiResizeHandle,
  },
  beforeRouteEnter(to, from, next) {
    // Opened bare (sidebar, tab bar, app start): what was searched is shown
    // again, and the route says so
    if (to.query.q || to.query.dict) next();
    else next((vm) => vm.restoreRoute(to));
  },
  data() {
    return {
      text: '',
      // The query whose results are shown
      query: '',
      // The dictionary the search keeps to, by name ('' for all)
      onlyDictionary: '',
      definitionCount: 0,
      // The term whose entry is open
      selectedTerm: '',
      // The result Up and Down moved to, opened by Enter
      activeTerm: '',
    };
  },
  computed: {
    // How the query was read, under the field
    readAs() {
      if (!this.query) return '';
      const where = this.onlyDictionary ? ` in ${this.onlyDictionaryLabel}` : '';
      return `Terms whose definitions say “${this.query}”${where} · ${plural(this.definitionCount, 'term')}`;
    },
    onlyDictionaryLabel() {
      return this.onlyDictionary ? cleanDictionaryLabel(this.onlyDictionary) : '';
    },
    // Phone: the entry full screen instead of the field and the results
    showingEntry() {
      return this.isMobile && this.mobileShowDefinition && !!this.selectedTerm;
    },
    // The highlighted result: the one moved to, else the one open
    highlightedTerm() {
      return this.activeTerm || this.selectedTerm;
    },
    // The hits of the query are marked in the entry too
    entryHighlight() {
      if (!this.query) return null;
      const terms = parseSearchQuery(this.query);
      return (html) => highlightSearchTerms(html, terms);
    },
    // A query in Tibetan script that is a term: Lookup has its entry
    lookupTerm() {
      this.allTermsVersion; // re-read when the terms change
      const text = (this.text || '').trim();
      if (!TIBETAN_CHAR_RE.test(text) || /[A-Za-z&()[\]{}]/.test(text)) return '';
      const key = tibetanLookupKey(text);
      return key && (SqlDatabase.allTerms || []).includes(key) ? key : '';
    },
  },
  watch: {
    text() {
      this.debouncedRunQuery();
    },
    $route(route, from) {
      // Kept alive while another page is open: its routes are not Search's
      if (route.path !== '/search') return;
      // Back to Search from another page: beforeRouteEnter's restoreRoute
      if (!route.query.q && !route.query.dict && !from?.path.startsWith('/search')) return;
      this.applyRoute(route);
    },
  },
  created() {
    this.debouncedRunQuery = _.debounce(this.runTypedQuery, DEBOUNCE_SEARCH_MS);
    // Created bare, the query to show is beforeRouteEnter's restoreRoute's:
    // applying the bare route would forget it first
    const { path, query } = this.$route;
    if (path === '/search' && (query.q || query.dict)) this.applyRoute(this.$route);
  },
  mounted() {
    this._onFocusLookup = () => {
      if (this.$route.path === '/search') this.focusField();
    };
    window.addEventListener('focus-lookup', this._onFocusLookup);
  },
  activated() {
    this.$nextTick(() => this.focusField());
  },
  deactivated() {
    // A pause that ends on another page searches nothing
    this.debouncedRunQuery.cancel();
  },
  beforeUnmount() {
    window.removeEventListener('focus-lookup', this._onFocusLookup);
    this.debouncedRunQuery.cancel();
  },
  methods: {
    applyRoute(route) {
      const query = route.query.q || '';
      this.onlyDictionary = route.query.dict || '';
      // A dictionary's "Search its definitions" keeps the query there was
      if (!query && route.query.dict) return;
      if (query !== this.query) {
        this.selectedTerm = '';
        this.activeTerm = '';
      }
      // A query run after a pause comes back trimmed: what is typed stays
      if ((this.text || '').trim() !== query) this.text = query;
      this.query = query;
      writeLookupState({ query });
    },
    // Opened bare: what this page shows, else the query searched last
    restoreRoute(to) {
      const query = this.query || readLookupState().query;
      if (!query && !this.onlyDictionary) return;
      this.$router.replace({ path: '/search', query: { ...to.query, ...this.routeQuery(query) }, hash: to.hash });
    },
    // A route's query: the query, and the dictionary kept to
    routeQuery(query) {
      return {
        ...(query ? { q: query } : {}),
        ...(this.onlyDictionary ? { dict: this.onlyDictionary } : {}),
      };
    },
    // After a pause in typing, the query runs (not kept in the previous
    // queries until Enter or a result is chosen)
    runTypedQuery() {
      if (this.$route.path !== '/search') return;
      const query = (this.text || '').trim();
      if (!query || query === this.query) return;
      this.$router.replace({ path: '/search', query: this.routeQuery(query) });
    },
    search() {
      const query = (this.text || '').trim();
      if (!query) return;
      this.debouncedRunQuery.cancel();
      storePreviousQuery(query);
      if (query !== this.query) this.$router.push({ path: '/search', query: this.routeQuery(query) });
    },
    // A query searched before, picked from the list
    searchPrevious(query) {
      this.text = query;
      this.search();
    },
    onSelect(term) {
      this.selectedTerm = term;
      this.activeTerm = term;
      recordTerm(term);
      // The query led somewhere: it is worth keeping
      storePreviousQuery(this.query);
      this.setMobileShowDefinition(true);
    },
    // The phone's back link: the field and the results as they were
    backToResults() {
      this.showTermsList();
    },
    // The ×: every dictionary again, the query kept
    searchEveryDictionary() {
      this.onlyDictionary = '';
      this.$router.replace({ path: '/search', query: this.routeQuery(this.query) });
      this.$nextTick(() => this.focusField());
    },
    lookUp(term) {
      this.$router.push('/lookup/' + encodeURIComponent(term));
    },
    clear() {
      this.debouncedRunQuery.cancel();
      this.text = '';
      this.query = '';
      this.selectedTerm = '';
      this.activeTerm = '';
      writeLookupState({ query: '' });
      const route = { path: '/search', query: this.routeQuery('') };
      if (this.$route.fullPath !== this.$router.resolve(route).fullPath) this.$router.push(route);
    },
    moveHighlight(step) {
      const terms = this.$refs.results?.resultTerms() || [];
      if (!terms.length) return;
      const index = terms.indexOf(this.highlightedTerm);
      const next = index === -1 ? (step > 0 ? 0 : -1) : index + step;
      if (next >= 0 && next < terms.length) this.activeTerm = terms[next];
    },
    onKeydown(event) {
      const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
      if (event.key === 'Escape') {
        if (!this.text) return;
        event.preventDefault();
        this.clear();
      } else if (event.key === 'Enter') {
        this.openHighlightedOrSearch();
      } else if (step) {
        event.preventDefault();
        this.moveHighlight(step);
      }
    },
    // Enter: the result moved to with Up and Down opens; a query changed
    // since is searched
    openHighlightedOrSearch() {
      const query = (this.text || '').trim();
      if (this.activeTerm && query === this.query) this.onSelect(this.activeTerm);
      else this.search();
    },
    focusField() {
      this.$refs.field?.focus();
    },
  },
};
</script>

<template>
  <section
    class="lookup-page search-page"
    :class="{ 'is-phone': isMobile, 'is-showing-entry': showingEntry }"
    :style="isMobile ? undefined : paneWidthStyle"
    data-testid="search-page"
  >
    <div v-show="!showingEntry" class="lookup-results-pane" data-testid="search-results-pane">
      <div class="lookup-page__head">
        <div v-if="isMobile" class="lookup-page__title-row">
          <h1 class="lookup-page__title">Search</h1>
          <help-button />
        </div>
        <h1 v-else class="lookup-page__title ui-visually-hidden">Search</h1>
        <search-field
          ref="field"
          v-model="text"
          :read-as="readAs"
          @keydown="onKeydown"
          @clear="clear"
          @submit="search"
        />
        <div v-if="onlyDictionary" class="search-only" data-testid="search-only">
          <ui-icon name="book-open" :size="15" class="search-only__icon" />
          <span class="search-only__text">Only in <strong>{{ onlyDictionaryLabel }}</strong></span>
          <button
            type="button"
            class="search-only__clear"
            aria-label="Search every dictionary"
            title="Search every dictionary"
            @click="searchEveryDictionary"
          >
            <ui-icon name="x" :size="15" />
          </button>
        </div>
        <section v-if="lookupTerm" class="search-hint" data-testid="hint-look-up">
          <ui-button class="search-hint__button" size="sm" @click="lookUp(lookupTerm)">
            <ui-icon name="search" :size="15" />
            Look up <span class="search-hint__tibetan">{{ lookupTerm }}</span> in Lookup
          </ui-button>
        </section>
      </div>
      <div class="lookup-page__list">
        <definition-results
          ref="results"
          :query="query"
          :selected="highlightedTerm"
          :refresh-key="refreshKey"
          :dictionary="onlyDictionary"
          @select="onSelect"
          @search="searchPrevious"
          @count="definitionCount = $event"
        />
      </div>
    </div>

    <ui-resize-handle
      v-if="!isMobile"
      :model-value="paneWidth"
      :min="300"
      :max="720"
      :reserve="420"
      label="Resize the results"
      @update:model-value="setPaneWidth"
      @reset="setPaneWidth(null)"
    />
    <div v-show="!isMobile || showingEntry" class="lookup-entry-pane" data-testid="search-entry-pane">
      <div class="lookup-entry-pane__inner">
        <term-entry v-if="selectedTerm" :term="selectedTerm" :highlight="entryHighlight">
          <template v-if="isMobile" #leading>
            <button type="button" class="lookup-back" data-testid="search-back" @click="backToResults">
              <ui-icon name="chevron-left" :size="22" :stroke-width="2.4" />Search
            </button>
          </template>
        </term-entry>
        <p v-else-if="!isMobile && query && definitionCount" class="search-page__pick" data-testid="search-pick">
          Choose a term to read its definitions here.
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped src="../lookup/lookup-layout.css"></style>

<style scoped>
.search-only {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  align-self: flex-start;
  max-width: 100%;
  min-height: var(--control-sm);
  padding: 0 4px 0 10px;
  border: 1px solid var(--accent-line);
  border-radius: var(--radius-md);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: var(--text-sm);
}
.search-only__icon {
  flex: none;
}
.search-only__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.search-only__clear {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: inherit;
  cursor: pointer;
}
.search-only__clear:hover {
  background: var(--accent-line);
}
.search-only__clear:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.search-hint__button {
  max-width: 100%;
}
.search-hint__tibetan {
  font-family: var(--font-tibetan);
  font-size: 1.15em;
  line-height: 1;
}

.search-page__pick {
  margin: var(--space-8) 0 0;
  color: var(--muted);
  font-size: var(--text-base);
  text-align: center;
}
</style>
