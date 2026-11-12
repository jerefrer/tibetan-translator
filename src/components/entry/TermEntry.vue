<script>
import Decorator from '../../services/decorator';
import CopyService, { cleanDictionaryLabel } from '../../services/copy-service';
import SqlDatabase from '../../services/sql-database';
import Storage from '../../services/storage';
import { getScanInfo } from '../../services/scan-service';
import { inShort } from '../../services/in-short';
import { isSaved, toggleSaved } from '../../services/saved-terms';
import { wylieFor, phoneticsForTerm } from '../../services/transcription';
import { supportsModularPacks } from '../../config/platform';
import { tibetanLookupKey } from '../../utils';
import { UiButton, UiIcon, UiSpinner } from '../../ui';
import DictionariesMenuMixin from '../DictionariesMenuMixin';
import EntriesEntry from '../EntriesEntry.vue';
import DictionaryAboutDialog from '../DictionaryAboutDialog.vue';
import QuickAddDialog from '../QuickAddDialog.vue';
import UninstalledPacksNotice from '../UninstalledPacksNotice.vue';
import DictionaryTabs from './DictionaryTabs.vue';
import InShort from './InShort.vue';

// How many dictionaries the condensed entry (Reader panel) shows
const COMPACT_DICTIONARIES = 3;

