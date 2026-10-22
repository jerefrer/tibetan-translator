<script>
import _ from "underscore";

import {
  MAX_MERGE_TERM_COUNT,
  DEBOUNCE_ENTRIES_MS,
  DEBOUNCE_TEXTAREA_MS,
} from "../config/constants";
import { convertWylieInText, tibetanLookupKey, withTrailingTshek } from "../utils";
import Storage from "../services/storage";
import SqlDatabase from "../services/sql-database";
import { mayNeedLegacyRepair } from "../services/legacy-to-unicode";
import { UiButton, UiIcon, UiSpinner, UiTextField, UiTooltip } from "../ui";
import Entries from "./Entries.vue";
import ResizableDivider from "./ResizableDivider.vue";
import DictionariesMenuMixin from "./DictionariesMenuMixin";
import MobileResponsiveMixin from "./mixins/MobileResponsiveMixin";
import ResultsAndPaginationAndDictionaries from "./ResultsAndPaginationAndDictionaries.vue";

// Merge brackets sit in lanes from the right edge of the terms list, so that
// brackets covering the same rows do not draw over each other.
const MERGE_LANE_WIDTH = 30;

// Boards "B · Split" (and its Empty and Phone variants).
// Desktop: the text on top; below, the terms found in it on the left and the
// definitions of the selected term on the right, with dividers to resize.
// Phone: the text and the terms; a tap shows the definitions, with a way back.
//
// The text area is a <UiTextField multiline> with this page's own Wylie and
// space handling rather than <UiTibetanField>: that one turns spaces into
// tshegs and drops trailing spaces, and here the spaces are the word breaks.
export default {
  mixins: [DictionariesMenuMixin, MobileResponsiveMixin],
  components: {
    Entries,
    ResizableDivider,
    ResultsAndPaginationAndDictionaries,
    UiButton,
    UiIcon,
    UiSpinner,
    UiTextField,
    UiTooltip,
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
      // Divider positions (percentages)
      topHeight: Storage.get("segment.topHeight", 24),
      leftWidth: Storage.get("segment.leftWidth", 27),
    };
  },
  computed: {
    selectedTerm() {
      if (this.selectedTermIndex !== null && this.selectedTermIndex < this.termsList.length) {
        return this.termsList[this.selectedTermIndex];
      }
      return null;
    },
    hasText() {
      return !!this.inputText.trim();
    },
    showingEntries() {
      return this.isMobile && this.mobileShowDefinition;
    },
    termsCountLabel() {
      if (this.termsList.length)
        return this.termsList.length + (this.termsList.length === 1 ? " term" : " terms");
      if (this.segmenting) return "Segmenting...";
      return "No terms";
    },
    topStyle() {
      if (this.isMobile) return {};
      return {
        height: `${this.topHeight}%`,
        // Room for the header and at least one line of text
        minHeight: "9rem",
      };
    },
    leftStyle() {
      if (this.isMobile) return {};
      return {
        width: `${this.leftWidth}%`,
        minWidth: "200px",
      };
    },
    // [{ start, count, term, lane }], one per merge button
    mergeBrackets() {
      const brackets = [];
      Object.keys(this.possibleMerges)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach((start) => {
          // Longest first, so that it takes the outer lane
          [...this.possibleMerges[start]]
            .sort((a, b) => b.count - a.count)
            .forEach(({ count, term }) => brackets.push({ start, count, term }));
        });
      const laneEnds = [];
      brackets.forEach((bracket) => {
        let lane = laneEnds.findIndex((end) => end <= bracket.start);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = bracket.start + bracket.count;
        bracket.lane = lane;
      });
      return brackets;
    },
    mergeLanes() {
      return this.mergeBrackets.reduce((lanes, bracket) => Math.max(lanes, bracket.lane + 1), 0);
    },
  },
  watch: {
    inputText(newVal, oldVal) {
      if (newVal !== oldVal && !this.updatingTextarea) {
        // Real-time update when user edits the text (live updates from page load)
        this.debouncedUpdateFromTextarea();
      }
    },
    selectedTermIndex() {
      this.$nextTick(() => this.scrollSelectedTermIntoView());
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
    },

    async checkMergesAtIndex(i) {
      // Check if merging 2, 3, 4, 5 terms starting at index i produces a known word
      const merges = [];

      for (let count = 2; count <= Math.min(MAX_MERGE_TERM_COUNT, this.termsList.length - i); count++) {
        const termsToMerge = this.termsList.slice(i, i + count);
        const merged = termsToMerge
          .map(withTrailingTshek)
          .join("");

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
    },

    async mergeTerms(startIndex, count) {
      // Merge terms at startIndex through startIndex + count - 1
      const termsToMerge = this.termsList.slice(startIndex, startIndex + count);
      const merged = termsToMerge
        .map(withTrailingTshek)
        .join("");

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

    mergeBracketStyle(bracket) {
      // Rows have a fixed height (--split-row), so the bracket is placed from
      // the indexes alone, inset 7px at each end as on the board.
      return {
        top: `calc(var(--split-row) * ${bracket.start} + 7px)`,
        height: `calc(var(--split-row) * ${bracket.count} - 14px)`,
        right: `${14 + bracket.lane * MERGE_LANE_WIDTH}px`,
      };
    },

    selectTermByIndex(index, { showMobileDefinition = true } = {}) {
      const newTerm = this.termsList[index] || null;
      // Only reload definitions if term actually changed
      const termChanged = newTerm !== this.lastSelectedTerm;

      this.selectedTermIndex = index;
      this.lastSelectedTerm = newTerm;

      if (showMobileDefinition) {
        this.setMobileShowDefinition(true);
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
          // Entry lookups are exact string matches, so the key must be derived
          // exactly as everything that stores a term derives it. The local
          // version this replaced stripped only [་།] where endPunctuation
          // covers eight marks, so a word ending in a gter tsheg or a double
          // shad was searched for with the punctuation still attached and
          // never matched anything — in this page's own dictionaries either.
          const normalizedTerm = tibetanLookupKey(this.selectedTerm);
          const rows = await SqlDatabase.getEntriesFor(normalizedTerm);
          this.entries = rows;
          this.resetDictionariesToDefaultAndSetNumberOfEntries();
        } finally {
          this.loading = false;
        }
      }
    },

    convertWylie(text) {
      return convertWylieInText(text, {
        normalizeTrailingPunctuation: false,
        normalizeMultipleTshegs: true,
        preserveWhitespace: true
      });
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
        const textarea = event.target;
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
      if (event.key && event.key.match(/[་ ]/)) {
        this.inputText = this.convertWylie(this.inputText);
      }
    },

    async onPaste(event) {
      const clipboard = {
        text: event.clipboardData?.getData("text/plain") || "",
        html: event.clipboardData?.getData("text/html") || "",
      };

      // A passage set in a pre-Unicode Tibetan font arrives as Latin gibberish,
      // and repairing it needs the markup, which the textarea would have thrown
      // away by the time the timeout below runs. Take over the insertion only
      // then; every other paste keeps the browser's own.
      if (mayNeedLegacyRepair(clipboard)) {
        event.preventDefault();
        const start = event.target.selectionStart;
        const end = event.target.selectionEnd;
        const { convertLegacyPaste } = await import(
          "../services/legacy-to-unicode"
        );
        const repaired = (await convertLegacyPaste(clipboard)) || clipboard.text;
        const current = this.inputText || "";
        this.inputText = this.convertWylie(
          current.substring(0, start) + repaired + current.substring(end)
        );
        await this.resegmentText();
        return;
      }

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

    scrollSelectedTermIntoView() {
      const active = this.$refs.termsList?.querySelector(".term-item.is-active");
      active?.scrollIntoView?.({ block: "nearest" });
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
      // Arrow key navigation for terms (works anywhere on this page), except
      // where another control already uses the arrows: the Dictionaries menu,
      // a dialog, a divider or another field.
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      if (event.defaultPrevented) return;
      const target = event.target;
      if (target?.closest?.(".dictionaries-menu, [role='dialog'], [role='separator']")) return;
      if (target?.matches?.("input, select, textarea") && target !== this.textareaElement()) return;
      event.preventDefault();
      if (event.key === "ArrowUp") this.selectPreviousTerm();
      else this.selectNextTerm();
    },

    textareaElement() {
      return this.$refs.textarea?.$refs.input;
    },

    // Only while the page is shown: <keep-alive> keeps it mounted elsewhere
    listenToArrows() {
      window.removeEventListener("keydown", this.handleKeydown);
      window.addEventListener("keydown", this.handleKeydown);
    },
    stopListeningToArrows() {
      window.removeEventListener("keydown", this.handleKeydown);
    },
  },
  mounted() {
    this.debouncedSetEntriesForSelectedTerm = _.debounce(
      this.setEntriesForSelectedTerm,
      DEBOUNCE_ENTRIES_MS
    );
    this.debouncedUpdateFromTextarea = _.debounce(
      this.updateFromTextarea,
      DEBOUNCE_TEXTAREA_MS
    );
    this.listenToArrows();
  },
  activated() {
    this.listenToArrows();
    this.$nextTick(() => this.focusTextarea());
  },
  deactivated() {
    this.stopListeningToArrows();
  },
  beforeUnmount() {
    this.stopListeningToArrows();
    this.debouncedUpdateFromTextarea?.cancel();
  },
};
</script>

<template>
  <div
    ref="container"
    class="segment-page"
    :class="{ 'is-phone': isMobile, 'mobile-show-definition': showingEntries }"
    data-testid="split-page"
  >
    <!-- Board "Empty": the title sits above the text area until there is text -->
    <span v-if="!hasText && !showingEntries" class="split-eyebrow" data-testid="split-title">Split</span>

    <section
      v-show="!showingEntries"
      class="split-input"
      :style="topStyle"
      aria-label="Text to split"
    >
      <div v-if="hasText" class="split-input__header" data-testid="split-header">
        <span class="split-eyebrow">Split</span>
        <span v-if="!isMobile" class="split-hint">Add or remove spaces to change where words are split.</span>
        <ui-button
          size="sm"
          class="split-words"
          :loading="segmenting"
          data-testid="split-words"
          @click="resegmentText"
        >
          <ui-icon v-if="!isMobile && !segmenting" name="scissors" :size="16" :stroke-width="2" />
          Split words
        </ui-button>
        <ui-button
          variant="ghost"
          size="sm"
          class="split-clear"
          data-testid="split-clear"
          @click="clearTextarea"
        >
          <ui-icon v-if="!isMobile" name="x" :size="16" :stroke-width="2" />
          Clear
        </ui-button>
      </div>

      <ui-text-field
        ref="textarea"
        v-model="inputText"
        multiline
        tibetan
        class="split-field"
        :rows="2"
        placeholder="Paste or type Tibetan text"
        aria-label="Tibetan text"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        data-testid="split-text"
        @paste="onPaste"
        @keydown="onKeydown"
        @keyup="onKeyup"
      />

      <div v-if="tokenizerError" class="tokenizer-error" role="alert" data-testid="split-tokenizer-error">
        <ui-icon name="triangle-alert" :size="16" />
        {{ tokenizerError }}
      </div>
    </section>

    <ResizableDivider
      v-if="!isMobile"
      direction="horizontal"
      label="Resize the text area"
      :value="topHeight"
      :min="15"
      :max="70"
      @resize="onHorizontalResize"
    />

    <div ref="bottomContainer" class="split-body">
      <section
        v-show="!showingEntries"
        class="terms-pane"
        :style="leftStyle"
        aria-label="Terms"
      >
        <div class="terms-header">
          <span class="terms-count" data-testid="split-terms-count">{{ termsCountLabel }}</span>
          <ResultsAndPaginationAndDictionaries
            v-if="entries.length"
            :dictionaries="dictionariesForCurrentResults"
            :totalNumberOfEntries="entries.length"
            :hidePagination="true"
            menuAlign="start"
            @close:dictionariesMenu="focusTextarea"
          />
        </div>

        <div
          v-if="termsList.length"
          ref="termsList"
          class="terms-list"
          :style="{ '--merge-lanes': mergeLanes }"
          role="listbox"
          aria-label="Terms in the text"
          data-testid="split-terms"
        >
          <div
            v-for="(term, index) in termsList"
            :key="index"
            class="term-item"
            :class="{
              'is-active': selectedTermIndex === index,
              'is-unknown': !hasDefinitions(term),
            }"
            role="option"
            :aria-selected="selectedTermIndex === index ? 'true' : 'false'"
            data-testid="split-term"
            @click="selectTermByIndex(index)"
          >
            <span class="term-item__text">{{ term }}</span>
            <ui-icon
              v-if="!hasDefinitions(term)"
              name="circle-help"
              :size="16"
              class="term-item__unknown"
              label="No entry in your dictionaries"
              data-testid="split-term-unknown"
            />
          </div>

          <!-- Merge buttons: a bracket over the terms that make a known word -->
          <span
            v-for="bracket in mergeBrackets"
            :key="bracket.start + '-' + bracket.count"
            class="merge-bracket"
            :style="mergeBracketStyle(bracket)"
            data-testid="split-merge"
          >
            <ui-tooltip side="right">
              <button
                type="button"
                class="merge-button"
                :aria-label="'Merge ' + bracket.count + ' terms: ' + bracket.term"
                data-testid="split-merge-button"
                @click.stop="mergeTerms(bracket.start, bracket.count)"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v6m0 0-3-3m3 3 3-3M12 21v-6m0 0-3 3m3-3 3 3" /></svg>
              </button>
              <template #content>
                <span class="merge-tip__term">{{ bracket.term }}</span> · Merge {{ bracket.count }} terms
              </template>
            </ui-tooltip>
          </span>
        </div>
        <div
          v-else-if="!segmenting && hasText"
          class="terms-empty"
          data-testid="split-terms-empty"
        >
          Add spaces between words or click "Split words"
        </div>
        <div v-else-if="!hasText" class="terms-empty" data-testid="split-terms-empty">
          Paste text above to begin
        </div>
      </section>

      <ResizableDivider
        v-if="!isMobile && termsList.length"
        direction="vertical"
        label="Resize the terms"
        :value="leftWidth"
        :min="20"
        :max="60"
        @resize="onVerticalResize"
      />

      <section
        v-show="!isMobile || showingEntries"
        class="entries-pane"
        aria-label="Definitions"
      >
        <template v-if="isMobile">
          <button
            type="button"
            class="back-link"
            data-testid="split-back"
            @click="showTermsList"
          >
            <span class="back-link__icon"><ui-icon name="chevron-left" :size="22" :stroke-width="2.4" /></span>
            Back to terms
          </button>
          <div
            v-if="selectedTerm && !loading"
            class="headword"
            data-testid="split-headword"
          >{{ selectedTerm }}</div>
        </template>

        <!-- Loading state -->
        <div v-if="loading" class="loading-state" data-testid="split-loading">
          <ui-spinner :size="40" />
          <div>Loading definitions...</div>
        </div>

        <!-- No term selected -->
        <div
          v-else-if="selectedTermIndex === null && termsList.length"
          class="pane-message"
          data-testid="split-select-term"
        >
          <ui-icon name="book-open" :size="20" />
          Select a term to see definitions
        </div>

        <!-- No definitions found -->
        <div
          v-else-if="selectedTerm && !entriesForEnabledDictionaries.length"
          class="pane-message"
          data-testid="split-no-definitions"
        >
          <ui-icon name="book-x" :size="20" />
          <span>No definitions found for "<span class="pane-message__term">{{ selectedTerm }}</span>"</span>
        </div>

        <!-- Definitions -->
        <transition v-else name="ui-fade" mode="out-in" appear>
          <div
            v-if="entriesForEnabledDictionaries.length"
            class="entries-card"
            data-testid="split-entries"
          >
            <Entries
              :entries="entriesForEnabledDictionaries"
              :initialNumberOfEntries="25"
              :cards="isMobile"
            />
          </div>
        </transition>
      </section>
    </div>
  </div>
