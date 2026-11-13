<script>
import _ from 'underscore';

import { DEBOUNCE_SEARCH_MS } from '../../config/constants';
import { hasLatinDiacritics } from '../../services/non-wylie-input';
import SqlDatabase from '../../services/sql-database';
import Storage from '../../services/storage';
import { cleanDictionaryLabel } from '../../services/copy-service';
import { clearGlossCache } from '../../services/glosses';
import { recordTerm } from '../../services/history';
import { TIBETAN_CHAR_RE, plural, termsStartingWith } from '../../services/quick-lookup';
import { highlightSearchTerms, parseSearchQuery } from '../../services/search-query';
import { initialTypedWylie, nextTypedWylie, typedWylieFor } from '../../services/typed-wylie';
import {
  isLookupMode,
  readLookupState,
  storePreviousQuery,
  switchLookupMode,
  writeLookupState,
} from '../../services/lookup-state';
import { UiIcon, UiResizeHandle } from '../../ui';
import MobileResponsiveMixin from '../mixins/MobileResponsiveMixin';
import PaneWidthMixin from '../mixins/PaneWidthMixin';
import TermEntry from '../entry/TermEntry.vue';
import DefinitionResults from './DefinitionResults.vue';
import HeadwordResults from './HeadwordResults.vue';
import LookupField from './LookupField.vue';
import LookupHints from './LookupHints.vue';
import LookupHome from './LookupHome.vue';
import HelpButton from '../help/HelpButton.vue';

// The dictionaries as they bear on results: which are on, in which order
function dictionariesSignature() {
  return (Storage.get('dictionaries') || [])
    .filter((dictionary) => dictionary.enabled)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((dictionary) => dictionary.id)
    .join(',');
}

