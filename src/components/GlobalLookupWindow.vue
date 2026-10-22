<script>
import _ from 'underscore';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { readText } from '@tauri-apps/plugin-clipboard-manager';

import Entries from './Entries.vue';
import Entry from './EntriesEntry.vue';
import DictionaryAboutDialog from './DictionaryAboutDialog.vue';
import { UiButton, UiIcon, UiSpinner, UiTextField, UiTibetanField, UiToast, vIntersect } from '../ui';
import Storage from '../services/storage';
import Decorator from '../services/decorator';
import SqlDatabase from '../services/sql-database';
import AudioPlayerService from '../services/audio-player-service';
import { getHotkey, formatHotkeyForDisplay } from '../services/global-lookup';
import { applyPopupAppearance } from '../services/popup-appearance';
import { PACK_DEFINITIONS } from '../config/pack-definitions';
import { getUninstalledPacks } from '../services/dictionary-catalog';
import { mayNeedLegacyRepair } from '../services/legacy-to-unicode';
import { phoneticsFor, substituteLinksWithATags } from '../utils';
import {
  TIBETAN_CHAR_RE,
  classifyClipboardText,
  entriesForEnabledDictionaries,
  highlightInHtml,
  highlightInText,
  plural,
  sortSearchEntries,
  switchMode,
  termsStartingWith,
} from '../services/quick-lookup';

const TERMS_BATCH_SIZE = 50;
const SEARCH_BATCH_SIZE = 20;
// Below this many terms or results, a missing pack is worth mentioning
// (same threshold as the packs notice on Define and Search)
const FEW_RESULTS = 3;

function hasTauri() {
  return typeof window.__TAURI__ !== 'undefined' || typeof window.__TAURI_INTERNALS__ !== 'undefined';
}

