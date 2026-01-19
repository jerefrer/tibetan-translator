<script>
import _ from "underscore";
import { useTheme } from "vuetify";
import TibetanRegExps from "tibetan-regexps";
import TibetanNormalizer from "tibetan-normalizer";
import WylieToUnicode from "../services/wylie-to-unicode";

import Storage from "../services/storage";
import SqlDatabase from "../services/sql-database";

const wylieToUnicode = new WylieToUnicode();
import Entries from "./Entries.vue";
import ResizableDivider from "./ResizableDivider.vue";
import DictionariesMenuMixin from "./DictionariesMenuMixin";
import DictionariesDetailsMixin from "./DictionariesDetailsMixin";
import ResultsAndPaginationAndDictionaries from "./ResultsAndPaginationAndDictionaries.vue";

export default {
  mixins: [DictionariesDetailsMixin, DictionariesMenuMixin],
  components: {
    Entries,
    ResizableDivider,
    ResultsAndPaginationAndDictionaries,
  },
  setup() {
    const theme = useTheme();
    return { theme };
  },
  data() {
    return {
      inputText: "",
      termsList: [], // List of terms with tsek, preserving order and duplicates
      selectedTermIndex: null,
      entries: [],
      loading: false,
      segmenting: false,
      tokenizer: null,
      tokenizerLoading: false,
      tokenizerError: null,
      // Track which terms have been checked and which have definitions
      checkedTerms: new Set(), // Terms we've looked up
      termsWithDefinitions: new Set(), // Terms confirmed to have definitions
      // Track possible merges: { index: [{ count: 2, term: "merged་" }, { count: 3, term: "merged་" }] }
      possibleMerges: {},
      // Track segmentation state
      hasBeenSegmented: false,
      updatingTextarea: false, // Flag to prevent recursive updates
      lastSelectedTerm: null, // Track last selected term content to avoid unnecessary refreshes
      // Refs for term elements (for calculating merge button positions)
      termRefs: {},
      // Divider positions (percentages)
      topHeight: Storage.get("segment.topHeight") || 33,
      leftWidth: Storage.get("segment.leftWidth") || 35,
      // Mobile
      isMobile: window.innerWidth <= 600,
      mobileShowDefinition: false,
    };
  },
  computed: {
    isDark() {
      return this.theme.global.current.value.dark;
    },
    selectedTerm() {
      if (this.selectedTermIndex !== null && this.selectedTermIndex < this.termsList.length) {
        return this.termsList[this.selectedTermIndex];
      }
      return null;
    },
    // Normalized term for lookup (without trailing tsek)
    selectedTermNormalized() {
      if (!this.selectedTerm) return null;
      return this.selectedTerm.replace(/[་།]+$/, "");
    },
    topStyle() {
      return {
        height: `${this.topHeight}%`,
        minHeight: "100px",
      };
    },
    bottomStyle() {
      return {
        height: `${100 - this.topHeight}%`,
        minHeight: "200px",
      };
    },
    leftStyle() {
      return {
        width: this.isMobile ? "100%" : `${this.leftWidth}%`,
        minWidth: this.isMobile ? "auto" : "200px",
      };
    },
    rightStyle() {
      return {
        width: this.isMobile ? "100%" : `${100 - this.leftWidth}%`,
        minWidth: this.isMobile ? "auto" : "300px",
      };
    },
  },
  watch: {
    inputText(newVal, oldVal) {
      if (newVal !== oldVal && !this.updatingTextarea) {
        // Real-time update when user edits the text (live updates from page load)
        this.debouncedUpdateFromTextarea();
      }
    },
    termsList() {
      // Clear refs when terms list changes
      this.termRefs = {};
    },
    // Note: definition loading is handled directly in selectTermByIndex()
    // to avoid race conditions with lastSelectedTerm
  },
  methods: {
    async initTokenizer() {
      if (this.tokenizer || this.tokenizerLoading) return;

      this.tokenizerLoading = true;
      this.tokenizerError = null;

      try {
        const { createTokenizer } = await import("tibetan-word-tokenizer");
        // Load dictionary from public folder
        const response = await fetch("/botok-dictionary.json");
        if (!response.ok) {
          throw new Error("Dictionary not found. Please ensure botok-dictionary.json is in the public folder.");
        }
        const dictionary = await response.json();
        this.tokenizer = createTokenizer({ dictionary });
      } catch (error) {
        console.error("Failed to initialize tokenizer:", error);
        this.tokenizerError = error.message;
      } finally {
        this.tokenizerLoading = false;
      }
    },

    async segmentText() {
      if (!this.inputText.trim()) {
        this.termsList = [];
        this.selectedTermIndex = null;
        this.entries = [];
        this.hasBeenSegmented = false;
        this.checkedTerms = new Set();
        this.termsWithDefinitions = new Set();
        this.possibleMerges = {};
        return;
      }

      this.segmenting = true;

      try {
        await this.initTokenizer();

        let tokens;
        if (!this.tokenizer) {
          // Fallback: simple syllable splitting if tokenizer failed
          tokens = this.inputText
            .split(/[་།\s]+/)
            .filter((t) => t.trim())
            .map((text) => ({ text: text + "་", chunkType: "TEXT" }));
        } else {
          tokens = this.tokenizer.tokenize(this.inputText);
        }

        // Extract terms from tokens
        this.termsList = this.extractTermsFromTokens(tokens);

        // Update textarea with spaced text (flag already set by updateTextareaFromTerms)
        this.updateTextareaFromTerms();

        this.hasBeenSegmented = true;

      } finally {
        this.segmenting = false;
      }
    },

    extractTermsFromTokens(tokens) {
      const terms = [];
      for (const token of tokens) {
        if (token.chunkType === "TEXT" && token.text) {
          let term = token.text.trim();
          // Ensure it ends with tsek
          if (!term.endsWith("་") && !term.endsWith("།")) {
            term = term + "་";
          }
          if (term && term !== "་") {
            terms.push(term);
          }
        }
      }
      return terms;
    },

    parseTextareaToTerms() {
      // Parse the current textarea content by spaces (respects user edits)
      const text = this.inputText.trim();
      if (!text) return [];

      // Split by spaces
      const parts = text.split(/\s+/).filter(p => p.trim());
      const terms = [];

      for (let part of parts) {
        part = part.trim();
        // Skip pure punctuation
        if (/^[།༔༑]+$/.test(part)) continue;
        // Ensure it ends with tsek (unless it's punctuation)
        if (!part.endsWith("་") && !part.endsWith("།")) {
          part = part + "་";
        }
        if (part && part !== "་") {
          terms.push(part);
        }
      }
      return terms;
    },

    updateTextareaFromTerms() {
      // Build spaced text from terms list
      this.updatingTextarea = true;
      const spacedText = this.termsList.join(" ");
      this.inputText = spacedText;
      this.$nextTick(() => {
        this.updatingTextarea = false;
      });
    },

    async resegmentText() {
      // Remember current selection index
      const previousIndex = this.selectedTermIndex;

      // Full re-segmentation using tokenizer
      await this.segmentText();

      // Re-establish selection (term at index may have changed after resegmentation)
      if (this.termsList.length > 0) {
        const newIndex = (previousIndex !== null && previousIndex < this.termsList.length)
          ? previousIndex
          : 0;
        // Clear lastSelectedTerm to force definition refresh even if same index
        this.lastSelectedTerm = null;
        // On mobile, don't auto-show definitions - let user click a term first
        this.selectTermByIndex(newIndex, { showMobileDefinition: false });
      }

      // Check which terms have definitions (async, updates UI progressively)
      await this.checkTermsForDefinitions();
      // Check for possible merges
      await this.checkPossibleMerges();
    },

    async updateFromTextarea() {
      // Parse the current textarea by spaces (respects user edits)
      const newTermsList = this.parseTextareaToTerms();
      const oldTermsList = this.termsList;

      // Check if anything actually changed
      if (JSON.stringify(newTermsList) === JSON.stringify(oldTermsList)) {
        return; // No changes, skip update
      }

      // Remember the currently selected term content
      const previousSelectedTerm = this.selectedTerm;

      // Find terms that are new (not in the old list)
      const oldTermsSet = new Set(oldTermsList);
      const newTerms = newTermsList.filter(t => !oldTermsSet.has(t));

      // Calculate new selected index BEFORE updating termsList to avoid visual jump
      let newSelectedIndex = this.selectedTermIndex;
      let needsDefinitionRefresh = false;

      if (previousSelectedTerm) {
        const foundIndex = newTermsList.indexOf(previousSelectedTerm);
        if (foundIndex !== -1) {
          // Same term exists at new position
          newSelectedIndex = foundIndex;
        } else {
          // Term no longer exists, adjust index
          if (newSelectedIndex >= newTermsList.length) {
            newSelectedIndex = newTermsList.length > 0 ? newTermsList.length - 1 : null;
          }
          needsDefinitionRefresh = true;
        }
      }

      // Update index and list together to avoid visual jump
      this.selectedTermIndex = newSelectedIndex;
      this.termsList = newTermsList;

      // Only check definitions for new terms
      if (newTerms.length > 0) {
        await this.checkTermsForDefinitions(newTerms);
      }

      // Re-check for possible merges (positions changed)
      await this.checkPossibleMerges();

      // If selected term changed, refresh definitions
      if (needsDefinitionRefresh && this.selectedTermIndex !== null) {
        this.lastSelectedTerm = this.termsList[this.selectedTermIndex];
        this.setEntriesForSelectedTerm();
      }
    },

    async checkTermsForDefinitions(termsToCheck = null) {
      // If no specific terms provided, check all and reset the sets
      if (!termsToCheck) {
        this.termsWithDefinitions = new Set();
        this.checkedTerms = new Set();
        termsToCheck = this.termsList;
      }

      // Get unique terms that we need to check (use terms directly with tsek)
      const uniqueTerms = new Set();
      for (const term of termsToCheck) {
        // Skip if we already checked this term
        if (!this.checkedTerms.has(term)) {
          uniqueTerms.add(term);
        }
      }

      // Check each unique term
      for (const term of uniqueTerms) {
        // Use term directly (already has trailing tsek)
        const rows = await SqlDatabase.getEntriesFor(term);
        // Mark as checked
        this.checkedTerms.add(term);
        // If found, also add to termsWithDefinitions
        if (rows.length > 0) {
          this.termsWithDefinitions.add(term);
        }
      }
    },

    async checkPossibleMerges() {
      this.possibleMerges = {};

      // For each position, check if merging 2, 3, etc. consecutive terms produces a known word
      for (let i = 0; i < this.termsList.length - 1; i++) {
        await this.checkMergesAtIndex(i);
      }

      // Force re-render to recalculate button positions after DOM updates
      this.$nextTick(() => {
        this.$forceUpdate();
      });
    },

    async checkMergesAtIndex(i) {
      // Check if merging 2, 3, 4, 5 terms starting at index i produces a known word
      const merges = [];

      for (let count = 2; count <= Math.min(5, this.termsList.length - i); count++) {
        const termsToMerge = this.termsList.slice(i, i + count);
        const merged = termsToMerge
          .map(t => t.replace(/[་།]+$/, ""))
          .join("་") + "་";

        // Use merged directly (already has trailing tsek)
        const rows = await SqlDatabase.getEntriesFor(merged);

        if (rows.length > 0) {
          merges.push({ count, term: merged });
        }
      }

      if (merges.length > 0) {
        this.possibleMerges[i] = merges;
      } else {
        delete this.possibleMerges[i];
      }
    },

    async updateMergesAroundIndex(mergeIndex, mergedCount) {
      // After a merge at mergeIndex that combined mergedCount terms into 1:
      // - Indices before mergeIndex - 4 are unaffected
      // - Indices from mergeIndex - 4 to mergeIndex need rechecking (they might now merge with the new term)
      // - Indices from mergeIndex to mergeIndex + 4 need rechecking
      // - Indices after mergeIndex + mergedCount need to be shifted down by (mergedCount - 1)

      const shift = mergedCount - 1;
      const newPossibleMerges = {};

      // Copy and shift existing merges that are far enough before the merge point
      for (const [indexStr, options] of Object.entries(this.possibleMerges)) {
        const index = parseInt(indexStr);
        if (index < mergeIndex - 4) {
          // Unaffected, keep as is
          newPossibleMerges[index] = options;
        } else if (index >= mergeIndex + mergedCount) {
          // After the merge, shift down
          newPossibleMerges[index - shift] = options;
        }
        // Indices in the affected zone will be rechecked below
      }

      this.possibleMerges = newPossibleMerges;

      // Recheck merges in the affected zone (5 terms before to 5 terms after the merge point)
      const startCheck = Math.max(0, mergeIndex - 4);
      const endCheck = Math.min(this.termsList.length - 1, mergeIndex + 4);

      for (let i = startCheck; i <= endCheck; i++) {
        await this.checkMergesAtIndex(i);
      }

      // Force re-render
      this.$nextTick(() => {
        this.$forceUpdate();
      });
    },

    async mergeTerms(startIndex, count) {
      // Merge terms at startIndex through startIndex + count - 1
      const termsToMerge = this.termsList.slice(startIndex, startIndex + count);
      const merged = termsToMerge
        .map(t => t.replace(/[་།]+$/, ""))
        .join("་") + "་";

      // Remember the currently selected term content
      const previousSelectedTerm = this.selectedTerm;
      const wasSelectedInMergeRange = this.selectedTermIndex !== null &&
        this.selectedTermIndex >= startIndex &&
        this.selectedTermIndex < startIndex + count;

      // Create new terms list
      const newTerms = [
        ...this.termsList.slice(0, startIndex),
        merged,
        ...this.termsList.slice(startIndex + count)
      ];

      // Calculate new selected index BEFORE updating termsList to avoid visual jump
      let newSelectedIndex = this.selectedTermIndex;
      let needsDefinitionRefresh = false;

      if (this.selectedTermIndex !== null) {
        if (wasSelectedInMergeRange) {
          // Selected term was part of the merge, select the merged term
          newSelectedIndex = startIndex;
          needsDefinitionRefresh = true;
        } else if (previousSelectedTerm) {
          // Find the same term in the new list
          const foundIndex = newTerms.indexOf(previousSelectedTerm);
          if (foundIndex !== -1) {
            newSelectedIndex = foundIndex;
          }
        }
      }

      // Update index and list together to avoid visual jump
      this.selectedTermIndex = newSelectedIndex;
      this.lastSelectedTerm = newSelectedIndex !== null ? newTerms[newSelectedIndex] : null;
      this.termsList = newTerms;

      // Refresh definitions if term changed (merged term selected)
      if (needsDefinitionRefresh) {
        this.setEntriesForSelectedTerm();
      }

      this.updateTextareaFromTerms();

      // Only check definitions for the merged term (it's new)
      await this.checkTermsForDefinitions([merged]);

      // Recalculate merges only around the affected area
      await this.updateMergesAroundIndex(startIndex, count);
    },

    hasDefinitions(term) {
      // If we haven't checked this term yet, assume it has definitions (show as normal)
      if (!this.checkedTerms.has(term)) {
        return true;
      }
      // If checked, return whether it actually has definitions
      return this.termsWithDefinitions.has(term);
    },

    getMergeOptions(index) {
      return this.possibleMerges[index] || [];
    },

    getMergeButtonStyle(startIndex, count) {
      // Calculate position and height to overlay the terms being merged
      const firstEl = this.termRefs[startIndex];
      const lastEl = this.termRefs[startIndex + count - 1];
      const listEl = this.$refs.termsList;

      if (!firstEl || !lastEl || !listEl) {
        return { display: 'none' };
      }

      const listRect = listEl.getBoundingClientRect();
      const firstRect = firstEl.getBoundingClientRect();
      const lastRect = lastEl.getBoundingClientRect();

      const top = firstRect.top - listRect.top + listEl.scrollTop;
      const height = lastRect.bottom - firstRect.top;

      // Offset for multiple merge options at same position (stack horizontally)
      const options = this.possibleMerges[startIndex] || [];
      const optionIndex = options.findIndex(o => o.count === count);
      const rightOffset = optionIndex * 34; // 34px per button width (32px + 2px gap)

      return {
        position: 'absolute',
        top: `${top}px`,
        height: `${height}px`,
        right: `${rightOffset}px`,
      };
    },

    selectTermByIndex(index, { showMobileDefinition = true } = {}) {
      const newTerm = this.termsList[index] || null;
      // Only reload definitions if term actually changed
      const termChanged = newTerm !== this.lastSelectedTerm;

      this.selectedTermIndex = index;
      this.lastSelectedTerm = newTerm;

      if (this.isMobile && showMobileDefinition) {
        this.mobileShowDefinition = true;
      }

      // Load definitions directly (don't rely on watcher)
      if (termChanged && newTerm) {
        this.setEntriesForSelectedTerm();
      }
    },

    async setEntriesForSelectedTerm() {
      if (this.selectedTerm) {
        this.loading = true;
        try {
          // Normalize: strip trailing punctuation and add exactly one tsek
          const normalizedTerm = this.selectedTerm.replace(/[་།]+$/, "") + "་";
          const rows = await SqlDatabase.getEntriesFor(normalizedTerm);
          this.entries = rows;
          this.resetDictionariesToDefaultAndSetNumberOfEntries();
        } finally {
          this.loading = false;
        }
      }
    },

    convertWylie(text) {
      var textWithConvertedWylie = (text || "").replace(
        new RegExp(`[^${TibetanRegExps.expressions.allTibetanCharacters}\\r\\n\\s]+`, 'iug'),
        (wylie) => wylieToUnicode.convert(wylie)
      );
      textWithConvertedWylie = textWithConvertedWylie.replace(/་+/g, "་");
      return TibetanNormalizer.normalize(textWithConvertedWylie);
    },

    onKeydown(event) {
      // Ctrl/Cmd+Enter → trigger split
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        this.resegmentText();
        return;
      }
      // Space without shift → insert tshegs instead
      if (event.key === " " && !event.shiftKey) {
        event.preventDefault();
        const textarea = this.$refs.textarea;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = this.inputText || "";
        this.inputText = text.substring(0, start) + "་" + text.substring(end);
        // Restore cursor position after the inserted tshegs
        this.$nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1;
        });
      }
      // Shift+Space → allow normal space (default behavior)
    },

    onKeyup(event) {
      // Convert Wylie on space or tsek
      if (event.key.match(/[་ ]/)) {
        this.inputText = this.convertWylie(this.inputText);
      }
    },

    async onPaste(event) {
      // Wait for the paste to complete, convert Wylie, then segment
      setTimeout(async () => {
        this.inputText = this.convertWylie(this.inputText);
        await this.resegmentText();
      }, 50);
    },

    onHorizontalResize(delta) {
      const containerHeight = this.$refs.container?.clientHeight || 600;
      const deltaPercent = (delta / containerHeight) * 100;
      const newHeight = Math.min(Math.max(this.topHeight + deltaPercent, 15), 70);
      this.topHeight = newHeight;
      Storage.set("segment.topHeight", newHeight);
    },

    onVerticalResize(delta) {
      const containerWidth = this.$refs.bottomContainer?.clientWidth || 800;
      const deltaPercent = (delta / containerWidth) * 100;
      const newWidth = Math.min(Math.max(this.leftWidth + deltaPercent, 20), 60);
      this.leftWidth = newWidth;
      Storage.set("segment.leftWidth", newWidth);
    },

    handleResize() {
      this.isMobile = window.innerWidth <= 600;
      if (!this.isMobile) {
        this.mobileShowDefinition = false;
      }
    },

    showTermsList() {
      if (this.isMobile) {
        this.mobileShowDefinition = false;
      }
    },

    selectPreviousTerm() {
      if (this.selectedTermIndex !== null && this.selectedTermIndex > 0) {
        this.selectTermByIndex(this.selectedTermIndex - 1);
      }
    },

    selectNextTerm() {
      if (this.selectedTermIndex !== null && this.selectedTermIndex < this.termsList.length - 1) {
        this.selectTermByIndex(this.selectedTermIndex + 1);
      } else if (this.selectedTermIndex === null && this.termsList.length > 0) {
        this.selectTermByIndex(0);
      }
    },

    focusTextarea() {
      this.$refs.textarea?.focus();
    },

    clearTextarea() {
      this.inputText = "";
      this.termsList = [];
      this.selectedTermIndex = null;
      this.entries = [];
      this.hasBeenSegmented = false;
      this.checkedTerms.clear();
      this.termsWithDefinitions.clear();
      this.possibleMerges = {};
      this.lastSelectedTerm = null;
      this.mobileShowDefinition = false;
      this.$nextTick(() => {
        this.focusTextarea();
      });
    },

    handleKeydown(event) {
      // Arrow key navigation for terms (works globally on this page)
      if (event.key === "ArrowUp") {
        event.preventDefault();
        this.selectPreviousTerm();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        this.selectNextTerm();
      }
    },
  },
  mounted() {
    this.debouncedSetEntriesForSelectedTerm = _.debounce(
      this.setEntriesForSelectedTerm,
      300
    );
    this.debouncedUpdateFromTextarea = _.debounce(
      this.updateFromTextarea,
      500
    );
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("keydown", this.handleKeydown);
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("keydown", this.handleKeydown);
  },
};
</script>