// Lookup: one field, Tibetan (བོད) or English (EN).
// The route carries what is looked up: /lookup/<term> selects a Tibetan term,
// /lookup?mode=en&q=<query> an English query, and `mode` alone switches.
// `dict=<name>` keeps an English search to one dictionary's definitions
// (Dictionaries' "Search its definitions"); it stays while queries change,
// until its × or a switch to བོད.
// The old /define/<term> and /search/<query> links are redirected here by
// the router. What was looked up last is kept in `lookupState`.
// Results: in བོད the headwords starting with the field (the first selected
// after a pause, as Define did), in EN the terms whose definitions match the
// query (run on Enter or after a pause, as Search did).
//
// Layout (boards Main, MobileHome, MobileResults, MobileEntry). Desktop: the
// results column with the field on top, and the entry pane (the selected
// term, or LookupHome while there is none), each scrolling on its own; the
// divider between them can be dragged (PaneWidthMixin).
// Phone: the title, the field, then LookupHome while the field is empty or
// the results; a tapped result shows its entry full screen with a back link
// (MobileResponsiveMixin's mobileShowDefinition, as Define did).
// Keyboard: Up/Down move through the results, Enter opens the English one
// highlighted, Escape clears the field.
export default {
  name: 'LookupPage',
  mixins: [
    MobileResponsiveMixin,
    PaneWidthMixin({ storageKey: 'lookupResultsWidth', cssVariable: '--results-width', min: 300, reserve: 420 }),
  ],
  components: {
    DefinitionResults,
    HeadwordResults,
    HelpButton,
    LookupField,
    LookupHints,
    LookupHome,
    TermEntry,
    UiIcon,
    UiResizeHandle,
  },
  beforeRouteEnter(to, from, next) {
    // Opened bare (sidebar, tab bar, app start): an instance kept alive goes
    // on showing what it shows; a new one takes back what was looked up last
    if (to.params.term || to.query.q) next();
    else next((vm) => vm.restoreIfEmpty(to));
  },
  data() {
    const { mode } = readLookupState();
    return {
      mode,
      text: '',
      // The Wylie behind the Tibetan in the field ("typed sangs rgyas")
      typedWylieState: initialTypedWylie(),
      // What was typed in བོད when it carried Latin diacritics (kākiṇī). The
      // field turns it into Tibetan, so it is kept as typed.
      asTyped: '',
      // The term selected in བོད (the route's) and in EN (local)
      selectedTerm: '',
      selectedDefinitionTerm: '',
      // The English result Up and Down moved to, opened by Enter
      activeDefinitionTerm: '',
      // The English query whose results are shown
      query: '',
      // The dictionary an English search keeps to, by name ('' for all)
      onlyDictionary: '',
      definitionCount: 0,
      // Bumped when SqlDatabase.allTerms changes (it is not reactive)
      allTermsVersion: 0,
      // Bumped to have the results read again (dictionaries or packs changed)
      refreshKey: 0,
    };
  },
  computed: {
    typedWylie() {
      return typedWylieFor(this.typedWylieState, this.text);
    },
    matches() {
      this.allTermsVersion; // re-read when the terms change
      if (this.mode !== 'bo' || !this.text) return [];
      return termsStartingWith(SqlDatabase.allTerms, this.text);
    },
    // How the input was read, under the field
    readAs() {
      if (this.mode === 'en') {
        if (!this.query) return '';
        const where = this.onlyDictionary ? ` in ${this.onlyDictionaryLabel}` : '';
        return `Terms whose definitions say “${this.query}”${where} · ${plural(this.definitionCount, 'term')}`;
      }
      if (!this.text) return '';
      const count = plural(this.matches.length, 'term');
      return this.typedWylie ? `Wylie ${this.typedWylie} → ${this.text} · ${count}` : count;
    },
    onlyDictionaryLabel() {
      return this.onlyDictionary ? cleanDictionaryLabel(this.onlyDictionary) : '';
    },
    // The term whose entry is shown: a route term means བོད, an English
    // result is chosen locally
    entryTerm() {
      return this.mode === 'en' ? this.selectedDefinitionTerm : this.selectedTerm;
    },
    // Phone: the entry full screen instead of the field and the results
    showingEntry() {
      return this.isMobile && this.mobileShowDefinition && !!this.entryTerm;
    },
    // The highlighted English result: the one moved to, else the one open
    highlightedDefinition() {
      return this.activeDefinitionTerm || this.selectedDefinitionTerm;
    },
    // In EN the hits of the query are marked in the entry too
    entryHighlight() {
      if (this.mode !== 'en' || !this.query) return null;
      const terms = parseSearchQuery(this.query);
      return (html) => highlightSearchTerms(html, terms);
    },
  },
  watch: {
    text(value) {
      this.typedWylieState = nextTypedWylie(this.typedWylieState, value || '');
      // Kept as typed: once the field has converted part of it (kākiṇī ->
      // ཀཱཀིṇī་), it is no longer what the user would search for. A paste
      // arrives converted already, so that is all there is to keep then.
      // Text replaced by Tibetan that was not converted from what was typed
      // (a paste, a picked term) forgets it.
      if (this.mode !== 'bo' || !value) this.asTyped = '';
      else if (hasLatinDiacritics(value)) {
        if (!TIBETAN_CHAR_RE.test(value) || !this.asTyped) this.asTyped = value.trim();
      } else if (!this.asTyped || !this.typedWylie) this.asTyped = '';
      if (this.mode === 'en') {
        this.debouncedSelectFirst.cancel();
        this.debouncedRunQuery();
      } else {
        this.debouncedRunQuery.cancel();
        this.debouncedSelectFirst();
      }
    },
    $route(route, from) {
      // Kept alive while another page is open: its routes are not Lookup's
      if (!route.path.startsWith('/lookup')) return;
      this.applyRoute(route);
      // A term another page links to (Reader's "Open entry"): on a phone the
      // entry opens, not the list. Typing and tapping inside Lookup decide
      // for themselves.
      if (route.params.term && !from?.path.startsWith('/lookup')) this.setMobileShowDefinition(true);
    },
  },
  created() {
    this.debouncedSelectFirst = _.debounce(this.selectFirstMatch, DEBOUNCE_SEARCH_MS);
    this.debouncedRunQuery = _.debounce(this.runTypedQuery, DEBOUNCE_SEARCH_MS);
    this.debouncedRecordTerm = _.debounce(this.recordSelectedTerm, DEBOUNCE_SEARCH_MS);
    this.shownDictionaries = dictionariesSignature();
    this.packsChanged = false;
    if (this.$route.path.startsWith('/lookup')) {
      this.applyRoute(this.$route);
      // Created on a term: a deep link (/define/<term>) or a link from
      // another page, so on a phone the entry opens
      if (this.$route.params.term) this.setMobileShowDefinition(true);
    }
  },
  mounted() {
    this._onFocusLookup = () => this.focusField();
    window.addEventListener('focus-lookup', this._onFocusLookup);
    this._onAllTermsUpdated = () => {
      this.allTermsVersion++;
      this.packsChanged = true;
    };
    this._onDictionariesUpdated = () => {
      this.packsChanged = true;
    };
    window.addEventListener('all-terms-updated', this._onAllTermsUpdated);
    window.addEventListener('dictionaries-updated', this._onDictionariesUpdated);
  },
  activated() {
    this.refreshIfStale();
    this.$nextTick(() => this.focusField());
  },
  deactivated() {
    // A pause that ends on another page selects nothing
    this.debouncedSelectFirst.cancel();
    this.debouncedRunQuery.cancel();
    // The term selected before leaving is recorded now rather than lost
    this.debouncedRecordTerm.cancel();
    this.recordSelectedTerm();
  },
  beforeUnmount() {
    this.debouncedRecordTerm.cancel();
    window.removeEventListener('focus-lookup', this._onFocusLookup);
    window.removeEventListener('all-terms-updated', this._onAllTermsUpdated);
    window.removeEventListener('dictionaries-updated', this._onDictionariesUpdated);
    this.debouncedSelectFirst.cancel();
    this.debouncedRunQuery.cancel();
  },
  methods: {
    applyRoute(route) {
      const term = route.params.term;
      const query = route.query.q;
      this.onlyDictionary = term ? '' : route.query.dict || '';
      if (term) {
        this.selectTerm(term);
        writeLookupState({ mode: 'bo', term });
      } else if (query) {
        this.mode = 'en';
        // A query run after a pause comes back trimmed: what is typed stays
        if ((this.text || '').trim() !== query) this.text = query;
        this.query = query;
        writeLookupState({ mode: 'en', query });
      } else if (isLookupMode(route.query.mode) && route.query.mode !== this.mode) {
        this.changeMode(route.query.mode, { updateRoute: false });
      }
    },
    // As Define's setSearchTerm: what was typed stays when the selected term
    // contains it (picking ཀ་ཀ་ after typing ཀ keeps ཀ in the field)
    selectTerm(term) {
      if (this.mode !== 'bo' || !this.text || !term.includes(this.text)) this.text = term;
      this.mode = 'bo';
      if (term !== this.selectedTerm) {
        this.selectedTerm = term;
        // As Define: only the term the user stays on goes to Recent, not
        // every one Up and Down pass through
        this._termToRecord = term;
        this.debouncedRecordTerm(term);
      }
    },
    recordSelectedTerm() {
      if (this._termToRecord) recordTerm(this._termToRecord);
      this._termToRecord = null;
    },
    // The dictionaries switched on or off or reordered in Settings, or packs
    // installed or removed, since the results were read: read them again
    refreshIfStale() {
      const signature = dictionariesSignature();
      if (signature === this.shownDictionaries && !this.packsChanged) return;
      this.shownDictionaries = signature;
      this.packsChanged = false;
      clearGlossCache();
      this.refreshKey++;
    },
    // As Define: after a pause in typing, the first match is selected
    selectFirstMatch() {
      if (this.mode !== 'bo' || !this.$route.path.startsWith('/lookup')) return;
      const [first] = this.matches;
      if (first) this.openTerm(first);
      else this.selectedTerm = '';
    },
    openTerm(term) {
      const path = '/lookup/' + encodeURIComponent(term);
      if (this.$route.path !== path) this.$router.push({ path });
      // The route has the term, but it was unselected meanwhile (the field
      // emptied by hand): select it again
      else if (term !== this.selectedTerm) this.selectTerm(term);
    },
    // A tap or a click on a result: on a phone the entry opens full screen
    onSelectHeadword(term) {
      this.openTerm(term);
      this.setMobileShowDefinition(true);
    },
    onSelectDefinition(term) {
      this.selectedDefinitionTerm = term;
      this.activeDefinitionTerm = term;
      recordTerm(term);
      // The query led somewhere: it is worth keeping
      storePreviousQuery(this.query);
      this.setMobileShowDefinition(true);
    },
    // A recent or saved term: a Tibetan term, so it opens in བོད
    onOpenFromHome(term) {
      this.openTerm(term);
      this.setMobileShowDefinition(true);
    },
    // The phone's back link: the field and the results as they were
    backToResults() {
      this.showTermsList();
    },
    // Up and Down in EN: the highlight moves, Enter opens the result
    moveDefinitionHighlight(step) {
      const terms = this.$refs.definitionResults?.resultTerms() || [];
      if (!terms.length) return;
      const index = terms.indexOf(this.highlightedDefinition);
      const next = index === -1 ? (step > 0 ? 0 : -1) : index + step;
      if (next >= 0 && next < terms.length) this.activeDefinitionTerm = terms[next];
    },
    // A click on བོད / EN: the new field takes the focus (it is another
    // field, so its autofocus does not run again)
    onChooseMode(mode) {
      this.changeMode(mode);
      this.$nextTick(() => this.focusField());
    },
    selectSibling(step) {
      const index = this.matches.indexOf(this.selectedTerm);
      const next = this.matches[index + step];
      if (index + step >= 0 && next) this.openTerm(next);
    },
    // In EN, after a pause in typing, the query runs (not kept in the
    // previous queries until Enter or a result is chosen)
    runTypedQuery() {
      if (this.mode !== 'en' || !this.$route.path.startsWith('/lookup')) return;
      const query = (this.text || '').trim();
      if (!query || query === this.query) return;
      this.query = query;
      this.selectedDefinitionTerm = '';
      this.activeDefinitionTerm = '';
      writeLookupState({ query });
      this.$router.replace({ path: '/lookup', query: this.englishRoute(query) });
    },
    searchPrevious(query) {
      this.text = query;
      this.search();
    },
    restoreIfEmpty(to) {
      if (this.text) return;
      const state = readLookupState();
      const mode = isLookupMode(to.query.mode) ? to.query.mode : state.mode;
      const query = { ...to.query, mode };
      if (mode === 'bo' && state.term) {
        this.$router.replace({ path: '/lookup/' + encodeURIComponent(state.term), query, hash: to.hash });
      } else if (mode === 'en' && state.query) {
        this.$router.replace({ path: '/lookup', query: { ...query, q: state.query }, hash: to.hash });
      } else {
        this.mode = mode;
      }
    },
    // A hint's button: the other mode, with the text the hint chose
    onHintSwitch({ mode, text }) {
      this.changeMode(mode, { text });
      if (mode === 'en') this.search();
    },
    changeMode(newMode, { updateRoute = true, text: chosenText } = {}) {
      if (!isLookupMode(newMode) || newMode === this.mode) return;
      const text =
        chosenText ??
        switchLookupMode(
          { mode: this.mode, text: this.text, typedWylie: this.typedWylie, asTyped: this.asTyped },
          newMode
        );
      this.mode = newMode;
      this.text = text;
      this.onlyDictionary = '';
      // The term stays the last one selected: the text converted to Tibetan
      // may not be a term
      writeLookupState(newMode === 'en' ? { mode: newMode, query: text } : { mode: newMode });
      // The route drops the term or query of the other mode, so that a link
      // to them (a definition link to the same term) is a change again
      if (updateRoute) this.$router.replace({ path: '/lookup', query: { mode: newMode } });
    },
    // An English route's query: the query, and the dictionary kept to
    englishRoute(query) {
      return {
        mode: 'en',
        ...(query ? { q: query } : {}),
        ...(this.onlyDictionary ? { dict: this.onlyDictionary } : {}),
      };
    },
    // The ×: every dictionary again, the query kept
    searchEveryDictionary() {
      this.onlyDictionary = '';
      this.$router.replace({ path: '/lookup', query: this.englishRoute(this.query) });
      this.$nextTick(() => this.focusField());
    },
    search() {
      const query = (this.text || '').trim();
      if (!query) return;
      this.debouncedRunQuery.cancel();
      if (query !== this.query) {
        this.selectedDefinitionTerm = '';
        this.activeDefinitionTerm = '';
      }
      this.query = query;
      storePreviousQuery(query);
      this.$router.push({ path: '/lookup', query: this.englishRoute(query) });
    },
    clear() {
      this.text = '';
      if (this.mode === 'en') {
        this.query = '';
        this.selectedDefinitionTerm = '';
        this.activeDefinitionTerm = '';
      } else {
        this.selectedTerm = '';
      }
      writeLookupState(this.mode === 'en' ? { query: '' } : { term: '' });
      const route = { path: '/lookup', query: this.mode === 'en' ? this.englishRoute('') : { mode: this.mode } };
      if (this.$route.fullPath !== this.$router.resolve(route).fullPath) this.$router.push(route);
    },
    onKeydown(event) {
      const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
      if (event.key === 'Escape') {
        if (!this.text) return;
        event.preventDefault();
        this.clear();
      } else if (this.mode === 'en') {
        if (event.key === 'Enter') this.openHighlightedOrSearch();
        else if (step) {
          event.preventDefault();
          this.moveDefinitionHighlight(step);
        }
      } else if (step) {
        event.preventDefault();
        this.selectSibling(step);
      }
    },
    // Enter in EN: the result moved to with Up and Down opens; a query
    // changed since is searched
    openHighlightedOrSearch() {
      const query = (this.text || '').trim();
      if (this.activeDefinitionTerm && query === this.query) {
        this.onSelectDefinition(this.activeDefinitionTerm);
      } else {
        this.search();
      }
    },
    focusField() {
      this.$refs.field?.focus();
    },
  },
};
</script>