// Board "B · Quick lookup" (PopupB): the window the global hotkey opens with
// the clipboard's text. A bar (where it came from, Define/Search, Esc), the
// field, then in Define the terms starting with the text beside the selected
// term in large Tibetan and its definitions; in Search the full-text results.
// A separate Tauri window with its own Vue instance (src/popup.js); on macOS
// an NSPanel that does not take the focus from the app you copied from.
export default {
  components: {
    Entries,
    Entry,
    DictionaryAboutDialog,
    UiButton,
    UiIcon,
    UiSpinner,
    UiTextField,
    UiTibetanField,
    UiToast,
  },
  directives: { intersect: vIntersect },
  // Entry rows report "Copied" and abbreviations through the snackbar; the
  // main window provides one from main.js, this window its own toast.
  provide() {
    return { snackbar: this.snackbar };
  },
  data() {
    return {
      // 'define' = terms starting with the text; 'search' = full-text search
      mode: 'define',
      searchTerm: '',
      selectedTerm: null,
      entries: [],
      initializing: true,
      displayedTermsCount: TERMS_BATCH_SIZE,
      loadingEntries: false,
      allTerms: [],
      searchEntries: [],
      searchLoading: false,
      searchDisplayCount: SEARCH_BATCH_SIZE,
      // Last Define value of this session, restored when Search holds Latin text
      lastDefineTerm: '',
      // The field's text came from the clipboard (not typed since)
      fromClipboard: false,
      // The Wylie the clipboard held, when the field shows it converted
      clipboardWylie: '',
      lastClipboardText: null,
      dictionaries: Storage.get('dictionaries') || [],
      uninstalledPacks: [],
      aboutOpen: false,
      aboutDictionary: '',
      hotkeyLabel: formatHotkeyForDisplay(getHotkey()),
      snackbar: {
        show: false,
        content: '',
        open(text) {
          this.content = text;
          this.show = true;
        },
        close() {
          this.show = false;
        },
      },
    };
  },
  computed: {
    title() {
      return this.fromClipboard ? 'From your clipboard' : 'Quick lookup';
    },
    // Tibetan is valid in Search too; it then gets the Tibetan font and size
    searchHasTibetan() {
      return TIBETAN_CHAR_RE.test(this.searchTerm || '');
    },
    termsStartingWithSearchTerm() {
      return termsStartingWith(this.allTerms, this.searchTerm);
    },
    visibleTerms() {
      return this.termsStartingWithSearchTerm.slice(0, this.displayedTermsCount);
    },
    hasMoreTerms() {
      return this.displayedTermsCount < this.termsStartingWithSearchTerm.length;
    },
    numberOfTerms() {
      return this.termsStartingWithSearchTerm.length;
    },
    selectedTermIndex() {
      return this.termsStartingWithSearchTerm.indexOf(this.selectedTerm);
    },
    visibleEntries() {
      return entriesForEnabledDictionaries(this.entries, this.dictionaries);
    },
    hiddenEntriesCount() {
      return this.entries.length - this.visibleEntries.length;
    },
    headwordWylie() {
      // Only when the headword is exactly what the copied Wylie converted to
      return this.clipboardWylie && this.selectedTerm === this.searchTerm ? this.clipboardWylie : '';
    },
    headwordPhonetics() {
      if (!this.selectedTerm) return '';
      try {
        return phoneticsFor('english-loose', this.selectedTerm);
      } catch (err) {
        return '';
      }
    },
    sortedSearchEntries() {
      return sortSearchEntries(
        entriesForEnabledDictionaries(this.searchEntries, this.dictionaries),
        this.searchTerm
      );
    },
    visibleSearchEntries() {
      return this.sortedSearchEntries.slice(0, this.searchDisplayCount).map((entry) => ({
        ...entry,
        definition: highlightInHtml(Decorator.decorate(entry), this.searchTerm),
        highlightedTerm: highlightInText(entry.term, this.searchTerm),
      }));
    },
    hasMoreSearchEntries() {
      return this.searchDisplayCount < this.sortedSearchEntries.length;
    },
    resultCount() {
      return this.mode === 'search' ? this.sortedSearchEntries.length : this.numberOfTerms;
    },
    packsNotice() {
      if (!this.searchTerm || !this.uninstalledPacks.length || this.resultCount >= FEW_RESULTS) return '';
      const names = this.uninstalledPacks.map((pack) => pack.name).join(', ');
      const count = this.uninstalledPacks.length;
      return `${count === 1 ? '1 pack was' : `${count} packs were`} not searched: ${names}. Install from Dictionaries in the main window.`;
    },
  },
  watch: {
    searchTerm() {
      if (!this._applyingClipboard) {
        this.fromClipboard = false;
        this.clipboardWylie = '';
      }
      this.displayedTermsCount = TERMS_BATCH_SIZE;
      if (this.mode === 'search') {
        this.runFullTextSearchDebounced();
        if (this.selectedTerm) {
          this.entries = [];
          this.selectedTerm = null;
        }
        return;
      }
      // Clear stale entries if the selected term is no longer in the list
      if (this.selectedTerm && this.termsStartingWithSearchTerm.indexOf(this.selectedTerm) === -1) {
        this.entries = [];
        this.selectedTerm = null;
      }
      // Select the first term at once (no debounce: the window is a glance)
      this.$nextTick(() => this.selectTermByIndex(0));
    },
    mode(mode) {
      if (mode === 'search') this.runFullTextSearch();
      else this.$nextTick(() => this.selectTermByIndex(0));
      this.$nextTick(() => this.focusInput());
    },
  },
  methods: {
    focusInput() {
      this.$refs.input?.focus();
    },
    async selectTermByIndex(index) {
      const terms = this.termsStartingWithSearchTerm;
      if (index < 0 || index >= terms.length) return;
      const term = terms[index];
      if (index >= this.displayedTermsCount) this.displayedTermsCount = index + TERMS_BATCH_SIZE;
      if (term === this.selectedTerm && (this.entries.length || this.loadingEntries)) {
        this.scrollSelectedTermIntoView();
        return;
      }

      this.selectedTerm = term;
      this.loadingEntries = true;
      // Up/Down can outrun the database: only the last request may land
      const request = (this._entriesRequest = (this._entriesRequest || 0) + 1);
      let entries = [];
      try {
        entries = await this.getEntriesForTerm(term);
      } catch (error) {
        console.error('[GlobalLookupWindow] Error fetching entries:', error);
      }
      if (request !== this._entriesRequest) return;
      this.entries = entries || [];
      this.loadingEntries = false;
      this.scrollSelectedTermIntoView();
    },
    selectTerm(term) {
      const index = this.termsStartingWithSearchTerm.indexOf(term);
      if (index !== -1) this.selectTermByIndex(index);
    },
    scrollSelectedTermIntoView() {
      this.$nextTick(() => {
        const active = this.$refs.termsList?.querySelector('.term-item.is-active');
        active?.scrollIntoView?.({ block: 'nearest' });
      });
    },
    async getEntriesForTerm(term) {
      try {
        return await invoke('pack_get_entries_for_term', { term });
      } catch (error) {
        console.error('[GlobalLookupWindow] Error getting entries via IPC:', error);
        return SqlDatabase.getEntriesFor(term);
      }
    },
    async runFullTextSearch() {
      const query = (this.searchTerm || '').trim();
      this.searchDisplayCount = SEARCH_BATCH_SIZE;
      if (!query) {
        this.searchEntries = [];
        return;
      }
      this.searchLoading = true;
      const request = (this._searchRequest = (this._searchRequest || 0) + 1);
      let entries = [];
      try {
        entries = await invoke('pack_search_entries', { query, searchType: 'definition' });
      } catch (err) {
        console.error('[GlobalLookupWindow] Full-text search failed:', err);
      }
      if (request !== this._searchRequest) return;
      this.searchEntries = entries || [];
      this.searchLoading = false;
    },
    loadMoreTerms(isIntersecting) {
      if (isIntersecting !== false && this.hasMoreTerms) this.displayedTermsCount += TERMS_BATCH_SIZE;
    },
    loadMoreSearchEntries(isIntersecting) {
      if (isIntersecting !== false && this.hasMoreSearchEntries) this.searchDisplayCount += SEARCH_BATCH_SIZE;
    },
    setText(text) {
      this._applyingClipboard = true;
      this.searchTerm = text;
      this.$nextTick(() => {
        this._applyingClipboard = false;
      });
    },
    /**
     * Reads the clipboard and looks it up. `onlyIfChanged` is for the focus
     * fallback: coming back to the window must not wipe what was typed when
     * the clipboard still holds what was already looked up.
     */
    async readClipboardAndSetSearch({ onlyIfChanged = false } = {}) {
      try {
        const text = await readText();
        if (!text || !text.trim()) return;
        if (onlyIfChanged && text === this.lastClipboardText) return;
        this.lastClipboardText = text;

        let raw = text.trim();
        // The Tauri clipboard exposes no HTML flavour, so a term copied out of
        // a pre-Unicode Tibetan document can only be repaired from the text
        // itself. That is enough whenever the source used a single legacy font,
        // which is the common case for a copied term.
        if (mayNeedLegacyRepair({ text: raw })) {
          const { convertLegacyPaste } = await import('../services/legacy-to-unicode');
          raw = (await convertLegacyPaste({ text: raw })) || raw;
        }

        const result = classifyClipboardText(raw, this.allTerms);
        if (!result) return;
        this.mode = result.mode;
        this.setText(result.text);
        this.fromClipboard = true;
        this.clipboardWylie = result.wylie;
        // A clipboard landing in Search starts the session's Define memory afresh
        this.lastDefineTerm = result.mode === 'define' ? result.text : '';
      } catch (err) {
        console.error('[GlobalLookupWindow] Error reading clipboard:', err);
      }
    },
    setMode(newMode) {
      const next = switchMode(
        { mode: this.mode, text: this.searchTerm, lastDefineText: this.lastDefineTerm },
        newMode
      );
      this.lastDefineTerm = next.lastDefineText;
      if (next.text !== this.searchTerm) this.searchTerm = next.text;
      this.mode = next.mode;
    },
    async loadAllTerms() {
      // Frozen: Vue then leaves the (large) list unproxied
      const terms = Object.freeze((await invoke('pack_get_all_terms')) || []);
      // The decorator links Tibetan inside definitions to terms it knows
      SqlDatabase.allTerms = terms;
      this.allTerms = terms;
    },
    async loadUninstalledPacks() {
      try {
        const installed = (await invoke('get_installed_packs')) || [];
        this.uninstalledPacks = getUninstalledPacks(
          PACK_DEFINITIONS,
          (packId) => !!PACK_DEFINITIONS[packId]?.included || installed.includes(packId)
        );
      } catch (err) {
        this.uninstalledPacks = [];
      }
    },
    // Settings live in the main window; pick up what changed there since
    refreshFromSettings() {
      this.dictionaries = Storage.get('dictionaries') || [];
      this.hotkeyLabel = formatHotkeyForDisplay(getHotkey());
      applyPopupAppearance();
    },
    async onPanelShown() {
      this.refreshFromSettings();
      // Read the clipboard at once so the copied word appears without waiting
      // for the term list, which can take hundreds of ms with many packs; the
      // list re-filters when the refresh lands.
      this.readClipboardAndSetSearch();
      this.focusInput();
      this.loadAllTerms().catch((err) => {
        console.warn('[GlobalLookupWindow] Could not refresh allTerms on panel-shown:', err);
      });
      this.loadUninstalledPacks();
    },
    async close() {
      try {
        // NSPanel orderOut on macOS: hides without moving the focus, so the
        // app you copied from stays active
        await invoke('hide_lookup_panel');
      } catch (err) {
        console.error('Error closing window:', err);
        try {
          await getCurrentWindow().hide();
        } catch (e) {
          console.error('Fallback hide also failed:', e);
        }
      }
    },
    dialogIsOpen() {
      return !!document.querySelector('[role="dialog"]');
    },
    handleKeydown(event) {
      // The About dialog and the scan viewer handle their own keys
      if (this.dialogIsOpen()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.close();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        this.setMode(this.mode === 'define' ? 'search' : 'define');
      } else if (this.mode === 'define' && event.key === 'ArrowDown') {
        event.preventDefault();
        this.selectTermByIndex(this.selectedTermIndex + 1);
      } else if (this.mode === 'define' && event.key === 'ArrowUp') {
        event.preventDefault();
        this.selectTermByIndex(this.selectedTermIndex - 1);
      }
    },
    // Links and abbreviations inside definitions. The main window routes
    // /define/ links; here they look the term up in this window instead of
    // letting the webview navigate away from popup.html.
    handleDefinitionClick(event) {
      const link = event.target.closest?.(".definition a[href^='/define/']");
      if (link) {
        event.preventDefault();
        const term = decodeURIComponent(link.getAttribute('href').replace('/define/', ''));
        this.setMode('define');
        this.searchTerm = term;
        return;
      }
      const abbreviation = event.target.closest?.('.definition abbr');
      if (abbreviation) {
        this.snackbar.open(substituteLinksWithATags(abbreviation.getAttribute('data-title') || ''));
      }
    },
    async startDrag(event) {
      // Buttons and fields in the bar keep their own clicks
      if (event.button !== 0 || event.target.closest('button, input, a')) return;
      try {
        await getCurrentWindow().startDragging();
      } catch (err) {
        console.error('Error starting drag:', err);
      }
    },
    showAbout(dictionary) {
      this.aboutDictionary = dictionary;
      this.aboutOpen = true;
    },
    plural,
  },
  async created() {
    // Debounced so typing quickly does not hammer Rust
    this.runFullTextSearchDebounced = _.debounce(() => this.runFullTextSearch(), 150);

    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!hasTauri()) {
      console.error('[GlobalLookupWindow] Tauri not available!');
      this.initializing = false;
      return;
    }
    try {
      await this.loadAllTerms();
    } catch (err) {
      console.error('[GlobalLookupWindow] Error loading terms via IPC:', err);
    }
    this.initializing = false;
    this.loadUninstalledPacks();
    await this.readClipboardAndSetSearch();
  },
  async mounted() {
    document.addEventListener('keydown', this.handleKeydown);
    document.addEventListener('click', this.handleDefinitionClick);
    AudioPlayerService.initialize();

    if (!hasTauri()) return;
    try {

      // macOS: turn the window into a non-activating NSPanel shown over
      // full-screen apps, hidden when it loses key status
      try {
        await invoke('configure_window_for_fullscreen');
      } catch (err) {
        console.log('[GlobalLookupWindow] Fullscreen config not available:', err);
      }

      // Emitted by show_lookup_panel on every hotkey press; more reliable than
      // focus events for an NSPanel
      this._unlistenPanelShown = await listen('panel-shown', () => this.onPanelShown());

      // Fallback when panel-shown does not come
      this._unlistenFocus = await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (focused) {
          this.refreshFromSettings();
          this.readClipboardAndSetSearch({ onlyIfChanged: true });
        }
      });
    } catch (err) {
      console.error('[GlobalLookupWindow] Error setting up listeners:', err);
    }
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
    document.removeEventListener('click', this.handleDefinitionClick);
    this.runFullTextSearchDebounced?.cancel();
    this._unlistenPanelShown?.();
    this._unlistenFocus?.();
  },
};
</script>