<template>
  <div
    class="segment-page"
    :class="{ 'mobile-show-definition': isMobile && mobileShowDefinition }"
    ref="container"
  >
    <!-- Top: Input area -->
    <div class="input-area" :style="topStyle">
      <div class="input-header" v-if="inputText.trim()">
        <span class="input-hint"></span>
        <div class="input-actions">
          <v-btn
            size="small"
            color="primary"
            variant="flat"
            :loading="segmenting"
            @click="resegmentText"
          >
            <v-icon start>mdi-content-cut</v-icon>
            Split words
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            @click="clearTextarea"
          >
            <v-icon start>mdi-close</v-icon>
            Clear
          </v-btn>
        </div>
      </div>
      <textarea
        ref="textarea"
        v-model="inputText"
        class="tibetan-textarea"
        placeholder="Paste or type Tibetan text"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        @paste="onPaste"
        @keydown="onKeydown"
        @keyup="onKeyup"
      ></textarea>
      <div v-if="tokenizerError" class="tokenizer-error text-caption text-error">
        <v-icon size="small" color="error">mdi-alert</v-icon>
        {{ tokenizerError }}
      </div>
    </div>

    <ResizableDivider
      v-if="!isMobile"
      direction="horizontal"
      @resize="onHorizontalResize"
    />

    <!-- Bottom: Terms and definitions -->
    <div class="bottom-area" :style="bottomStyle" ref="bottomContainer">
      <!-- Terms list -->
      <div class="terms-drawer" :style="leftStyle">
        <div class="terms-header">
          <span class="terms-count text-caption text-grey" v-if="termsList.length">
            {{ termsList.length }} terms
          </span>
          <span class="terms-count text-caption text-grey" v-else-if="segmenting">
            Segmenting...
          </span>
          <span class="terms-count text-caption text-grey" v-else>
            No terms
          </span>
          <ResultsAndPaginationAndDictionaries
            v-if="entries.length"
            :dictionaries="dictionariesForCurrentResults"
            :totalNumberOfEntries="entries.length"
            :hidePagination="true"
            @close:dictionariesMenu="focusTextarea"
          />
        </div>
        <div v-if="termsList.length" class="terms-list" ref="termsList">
          <div
            v-for="(term, index) in termsList"
            :key="index"
            :ref="el => termRefs[index] = el"
            class="term-item tibetan"
            :class="{
              'active bg-primary': selectedTermIndex === index,
              'text-white': selectedTermIndex === index && !isDark,
              'bg-primary-darken-2': selectedTermIndex === index && isDark,
              'unknown-term': !hasDefinitions(term),
            }"
            @click="selectTermByIndex(index)"
          >
            <span>{{ term }}</span>
            <v-icon
              v-if="!hasDefinitions(term)"
              size="x-small"
              class="unknown-icon"
              :color="selectedTermIndex === index ? 'white' : 'grey'"
            >mdi-help-circle-outline</v-icon>
          </div>
          <!-- Merge overlay buttons -->
          <template v-for="(options, startIndex) in possibleMerges" :key="'merge-' + startIndex">
            <button
              v-for="option in options"
              :key="option.count"
              class="merge-overlay-btn"
              :style="getMergeButtonStyle(parseInt(startIndex), option.count)"
              @click.stop="mergeTerms(parseInt(startIndex), option.count)"
              :title="'Merge ' + option.count + ' terms: ' + option.term"
            >
              <v-icon size="x-small">mdi-format-vertical-align-center</v-icon>
            </button>
          </template>
        </div>
        <div
          v-else-if="!segmenting && inputText.trim() && !termsList.length"
          class="d-flex align-center mx-4 text-caption text-grey"
          style="height: 48px"
        >
          Add spaces between words or click "Split words"
        </div>
        <div
          v-else-if="!inputText.trim()"
          class="d-flex align-center mx-4 text-caption text-grey"
          style="height: 48px"
        >
          Paste text above to begin
        </div>
      </div>

      <ResizableDivider
        v-if="!isMobile && termsList.length"
        direction="vertical"
        @resize="onVerticalResize"
      />

      <!-- Definitions -->
      <div class="definitions-container" :style="rightStyle">
        <!-- Back button for mobile -->
        <div v-if="isMobile && mobileShowDefinition" class="mobile-back">
          <v-btn variant="text" size="small" @click="showTermsList">
            <v-icon start>mdi-arrow-left</v-icon>
            Back to terms
          </v-btn>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="loading-state">
          <v-progress-circular indeterminate size="48" color="primary" />
          <div class="mt-3 text-grey text-caption">Loading definitions...</div>
        </div>

        <!-- No term selected -->
        <div v-else-if="selectedTermIndex === null && termsList.length" class="empty-state">
          <v-icon size="48" color="grey-lighten-1">mdi-book-open-variant</v-icon>
          <div class="mt-3 text-grey text-caption">Select a term to see definitions</div>
        </div>

        <!-- No definitions found -->
        <div v-else-if="selectedTerm && !entriesForEnabledDictionaries.length && !loading" class="empty-state">
          <v-icon size="48" color="grey-lighten-1">mdi-book-off</v-icon>
          <div class="mt-3 text-grey text-caption">No definitions found for "{{ selectedTerm }}"</div>
        </div>

        <!-- Definitions -->
        <v-fade-transition mode="out-in" appear v-else>
          <div v-if="entriesForEnabledDictionaries.length">
            <Entries
              :entries="entriesForEnabledDictionaries"
              :initialNumberOfEntries="25"
            />
          </div>
        </v-fade-transition>
      </div>
    </div>
  </div>
