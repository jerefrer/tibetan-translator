<script>
import { SEARCH_GROUPS_BATCH_SIZE, INFINITE_SCROLL_ROOT_MARGIN_LARGE } from '../../config/constants';
import SqlDatabase from '../../services/sql-database';
import Storage from '../../services/storage';
import Decorator from '../../services/decorator';
import { hasTibetan, plainGloss } from '../../services/glosses';
import { getScanInfo } from '../../services/scan-service';
import { plural } from '../../services/quick-lookup';
import {
  buildSearchSql,
  groupSearchEntries,
  highlightSearchTerms,
  parseSearchQuery,
} from '../../services/search-query';
import { clearPreviousQueries, readPreviousQueries } from '../../services/lookup-state';
import { UiIcon, UiSpinner } from '../../ui';
import InfiniteScrollMixin from '../mixins/InfiniteScrollMixin';
import UninstalledPacksNotice from '../UninstalledPacksNotice.vue';

const GLOSS_LENGTH = 240;
// Stand-ins for < and > while the hits are marked, so that a definition's
// own angle brackets are never read as tags
const LT = '\uE000';
const GT = '\uE001';

/** The definition as plain text with the hits in <em>, every other
 *  character escaped: safe for v-html. Tibetan runs go in a span set in the
 *  Tibetan font (added after escaping: Tibetan letters are never markup). */
export function highlightedGloss(definitionHtml, terms) {
  const text = plainGloss(definitionHtml, GLOSS_LENGTH).replace(/</g, LT).replace(/>/g, GT);
  return highlightSearchTerms(text, terms)
    .split(/(<\/?em>)/)
    .map((part) =>
      /^<\/?em>$/.test(part)
        ? part
        : part
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(new RegExp(LT, 'g'), '&lt;')
            .replace(new RegExp(GT, 'g'), '&gt;')
            .replace(/[ༀ-࿿]+/g, '<span class="lookup-result__gloss-tibetan">$&</span>')
    )
    .join('');
}

