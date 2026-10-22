<script>
  import DictionariesDetailsMixin from './DictionariesDetailsMixin'
  import ScanViewer from './ScanViewer.vue'
  import { UiButton, UiIcon, vIntersect } from '../ui'
  import { getScanInfo } from '../services/scan-service'
  import CopyService from '../services/copy-service'

  // One definition: the dictionary chip (opens the dictionary's "about"), a
  // copy button, and the decorated definition. A scanned dictionary holds a
  // page number instead, with a button that opens the scan viewer.
  //
  // The definition keeps the `definition` class: App.vue listens on it for
  // abbreviations and in-app /define/ links, and the decorator's audio
  // players are styled from layout.css.
  export default {
    mixins: [DictionariesDetailsMixin],
    components: { ScanViewer, UiButton, UiIcon },
    directives: { intersect: vIntersect },
    // The quick lookup popup mounts entries without a snackbar
    inject: { snackbar: { default: null } },
    props: {
      entry: Object,
      isLastEntry: Boolean
    },
    emits: ['intersect', 'show-about'],
    data() {
      return {
        showScanViewer: false,
        copied: false
      }
    },
    computed: {
      scanInfo() {
        return getScanInfo(this.entry.dictionary);
      },
      isScannedDictionary() {
        return !!this.scanInfo;
      },
      scanPageNumber() {
        if (!this.isScannedDictionary) return null;
        // Definition contains page number, possibly with ? suffix
        const pageStr = this.entry.definition?.replace('?', '').trim();
        const page = parseInt(pageStr, 10);
        return isNaN(page) ? null : page;
      },
      isApproximatePage() {
        return !!this.entry.definition?.includes('?');
      }
    },
    methods: {
      intersect(isIntersecting) {
        if (isIntersecting && this.isLastEntry)
          this.$emit('intersect');
      },
      showDictionaryAbout() {
        this.$emit('show-about', this.entry.dictionary);
      },
      openScanViewer() {
        this.showScanViewer = true;
      },
      async copyEntry() {
        try {
          await CopyService.writeToClipboard(CopyService.entryToText(this.entry));
          this.copied = true;
          this.snackbar?.open('Copied');
          clearTimeout(this._copiedTimer);
          this._copiedTimer = setTimeout(() => { this.copied = false; }, 1200);
        } catch (err) {
          this.snackbar?.open('Copy failed');
        }
      }
    },
    beforeUnmount() {
      clearTimeout(this._copiedTimer);
    }
  }
</script>

<template>
  <article
    class="entry-row"
    data-testid="entry"
    v-intersect.quiet="intersect"
  >
    <div class="entry-header">
      <button
        type="button"
        class="dictionary-label"
        title="About this dictionary"
        data-testid="entry-dictionary"
        @click="showDictionaryAbout"
        v-html="dictionaryLabelFor(entry.dictionary, { short: true })"
      />

      <button
        v-if="!isScannedDictionary"
        type="button"
        class="copy-button"
        :class="{ 'is-copied': copied }"
        :aria-label="copied ? 'Copied' : 'Copy definition'"
        :title="copied ? 'Copied' : 'Copy definition'"
        data-testid="entry-copy"
        @click="copyEntry"
      >
        <ui-icon :name="copied ? 'check' : 'copy'" :size="17" />
      </button>
    </div>

    <!-- Regular definition display -->
    <div
      v-if="!isScannedDictionary"
      class="definition"
      v-html="entry.definition"
    />

    <!-- Scanned dictionary: page number and a button to the scan -->
    <div v-else class="scanned-entry" data-testid="entry-scan">
      <span class="page-info">
        Page {{ scanPageNumber }}
        <span v-if="isApproximatePage" class="uncertain">(approximate)</span>
      </span>

      <ui-button
        variant="outline"
        size="sm"
        class="view-scan-button"
        data-testid="entry-view-scan"
        @click="openScanViewer"
      >
        <ui-icon name="book-open-text" :size="16" />
        View scan
      </ui-button>
    </div>

    <ScanViewer
      v-if="isScannedDictionary"
      v-model="showScanViewer"
      :dictionary-id="entry.dictionary"
      :initial-page="scanPageNumber"
      :approximate="isApproximatePage"
    />
  </article>
</template>

<style scoped>
/* Board "B · Define": rows inside one card. `.entries--cards` (Entries.vue)
   turns each row into a card of its own, as on the phone board. */
.entry-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 22px 14px;
  border-bottom: 1px solid var(--soft);
  color: var(--ink);
  font-family: var(--font-ui);
}

.entry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 2rem;
}

.dictionary-label {
  min-width: 0;
  border: 0;
  border-radius: var(--radius-sm);
  padding: 3px 9px;
  background: var(--accent-soft);
  color: var(--accent);
  font: 600 var(--text-chip) / 1.35 var(--font-ui);
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.dictionary-label:hover {
  background: var(--accent-line);
}
.dictionary-label:focus-visible,
.copy-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
/* Tibetan inside a label (wrapped in spans by the decorator) */
.dictionary-label :deep(.tibetan) {
  font-size: 1.15em;
  line-height: 1;
}

.copy-button {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: var(--radius-md);
  background: none;
  color: var(--muted);
  cursor: pointer;
}
.copy-button:hover {
  color: var(--ink);
  background: var(--soft);
}
.copy-button.is-copied {
  color: var(--success-ink);
}

.definition {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--text-entry);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

/* Tibetan in a definition links to its own lookup */
.definition :deep(a[href]) {
  color: var(--rubric);
  text-decoration: none;
}

.scanned-entry {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  padding: 2px 0;
}

.page-info {
  font-size: var(--text-body);
}

.uncertain {
  color: var(--muted);
}

.view-scan-button {
  color: var(--accent);
  border-color: var(--accent);
  font-weight: 600;
}

/* Phone: the definition one step smaller, as on the phone board */
@media (max-width: 600px) {
  .definition {
    font-size: 1.0313rem;
    line-height: 1.45;
  }
}
</style>
