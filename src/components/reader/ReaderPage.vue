<script>
import { isTauri } from '../../config/platform';
import SqlDatabase from '../../services/sql-database';
import {
  createTokenizerSession,
  tokenizerError,
  splitIntoWords,
  wordsFromSpacedText,
  findMerges,
  mergeLanes,
} from '../../services/segmenter';
import { recentTexts, recordText, clearSplitHistory } from '../../services/split-history';
import { tibetanLookupKey, withTrailingTshek } from '../../utils';
import { UiButton, UiIcon, UiList, UiListItem } from '../../ui';
import MobileResponsiveMixin from '../mixins/MobileResponsiveMixin';
import ReaderEditor from './ReaderEditor.vue';
import ReaderText from './ReaderText.vue';
import ReaderWordPanel from './ReaderWordPanel.vue';

// The passage the empty Reader offers to try (as Split did)
const EXAMPLE_TEXT = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།';

// Reader (boards DesktopReader and MobileReader), Split's successor.
//
// Two states. Editing: the text area with Split's rules (ReaderEditor), the
// recent texts and an example while it is empty. Reading: the text as a
// button per word (ReaderText) and the selected word's entry beside it
// (ReaderWordPanel: a panel on desktop, a bottom sheet on a phone).
//
// Splitting: a typed or pasted text goes through the tokenizer. Once split,
// the editor holds the words separated by spaces, and from then on the spaces
// are the word breaks, as they were in Split's text area: Edit, change the
// breaks (Shift+Space), Split again. A paste, the Paste button, Clear, an
// emptied editor or a text with no space left hand it back to the tokenizer.
//
// Expressions across neighbouring words (findMerges, up to 5 words) are found
// after each split; a newer split discards an older search still running.
//
// Keyboard (window, while the Reader is shown): Up/Down move between words
// (left alone in fields and dialogs, as Split), Escape closes the phone sheet.
export default {
  name: 'ReaderPage',
  mixins: [MobileResponsiveMixin],
  components: {
    ReaderEditor,
    ReaderText,
    ReaderWordPanel,
    UiButton,
    UiIcon,
    UiList,
    UiListItem,
  },
  inject: { snackbar: { default: null } },
  data() {
    return {
      text: '',
      words: [],
      editing: true,
      // The spaces of the editor's text are the word breaks
      respectSpaces: false,
      // null, a word's index, or an expression's { start, count }
      selection: null,
      merges: [],
      // Words looked up, and those of them with no entry
      checkedWords: new Set(),
      wordsWithoutEntry: new Set(),
      showWylie: false,
      sheetOpen: false,
      splitting: false,
      pasting: false,
      tokenizerError: null,
      recent: recentTexts(),
      exampleText: EXAMPLE_TEXT,
    };
  },
  computed: {
    reading() {
      return !this.editing && this.words.length > 0;
    },
    hasText() {
      return !!this.text.trim();
    },
    selectedTerm() {
      const selection = this.selection;
      if (typeof selection === 'number') return this.words[selection] || '';
      if (selection && typeof selection === 'object') {
        return this.words.slice(selection.start, selection.start + selection.count).map(withTrailingTshek).join('');
      }
      return '';
    },
    unknownWords() {
      return [...this.wordsWithoutEntry];
    },
  },
  watch: {
    text(value) {
      // An editor emptied by hand starts a new text: the tokenizer splits it
      if (!value.trim()) this.respectSpaces = false;
    },
  },
  created() {
    // Not reactive: it holds the tokenizer, which is large
    this.tokenizerSession = createTokenizerSession();
    this.mergeRun = 0;
    this.lookupsStale = false;
  },
  mounted() {
    this.listenToKeyboard();
    this._onDatabaseChanged = () => {
      if (this.isShown()) this.refreshLookups();
      else this.lookupsStale = true;
    };
    window.addEventListener('all-terms-updated', this._onDatabaseChanged);
    window.addEventListener('dictionaries-updated', this._onDatabaseChanged);
  },
  activated() {
    this.listenToKeyboard();
    this.recent = recentTexts();
    if (this.lookupsStale) {
      this.lookupsStale = false;
      this.refreshLookups();
    }
    if (this.editing) this.$nextTick(() => this.focusEditor());
  },
  deactivated() {
    this.stopListeningToKeyboard();
  },
  beforeUnmount() {
    this.stopListeningToKeyboard();
    window.removeEventListener('all-terms-updated', this._onDatabaseChanged);
    window.removeEventListener('dictionaries-updated', this._onDatabaseChanged);
    this.mergeRun++;
  },
  methods: {
    isShown() {
      return !!this.$route?.path?.startsWith('/reader');
    },

    // Splitting

    async split({ pasted = false } = {}) {
      if (!this.hasText || this.splitting) return;
      if (pasted) this.respectSpaces = false;
      let words;
      // A text with no space left (replaced wholesale) is a new text
      if (this.respectSpaces && /\s/.test(this.text.trim())) {
        words = wordsFromSpacedText(this.text);
      } else {
        this.splitting = true;
        try {
          words = await splitIntoWords(this.text, this.tokenizerSession);
          this.tokenizerError = tokenizerError(this.tokenizerSession);
        } finally {
          this.splitting = false;
        }
      }
      if (!words.length) return;
      this.showWords(words);
    },

    // The words become the text to read; the editor keeps them spaced
    showWords(words, { selectFirst = false } = {}) {
      const previous = this.selection;
      this.words = words;
      this.text = words.join(' ');
      this.respectSpaces = true;
      this.editing = false;
      this.sheetOpen = false;
      recordText(this.text);
      this.recent = recentTexts();
      // As Split: the selected position is kept when the text is split again
      const keep = !selectFirst && typeof previous === 'number' && previous < words.length;
      this.selection = keep ? previous : 0;
      this.checkWords();
      this.findExpressions();
    },

    async hasEntries(term) {
      const rows = await SqlDatabase.getEntriesFor(tibetanLookupKey(term) || term);
      return !!rows && rows.length > 0;
    },

    // Marks the words found in no dictionary, each looked up once
    async checkWords() {
      const pending = [...new Set(this.words)].filter((word) => !this.checkedWords.has(word));
      for (const word of pending) {
        try {
          const found = await this.hasEntries(word);
          this.checkedWords.add(word);
          if (!found) this.wordsWithoutEntry.add(word);
        } catch (error) {
          // A word that cannot be looked up is not marked
        }
      }
    },

    // The expressions of the current words. The last ones go at once, and a
    // search started for older words never overwrites a newer one.
    async findExpressions() {
      const run = ++this.mergeRun;
      this.merges = [];
      const words = this.words;
      if (words.length < 2) return;
      try {
        const found = await findMerges(words, this.hasEntries);
        if (run !== this.mergeRun) return;
        this.merges = mergeLanes(found);
      } catch (error) {
        if (run === this.mergeRun) this.merges = [];
      }
    },

    // Packs installed or removed, dictionaries switched on or off
    refreshLookups() {
      if (!this.words.length) return;
      this.checkedWords = new Set();
      this.wordsWithoutEntry = new Set();
      this.checkWords();
      this.findExpressions();
    },

    // Editing

    edit() {
      this.editing = true;
      this.sheetOpen = false;
      this.$nextTick(() => this.focusEditor());
    },

    clear() {
      this.mergeRun++;
      this.text = '';
      this.words = [];
      this.merges = [];
      this.selection = null;
      this.editing = true;
      this.respectSpaces = false;
      this.sheetOpen = false;
      this.checkedWords = new Set();
      this.wordsWithoutEntry = new Set();
      this.recent = recentTexts();
      this.$nextTick(() => this.focusEditor());
    },

    async pasteFromClipboard() {
      if (this.pasting) return;
      this.pasting = true;
      try {
        const clipboardText = await this.readClipboard();
        if (!clipboardText || !clipboardText.trim()) {
          this.snackbar?.open('The clipboard holds no text.');
          return;
        }
        this.$refs.editor?.insertAtCaret(clipboardText);
        await this.$nextTick();
        await this.split({ pasted: true });
      } catch (error) {
        console.warn('[Reader] Clipboard not read', error);
        this.snackbar?.open('The clipboard could not be read. Paste into the text with Ctrl+V (⌘V on a Mac).');
      } finally {
        this.pasting = false;
      }
    },

    async readClipboard() {
      if (isTauri()) {
        const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
        return readText();
      }
      if (!navigator.clipboard?.readText) throw new Error('Clipboard reading not supported');
      return navigator.clipboard.readText();
    },

    // A recent text is stored as split, so its spaces are the user's own
    // breaks: read them back instead of running the tokenizer again
    openRecent(text) {
      const words = wordsFromSpacedText(text);
      if (!words.length) return;
      this.showWords(words, { selectFirst: true });
    },

    clearRecent() {
      clearSplitHistory();
      this.recent = [];
    },

    useExample() {
      this.text = this.exampleText;
      this.split({ pasted: true });
    },

    focusEditor() {
      this.$refs.editor?.focus();
    },

    // Reading

    select(selection, { openSheet = true } = {}) {
      this.selection = selection;
      if (openSheet && this.isMobile) this.sheetOpen = true;
    },

    closeSheet() {
      this.sheetOpen = false;
    },

    openEntry(term) {
      this.$router.push('/lookup/' + encodeURIComponent(term));
    },

    // Up/Down: the word before or after the selection (an expression counts
    // from its first word going up, its last going down), without wrapping
    move(step) {
      const selection = this.selection;
      let from;
      if (typeof selection === 'number') from = selection;
      else if (selection && typeof selection === 'object') {
        from = step > 0 ? selection.start + selection.count - 1 : selection.start;
      } else if (step > 0) from = -1;
      else return;
      const next = from + step;
      if (next >= 0 && next < this.words.length) this.select(next);
    },

    handleKeydown(event) {
      if (!this.isShown() || event.defaultPrevented) return;
      const target = event.target;
      if (target?.closest?.(".dictionaries-menu, [role='dialog']")) return;

      if (event.key === 'Escape') {
        if (this.isMobile && this.sheetOpen) {
          event.preventDefault();
          this.closeSheet();
        }
        return;
      }

      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      if (!this.reading) return;
      if (target?.matches?.('input, select, textarea') || target?.isContentEditable) return;
      event.preventDefault();
      this.move(event.key === 'ArrowUp' ? -1 : 1);
    },

    // Only while the page is shown: <keep-alive> keeps it mounted elsewhere
    listenToKeyboard() {
      window.removeEventListener('keydown', this.handleKeydown);
      window.addEventListener('keydown', this.handleKeydown);
    },
    stopListeningToKeyboard() {
      window.removeEventListener('keydown', this.handleKeydown);
    },
  },
};
</script>