<template>
  <div class="quick-lookup" data-testid="quick-lookup">
    <!-- Bar: drags the window -->
    <header class="ql-bar" data-testid="ql-bar" @mousedown="startDrag">
      <div class="ql-logo" aria-hidden="true"><span>ཀ</span></div>
      <span class="ql-title" data-testid="ql-title">{{ title }}</span>
      <span class="ui-spacer" />
      <div class="ql-modes" role="group" aria-label="Mode">
        <button
          type="button"
          class="ql-mode"
          :class="{ 'is-active': mode === 'define' }"
          :aria-pressed="mode === 'define' ? 'true' : 'false'"
          data-testid="ql-mode-define"
          @click="setMode('define')"
        >
          Define
        </button>
        <button
          type="button"
          class="ql-mode"
          :class="{ 'is-active': mode === 'search' }"
          :aria-pressed="mode === 'search' ? 'true' : 'false'"
          data-testid="ql-mode-search"
          @click="setMode('search')"
        >
          Search
        </button>
      </div>
      <button type="button" class="ql-close" aria-label="Close" title="Close" data-testid="ql-close" @click="close">
        <span class="ql-close__label">Close with</span>
        <kbd class="ql-kbd">Esc</kbd>
      </button>
    </header>

    <div class="ql-search">
      <ui-tibetan-field
        v-if="mode === 'define'"
        ref="input"
        v-model="searchTerm"
        class="ql-field"
        prepend-icon="search"
        placeholder="Type or paste Tibetan"
        aria-label="Term to define"
        autofocus
        clearable
        data-testid="ql-field"
      />
      <ui-text-field
        v-else
        ref="input"
        v-model="searchTerm"
        class="ql-field ql-field--search"
        :class="{ 'has-tibetan': searchHasTibetan }"
        prepend-icon="search"
        placeholder="Search across definitions"
        aria-label="Search across definitions"
        autofocus
        clearable
        spellcheck="false"
        autocomplete="off"
        data-testid="ql-search-field"
      />
    </div>

    <div class="ql-body">
      <div v-if="initializing" class="ql-state" data-testid="ql-loading">
        <ui-spinner :size="36" label="Loading terms" />
      </div>

      <!-- Search: full-text results -->
      <template v-else-if="mode === 'search'">
        <div v-if="searchLoading && !searchEntries.length" class="ql-state" data-testid="ql-search-loading">
          <ui-spinner :size="28" label="Searching" />
        </div>
        <div v-else-if="visibleSearchEntries.length" class="ql-results" data-testid="ql-results">
          <div class="ql-caps ql-results__count" data-testid="ql-results-count">
            {{ plural(sortedSearchEntries.length, 'result') }}
          </div>
          <div
            v-for="(entry, index) in visibleSearchEntries"
            :key="`${entry.term}-${entry.dictionaryId}-${index}`"
            class="ql-result"
            data-testid="ql-result"
          >
            <div class="ql-result__term" v-html="entry.highlightedTerm" />
            <Entry :entry="entry" @show-about="showAbout" />
          </div>
          <div
            v-if="hasMoreSearchEntries"
            v-intersect="loadMoreSearchEntries"
            class="ql-more"
            data-testid="ql-results-more"
          >
            <ui-button variant="ghost" size="sm" @click="loadMoreSearchEntries()">Show more results</ui-button>
          </div>
        </div>
        <div v-else-if="searchTerm.trim()" class="ql-state" data-testid="ql-no-results">
          <p class="ql-state__title">No results for “{{ searchTerm.trim() }}”.</p>
        </div>
        <div v-else class="ql-state" data-testid="ql-search-empty">
          <ui-icon name="search" :size="28" class="ql-state__icon" />
          <p class="ql-state__title">Type to search across every definition.</p>
        </div>
      </template>

      <!-- Define: terms beside the selected term -->
      <template v-else>
        <div v-if="!searchTerm" class="ql-state" data-testid="ql-empty">
          <ui-icon name="clipboard-list" :size="28" class="ql-state__icon" />
          <p class="ql-state__title">Copy Tibetan text anywhere, then press <kbd class="ql-kbd">{{ hotkeyLabel }}</kbd></p>
          <p class="ql-state__text">Or type it above, in Tibetan or Wylie.</p>
        </div>

        <div v-else-if="!numberOfTerms" class="ql-state" data-testid="ql-no-terms">
          <p class="ql-state__title">No term starts with “<span class="ql-tibetan">{{ searchTerm }}</span>”.</p>
          <ui-button variant="outline" size="sm" data-testid="ql-search-instead" @click="setMode('search')">
            <ui-icon name="search" :size="16" />
            Search the definitions instead
          </ui-button>
        </div>

        <div v-else class="ql-define">
          <section class="ql-terms" aria-label="Terms">
            <div class="ql-caps ql-terms__count" data-testid="ql-terms-count">{{ plural(numberOfTerms, 'term') }}</div>
            <div
              ref="termsList"
              class="ql-terms__list"
              role="listbox"
              aria-label="Terms starting with the text"
              data-testid="ql-terms"
            >
              <div
                v-for="term in visibleTerms"
                :key="term"
                class="term-item"
                :class="{ 'is-active': selectedTerm === term }"
                role="option"
                :aria-selected="selectedTerm === term ? 'true' : 'false'"
                data-testid="ql-term"
                @click="selectTerm(term)"
              >{{ term }}</div>
              <div
                v-if="hasMoreTerms"
                v-intersect="loadMoreTerms"
                class="ql-more"
                data-testid="ql-terms-more"
              >
                <ui-button variant="ghost" size="sm" @click="loadMoreTerms()">More</ui-button>
              </div>
            </div>
          </section>

          <section class="ql-main" aria-label="Definitions" data-testid="ql-main">
            <div v-if="selectedTerm" class="ql-headword" data-testid="ql-headword">
              <h1 class="ql-headword__term">{{ selectedTerm }}</h1>
              <div class="ql-headword__meta">
                <span v-if="headwordWylie || headwordPhonetics" class="ql-headword__reading" data-testid="ql-reading">
                  <template v-if="headwordWylie">{{ headwordWylie }}<template v-if="headwordPhonetics"> · </template></template>{{ headwordPhonetics }}
                </span>
                <span v-if="!loadingEntries" class="ql-caps" data-testid="ql-entries-count">
                  {{ plural(visibleEntries.length, 'entry', 'entries') }}
                </span>
              </div>
            </div>

            <div v-if="loadingEntries" class="ql-state ql-state--inline" data-testid="ql-entries-loading">
              <ui-spinner :size="28" label="Loading definitions" />
            </div>
            <div v-else-if="visibleEntries.length" class="ql-entries" data-testid="ql-entries">
              <Entries :key="selectedTerm" :entries="visibleEntries" :initial-number-of-entries="25" />
            </div>
            <div v-else-if="selectedTerm" class="ql-state ql-state--inline" data-testid="ql-no-entries">
              <p class="ql-state__title">No definitions for “<span class="ql-tibetan">{{ selectedTerm }}</span>”.</p>
              <p v-if="hiddenEntriesCount" class="ql-state__text" data-testid="ql-hidden-entries">
                {{ plural(hiddenEntriesCount, 'entry is', 'entries are') }} in dictionaries turned off in Settings.
              </p>
            </div>
          </section>
        </div>
      </template>
    </div>

    <footer class="ql-footer" data-testid="ql-footer">
      <span v-if="packsNotice" class="ql-footer__notice" data-testid="ql-packs-notice">{{ packsNotice }}</span>
      <template v-else>
        <span class="ql-footer__hint"><kbd class="ql-kbd">Tab</kbd> Define or Search</span>
        <span v-if="mode === 'define'" class="ql-footer__hint"><kbd class="ql-kbd">↑</kbd><kbd class="ql-kbd">↓</kbd> Terms</span>
      </template>
    </footer>

    <DictionaryAboutDialog v-model="aboutOpen" :dictionary="aboutDictionary" />
    <ui-toast v-model="snackbar.show" :duration="3000">
      <div v-html="snackbar.content" />
    </ui-toast>
  </div>