// Lookup's results in EN mode (boards ModeEnglish and MobileResults): the
// definitions searched the way Search does (same SQL, grouping and order),
// one row per Tibetan term with its first definition as a highlighted gloss.
// `dictionary` (a dictionary's name) keeps to that dictionary's definitions
// (Dictionaries' "Search its definitions"). Before any query, the queries
// searched before.
export default {
  name: 'DefinitionResults',
  components: { UiIcon, UiSpinner, UninstalledPacksNotice },
  mixins: [InfiniteScrollMixin],
  props: {
    query: { type: String, default: '' },
    selected: { type: String, default: '' },
    // Changes when the dictionaries (enabled, order) or packs changed: the
    // query is searched again
    refreshKey: { type: Number, default: 0 },
    // Only this dictionary's definitions, by name ('' for every dictionary)
    dictionary: { type: String, default: '' },
  },
  emits: ['select', 'search', 'count'],
  data() {
    return {
      loading: false,
      // undefined until a query was searched
      entries: undefined,
      dictionaries: [],
      // The terms of the query searched, frozen for the highlighting
      searchedTerms: { regular: [], phoneticsStrict: [], phoneticsLoose: [] },
      displayedCount: SEARCH_GROUPS_BATCH_SIZE,
      previousQueries: readPreviousQueries(),
    };
  },
  computed: {
    infiniteScrollRootMargin() {
      return INFINITE_SCROLL_ROOT_MARGIN_LARGE;
    },
    groups() {
      if (!this.entries) return [];
      return groupSearchEntries(this.entries, { dictionaries: this.dictionaries, ...this.searchedTerms });
    },
    visibleGroups() {
      return this.groups.slice(0, this.displayedCount).map((group) => {
        // Scanned dictionaries hold a page number, not a definition
        const entry = group.entries.find((e) => !getScanInfo(e.dictionary));
        return {
          term: group.term,
          gloss: entry ? highlightedGloss(entry.definition, this.searchedTerms) : '',
          count: plural(group.entries.length, 'definition'),
        };
      });
    },
    hasMore() {
      return this.displayedCount < this.groups.length;
    },
  },
  watch: {
    query: {
      handler() {
        this.search();
      },
      immediate: true,
    },
    refreshKey() {
      if (this.query) this.search();
    },
    dictionary() {
      if (this.query) this.search();
    },
    displayedCount() {
      this.setupInfiniteScroll();
    },
    // Moved to with Up and Down: shown, even further down than the rows shown
    selected(term) {
      const index = this.groups.findIndex((group) => group.term === term);
      if (index >= this.displayedCount) this.displayedCount = index + SEARCH_GROUPS_BATCH_SIZE;
      this.$nextTick(() =>
        this.$el?.querySelector?.('.lookup-result.is-selected')?.scrollIntoView?.({ block: 'nearest' })
      );
    },
  },
  activated() {
    this.previousQueries = readPreviousQueries();
  },
  beforeUnmount() {
    // A search still running when the list goes is dropped on return
    this._searchToken = (this._searchToken || 0) + 1;
  },
  methods: {
    hasTibetan,
    async search() {
      const query = (this.query || '').trim();
      const token = (this._searchToken = (this._searchToken || 0) + 1);
      if (!query) {
        this.entries = undefined;
        this.loading = false;
        this.previousQueries = readPreviousQueries();
        this.$emit('count', 0);
        return;
      }
      const parsed = parseSearchQuery(query);
      // The phonetic terms go raw: their variants are derived by the service
      const sql = buildSearchSql({
        regular: parsed.regular,
        strictVariants: parsed.phoneticsStrict,
        looseVariants: parsed.phoneticsLoose,
      });
      this.loading = true;
      let rows = [];
      try {
        rows = sql ? (await SqlDatabase.exec(sql, [])) || [] : [];
      } catch (error) {
        console.warn('[Lookup] Search failed', error);
      }
      if (token !== this._searchToken) return;
      if (this.dictionary) rows = rows.filter((row) => row.dictionary === this.dictionary);
      this.searchedTerms = parsed;
      this.dictionaries = Storage.get('dictionaries') || [];
      this.entries = rows;
      this.displayedCount = SEARCH_GROUPS_BATCH_SIZE;
      this.loading = false;
      this.$emit('count', this.groups.length);
      this.setupInfiniteScroll();
    },
    loadMore() {
      if (this.hasMore) this.displayedCount += SEARCH_GROUPS_BATCH_SIZE;
    },
    // Every result's term, in order (Lookup's Up and Down go through them)
    resultTerms() {
      return this.groups.map((group) => group.term);
    },
    clearHistory() {
      clearPreviousQueries();
      this.previousQueries = [];
    },
    // Tibetan in a previous query, in DDC Uchen
    // (escaped first: a query is text the user typed, never markup)
    decoratedQuery(query) {
      const text = query.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return Decorator.wrapAllTibetanWithSpansAndAddTshekIfMissing(text);
    },
  },
};
</script>