<template>
  <!-- segment-page: the selection popup leaves this page alone, as it did Split -->
  <section
    class="reader-page segment-page"
    :class="{ 'is-phone': isMobile, 'is-reading': reading, 'has-sheet': isMobile && sheetOpen }"
    data-testid="reader-page"
  >
    <div class="reader-main">
      <header class="reader-header">
        <h1 class="reader-title">Reader</h1>
        <div v-if="reading" class="reader-actions">
          <ui-button
            variant="outline"
            size="sm"
            class="reader-action"
            data-testid="reader-edit"
            @click="edit"
          >
            <ui-icon v-if="!isMobile" name="pencil" :size="15" />
            Edit
          </ui-button>
          <ui-button
            variant="outline"
            size="sm"
            class="reader-action"
            :class="{ 'is-on': showWylie }"
            :aria-pressed="showWylie ? 'true' : 'false'"
            data-testid="reader-show-wylie"
            @click="showWylie = !showWylie"
          >{{ isMobile ? 'Wylie' : 'Show Wylie' }}</ui-button>
          <ui-button
            variant="outline"
            size="sm"
            icon
            class="reader-action"
            aria-label="Clear"
            title="Clear"
            data-testid="reader-clear"
            @click="clear"
          >
            <ui-icon name="x" :size="16" />
          </ui-button>
        </div>
      </header>

      <div class="reader-body">
        <div v-if="tokenizerError" class="reader-error" role="alert" data-testid="reader-tokenizer-error">
          <ui-icon name="triangle-alert" :size="16" />
          {{ tokenizerError }}
        </div>

        <template v-if="!reading">
          <reader-editor
            ref="editor"
            v-model="text"
            :splitting="splitting"
            :pasting="pasting"
            :is-mobile="isMobile"
            @split="split"
            @paste="pasteFromClipboard"
            @clear="clear"
          />

          <template v-if="!hasText">
            <section v-if="recent.length" class="reader-recent" aria-label="Recent texts">
              <div class="reader-section-head">
                <h2 class="reader-section-label">Recent texts</h2>
                <ui-button variant="ghost" size="sm" data-testid="reader-recent-clear" @click="clearRecent">Clear</ui-button>
              </div>
              <ui-list class="reader-recent__list" data-testid="reader-recent">
                <ui-list-item
                  v-for="recentText in recent"
                  :key="recentText"
                  clickable
                  data-testid="reader-recent-item"
                  @click="openRecent(recentText)"
                >
                  <span class="reader-recent__text">{{ recentText }}</span>
                </ui-list-item>
              </ui-list>
            </section>

            <p class="reader-example">
              <span class="reader-example__label">Try it with</span>
              <button type="button" class="reader-example__button" data-testid="reader-example" @click="useExample">
                <span class="reader-example__text">{{ exampleText }}</span>
                <ui-icon name="arrow-right" :size="16" :stroke-width="2" />
              </button>
            </p>
          </template>
        </template>

        <template v-else>
          <p v-if="!isMobile" class="reader-hint">
            Click a word to see its entry. A line under several words marks a longer expression: click it to look the expression up.
          </p>
          <reader-text
            class="reader-text-card"
            :words="words"
            :merges="merges"
            :selected="selection"
            :unknown-words="unknownWords"
            :show-wylie="showWylie"
            :is-mobile="isMobile"
            @select="select"
          />
        </template>
      </div>
    </div>

    <reader-word-panel
      v-if="reading"
      :term="selectedTerm"
      :is-mobile="isMobile"
      :open="sheetOpen"
      @close="closeSheet"
      @open-entry="openEntry"
    />
  </section>
