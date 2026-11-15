<script>
import { SEARCH_GROUPS_BATCH_SIZE, INFINITE_SCROLL_ROOT_MARGIN_LARGE } from '../../config/constants';
import SqlDatabase from '../../services/sql-database';
import Storage from '../../services/storage';
import { hasTibetan, plainGloss, tibetanRuns } from '../../services/glosses';
import { getScanInfo } from '../../services/scan-service';
import { plural } from '../../services/quick-lookup';
import {
  buildSearchSql,
  groupSearchEntries,
  highlightSearchTerms,
  parseSearchQuery,
} from '../../services/search-query';
import { clearPreviousQueries, readPreviousQueries, removePreviousQuery } from '../../services/lookup-state';
import { MATCH_MODES, queryConditions } from '../../services/query-conditions';
import { UiIcon, UiSpinner } from '../../ui';
import InfiniteScrollMixin from '../mixins/InfiniteScrollMixin';
import UninstalledPacksNotice from '../UninstalledPacksNotice.vue';

const GLOSS_LENGTH = 240;
// The recent searches shown before "Show all"
const PREVIOUS_ROWS = 8;
const MODE_LABELS = Object.fromEntries(MATCH_MODES.map((mode) => [mode.value, mode.label]));
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

// Search's results (boards ModeEnglish and MobileResults): the
// definitions searched the way the former Search did (same SQL, grouping and order),
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
      PREVIOUS_ROWS,
      loading: false,
      // undefined until a query was searched
      entries: undefined,
      dictionaries: [],
      // The terms of the query searched, frozen for the highlighting
      searchedTerms: { regular: [], phoneticsStrict: [], phoneticsLoose: [] },
      displayedCount: SEARCH_GROUPS_BATCH_SIZE,
      previousQueries: readPreviousQueries(),
      allPrevious: false,
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
    shownPreviousQueries() {
      return this.allPrevious ? this.previousQueries : this.previousQueries.slice(0, PREVIOUS_ROWS);
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
    tibetanRuns,
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
        console.warn('[Search] Search failed', error);
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
    // Every result's term, in order (Define's Up and Down go through them)
    resultTerms() {
      return this.groups.map((group) => group.term);
    },
    clearHistory() {
      clearPreviousQueries();
      this.previousQueries = [];
    },
    removePrevious(query) {
      removePreviousQuery(query);
      this.previousQueries = readPreviousQueries();
    },
    // A previous query as the conditions to draw: the mode's label for any
    // but `contains` (drawn as plain text). A query with none is drawn as is.
    previousConditions(query) {
      const conditions = queryConditions(query);
      if (!conditions.length) return [{ mode: 'contains', term: query, label: '' }];
      return conditions.map((condition) => ({
        ...condition,
        label: condition.mode === 'contains' ? '' : MODE_LABELS[condition.mode],
      }));
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
          <h2 class="lookup-previous__label">Recent</h2>
          <button type="button" class="lookup-previous__clear" data-testid="lookup-previous-clear" @click="clearHistory">
            Clear
          </button>
        </div>
        <ul class="lookup-previous__group">
          <li v-for="previous in shownPreviousQueries" :key="previous" class="lookup-previous__row">
            <button
              type="button"
              class="lookup-previous__query"
              :aria-label="previous"
              data-testid="lookup-previous-query"
              @click="$emit('search', previous)"
            >
              <template v-for="(condition, index) in previousConditions(previous)" :key="index">
                <span v-if="index > 0" class="lookup-previous__and">AND</span>
                <span :class="condition.label ? 'lookup-previous__chip' : 'lookup-previous__plain'">
                  <small v-if="condition.label">{{ condition.label }}</small>
                  <span class="lookup-previous__term"><template v-for="(run, runIndex) in tibetanRuns(condition.term)" :key="runIndex"><span v-if="run.tibetan" class="lookup-previous__tibetan">{{ run.text }}</span><template v-else>{{ run.text }}</template></template></span>
                </span>
              </template>
            </button>
            <button
              type="button"
              class="lookup-previous__remove"
              aria-label="Remove from recent searches"
              data-testid="lookup-previous-remove"
              @click="removePrevious(previous)"
            >
              <ui-icon name="x" :size="15" />
            </button>
          </li>
        </ul>
        <button
          v-if="previousQueries.length > PREVIOUS_ROWS"
          type="button"
          class="lookup-previous__all"
          data-testid="lookup-previous-all"
          @click="allPrevious = !allPrevious"
        >
          {{ allPrevious ? 'Show fewer' : 'Show all ' + previousQueries.length }}
        </button>
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
  align-items: stretch;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
}

.lookup-previous__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 var(--space-1);
}

.lookup-previous__label {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--faint);
}

.lookup-previous__clear {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font: var(--text-base) var(--font-ui);
  cursor: pointer;
}

.lookup-previous__clear:hover {
  text-decoration: underline;
}

.lookup-previous__group {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: var(--radius-group);
  background: var(--surface);
  overflow: hidden;
}

.lookup-previous__row {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 6px 8px 6px 14px;
}

.lookup-previous__row + .lookup-previous__row {
  border-top: 1px solid var(--line-soft);
}

.lookup-previous__row:hover {
  background: var(--bg-quiet);
}

.lookup-previous__query {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  font: var(--text-base) var(--font-ui);
  line-height: 1.3;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.lookup-previous__query:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.lookup-previous__chip {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 1px 7px;
  border-radius: var(--radius-md);
  background: var(--accent-soft);
}

.lookup-previous__chip small {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
}

.lookup-previous__and {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--faint);
}

.lookup-previous__tibetan {
  font-family: var(--font-tibetan);
  font-size: var(--text-tibetan-sm);
  color: var(--rubric);
}

.lookup-previous__remove {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin-left: var(--space-2);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: none;
  color: var(--faint);
  opacity: 0;
  cursor: pointer;
}

.lookup-previous__row:hover .lookup-previous__remove,
.lookup-previous__row:focus-within .lookup-previous__remove {
  opacity: 1;
}

@media (hover: none) {
  .lookup-previous__remove {
    opacity: 1;
  }
}

.lookup-previous__remove:hover {
  color: var(--ink);
  background: var(--soft);
}

.lookup-previous__remove:focus-visible {
  outline: 2px solid var(--accent);
}

.lookup-previous__all {
  align-self: flex-start;
  padding: var(--space-1) var(--space-1);
  border: 0;
  background: none;
  color: var(--accent);
  font: var(--text-sm) var(--font-ui);
  cursor: pointer;
}

.lookup-previous__all:hover {
  text-decoration: underline;
}
</style>