<template>
  <div class="lookup-results">
    <div v-if="loading && !entries" class="lookup-results__loading">
      <ui-spinner :size="22" label="Searching" />
    </div>

    <!-- Before any query: what was searched before -->
    <section
      v-else-if="!entries"
      class="lookup-previous"
      aria-label="Recent searches"
      data-testid="lookup-previous"
    >
      <template v-if="previousQueries.length">
        <div class="lookup-previous__head">
          <ui-icon name="history" :size="16" :stroke-width="2" />
          <h2 class="lookup-previous__label">Recent searches</h2>
          <button type="button" class="lookup-previous__clear" data-testid="lookup-previous-clear" @click="clearHistory">
            Clear
          </button>
        </div>
        <button
          v-for="previous in previousQueries"
          :key="previous"
          type="button"
          class="lookup-previous__query"
          data-testid="lookup-previous-query"
          @click="$emit('search', previous)"
          v-html="decoratedQuery(previous)"
        />
      </template>
    </section>

    <template v-else>
      <div
        v-if="visibleGroups.length"
        class="lookup-results__list"
        role="listbox"
        aria-label="Terms whose definitions match"
        data-testid="lookup-definitions"
      >
        <div
          v-for="group in visibleGroups"
          :key="group.term"
          class="lookup-result"
          :class="{ 'is-selected': group.term === selected }"
          role="option"
          :aria-selected="group.term === selected ? 'true' : 'false'"
          data-testid="lookup-result"
          @click="$emit('select', group.term)"
        >
          <span class="lookup-result__head">
            <span class="lookup-result__term" data-testid="lookup-result-term">{{ group.term }}</span>
            <span class="lookup-result__count" data-testid="lookup-result-count">{{ group.count }}</span>
          </span>
          <!-- Plain text escaped by highlightedGloss, only <em> added -->
          <span class="lookup-result__gloss" :class="{ 'has-tibetan': hasTibetan(group.gloss) }" data-testid="lookup-result-gloss" v-html="group.gloss" />
        </div>
        <div ref="loadMoreSentinel" class="lookup-results__sentinel" aria-hidden="true">
          <ui-spinner v-if="hasMore" :size="20" label="Loading more results" />
        </div>
      </div>
      <div v-else class="lookup-results__none" data-testid="lookup-no-results">No results.</div>

      <!-- Not while one dictionary is searched: the packs would not add to it -->
      <UninstalledPacksNotice v-if="!dictionary" :result-count="groups.length" />
    </template>
  </div>
</template>

<style scoped>
.lookup-results__list {
  display: flex;
  flex-direction: column;
}

.lookup-result {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line-soft);
  color: var(--ink);
  cursor: pointer;
}

.lookup-result:hover {
  background: var(--bg-quiet);
}

.lookup-result.is-selected {
  background: var(--accent-soft);
  border-bottom-color: var(--accent-line);
}

.lookup-result__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.lookup-result__term {
  font-family: var(--font-tibetan);
  font-size: var(--text-result-tibetan);
  line-height: 1.5;
  color: var(--rubric);
  overflow-wrap: anywhere;
}

.lookup-result__count {
  flex: none;
  font-size: var(--text-xs);
  color: var(--faint);
}

.lookup-result__gloss {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: var(--text-sm);
  line-height: 1.45;
  color: var(--muted);
}

.lookup-result__gloss :deep(em) {
  font-style: normal;
  font-weight: 600;
  color: var(--ink);
}

/* Two lines that hold Tibetan need room for its stacks and vowels: the
   clamp cuts at the line boxes, so they are made tall enough */
.lookup-result__gloss.has-tibetan {
  line-height: 1.95;
}

.lookup-result__gloss :deep(.lookup-result__gloss-tibetan) {
  font-family: var(--font-tibetan);
  font-size: 1.1em;
  line-height: inherit;
}

.lookup-results__sentinel {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 1px;
  color: var(--muted);
}

.lookup-results__sentinel:not(:empty) {
  min-height: 2.75rem;
}

.lookup-results__none,
.lookup-results__loading {
  padding: var(--space-4);
  font-size: var(--text-base);
  color: var(--muted);
}

.lookup-previous {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
}

.lookup-previous__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  align-self: stretch;
  margin-bottom: var(--space-1);
  color: var(--faint);
}

.lookup-previous__label {
  flex: 1;
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.lookup-previous__clear {
  padding: var(--space-1);
  border: 0;
  background: none;
  color: var(--accent);
  font: 500 var(--text-sm) var(--font-ui);
  cursor: pointer;
}

.lookup-previous__query {
  max-width: 100%;
  padding: var(--space-1) 0;
  border: 0;
  background: none;
  color: var(--ink);
  font: var(--text-base) var(--font-ui);
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.lookup-previous__query:hover {
  color: var(--accent);
}

.lookup-previous__query :deep(.tibetan) {
  font-family: var(--font-tibetan);
  font-size: var(--text-tibetan-sm);
  color: var(--rubric);
}
</style>
