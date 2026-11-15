<script>
import Decorator from '../../services/decorator';
import CopyService, { cleanDictionaryLabel } from '../../services/copy-service';
import SqlDatabase from '../../services/sql-database';
import Storage from '../../services/storage';
import { getScanInfo } from '../../services/scan-service';
import { inShort } from '../../services/in-short';
import DictionariesDetails from '../../services/dictionaries-details';
import { directionLabel } from '../../services/dictionary-catalog';
import { isSaved, toggleSaved } from '../../services/saved-terms';
import { wylieFor, phoneticsForTerm } from '../../services/transcription';
import { supportsModularPacks } from '../../config/platform';
import { getAudioUrl } from '../../services/audio-service';
import { entryAudio, highlightTerm } from '../../services/entry-audio';
import { tibetanLookupKey } from '../../utils';
import { UiButton, UiCollapse, UiIcon, UiSpinner } from '../../ui';
import DictionariesMenuMixin from '../DictionariesMenuMixin';
import EntriesEntry from '../EntriesEntry.vue';
import DictionaryAboutDialog from '../DictionaryAboutDialog.vue';
import QuickAddDialog from '../QuickAddDialog.vue';
import UninstalledPacksNotice from '../UninstalledPacksNotice.vue';
import DictionaryFilter from './DictionaryFilter.vue';
import InShort from './InShort.vue';

// How many dictionaries the condensed entry (Reader panel) shows
const COMPACT_DICTIONARIES = 3;

