<script>
import { TERMS_BATCH_SIZE } from '../../config/constants';
import Storage from '../../services/storage';
import { loadGlosses, tibetanRuns } from '../../services/glosses';
import { UiSpinner } from '../../ui';
import InfiniteScrollMixin from '../mixins/InfiniteScrollMixin';
import UninstalledPacksNotice from '../UninstalledPacksNotice.vue';

// Lookup's results in བོད mode (boards Main and MobileResults): the headwords
// starting with what was typed, 100 at a time, each with a one-line gloss
// from the first enabled dictionary that has it.
export default {
  name: 'HeadwordResults',
  components: { UiSpinner, UninstalledPacksNotice },
  mixins: [InfiniteScrollMixin],
  props: {
    // Every match, sorted
    terms: { type: Array, required: true },
    selected: { type: String, default: '' },
    // Changes when the dictionaries (enabled, order) or packs changed: the
    // glosses are read again
    refreshKey: { type: Number, default: 0 },
  },
  emits: ['select'],
  data() {
    return {
      displayedCount: TERMS_BATCH_SIZE,
      // term -> gloss ('' when no enabled dictionary has one); a term not
      // there yet shows a placeholder
      glosses: {},
    };
  },
  computed: {
    visibleTerms() {
      return this.terms.slice(0, this.displayedCount);
    },
    hasMore() {
      return this.displayedCount < this.terms.length;
    },
  },
  watch: {
    terms() {
      this.displayedCount = TERMS_BATCH_SIZE;
      this.revealSelected();
    },
    selected() {
      this.revealSelected();
      this.$nextTick(() => this.scrollSelectedIntoView());
    },
    visibleTerms: {
      handler() {
        this.loadVisibleGlosses();
        this.setupInfiniteScroll();
      },
      immediate: true,
    },
    refreshKey() {
      this.glosses = {};
      this.loadVisibleGlosses();
    },
  },
  methods: {
    tibetanRuns,
    loadMore() {
      if (this.hasMore) this.displayedCount += TERMS_BATCH_SIZE;
    },
    // A selected term further down than the rows shown is shown too
    revealSelected() {
      const index = this.terms.indexOf(this.selected);
      if (index >= this.displayedCount) this.displayedCount = index + TERMS_BATCH_SIZE;
    },
    async loadVisibleGlosses() {
      const missing = this.visibleTerms.filter((term) => !(term in this.glosses));
      if (!missing.length) return;
      const token = (this._glossToken = (this._glossToken || 0) + 1);
      const refreshKey = this.refreshKey;
      try {
        const loaded = await loadGlosses(missing, Storage.get('dictionaries') || []);
        // Glosses read for an older list or older dictionaries are dropped
        if (refreshKey !== this.refreshKey) return;
        this.glosses = { ...this.glosses, ...Object.fromEntries(loaded) };
      } catch (error) {
        if (token === this._glossToken) console.warn('[Lookup] Glosses not loaded', error);
      }
    },
    scrollSelectedIntoView() {
      this.$el?.querySelector?.('.lookup-result.is-selected')?.scrollIntoView?.({ block: 'nearest' });
    },
  },
};
</script>

<template>
  <div class="lookup-results">
    <div
      v-if="terms.length"
      class="lookup-results__list"
      role="listbox"
      aria-label="Terms starting with what you typed"
      data-testid="lookup-headwords"
    >
      <div
        v-for="term in visibleTerms"
        :key="term"
        class="lookup-result"
        :class="{ 'is-selected': term === selected }"
        role="option"
        :aria-selected="term === selected ? 'true' : 'false'"
        data-testid="lookup-result"
        @click="$emit('select', term)"
      >
        <span class="lookup-result__term" data-testid="lookup-result-term">{{ term }}</span>
        <span
          v-if="term in glosses"
          class="lookup-result__gloss"
          data-testid="lookup-result-gloss"
        ><template v-for="(run, index) in tibetanRuns(glosses[term])" :key="index"><span v-if="run.tibetan" class="lookup-result__gloss-tibetan">{{ run.text }}</span><template v-else>{{ run.text }}</template></template></span>
        <span v-else class="lookup-result__placeholder" aria-hidden="true" />
      </div>
      <!-- Sentinel for infinite scroll. Hidden from assistive technology:
           a listbox may only contain options. -->
      <div ref="loadMoreSentinel" class="lookup-results__sentinel" aria-hidden="true">
        <ui-spinner v-if="hasMore" :size="20" label="Loading more terms" />
      </div>
    </div>
    <div v-else class="lookup-results__none" data-testid="lookup-no-results">No results.</div>

    <UninstalledPacksNotice :result-count="terms.length" />
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

.lookup-result__term {
  font-family: var(--font-tibetan);
  font-size: var(--text-result-tibetan);
  line-height: 1.5;
  color: var(--rubric);
  overflow-wrap: anywhere;
}

.lookup-result__gloss {
  min-height: 1.2em;
  font-size: var(--text-sm);
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lookup-result__gloss-tibetan {
  font-family: var(--font-tibetan);
  font-size: 1.15em;
  line-height: 1;
}

/* Until its gloss is read, a faint bar holds the row's height */
.lookup-result__placeholder {
  width: 60%;
  height: 0.8em;
  margin: 0.2em 0;
  border-radius: var(--radius-xs);
  background: var(--soft);
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

.lookup-results__none {
  padding: var(--space-4);
  font-size: var(--text-base);
  color: var(--muted);
}
</style>