</template>

<style lang="stylus">
html, body
  margin 0
  padding 0
  overflow hidden
  background var(--surface)
</style>

<style lang="stylus" scoped>
// Board "B · Quick lookup" (PopupB.dc.html), 560 × 480 at the default size
.quick-lookup
  box-sizing border-box
  height 100vh
  display flex
  flex-direction column
  overflow hidden
  background var(--surface)
  color var(--ink)
  font-family var(--font-ui)
  font-size var(--text-base)

.ql-kbd
  display inline-block
  font 600 var(--text-xs) var(--font-ui)
  color var(--ink)
  background var(--surface)
  border 1px solid var(--line-strong)
  border-bottom-width 2px
  border-radius var(--radius-sm)
  padding 2px 7px
  line-height 1.3
  white-space nowrap

.ql-caps
  font-size var(--text-xs)
  font-weight 600
  letter-spacing 0.08em
  text-transform uppercase
  color var(--muted)

// Bar
.ql-bar
  flex none
  box-sizing border-box
  height 3.25rem
  padding 0 14px 0 18px
  display flex
  align-items center
  gap 12px
  background var(--bg)
  border-bottom 1px solid var(--line)
  user-select none
  cursor default

.ql-logo
  flex none
  width 28px
  height 28px
  border-radius 8px
  background var(--logo-bg)
  color var(--logo-ink)
  display flex
  align-items center
  justify-content center

  span
    font-family var(--font-tibetan)
    font-size 18px
    line-height 1
    margin-top 4px