<template>
  <section
    class="lookup-page"
    :class="{ 'is-phone': isMobile, 'is-showing-entry': showingEntry }"
    :style="isMobile ? undefined : paneWidthStyle"
    data-testid="lookup-page"
  >
    <div v-show="!showingEntry" class="lookup-results-pane" data-testid="lookup-results-pane">
      <div class="lookup-page__head">
        <div v-if="isMobile" class="lookup-page__title-row">
          <h1 class="lookup-page__title">Lookup</h1>
          <help-button />
        </div>
        <h1 v-else class="lookup-page__title ui-visually-hidden">Lookup</h1>
        <lookup-field
          ref="field"
          v-model="text"
          :mode="mode"
          :typed-wylie="typedWylie"
          :read-as="readAs"
          @update:mode="onChooseMode"
          @keydown="onKeydown"
          @clear="clear"
          @submit="search"
        />
        <div v-if="mode === 'en' && onlyDictionary" class="lookup-only" data-testid="lookup-only">
          <ui-icon name="book-open" :size="15" class="lookup-only__icon" />
          <span class="lookup-only__text">Only in <strong>{{ onlyDictionaryLabel }}</strong></span>
          <button
            type="button"
            class="lookup-only__clear"
            aria-label="Search every dictionary"
            title="Search every dictionary"
            @click="searchEveryDictionary"
          >
            <ui-icon name="x" :size="15" />
          </button>
        </div>
        <lookup-hints
          :mode="mode"
          :text="text"
          :typed-wylie="typedWylie"
          :as-typed="asTyped"
          :headword-count="matches.length"
          @switch="onHintSwitch"
        />
      </div>
      <div class="lookup-page__list">
        <template v-if="mode === 'bo'">
          <headword-results
            v-if="text"
            :terms="matches"
            :selected="selectedTerm"
            :refresh-key="refreshKey"
            @select="onSelectHeadword"
          />
          <lookup-home v-else-if="isMobile" phone @open="onOpenFromHome" />
        </template>
        <template v-else>
          <definition-results
            ref="definitionResults"
            :query="query"
            :selected="highlightedDefinition"
            :refresh-key="refreshKey"
            :dictionary="onlyDictionary"
            @select="onSelectDefinition"
            @search="searchPrevious"
            @count="definitionCount = $event"
          />
          <lookup-home v-if="isMobile && !text" phone @open="onOpenFromHome" />
        </template>
      </div>
    </div>

    <ui-resize-handle
      v-if="!isMobile"
      :model-value="paneWidth"
      :min="300"
      :max="720"
      :reserve="420"
      label="Resize the results"
      @update:model-value="setPaneWidth"
      @reset="setPaneWidth(null)"
    />
    <div v-show="!isMobile || showingEntry" class="lookup-entry-pane" data-testid="lookup-entry-pane">
      <div class="lookup-entry-pane__inner">
        <term-entry v-if="entryTerm" :term="entryTerm" :highlight="entryHighlight">
          <template v-if="isMobile" #leading>
            <button type="button" class="lookup-back" data-testid="lookup-back" @click="backToResults">
              <ui-icon name="chevron-left" :size="22" :stroke-width="2.4" />Lookup
            </button>
          </template>
        </term-entry>
        <lookup-home v-else-if="!isMobile" @open="onOpenFromHome" />
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Desktop: the results column (field on top) and the entry pane, each
   scrolling on its own (board Main) */