</template>

<style scoped>
/* Desktop: the text, and the selected word's panel on the right
   (board DesktopReader) */
.reader-page {
  position: relative;
  box-sizing: border-box;
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-ui);
}

.reader-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.reader-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: var(--control-sm);
  padding: var(--space-4) var(--space-7);
  border-bottom: 1px solid var(--line-soft);
}
.reader-title {
  margin: 0;
  font-size: var(--text-title);
  font-weight: 600;
  line-height: var(--control-sm);
}
.reader-actions {
  display: flex;
  gap: var(--space-2);
}
.reader-action {
  gap: 6px;
}
.reader-action.is-on {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  color: var(--accent);
}

.reader-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: calc(var(--space-8) + var(--space-2)) calc(var(--space-8) + var(--space-4));
}
.reader-page:not(.is-reading) .reader-body {
  gap: var(--space-6);
  padding-top: var(--space-7);
}
.reader-page:not(.is-reading) .reader-body > * {
  width: 100%;
  max-width: 55rem;
}

.reader-hint {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--muted);
}

.reader-error {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-sm);
  color: var(--danger-ink);
}

/* Recent texts and the example, below the empty editor */
.reader-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}
.reader-section-label {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--faint);
}
.reader-recent__list {
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}
/* One line of the passage, cut short with an ellipsis */
.reader-recent__text {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-tibetan);
  font-size: var(--text-tibetan-sm);
  /* overflow hidden clips at the line box: room for vowels like ི above */
  line-height: 2.1;
  color: var(--rubric);
}