.ql-title
  font-size var(--text-sm-plus)
  font-weight 600
  white-space nowrap
  overflow hidden
  text-overflow ellipsis

.ql-modes
  flex none
  display flex
  padding 2px
  border 1px solid var(--line)
  border-radius var(--radius-lg)
  background var(--surface)

.ql-mode
  height 1.75rem
  padding 0 12px
  border 0
  border-radius 8px
  background none
  color var(--muted)
  font 500 var(--text-sm) var(--font-ui)
  cursor pointer

  &:hover
    color var(--ink)

  &.is-active
    background var(--accent-soft)
    color var(--accent)
    font-weight 600

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset 1px

.ql-close
  flex none
  display flex
  align-items center
  gap 8px
  height 2rem
  padding 0 4px
  border 0
  border-radius var(--radius-md)
  background none
  color var(--muted)
  font var(--text-chip) var(--font-ui)
  cursor pointer

  &:hover .ql-kbd
    border-color var(--accent)

  &:focus-visible
    outline 2px solid var(--accent)

// Field
.ql-search
  flex none
  padding 14px 22px 0

.ql-field
  :deep(.ui-field__control)
    min-height var(--control-md)

  :deep(.ui-field__input)
    font-size var(--text-tibetan-sm)
    padding-top 0.3rem

  :deep(.ui-field__input::placeholder)
    font-family var(--font-ui)
    font-size var(--text-base)