// One Tibetan term as a page: the headword, its Wylie and phonetics, what the
// dictionaries agree on (In short), a filter to show one dictionary, then the
// definitions grouped by dictionary in the user's order, enabled dictionaries
// only.
//
// `compact` is the Reader panel's version: a smaller headword, no filter, the
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
    DictionaryFilter,
    EntriesEntry,
    InShort,
    QuickAddDialog,
    UiButton,
    UiCollapse,
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
      quickAddOpen: false,
      // The recording playing: 'word', 'example' or null
      playing: null,
      // In context folded unless the user opened it (kept for every entry)
      contextOpen: Storage.get('entryContextOpen') === true
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
    // The filter's list: each dictionary of the term with its count; two
    // that share a name (Hopkins Synonyms 1992, Tib↔En and Tib) are told
    // apart by their languages
    filterDictionaries() {
      const names = this.dictionaryGroups.map((group) => cleanDictionaryLabel(group.name));
      return this.dictionaryGroups.map((group, index) => {
        const text = names[index];
        const twin = names.filter((name) => name === text).length > 1;
        const languages = twin ? directionLabel(DictionariesDetails[group.name]?.language) : '';
        return {
          id: group.id,
          text: languages ? `${text} (${languages})` : text,
          count: group.entries.length,
        };
      });
    },
    // A chosen dictionary that is no longer there (switched off) is no filter
    activeDictionaryId() {
      return this.filterDictionaries.some((dictionary) => dictionary.id === this.selectedDictionaryId)
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
    // The word's and the example sentence's recordings, from a Heart of
    // Tibetan Language entry of the term
    audio() {
      return entryAudio(this.shownEntries);
    },
    exampleParts() {
      return this.audio?.example ? highlightTerm(this.audio.example.tibetan, this.headword) : [];
    },
    canAddToLexicon() {
      return supportsModularPacks();
    }
  },
  watch: {
    term: {
      immediate: true,
      handler() {
        this.stopAudio();
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
  deactivated() {
    this.stopAudio();
  },
  beforeUnmount() {
    this.stopAudio();
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
    // One recording at a time: starting one stops the other, and the same
    // button again stops it
    toggleContext() {
      this.contextOpen = !this.contextOpen;
      Storage.set('entryContextOpen', this.contextOpen);
      // Folded away while its sentence plays: it stops
      if (!this.contextOpen && this.playing === 'example') this.stopAudio();
    },
    async toggleAudio(kind) {
      if (this.playing === kind) {
        this.stopAudio();
        return;
      }
      this.stopAudio();
      const file = kind === 'word' ? this.audio?.word : this.audio?.example?.file;
      if (!file) return;
      this.playing = kind;
      const token = (this._audioToken = (this._audioToken || 0) + 1);
      try {
        const url = await getAudioUrl(this.audio.audioId, file);
        if (token !== this._audioToken) return;
        const player = (this._player = new Audio(url));
        player.addEventListener('ended', () => {
          if (token === this._audioToken) this.playing = null;
        });
        player.addEventListener('error', () => this.audioFailed(token));
        await player.play();
      } catch (error) {
        this.audioFailed(token);
      }
    },
    audioFailed(token) {
      if (token !== this._audioToken) return;
      this.playing = null;
      if (this.snackbar) this.snackbar.open('Could not play the recording');
      else console.warn('[TermEntry] Could not play the recording');
    },
    stopAudio() {
      this._audioToken = (this._audioToken || 0) + 1;
      if (this._player) {
        this._player.pause();
        this._player = null;
      }
      this.playing = null;
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
      } catch (error) {
        // Definitions that cannot be read show as none, with the usual notice
        if (token !== this._loadToken) return;
        console.warn('[TermEntry] Definitions not loaded', error);
        this.entries = [];
        this.$emit('loaded', 0);
      } finally {
        if (token === this._loadToken) this.loading = false;
      }
    },
    // A pack was installed or removed, or a dictionary switched on or off or
    // moved. Only new or removed dictionaries can change what the database
    // holds for the term; otherwise the entries already read are filtered and
    // ordered again, without the spinner.
    refreshDictionaries() {
      const ids = (dictionaries) => dictionaries.map((dictionary) => dictionary.id).sort().join(',');
      const before = ids(this.dictionaries);
      this.dictionaries = Storage.get('dictionaries').map((dictionary) => ({
        ...dictionary,
        enabledInPreferences: dictionary.enabled
      }));
      if (ids(this.dictionaries) !== before || this.loading) {
        this.load();
        return;
      }
      this.resetDictionariesToDefaultAndSetNumberOfEntries();
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
    :class="{ 'term-entry--compact': compact, 'term-entry--hits': !!highlight }"
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
          <!-- What the caller puts before the actions (the phone's back link) -->
          <div v-if="$slots.leading" class="term-entry__leading"><slot name="leading" /></div>
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
      <p class="term-entry__transcription" data-testid="entry-transcription">{{ transcription }}<button
          v-if="audio?.word"
          type="button"
          class="term-entry__listen"
          :aria-label="`Listen to ${headword}`"
          data-testid="entry-listen"
          @click="toggleAudio('word')"
        >
          <ui-icon :name="playing === 'word' ? 'pause' : 'volume-2'" :size="16" />
          {{ playing === 'word' ? 'Playing' : 'Listen' }}
        </button></p>
    </header>

    <div v-if="loading" class="term-entry__loading" data-testid="entry-loading">
      <ui-spinner :size="32" />
      <span>Loading definitions...</span>
    </div>

    <template v-else-if="shownEntries.length">
      <in-short :glosses="glosses" />

      <section
        v-if="!compact && audio?.example"
        class="term-entry__context"
        aria-label="In context"
        data-testid="entry-context"
      >
        <button
          type="button"
          class="term-entry__context-toggle"
          :aria-expanded="contextOpen ? 'true' : 'false'"
          data-testid="entry-context-toggle"
          @click="toggleContext"
        >
          <ui-icon name="chevron-right" :size="14" class="term-entry__context-chevron" :class="{ 'is-open': contextOpen }" />
          <span class="term-entry__context-label">In context</span>
          <span v-if="!contextOpen" class="term-entry__context-hint">Hear the term in a sentence</span>
        </button>
        <ui-collapse>
        <div v-if="contextOpen" class="term-entry__context-row">
          <button
            type="button"
            class="term-entry__context-play"
            aria-label="Play the sentence"
            data-testid="entry-context-play"
            @click="toggleAudio('example')"
          >
            <ui-icon
              :name="playing === 'example' ? 'pause' : 'play'"
              :size="14"
              fill="currentColor"
            />
          </button>
          <div class="term-entry__context-text">
            <p class="term-entry__context-tibetan"><template v-for="(part, index) in exampleParts" :key="index"><mark v-if="part.match">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></p>
            <p class="term-entry__context-translation">{{ audio.example.translation }}</p>
            <small class="term-entry__context-source">{{ audio.label }}</small>
          </div>
        </div>
        </ui-collapse>
      </section>

      <dictionary-filter
        v-if="!compact"
        :model-value="activeDictionaryId"
        @update:model-value="selectedDictionaryId = $event"
        :dictionaries="filterDictionaries"
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
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
}
/* A headword too long to share its line with the actions keeps the whole
   width and the actions go below it. Its lines are spaced for the stacks
   above and below them; the negative margins take that room back from a
   single line, so it sits where a 1.2 line height would put it */
.term-entry__headword {
  min-width: 0;
  margin: -0.125em 0;
  font-family: var(--font-tibetan);
  font-size: var(--text-headword-xl);
  font-weight: 600;
  line-height: 1.45;
  color: var(--rubric);
  overflow-wrap: anywhere;
}
.term-entry__actions {
  flex: none;
  display: flex;
  gap: var(--space-2);
  padding-top: 10px;
}
.term-entry__leading {
  display: flex;
  align-items: center;
  margin-right: auto;
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

/* Listen: the pronunciation's recording, at the end of its line */
.term-entry__listen {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 10px;
  padding: 3px 10px 3px 8px;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent);
  font: 500 var(--text-sm) var(--font-ui);
  vertical-align: middle;
  cursor: pointer;
}
.term-entry__listen:hover {
  background: var(--accent-line);
}
.term-entry__listen:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* In context: folded to one quiet line, the sentence with the term to read
   and hear once opened (kept open for every entry when the user wants it).
   The label is In short's */
.term-entry__context {
  margin: 10px 0 4px;
}
.term-entry__context-toggle {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--faint);
  cursor: pointer;
}
.term-entry__context-toggle:hover .term-entry__context-hint {
  color: var(--ink);
}
.term-entry__context-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}
.term-entry__context-chevron {
  align-self: center;
  transition: transform 0.15s;
}
.term-entry__context-chevron.is-open {
  transform: rotate(90deg);
}
.term-entry__context-label {
  font: 600 var(--text-caption) / 1.3 var(--font-ui);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.term-entry__context-hint {
  font: var(--text-sm) var(--font-ui);
  color: var(--muted);
}
.term-entry__context-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-top: 6px;
  padding: 14px 18px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
}
.term-entry__context-play {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
  cursor: pointer;
}
.term-entry__context-play:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.term-entry__context-text {
  min-width: 0;
}
.term-entry__context-text p {
  margin: 0;
  overflow-wrap: anywhere;
}
.term-entry__context-tibetan {
  font-family: var(--font-tibetan);
  font-size: 1.5rem;
  line-height: 1.6;
  color: var(--ink);
}
.term-entry__context-tibetan mark {
  background: none;
  color: var(--rubric);
  border-bottom: 2px solid var(--accent-line);
}
.term-entry__context-translation {
  font-family: var(--font-serif);
  font-size: 1.0625rem;
  line-height: 1.5;
  color: var(--muted);
}
.term-entry__context-source {
  display: block;
  margin-top: 4px;
  font-size: var(--text-xs);
  color: var(--faint);
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

/* The hits of a search (`highlight`), as Search marks them: Latin on
   yellow, Tibetan underlined in yellow */
.term-entry--hits .term-entry__source :deep(em) {
  font-style: normal;
  background: var(--hit-bg);
  color: var(--on-hit-bg);
  border-radius: 2px;
}
.term-entry--hits .term-entry__source :deep(.tibetan em) {
  background: none;
  color: inherit;
  text-decoration: underline var(--hit-bg) 3px;
  text-underline-offset: 4px;
}

/* The Reader panel's condensed entry */
.term-entry--compact {
  gap: 14px;
}
.term-entry--compact .term-entry__headword {
  font-size: var(--text-headword-lg);
}
/* The actions on the panel's first line, level with the Reader's header */
.term-entry--compact .term-entry__actions {
  padding-top: 0;
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