// One Tibetan term as a page: the headword, its Wylie and phonetics, what the
// dictionaries agree on (In short), a tab per dictionary, then the definitions
// grouped by dictionary in the user's order, enabled dictionaries only.
//
// `compact` is the Reader panel's version: a smaller headword, no tabs, the
// first three dictionaries and a link that asks the caller to open the entry.
// `highlight` marks search hits in a definition (HTML in, HTML out).
//
// The definitions are EntriesEntry rows, so everything an entry does stays:
// the `definition` element App.vue listens on, abbreviations, links to other
// terms, audio, scans, copy.
export default {
  name: 'TermEntry',
  mixins: [DictionariesMenuMixin],
  components: {
    DictionaryAboutDialog,
    DictionaryTabs,
    EntriesEntry,
    InShort,
    QuickAddDialog,
    UiButton,
    UiIcon,
    UiSpinner,
    UninstalledPacksNotice
  },
  // The quick lookup popup and tests mount without a snackbar
  inject: { snackbar: { default: null } },
  props: {
    term: { type: String, required: true },
    compact: { type: Boolean, default: false },
    highlight: { type: Function, default: null }
  },
  emits: ['loaded', 'open-entry'],
  data() {
    return {
      entries: [],
      loading: false,
      selectedDictionaryId: null,
      saved: false,
      aboutOpen: false,
      aboutDictionary: '',
      quickAddOpen: false
    };
  },
  computed: {
    // The headword as dictionaries store it: Tibetan, one closing tsheg
    headword() {
      return tibetanLookupKey(this.term) || this.term;
    },
    transcription() {
      const parts = [];
      try {
        const wylie = wylieFor(this.headword);
        if (wylie) parts.push(wylie);
        const phonetics = phoneticsForTerm(this.headword);
        if (phonetics) parts.push(phonetics);
      } catch (error) {
        // A headword that cannot be transcribed still has its definitions
      }
      const count = this.shownEntries.length;
      if (!this.loading) parts.push(`${count} ${count === 1 ? 'definition' : 'definitions'}`);
      return parts.join(' · ');
    },
    shownEntries() {
      return this.entriesForEnabledDictionaries;
    },
    // [{ id, name, entries }] in the user's order
    dictionaryGroups() {
      const groups = [];
      const byId = new Map();
      for (const entry of this.shownEntries) {
        if (!byId.has(entry.dictionaryId)) {
          const group = { id: entry.dictionaryId, name: entry.dictionary, entries: [] };
          byId.set(entry.dictionaryId, group);
          groups.push(group);
        }
        byId.get(entry.dictionaryId).entries.push(entry);
      }
      return groups;
    },
    tabDictionaries() {
      return this.dictionaryGroups.map((group) => ({
        id: group.id,
        label: this.dictionaryLabelFor(group.name, { short: true }),
        text: cleanDictionaryLabel(group.name)
      }));
    },
    // A chosen dictionary that is no longer there (switched off) is no filter
    activeDictionaryId() {
      return this.tabDictionaries.some((tab) => tab.id === this.selectedDictionaryId)
        ? this.selectedDictionaryId
        : null;
    },
    visibleGroups() {
      if (this.compact) return this.dictionaryGroups.slice(0, COMPACT_DICTIONARIES);
      if (this.activeDictionaryId === null) return this.dictionaryGroups;
      return this.dictionaryGroups.filter((group) => group.id === this.activeDictionaryId);
    },
    sources() {
      return this.visibleGroups.map((group) => ({
        id: group.id,
        name: group.name,
        label: this.dictionaryLabelFor(group.name),
        entries: group.entries.map((entry) => ({ ...entry, definition: this.decorated(entry) }))
      }));
    },
    glosses() {
      return inShort(this.shownEntries.filter((entry) => !getScanInfo(entry.dictionary)));
    },
    // What Copy copies: the definitions shown, scans left out (they hold a page)
    copyableEntries() {
      const shown = new Set(this.visibleGroups.map((group) => group.id));
      return this.shownEntries.filter(
        (entry) => shown.has(entry.dictionaryId) && !getScanInfo(entry.dictionary)
      );
    },
    canAddToLexicon() {
      return supportsModularPacks();
    }
  },
  watch: {
    term: {
      immediate: true,
      handler() {
        this.selectedDictionaryId = null;
        this.entries = [];
        this.saved = isSaved(this.headword);
        this.load();
      }
    }
  },
  mounted() {
    this._onDictionariesUpdated = () => this.refreshDictionaries();
    this._onSavedUpdated = () => {
      this.saved = isSaved(this.headword);
    };
    window.addEventListener('dictionaries-updated', this._onDictionariesUpdated);
    window.addEventListener('saved-terms-updated', this._onSavedUpdated);
  },
  beforeUnmount() {
    window.removeEventListener('dictionaries-updated', this._onDictionariesUpdated);
    window.removeEventListener('saved-terms-updated', this._onSavedUpdated);
  },
  methods: {
    decorated(entry) {
      const html = Decorator.decorate(entry);
      // A scanned dictionary holds a page number: nothing to highlight
      if (!this.highlight || getScanInfo(entry.dictionary)) return html;
      return this.highlight(html);
    },
    async load() {
      const key = this.headword;
      const token = (this._loadToken = (this._loadToken || 0) + 1);
      this.loading = true;
      try {
        const rows = await SqlDatabase.getEntriesFor(key);
        if (token !== this._loadToken) return;
        this.entries = rows || [];
        this.resetDictionariesToDefaultAndSetNumberOfEntries();
        this.$emit('loaded', this.shownEntries.length);
      } finally {
        if (token === this._loadToken) this.loading = false;
      }
    },
    // A pack was installed or removed, or a dictionary switched on or off
    refreshDictionaries() {
      this.dictionaries = Storage.get('dictionaries').map((dictionary) => ({
        ...dictionary,
        enabledInPreferences: dictionary.enabled
      }));
      this.load();
    },
    async copyAll() {
      try {
        await CopyService.writeToClipboard(
          CopyService.entriesToText(this.headword, this.copyableEntries)
        );
        this.snackbar?.open('Copied');
      } catch (error) {
        this.snackbar?.open('Copy failed');
      }
    },
    toggleSave() {
      this.saved = toggleSaved(this.headword);
    },
    showAbout(dictionary) {
      this.aboutDictionary = dictionary;
      this.aboutOpen = true;
    }
  }
};
</script>