.lookup-page {
  box-sizing: border-box;
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-ui);
}

.lookup-results-pane {
  flex: none;
  display: flex;
  flex-direction: column;
  width: var(--results-width);
  min-height: 0;
  border-right: 1px solid var(--line);
}

.lookup-page__head {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: 1px solid var(--line-soft);
}

.lookup-only {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  align-self: flex-start;
  max-width: 100%;
  min-height: var(--control-sm);
  padding: 0 4px 0 10px;
  border: 1px solid var(--accent-line);
  border-radius: var(--radius-md);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: var(--text-sm);
}
.lookup-only__icon {
  flex: none;
}
.lookup-only__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lookup-only__clear {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: inherit;
  cursor: pointer;
}
.lookup-only__clear:hover {
  background: var(--accent-line);
}
.lookup-only__clear:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.lookup-page__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lookup-page__title {
  margin: 0;
  font-size: var(--text-large-title);
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.lookup-page__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.lookup-entry-pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.lookup-entry-pane__inner {
  box-sizing: border-box;
  max-width: var(--entry-max-width);
  margin: 0 auto;
  padding: var(--space-8) calc(var(--space-8) + var(--space-2));
}

/* With nothing selected, the home sits in the entry pane */
.lookup-entry-pane__inner > .lookup-home {
  max-width: 30rem;
}

.lookup-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 2.75rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font: var(--text-md) var(--font-ui);
  cursor: pointer;
}

