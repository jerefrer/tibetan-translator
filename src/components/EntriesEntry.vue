<script>
  import DictionariesDetailsMixin from './DictionariesDetailsMixin'
  import ScanViewer from './ScanViewer.vue'
  import { getScanInfo } from '../services/scan-service'

  export default {
    mixins: [DictionariesDetailsMixin],
    components: { ScanViewer },
    inject: ['snackbar'],
    props: {
      entry: Object,
      isLastEntry: Boolean
    },
    data() {
      return {
        showScanViewer: false
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
      scanButtonText() {
        return this.scanInfo?.linkText || 'View scanned page';
      }
    },
    methods: {
      intersect(entries, observer) {
        if (this.isLastEntry)
          this.$emit('intersect');
      },
      showDictionaryAbout() {
        this.snackbar.open(this.dictionaryAboutFor(this.entry.dictionary));
      },
      openScanViewer() {
        this.showScanViewer = true;
      }
    }
  }
</script>

<template>
  <div
    class="entry-row"
    v-intersect.quiet="intersect"
  >
    <div class="entry-header">
      <v-chip
        variant="flat"
        size="small"
        class="dictionary-label"
        color="grey-darken-2"
        @click="showDictionaryAbout"
      >
        <span v-html="dictionaryLabelFor(entry.dictionary, { short: true })" />
      </v-chip>
    </div>

    <!-- Regular definition display -->
    <div
      v-if="!isScannedDictionary"
      class="definition"
      v-html="entry.definition"
    />

    <!-- Scanned dictionary: show page number and view button -->
    <div v-else class="scanned-entry">
      <div class="page-info">
        Page {{ scanPageNumber }}
        <span v-if="entry.definition?.includes('?')" class="uncertain">(approximate)</span>
      </div>

      <v-btn
        color="primary"
        variant="outlined"
        size="small"
        class="mt-2"
        @click="openScanViewer"
      >
        <v-icon start size="small">mdi-book-open-page-variant</v-icon>
        View Scan
      </v-btn>
    </div>

    <!-- Scan Viewer Modal -->
    <ScanViewer
      v-if="isScannedDictionary"
      v-model="showScanViewer"
      :dictionary-id="entry.dictionary"
      :initial-page="scanPageNumber"
    />

  </div>
</template>

<style scoped>
.entry-row {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: white;
}

.v-theme--dark .entry-row {
  background: #252525;
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.entry-header {
  margin-bottom: 8px;
}

.dictionary-label {
  cursor: pointer;
  height: auto;
  white-space: break-spaces;
  padding-bottom: 1px;
}

.dictionary-label:hover {
  opacity: 0.85;
}

.definition {
  line-height: 1.6;
  text-align: justify;
}

.scanned-entry {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.page-info {
  font-size: 0.95em;
  color: var(--v-theme-on-surface);
}

.uncertain {
  font-size: 0.85em;
  color: #888;
  margin-left: 4px;
}

/* Mobile */
@media (max-width: 600px) {
  .entry-row {
    padding: 10px 12px;
  }
}
</style>