.reader-example {
  margin: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.reader-example__label {
  font-size: var(--text-sm);
  color: var(--muted);
}
.reader-example__button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  max-width: 100%;
  padding: var(--space-1) 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg-quiet);
  color: var(--accent);
  cursor: pointer;
}
.reader-example__button:hover {
  border-color: var(--accent-line);
}
.reader-example__button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.reader-example__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-tibetan);
  font-size: var(--text-tibetan-sm);
  line-height: 2.1;
  color: var(--rubric);
}

/* A narrow window: less padding around the text */
@media (max-width: 1180px) {
  .reader-page:not(.is-phone) .reader-body {
    padding: var(--space-7) var(--space-7);
  }
}

/* Phone: one column on the grouped ground, as high as what the software
   keyboard leaves visible (--visible-height) so it never covers the editor
   or the sheet; the sheet sits over the text, above the bottom bar
   (board MobileReader) */
.reader-page.is-phone {
  height: min(100%, calc(var(--visible-height, 100dvh) - var(--safe-top)));
  background: var(--bg-grouped);
  overflow: hidden;
}
.reader-page.is-phone .reader-header {
  flex-wrap: wrap;
  padding: 22px var(--space-4) 0;
  border-bottom: 0;
}
.reader-page.is-phone .reader-title {
  font-size: var(--text-large-title);
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
}
.reader-page.is-phone .reader-actions {
  gap: var(--space-1);
}
.reader-page.is-phone .reader-action {
  height: var(--control-sm);
  border-color: transparent;
  background: transparent;
  color: var(--accent);
  font-size: var(--text-md);
  padding: 0 var(--space-2);
}
.reader-page.is-phone .reader-action.is-on {
  background: var(--accent-soft);
}
.reader-page.is-phone .reader-body {
  gap: 14px;
  padding: 14px var(--space-4) var(--space-6);
}
.reader-page.is-phone .reader-text-card {
  box-sizing: border-box;
  padding: var(--space-4);
  border-radius: var(--radius-group);
  background: var(--surface);
}
/* With the sheet open, the text can scroll above it */
.reader-page.is-phone.has-sheet .reader-body {
  padding-bottom: calc(var(--visible-height, 100dvh) * 0.6);
  scroll-padding-bottom: calc(var(--visible-height, 100dvh) * 0.6);
}
</style>
