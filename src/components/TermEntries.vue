<script>
  import DictionariesDetailsMixin from './DictionariesDetailsMixin'
  import Entry from './EntriesEntry.vue'
  import { UiIcon } from '../ui'
  import { getScanInfo } from '../services/scan-service'

  // One Tibetan headword as a row that unfolds. Collapsed, it is one line: the
  // headword, a preview of its first definition and how many it holds. Open,
  // the preview gives way to the definitions, each drawn by EntriesEntry the
  // way Define draws the entries of the selected term (dictionary label, the
  // definition or the scanned page, copy button), then a footer. The entries
  // arrive already decorated. The caller passes the `preview` entry only while
  // the row is collapsed and the `entries` to show only while it is open (so
  // the others are never decorated) and, when it held some back, the `total`:
  // a "Show N more" button follows, asking the caller to unfold the row. Once
  // `expanded`, the same button offers "Show less".
  export default {
    name: 'TermEntries',
    mixins: [DictionariesDetailsMixin],
    components: { Entry, UiIcon },
    props: {
      // The headword, as HTML (it may carry hit highlighting)
      term: { type: String, required: true },
      open: { type: Boolean, default: false },
      // The first definition, already decorated, while the row is collapsed
      preview: { type: Object, default: null },
      entries: { type: Array, default: () => [] },
      total: { type: Number, default: null },
      expanded: { type: Boolean, default: false },
      titleTestid: { type: String, default: 'term-entries-title' },
      entryTestid: { type: String, default: 'entry' },
      // `<prefix>-header`, `-preview`, `-count` and `-open-define`
      testidPrefix: { type: String, default: 'term-entries' }
    },
    emits: ['toggle-open', 'open-term', 'show-about', 'toggle-more'],
    computed: {
      count () {
        const total = this.total ?? this.entries.length;
        return `${total} ${total === 1 ? 'definition' : 'definitions'}`;
      },
      hiddenCount () {
        return this.total === null ? 0 : Math.max(0, this.total - this.entries.length);
      },
      previewIsScan () {
        return !!this.preview && !!getScanInfo(this.preview.dictionary);
      },
      previewPage () {
        // The definition of a scanned entry is its page, possibly with a ?
        const page = parseInt(this.preview?.definition, 10);
        return isNaN(page) ? '' : `Page ${page}`;
      }
    },
    methods: {
      toggleMore () {
        const folding = this.expanded;
        this.$emit('toggle-more');
        // Folding a long row would leave the reader far below it: keep the
        // button they pressed in view (jsdom has no scrollIntoView)
        if (folding) this.$nextTick(() => this.$refs.more?.scrollIntoView?.({ block: 'nearest' }));
      }
    }
  }
</script>

<template>
  <section class="term-entries" :class="{ 'is-open': open }" data-testid="term-entries">
    <button
      type="button"
      class="term-entries__header"
      :aria-expanded="open"
      :data-testid="`${testidPrefix}-header`"
      @click="$emit('toggle-open')"
    >
      <span
        class="term-entries__title result-term tibetan"
        :data-testid="titleTestid"
        v-html="term"
      />
      <span
        v-if="!open && preview"
        class="term-entries__preview"
        :data-testid="`${testidPrefix}-preview`"
      >
        <span class="term-entries__chip" v-html="dictionaryLabelFor(preview.dictionary, { short: true })" />
        <span v-if="previewIsScan" class="term-entries__preview-text">{{ previewPage }}</span>
        <span v-else class="term-entries__preview-text" v-html="preview.definition" />
      </span>
      <span class="term-entries__meta">
        <span class="term-entries__count" :data-testid="`${testidPrefix}-count`">{{ count }}</span>
        <ui-icon class="term-entries__chevron" name="chevron-down" :size="18" />
      </span>
    </button>
    <template v-if="open">
      <entry
        v-for="(entry, index) in entries"
        :key="`${entry.dictionaryId}-${index}`"
        :entry="entry"
        :data-testid="entryTestid"
        @show-about="$emit('show-about', $event)"
      />
      <div class="term-entries__footer">
        <button
          v-if="expanded || hiddenCount > 0"
          ref="more"
          type="button"
          class="term-entries__link"
          :aria-expanded="expanded"
          data-testid="term-entries-more"
          @click="toggleMore"
        >
          {{ expanded ? 'Show less' : `Show ${hiddenCount} more` }}
        </button>
        <button
          type="button"
          class="term-entries__link term-entries__define"
          :data-testid="`${testidPrefix}-open-define`"
          @click="$emit('open-term')"
        >
          Open in Define &rarr;
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.term-entries {
  border-bottom: 1px solid var(--soft);
  /* overflow: hidden drops a flex item's minimum height to 0: in Search's
     scrolling column the rows would shrink to their borders */
  flex: none;
  overflow: hidden;
}