<template>
  <article
    class="term-entry"
    :class="{ 'term-entry--compact': compact }"
    data-testid="term-entry"
  >
    <header class="term-entry__header">
      <div class="term-entry__top">
        <component
          :is="compact ? 'h2' : 'h1'"
          class="term-entry__headword"
          data-testid="entry-headword"
        >{{ headword }}</component>
        <div class="term-entry__actions">
          <ui-button
            v-if="!loading && copyableEntries.length"
            variant="outline"
            size="sm"
            icon
            aria-label="Copy all definitions"
            title="Copy all definitions"
            data-testid="entry-copy"
            @click="copyAll"
          >
            <ui-icon name="copy" :size="17" />
          </ui-button>
          <ui-button
            variant="outline"
            size="sm"
            class="term-entry__save"
            :class="{ 'is-saved': saved }"
            :aria-pressed="saved ? 'true' : 'false'"
            :aria-label="saved ? 'Remove from saved terms' : 'Save term'"
            data-testid="entry-save"
            @click="toggleSave"
          >
            <ui-icon name="bookmark" :size="17" :fill="saved ? 'currentColor' : 'none'" />
            <span class="term-entry__save-label">{{ saved ? 'Saved' : 'Save' }}</span>
          </ui-button>
          <ui-button
            v-if="canAddToLexicon"
            variant="outline"
            size="sm"
            icon
            aria-label="Add my definition"
            title="Add my definition"
            data-testid="entry-add"
            @click="quickAddOpen = true"
          >
            <ui-icon name="book-plus" :size="18" />
          </ui-button>
        </div>
      </div>
      <p class="term-entry__transcription" data-testid="entry-transcription">{{ transcription }}</p>
    </header>

    <div v-if="loading" class="term-entry__loading" data-testid="entry-loading">
      <ui-spinner :size="32" />
      <span>Loading definitions...</span>
    </div>

    <template v-else-if="shownEntries.length">
      <in-short :glosses="glosses" />

      <dictionary-tabs
        v-if="!compact"
        v-model="selectedDictionaryId"
        :dictionaries="tabDictionaries"
        :total="shownEntries.length"
      />

      <div class="term-entry__sources">
        <section
          v-for="source in sources"
          :key="source.id"
          class="term-entry__source"
          data-testid="entry-source"
        >
          <h3 class="term-entry__source-title">
            <button
              type="button"
              class="term-entry__source-name"
              title="About this dictionary"
              data-testid="entry-source-name"
              @click="showAbout(source.name)"
              v-html="source.label"
            />
          </h3>
          <entries-entry
            v-for="(entry, index) in source.entries"
            :key="`${source.id}-${index}`"
            :entry="entry"
            hide-dictionary
          />
        </section>
      </div>

      <button
        v-if="compact"
        type="button"
        class="term-entry__open"
        data-testid="entry-open"
        @click="$emit('open-entry', headword)"
      >
        Open entry
        <ui-icon name="arrow-right" :size="16" />
      </button>
    </template>

    <template v-else>
      <p class="term-entry__empty" data-testid="entry-empty">No definitions found for this term.</p>
      <uninstalled-packs-notice :result-count="0" />
    </template>

    <dictionary-about-dialog v-model="aboutOpen" :dictionary="aboutDictionary" />
    <quick-add-dialog v-model="quickAddOpen" :term="headword" @saved="load" />
  </article>
</template>

<style scoped>
.term-entry {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  color: var(--ink);
  font-family: var(--font-ui);
}

.term-entry__header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.term-entry__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}
.term-entry__headword {
  min-width: 0;
  margin: 0;
  font-family: var(--font-tibetan);
  font-size: var(--text-headword-xl);
  font-weight: 600;
  line-height: 1.2;
  color: var(--rubric);
  overflow-wrap: anywhere;
}
.term-entry__actions {
  flex: none;
  display: flex;
  gap: var(--space-2);
  padding-top: 10px;
}
.term-entry__save.is-saved {
  color: var(--accent);
  border-color: var(--accent-line);
  background: var(--accent-soft);
}
.term-entry__transcription {
  margin: 0;
  font-size: var(--text-body);
  color: var(--muted);
  overflow-wrap: anywhere;
}