</template>

<style lang="stylus" scoped>
.segment-page
  // One term row; merge brackets are placed in multiples of it
  --split-row 3.25rem
  box-sizing border-box
  height 100%
  display flex
  flex-direction column
  gap 18px
  padding 28px 40px 0
  overflow hidden
  background var(--bg)
  color var(--ink)
  font-family var(--font-ui)
  font-size var(--text-base)

// The text: a card with the title, the hint, Split words and Clear above the field
.card
  background var(--surface)
  border 1px solid var(--line)
  border-radius var(--radius-card)
  box-shadow var(--shadow-card)

.split-eyebrow
  flex none
  font-size var(--text-xs)
  font-weight 600
  letter-spacing 0.08em
  text-transform uppercase
  color var(--muted)

.split-input
  @extend .card
  flex none
  box-sizing border-box
  min-height 0
  display flex
  flex-direction column
  gap 10px
  padding 14px 22px 16px

.split-input__header
  flex none
  display flex
  align-items center
  gap 10px

.split-hint
  flex 1
  min-width 0
  padding-left 10px
  font-size var(--text-chip)
  color var(--muted)
  white-space nowrap
  overflow hidden
  text-overflow ellipsis

.split-words
  gap 8px

.split-clear
  gap 6px
  padding 0 10px
  color var(--muted)
  font-weight 500

  &:hover:not(:disabled)
    background var(--soft)
    color var(--ink)

