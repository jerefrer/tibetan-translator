<script>
  import DictionariesDetailsMixin from './DictionariesDetailsMixin'
  import Entry from './EntriesEntry.vue'
  import { UiIcon } from '../ui'
  import { getScanInfo } from '../services/scan-service'

  let uid = 0;

  // One Tibetan headword as a row that unfolds. Collapsed, it is one line: the
  // headword, a preview of its first definition and how many it holds. Open,
  // the preview unfolds in place into the first definition, the others below
  // it, each drawn by EntriesEntry the way Define draws the entries of the
  // selected term (dictionary label, the definition or the scanned page, copy
  // button), then a footer that can fold the row again. Open, the count gives
  // way to the definitions themselves: it stays for screen readers only. The
  // row eases between its two heights. The entries arrive already decorated.
  // The caller passes the `preview` entry only while the row is collapsed and
  // the `entries` to show only while it is open (so the others are never
  // decorated) and, when it held some back, the `total`: a "Show N more"
  // button follows, asking the caller to unfold the row. Once `expanded`, the
  // same button offers "Show less".
  //
  // An open definition holds links and buttons, which a button cannot: the
  // toggle is the count and chevron, stretched over the whole row, and the
  // open definitions sit above it.
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
      // `<prefix>-header`, `-preview`, `-count`, `-fold` and `-open-define`
      testidPrefix: { type: String, default: 'term-entries' }
    },
    emits: ['toggle-open', 'open-term', 'show-about', 'toggle-more'],
    data () {
      const id = ++uid;
      return { titleId: `term-entries-title-${id}`, countId: `term-entries-count-${id}` };
    },
    watch: {
      // Before the row redraws: opening, closing, showing more or less
      open () { this.easeHeight(); },
      'entries.length' () { this.easeHeight(); }
    },
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
      // Called before the row redraws: takes its height now, then animates
      // from it to the new one once drawn. Opening and its entries arriving
      // in the same update make one animation.
      easeHeight () {
        if (this._easing || typeof this.$el?.animate !== 'function') return;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
        const from = this.$el.offsetHeight;
        this._easing = true;
        this.$nextTick(() => {
          this._easing = false;
          const to = this.$el.offsetHeight;
          if (from === to) return;
          this.$el.animate(
            [{ height: `${from}px` }, { height: `${to}px` }],
            { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
          );
        });
      },
      toggleMore () {
        const folding = this.expanded;
        this.$emit('toggle-more');
        // Folding a long row would leave the reader far below it: keep the
        // button they pressed in view (jsdom has no scrollIntoView)
        if (folding) this.$nextTick(() => this.$refs.more?.scrollIntoView?.({ block: 'nearest' }));
      },
      fold () {
        this.$emit('toggle-open');
        // Folded from the bottom of a long row, the headword may be far above:
        // bring it back in view
        this.$nextTick(() => this.$refs.title?.scrollIntoView?.({ block: 'nearest' }));
      }
    }
  }
</script>

<template>
  <section class="term-entries" :class="{ 'is-open': open }" data-testid="term-entries">
    <span
      :id="titleId"
      ref="title"
      class="term-entries__title result-term tibetan"
      :data-testid="titleTestid"
      v-html="term"
    />
    <button
      type="button"
      class="term-entries__toggle"
      :aria-expanded="open"
      :aria-labelledby="`${titleId} ${countId}`"
      :data-testid="`${testidPrefix}-header`"
      @click="$emit('toggle-open')"
    >
      <span
        :id="countId"
        class="term-entries__count"
        :class="{ 'ui-visually-hidden': open }"
        :data-testid="`${testidPrefix}-count`">{{ count }}</span>
      <ui-icon class="term-entries__chevron" name="chevron-down" :size="18" />
    </button>
    <div class="term-entries__body">
      <div
        v-if="!open && preview"
        class="term-entries__preview"
        :data-testid="`${testidPrefix}-preview`"
      >
        <span class="term-entries__chip" v-html="dictionaryLabelFor(preview.dictionary, { short: true })" />
        <span v-if="previewIsScan" class="term-entries__preview-text">{{ previewPage }}</span>
        <span v-else class="term-entries__preview-text" v-html="preview.definition" />
      </div>
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
            class="term-entries__link term-entries__fold"
            :data-testid="`${testidPrefix}-fold`"
            @click="fold"
          >
            Fold
            <ui-icon name="chevron-up" :size="16" />
          </button>
          <button
            type="button"
            class="term-entries__link"
            :data-testid="`${testidPrefix}-open-define`"
            @click="$emit('open-term')"
          >
            Open in Define &rarr;
          </button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
