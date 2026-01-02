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
  <fieldset
    class="entry"
    v-intersect.quiet="intersect"
  >

    <legend
      v-html="dictionaryLabelFor(entry.dictionary)"
      @click="showDictionaryAbout"
    />

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

  </fieldset>
</template>

<style scoped>
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
</style>