.split-field
  flex 1
  min-height 0

  :deep(.ui-field__control)
    flex 1
    min-height 0
    align-items stretch
    padding 10px 16px
    border-radius var(--radius-lg)

  :deep(.ui-field__input)
    height 100%
    min-height 3rem
    resize none
    padding 0
    font-size 1.875rem
    line-height 1.6

  :deep(.ui-field__input::placeholder)
    font-family var(--font-serif)
    font-size 1.25rem
    line-height 1.9

.tokenizer-error
  flex none
  display flex
  align-items center
  gap 6px
  font-size var(--text-sm)
  color var(--danger-ink)

// Below: terms | definitions
.split-body
  flex 1
  min-height 0
  display flex

// Terms
.terms-pane
  flex none
  box-sizing border-box
  min-height 0
  display flex
  flex-direction column
  padding-bottom 28px

.terms-header
  flex none
  box-sizing border-box
  display flex
  align-items center
  justify-content space-between
  gap 10px
  min-height 2.25rem
  margin-bottom 10px

.terms-count
  font-size var(--text-sm)
  color var(--muted)
  white-space nowrap

.terms-list
  @extend .card
  position relative
  flex 0 1 auto
  min-height 0
  overflow-y auto
  overscroll-behavior contain

.term-item
  box-sizing border-box
  height var(--split-row)
  padding 0 18px
  padding-right calc(18px + var(--merge-lanes, 0) * 30px)
  display flex
  align-items center
  gap 8px
  border-bottom 1px solid var(--soft)
  font-family var(--font-tibetan)
  font-size var(--text-tibetan-md)
  white-space nowrap
  cursor pointer

  &:last-of-type
    border-bottom-color transparent

  &:hover
    background var(--soft)

  &.is-active
    background var(--accent)
    color var(--on-accent)
    border-bottom-color transparent

  // No entry for this term: muted, with a marker (--faint is under 4.5:1)
  &.is-unknown:not(.is-active)
    color var(--muted)