.ql-field--search:not(.has-tibetan) :deep(.ui-field__input)
  font-size var(--text-md)
  padding-top 0

.ql-field--search.has-tibetan :deep(.ui-field__input)
  font-family var(--font-tibetan)

// Body
.ql-body
  flex 1
  min-height 0
  display flex
  flex-direction column

.ql-state
  flex 1
  display flex
  flex-direction column
  align-items center
  justify-content center
  gap 10px
  padding 16px 22px
  text-align center
  color var(--muted)

  &--inline
    flex none
    align-items flex-start
    text-align left
    padding 14px 0

.ql-state__icon
  color var(--faint)

.ql-state__title
  margin 0
  font-size var(--text-body)
  color var(--ink)
  overflow-wrap anywhere

.ql-tibetan
  font-family var(--font-tibetan)
  font-size 1.25em

.ql-state__text
  margin 0
  font-size var(--text-sm)

.ql-more
  display flex
  justify-content center
  padding 6px 0

// Define
.ql-define
  flex 1
  min-height 0
  display flex
  gap 18px
  padding 12px 0 0 22px

.ql-terms
  flex none
  width 9.5rem
  min-height 0
  display flex
  flex-direction column
  gap 6px
  padding-bottom 12px

.ql-terms__list
  flex 0 1 auto
  min-height 0
  overflow-y auto
  overscroll-behavior contain
  border 1px solid var(--line)
  border-radius var(--radius-xl)
  background var(--surface)