.term-entry__loading {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) 0;
  color: var(--muted);
  font-size: var(--text-body);
}
.term-entry__empty {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-body);
}

/* A dictionary: its name, then its definitions */
.term-entry__sources {
  display: flex;
  flex-direction: column;
}
.term-entry__source {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 0;
  border-top: 1px solid var(--line-soft);
}
.term-entry__source:first-child {
  padding-top: 4px;
  border-top: 0;
}
.term-entry__source-title {
  margin: 0;
}
.term-entry__source-name {
  max-width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: var(--muted);
  font: 600 var(--text-xs) / 1.4 var(--font-ui);
  letter-spacing: 0.02em;
  text-align: left;
  cursor: pointer;
}
.term-entry__source-name:hover {
  color: var(--ink);
  text-decoration: underline;
}
.term-entry__source-name:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}
.term-entry__source-name :deep(.tibetan) {
  font-size: 1.15em;
}

/* Definitions: plain paragraphs under the name; the copy button of each sits
   at its top right, shown on hover where there is one */
.term-entry__source :deep(.entry-row) {
  position: relative;
  gap: 0;
  padding: 0 2.25rem 0 0;
  border-bottom: 0;
}
.term-entry__source :deep(.entry-row + .entry-row) {
  margin-top: var(--space-3);
}
.term-entry__source :deep(.entry-header) {
  position: absolute;
  top: -4px;
  right: 0;
  min-height: 0;
}
.term-entry__source :deep(.copy-button) {
  width: 1.875rem;
  height: 1.875rem;
}
@media (hover: hover) {
  .term-entry__source :deep(.copy-button:not(.is-copied)) {
    opacity: 0;
  }
  .term-entry__source :deep(.entry-row:hover .copy-button),
  .term-entry__source :deep(.copy-button:focus-visible) {
    opacity: 1;
  }
}

.term-entry__open {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 2.25rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font: 600 var(--text-sm-plus) var(--font-ui);
  cursor: pointer;
}
.term-entry__open:hover {
  text-decoration: underline;
}
.term-entry__open:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* The Reader panel's condensed entry */
.term-entry--compact {
  gap: 14px;
}
.term-entry--compact .term-entry__headword {
  font-size: var(--text-headword-lg);
}
.term-entry--compact .term-entry__source {
  padding: 12px 0;
}
.term-entry--compact .term-entry__source:first-child {
  padding-top: 0;
}
.term-entry--compact :deep(.in-short) {
  background: var(--bg-quiet);
  border-radius: var(--radius-xl);
}

/* Phone: the actions on a line of their own above the headword, the
   dictionaries as one grouped card */
@media (max-width: 600px) {
  .term-entry {
    gap: 14px;
  }
  .term-entry__top {
    flex-direction: column-reverse;
    align-items: stretch;
    gap: var(--space-1);
  }
  .term-entry__headword {
    font-size: var(--text-headword-lg);
    line-height: 1.25;
  }
  .term-entry__actions {
    justify-content: flex-end;
    padding-top: 0;
  }
  .term-entry__actions :deep(.ui-button) {
    min-width: 2.75rem;
    height: 2.75rem;
    border-color: transparent;
    background: transparent;
    color: var(--accent);
  }
  .term-entry__save-label {
    display: none;
  }
  .term-entry__transcription {
    font-size: var(--text-base);
  }
  .term-entry__sources {
    padding: 0 var(--space-4);
    border-radius: var(--radius-group);
    background: var(--surface);
  }
  .term-entry__source {
    padding: 14px 0;
  }
  .term-entry__source:first-child {
    padding-top: 14px;
  }
  .term-entry__source :deep(.entry-header) {
    top: -2px;
  }
  .term-entry--compact .term-entry__sources {
    padding: 0;
    background: none;
  }
}
</style>
