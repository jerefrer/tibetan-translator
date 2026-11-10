<script>
  import Entry from './EntriesEntry.vue'

  // One Tibetan headword and its definitions, each drawn by EntriesEntry the
  // way Define draws the entries of the selected term (dictionary label, the
  // definition or the scanned page, copy button). The entries arrive already
  // decorated. The caller passes only the entries to show (so the others are
  // never decorated) and, when it held some back, the `total`: a
  // "Show N more" button follows, asking the caller to unfold the card. Once
  // `expanded`, the same button offers "Show less".
  export default {
    name: 'TermEntries',
    components: { Entry },
    props: {
      // The headword, as HTML (it may carry hit highlighting)
      term: { type: String, required: true },
      entries: { type: Array, required: true },
      total: { type: Number, default: null },
      expanded: { type: Boolean, default: false },
      titleTestid: { type: String, default: 'term-entries-title' },
      entryTestid: { type: String, default: 'entry' }
    },
    emits: ['open-term', 'show-about', 'toggle-more'],
    computed: {
      hiddenCount () {
        return this.total === null ? 0 : Math.max(0, this.total - this.entries.length);
      }
    },
    methods: {
      toggleMore () {
        const folding = this.expanded;
        this.$emit('toggle-more');
        // Folding a long card would leave the reader far below it: keep the
        // button they pressed in view (jsdom has no scrollIntoView)
        if (folding) this.$nextTick(() => this.$refs.more?.scrollIntoView?.({ block: 'nearest' }));
      }
    }
  }
</script>

<template>
  <section class="term-entries" data-testid="term-entries">
    <button
      type="button"
      class="term-entries__title result-term tibetan"
      :data-testid="titleTestid"
      @click="$emit('open-term')"
      v-html="term"
    />
    <entry
      v-for="(entry, index) in entries"
      :key="`${entry.dictionaryId}-${index}`"
      :entry="entry"
      :data-testid="entryTestid"
      @show-about="$emit('show-about', $event)"
    />
    <button
      v-if="expanded || hiddenCount > 0"
      ref="more"
      type="button"
      class="term-entries__more"
      :aria-expanded="expanded"
      data-testid="term-entries-more"
      @click="toggleMore"
    >
      {{ expanded ? 'Show less' : `Show ${hiddenCount} more` }}
    </button>
  </section>
</template>

<style scoped>
.term-entries {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  /* overflow: hidden drops a flex item's minimum height to 0: in Search's
     scrolling column the cards would shrink to their borders */
  flex: none;
}
.term-entries__title {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 12px 22px 2px;
  border: 0;
  background: none;
  text-align: left;
  font-family: var(--font-tibetan);
  font-size: var(--text-tibetan-md);
  line-height: 1.7;
  color: var(--rubric);
  overflow-wrap: anywhere;
  cursor: pointer;
}
.term-entries__title:hover {
  text-decoration: underline;
}
.term-entries__title:focus-visible,
.term-entries__more:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.term-entries > :deep(.entry-row:last-of-type) {
  border-bottom: 0;
}
.term-entries__more {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 22px 14px;
  border: 0;
  border-top: 1px solid var(--soft);
  background: none;
  text-align: left;
  color: var(--accent);
  font: 600 var(--text-sm-plus) var(--font-ui);
  cursor: pointer;
}
.term-entries__more:hover {
  text-decoration: underline;
}

/* The hits: Latin on yellow, Tibetan underlined in yellow (amber in dark) */
.term-entries :deep(em) {
  font-style: normal;
  background: var(--hit-bg);
  color: var(--on-hit-bg);
  border-radius: 2px;
}
.term-entries__title :deep(em),
.term-entries :deep(.tibetan em) {
  background: none;
  color: inherit;
  text-decoration: underline var(--hit-bg) 3px;
  text-underline-offset: 4px;
}
</style>