.term-item__text
  min-width 0
  overflow hidden
  text-overflow ellipsis
  padding-top 0.3rem

.term-item__unknown
  flex none
  opacity 0.9

// A "]" over the merged rows, its button on the right edge
.merge-bracket
  position absolute
  width 16px
  box-sizing border-box
  border 2px solid var(--accent-line)
  border-left 0
  border-radius 0 9px 9px 0
  pointer-events none

.merge-button
  position absolute
  right -14px
  top 50%
  transform translateY(-50%)
  width 28px
  height 28px
  box-sizing border-box
  padding 0
  display flex
  align-items center
  justify-content center
  border 1.5px solid var(--accent)
  border-radius 50%
  background var(--surface)
  color var(--accent)
  cursor pointer
  pointer-events auto

  &:hover
    background var(--accent)
    color var(--on-accent)

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset 2px

.terms-empty
  font-size var(--text-base)
  color var(--muted)
  padding 10px 0

// Definitions
.entries-pane
  flex 1
  min-width 0
  min-height 0
  display flex
  flex-direction column
  // Level with the terms list, below the terms header
  padding-top calc(2.25rem + 10px)
  box-sizing border-box

.entries-card
  @extend .card
  flex 0 1 auto
  min-height 0
  margin-bottom 28px
  overflow-y auto