/* The line: headword | preview | count and chevron */
.term-entries__header {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr) auto;
  grid-template-areas: 'title preview meta';
  align-items: center;
  column-gap: 18px;
  width: 100%;
  box-sizing: border-box;
  min-height: 2.75rem;
  padding: 6px 22px;
  border: 0;
  background: none;
  text-align: left;
  color: var(--ink);
  font-family: var(--font-ui);
  cursor: pointer;
}
.term-entries__header:hover {
  background: var(--soft);
}
.term-entries__header:focus-visible,
.term-entries__link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.term-entries__title {
  grid-area: title;
  font-family: var(--font-tibetan);
  font-size: var(--text-tibetan-md);
  line-height: 1.7;
  color: var(--rubric);
  overflow-wrap: anywhere;
}

/* One line, cut with an ellipsis. The line height keeps the vowels above the
   Tibetan from being clipped by the overflow. */
.term-entries__preview {
  grid-area: preview;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  line-height: 1.9;
}
.term-entries__chip {
  flex: none;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: var(--radius-sm);
  padding: 3px 9px;
  background: var(--accent-soft);
  color: var(--accent);
  font: 600 var(--text-chip) / 1.35 var(--font-ui);
}
.term-entries__chip :deep(.tibetan) {
  font-size: 1.15em;
  line-height: 1;
}
.term-entries__preview-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: var(--text-entry);
  line-height: 1.9;
}
/* A definition can hold paragraphs, breaks, links and players: flatten them
   to run in one line */
.term-entries__preview-text :deep(*) {
  display: inline;
}
.term-entries__preview-text :deep(br),
.term-entries__preview-text :deep(audio),
.term-entries__preview-text :deep(button) {
  display: none;
}
.term-entries__preview-text :deep(a[href]) {
  color: var(--rubric);
  text-decoration: none;
  pointer-events: none;
}

.term-entries__meta {
  grid-area: meta;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
}
.term-entries__count {
  font-size: var(--text-sm);
  white-space: nowrap;
}
.term-entries__chevron {
  flex: none;
  transition: transform 0.15s ease;
}
.is-open .term-entries__chevron {
  transform: rotate(180deg);
}

.term-entries > :deep(.entry-row:last-of-type) {
  border-bottom: 0;
}

.term-entries__footer {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 2px 22px 8px;
}
.term-entries__link {
  min-height: 2.25rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font: 600 var(--text-sm-plus) var(--font-ui);
  cursor: pointer;
}
.term-entries__link:hover {
  text-decoration: underline;
}
.term-entries__define {
  margin-left: auto;
}

/* Phone: the term, the count and the chevron on a line, the preview under */
@media (max-width: 600px) {
  .term-entries__header {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'title meta'
      'preview preview';
    column-gap: 12px;
    padding: 8px 16px;
  }
  .term-entries__footer {
    padding: 2px 16px 8px;
  }
  .term-entries__link {
    min-height: 2.75rem;
  }
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