.term-item
  box-sizing border-box
  height 2.5rem
  padding 0.25rem 12px 0
  display flex
  align-items center
  border-bottom 1px solid var(--soft)
  font-family var(--font-tibetan)
  font-size 1.25rem
  white-space nowrap
  overflow hidden
  text-overflow ellipsis
  cursor pointer

  &:hover
    background var(--soft)

  &.is-active
    background var(--accent)
    color var(--on-accent)
    border-bottom-color transparent

.ql-main
  flex 1
  min-width 0
  min-height 0
  overflow-y auto
  overscroll-behavior contain
  padding-right 22px
  padding-bottom 12px

.ql-headword
  display flex
  align-items center
  flex-wrap wrap
  column-gap 18px
  row-gap 2px

.ql-headword__term
  margin 0
  font-family var(--font-tibetan)
  font-weight 400
  font-size 2.75rem
  line-height 1.55
  color var(--rubric)
  overflow-wrap anywhere

.ql-headword__meta
  display flex
  flex-direction column
  gap 2px
  min-width 0

.ql-headword__reading
  font-family var(--font-serif)
  font-size 1.125rem
  color var(--muted)

// Entry rows: the board's grid, the dictionary chip in a 124 px column
.ql-entries :deep(.entry-row),
.ql-result :deep(.entry-row)
  display grid
  grid-template-columns 7.75rem minmax(0, 1fr) auto
  column-gap 14px
  align-items start
  padding 12px 0
  border-top 1px solid var(--soft)
  border-bottom 0