.pane-message
  @extend .card
  flex none
  display flex
  align-items center
  gap 10px
  padding 16px 18px
  color var(--muted)

.pane-message__term
  font-family var(--font-tibetan)
  font-size var(--text-md)
  color var(--ink)

.loading-state
  display flex
  flex-direction column
  align-items center
  justify-content center
  gap 16px
  height 12.5rem
  color var(--muted)

.back-link
  flex none
  display flex
  align-items center
  height 2.75rem
  margin 0 -6px
  padding 0 8px 0 0
  border 0
  background none
  color var(--accent)
  font 600 0.9375rem var(--font-ui)
  cursor pointer

.back-link__icon
  display inline-flex
  align-items center
  justify-content center
  width 2.75rem
  height 2.75rem

.headword
  flex none
  font-family var(--font-tibetan)
  font-size 2.125rem
  line-height 1.5
  color var(--accent)
  overflow-wrap anywhere

// Phone (boards "B · Split on a phone" and "… entries")
.segment-page.is-phone
  gap 14px
  padding 16px 16px 0

  .split-input
    padding 10px 12px 12px
    gap 8px

  .split-input__header
    gap 8px

    .split-eyebrow
      flex 1

  .split-words,
  .split-clear
    height 2.75rem
    font-size var(--text-base)

  .split-words
    border-radius var(--radius-lg)

  .split-clear
    padding 0 8px

  .split-field
    flex none

    :deep(.ui-field__control)
      padding 8px 12px

    :deep(.ui-field__input)
      height 4.5rem
      min-height 0
      font-size var(--text-tibetan-md)

  .split-body
    flex-direction column

  .terms-pane
    flex 1
    padding-bottom 16px

  .terms-header
    min-height 0
    margin-bottom 14px

  .entries-pane
    flex 1
    padding-top 0
    gap 14px
    padding-bottom 16px
    overflow-y auto
    -webkit-overflow-scrolling touch

  .entries-card
    flex none
    margin-bottom 0
    overflow visible
    background none
    border 0
    border-radius 0
    box-shadow none
</style>

<style>
/* The merge tooltip is rendered outside the page */
.merge-tip__term {
  font-family: var(--font-tibetan);
  font-size: 0.9375rem;
}
</style>