</template>

<style lang="stylus">
.segment-page
  display flex
  flex-direction column
  height 100%
  overflow hidden

  .input-area
    display flex
    flex-direction column
    background #fffcf4
    border-bottom 2px solid rgba(0, 0, 0, 0.1)
    overflow hidden

    .input-header
      display flex
      align-items center
      justify-content space-between
      padding 0 15px
      flex-shrink 0
      min-height 48px
      border-bottom 1px solid rgba(0, 0, 0, 0.06)

      .input-hint
        font-size 1em
        color rgba(0, 0, 0, 0.5)

      .input-actions
        display flex
        gap 8px

    .tibetan-textarea
      flex 1
      width 100%
      min-height 80px
      padding 12px 15px
      font-family "DDC_Uchen", serif
      font-size 26px
      line-height 1.6
      border none
      border-radius 0
      background transparent
      resize none
      outline none

      &:focus
        outline none
        box-shadow none

      &::placeholder
        font-family "Segoe UI", "Roboto", sans-serif
        font-size 18px
        opacity 0.5
        color #666

    .tokenizer-error
      margin 0 15px 8px
      display flex
      align-items center
      gap 4px

  .bottom-area
    flex 1
    display flex
    overflow hidden
    min-height 0

  .terms-drawer
    flex-shrink 0
    background var(--paper, #FAF3E0)
    border-right 2px solid rgba(0, 0, 0, 0.1)
    display flex
    flex-direction column
    overflow hidden

    .terms-header
      display flex
      align-items center
      justify-content space-between
      padding 7px 15px
      min-height 48px
      background var(--paper, #FAF3E0)
      border-bottom 2px solid rgba(0, 0, 0, 0.08)
      flex-shrink 0

      .terms-count
        white-space nowrap

    .terms-list
      flex 1
      overflow-y auto
      min-height 0
      position relative

    .term-item
      min-height 44px
      line-height 44px
      font-size 20px
      padding 0 16px
      border-bottom thin solid rgba(0, 0, 0, 0.08)
      transition background 0.2s ease
      cursor pointer
      display flex
      align-items center
      justify-content space-between

      &:hover
        background rgba(0, 0, 0, 0.04)

      &.unknown-term:not(.active)
        opacity 0.6
        font-style italic

      .unknown-icon
        margin-left 8px

    .merge-overlay-btn
      width 32px
      border none
      background rgba(211, 47, 47, 0.15)
      border-left 3px solid rgba(211, 47, 47, 0.5)
      cursor pointer
      display flex
      flex-direction column
      align-items center
      justify-content center
      gap 2px
      transition all 0.15s ease
      z-index 5

      &:hover
        background rgb(211, 47, 47)
        border-left-color rgb(211, 47, 47)

        .v-icon
          color white

      .v-icon
        font-size 18px
        color rgba(211, 47, 47, 0.85)

  .definitions-container
    flex 1
    overflow-y auto
    padding 0
    position relative
    background white

    .mobile-back
      padding 8px 12px
      border-bottom 1px solid rgba(0, 0, 0, 0.08)

    .loading-state,
    .empty-state
      display flex
      flex-direction column
      align-items center
      justify-content center
      height 200px
      text-align center

// Dark theme
.v-theme--dark .segment-page
  .input-area
    background #1e1e1e
    border-bottom-color rgba(255, 255, 255, 0.12)

    .input-header
      border-bottom-color rgba(255, 255, 255, 0.08)

    .input-hint
      color rgba(255, 255, 255, 0.5)

    .tibetan-textarea
      background transparent
      color white

      &::placeholder
        color #aaa

  .terms-drawer
    background #1e1e1e
    border-right-color rgba(255, 255, 255, 0.12)

    .terms-header
      background #1e1e1e
      border-bottom-color rgba(255, 255, 255, 0.12)

    .term-item
      border-bottom-color rgba(255, 255, 255, 0.12)

      &:hover
        background rgba(255, 255, 255, 0.08)

    .merge-overlay-btn
      background rgba(239, 83, 80, 0.2)
      border-left-color rgba(239, 83, 80, 0.5)

      &:hover
        background rgb(239, 83, 80)
        border-left-color rgb(239, 83, 80)

        .v-icon
          color #1e1e1e

      .v-icon
        color rgba(239, 83, 80, 0.95)

  .definitions-container
    background #252525

    .mobile-back
      border-bottom-color rgba(255, 255, 255, 0.12)

// Light theme hover
.v-theme--light .segment-page
  .terms-drawer
    .term-item:hover
      background #ddd

// Mobile styles
@media (max-width: 600px)
  .segment-page
    .input-area
      height auto !important
      min-height 120px
      max-height 40%

      .input-header
        padding 0 10px
        min-height 40px

      .tibetan-textarea
        min-height 60px
        padding 10px
        font-size 22px

    .bottom-area
      flex-direction column
      height auto !important
      flex 1

    .terms-drawer
      width 100% !important
      flex 1
      border-right none
      border-bottom 2px solid rgba(0, 0, 0, 0.1)

      .terms-header
        padding 7px 10px

      .term-item
        padding-left 10px

    .definitions-container
      display none
      width 100% !important

    &.mobile-show-definition
      .input-area
        display none

      .terms-drawer
        display none

      .definitions-container
        display flex
        flex-direction column
        flex 1
        overflow-y auto
</style>