.lookup-back:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* A narrow entry pane (a small window): less padding, a smaller headword */
@media (max-width: 1180px) {
  .lookup-page:not(.is-phone) .lookup-entry-pane__inner {
    padding: var(--space-6) var(--space-6);
  }
  .lookup-page:not(.is-phone) .lookup-entry-pane :deep(.term-entry__headword) {
    font-size: var(--text-headword-lg);
  }
}

/* Phone: one column on the grouped ground, as high as what the software
   keyboard leaves visible (--visible-height, set from visualViewport) so it
   never covers the results (boards MobileHome, MobileResults, MobileEntry) */
.lookup-page.is-phone {
  flex-direction: column;
  height: min(100%, calc(var(--visible-height, 100dvh) - var(--safe-top)));
  background: var(--bg-grouped);
}

.lookup-page.is-phone .lookup-results-pane {
  flex: 1;
  width: auto;
  border-right: 0;
}

.lookup-page.is-phone .lookup-page__head {
  gap: var(--space-3);
  padding: 22px var(--space-4) 0;
  border-bottom: 0;
}

.lookup-page.is-phone .lookup-page__list {
  overflow-y: auto;
  padding: 14px var(--space-4) var(--space-6);
}

/* The results as one white group */
.lookup-page.is-phone .lookup-page__list :deep(.lookup-results__list) {
  border-radius: var(--radius-group);
  background: var(--surface);
  overflow: hidden;
}

.lookup-page.is-phone .lookup-page__list :deep(.lookup-result) {
  padding: 10px var(--space-4);
}

.lookup-page.is-phone .lookup-page__list :deep(.lookup-result:last-of-type) {
  border-bottom: 0;
}

/* The recent searches line up with the home's sections */
.lookup-page.is-phone .lookup-page__list :deep(.lookup-previous) {
  padding: 0 var(--space-1);
}

.lookup-page.is-phone .lookup-page__list > .lookup-home {
  margin-top: var(--space-2);
}

.lookup-page.is-phone .lookup-entry-pane {
  flex: 1;
}

.lookup-page.is-phone .lookup-entry-pane__inner {
  padding: 14px var(--space-4) var(--space-6);
}
</style>