.ql-entries :deep(.entry-header),
.ql-result :deep(.entry-header)
  display contents

.ql-entries :deep(.dictionary-label),
.ql-result :deep(.dictionary-label)
  grid-column 1
  grid-row 1
  justify-self start

.ql-entries :deep(.copy-button),
.ql-result :deep(.copy-button)
  grid-column 3
  grid-row 1
  width 1.75rem
  height 1.75rem
  margin-top -2px

.ql-entries :deep(.definition),
.ql-entries :deep(.scanned-entry),
.ql-result :deep(.definition),
.ql-result :deep(.scanned-entry)
  grid-column 2
  grid-row 1

.ql-entries :deep(.definition),
.ql-result :deep(.definition)
  font-size var(--text-md)
  line-height 1.5

// Search
.ql-results
  flex 1
  min-height 0
  overflow-y auto
  overscroll-behavior contain
  padding 12px 22px

.ql-results__count
  padding-bottom 6px

.ql-result
  border-top 1px solid var(--line)
  padding-top 10px

  &:first-of-type
    border-top 0

  :deep(.entry-row)
    border-top 0
    padding-top 4px

.ql-result__term
  font-family var(--font-tibetan)
  font-size var(--text-tibetan-sm)
  line-height 1.6
  color var(--rubric)
  overflow-wrap anywhere

.ql-results :deep(mark)
  background var(--amber-bg)
  color var(--amber-ink)
  border-radius 2px

.ql-result__term :deep(mark)
  background none
  color inherit
  text-decoration underline var(--amber-line) 3px

// Footer
.ql-footer
  flex none
  box-sizing border-box
  min-height 3rem
  padding 8px 22px
  display flex
  align-items center
  gap 16px
  border-top 1px solid var(--line)
  background var(--bg)
  font-size var(--text-sm)
  color var(--muted)

.ql-footer__notice
  flex 1
  line-height 1.4

.ql-footer__hint
  display inline-flex
  align-items center
  gap 4px
  white-space nowrap

// Narrow window (the window's minimum is 450 px wide)
@media (max-width: 520px)
  .ql-close__label
    display none

  .ql-bar
    gap 8px
    padding 0 10px 0 14px

  .ql-search
    padding 12px 14px 0

  .ql-define
    gap 12px
    padding-left 14px

  .ql-terms
    width 7.5rem

  .ql-main
    padding-right 14px

  .ql-results
    padding 12px 14px

  .ql-footer
    padding 8px 14px

// Beside the terms list, the chip column leaves the definitions too narrow
// below this width: the chip goes above the definition instead
@media (max-width: 640px)
  .ql-entries :deep(.entry-row)
    grid-template-columns minmax(0, 1fr) auto
    row-gap 4px

  .ql-entries :deep(.dictionary-label)
    grid-column 1

  .ql-entries :deep(.copy-button)
    grid-column 2

  .ql-entries :deep(.definition),
  .ql-entries :deep(.scanned-entry)
    grid-column 1 / -1
    grid-row 2

// Search results have the whole width, so they stack only when narrower
@media (max-width: 520px)
  .ql-result :deep(.entry-row)
    grid-template-columns minmax(0, 1fr) auto
    row-gap 4px

  .ql-result :deep(.dictionary-label)
    grid-column 1

  .ql-result :deep(.copy-button)
    grid-column 2

  .ql-result :deep(.definition),
  .ql-result :deep(.scanned-entry)
    grid-column 1 / -1
    grid-row 2
</style>