/* The row: headword | body | count and chevron. The body holds the preview
   while collapsed, the definitions once open, on the same columns: the
   dictionary, the definition, the copy button. So every definition starts at
   the same place, and the first one opens where its preview stood. */
.term-entries {
  /* The term column grows on a wide screen, so fewer terms wrap */
  --term-column: clamp(11rem, 22%, 18rem);
  --dictionary-column: 11rem;
  /* The first line, as tall as the headword: the preview, the first
     definition, its label and the toggle are centred on it */
  --row-line: calc(var(--text-tibetan-md) * 1.7);
  position: relative;
  display: grid;
  grid-template-columns: var(--term-column) minmax(0, 1fr) auto;
  align-items: start;
  column-gap: 18px;
  padding: 6px 22px;
  border-bottom: 1px solid var(--soft);
  /* overflow: hidden drops a flex item's minimum height to 0: in Search's
     scrolling column the rows would shrink to their borders. It also clips
     the row while its height eases. */
  flex: none;
  overflow: hidden;
}
.term-entries:not(.is-open):hover {
  background: var(--soft);
}

.term-entries__title {
  grid-column: 1;
  grid-row: 1;
  font-family: var(--font-tibetan);
  font-size: var(--text-tibetan-md);
  line-height: var(--row-line);
  color: var(--rubric);
  overflow-wrap: anywhere;
}

/* The toggle is stretched over the whole row. The open body sits above it,
   so its text can be selected and its links and buttons pressed. */
.term-entries__toggle {
  /* The last column, on a desktop as on the phone */
  grid-column: -2;
  grid-row: 1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: var(--row-line);
  padding: 0;
  border: 0;
  background: none;
  color: var(--muted);
  font-family: var(--font-ui);
  cursor: pointer;
}
.term-entries__toggle::after {
  content: '';
  position: absolute;
  inset: 0;
}
.term-entries__toggle:hover {
  color: var(--ink);
}
.term-entries__toggle:focus-visible,
.term-entries__link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
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

.term-entries__body {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
}
.is-open .term-entries__body {
  position: relative;
  z-index: 1;
}

/* The preview: one line, cut with an ellipsis. The overflow would clip the
   vowels above the Tibetan and the stacks below it: the padding widens the
   clip, the margin keeps the line where it was. */
.term-entries__preview {
  display: grid;
  grid-template-columns: var(--dictionary-column) minmax(0, 1fr) 2rem;
  align-items: center;
  column-gap: 18px;
  min-height: var(--row-line);
}
.term-entries__chip {
  justify-self: start;
  max-width: 100%;
  box-sizing: border-box;
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
  padding-block: 0.35em;
  margin-block: -0.35em;
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

.term-entries__body > :deep(.entry-row:last-of-type) {
  border-bottom: 0;
}

/* Open, each definition on the preview's columns, its first line centred on
   the row's first line as the preview's was */
@media (min-width: 601px) {
  .term-entries__body > :deep(.entry-row) {
    display: grid;
    grid-template-columns: var(--dictionary-column) minmax(0, 1fr) 2rem;
    column-gap: 18px;
    align-items: start;
    padding: 8px 0;
  }
  .term-entries__body > :deep(.entry-row:first-child) {
    padding-top: 0;
  }
  .term-entries__body > :deep(.entry-row .entry-header) {
    display: contents;
  }
  .term-entries__body > :deep(.entry-row .dictionary-label) {
    grid-column: 1;
    grid-row: 1;
    justify-self: start;
    margin-top: calc((var(--row-line) - var(--text-chip) * 1.35 - 6px) / 2);
  }
  .term-entries__body > :deep(.entry-row .definition) {
    grid-column: 2;
    grid-row: 1;
    padding-top: calc((var(--row-line) - var(--text-entry) * 1.55) / 2);
  }
  .term-entries__body > :deep(.entry-row .scanned-entry) {
    grid-column: 2;
    grid-row: 1;
    min-height: var(--row-line);
    padding: 0;
  }
  .term-entries__body > :deep(.entry-row .copy-button) {
    grid-column: 3;
    grid-row: 1;
    margin-top: calc((var(--row-line) - 2rem) / 2);
  }
}

.term-entries__footer {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-top: 2px;
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
.term-entries__fold {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

/* Phone: the term, the count and the chevron on a line, the body under */
@media (max-width: 600px) {
  .term-entries {
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 12px;
    padding: 8px 16px;
  }
  .term-entries__body {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .term-entries__preview {
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: 12px;
    min-height: 0;
  }
  .term-entries__chip {
    max-width: 40vw;
  }
  .term-entries__body > :deep(.entry-row) {
    padding: 10px 0 12px;
  }
  .term-entries__body > :deep(.entry-row:first-child) {
    padding-top: 2px;
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
