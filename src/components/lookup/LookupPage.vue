<script>
import _ from 'underscore';

import { DEBOUNCE_SEARCH_MS } from '../../config/constants';
import { hasLatinDiacritics } from '../../services/non-wylie-input';
import SqlDatabase from '../../services/sql-database';
import Storage from '../../services/storage';
import { clearGlossCache } from '../../services/glosses';
import { recordTerm } from '../../services/history';
import { TIBETAN_CHAR_RE, plural, termsStartingWith } from '../../services/quick-lookup';
import { initialTypedWylie, nextTypedWylie, typedWylieFor } from '../../services/typed-wylie';
import {
  isLookupMode,
  readLookupState,
  storePreviousQuery,
  switchLookupMode,
  writeLookupState,
} from '../../services/lookup-state';
import DefinitionResults from './DefinitionResults.vue';
import HeadwordResults from './HeadwordResults.vue';
import LookupField from './LookupField.vue';
import LookupHints from './LookupHints.vue';

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
// The old /define/<term> and /search/<query> links are redirected here by
// the router. What was looked up last is kept in `lookupState`.
// Results: in བོད the headwords starting with the field (the first selected
// after a pause, as Define did), in EN the terms whose definitions match the
// query (run on Enter or after a pause, as Search did).
// (The layout comes with Task 11.)
export default {
  name: 'LookupPage',
  components: { DefinitionResults, HeadwordResults, LookupField, LookupHints },
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
      // The English query whose results are shown
      query: '',
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
        return `Terms whose definitions say “${this.query}” · ${plural(this.definitionCount, 'term')}`;
      }
      if (!this.text) return '';
      const count = plural(this.matches.length, 'term');
      return this.typedWylie ? `Wylie ${this.typedWylie} → ${this.text} · ${count}` : count;
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
    $route(route) {
      // Kept alive while another page is open: its routes are not Lookup's
      if (!route.path.startsWith('/lookup')) return;
      this.applyRoute(route);
    },
  },
  created() {
    this.debouncedSelectFirst = _.debounce(this.selectFirstMatch, DEBOUNCE_SEARCH_MS);
    this.debouncedRunQuery = _.debounce(this.runTypedQuery, DEBOUNCE_SEARCH_MS);
    this.debouncedRecordTerm = _.debounce(this.recordSelectedTerm, DEBOUNCE_SEARCH_MS);
    this.shownDictionaries = dictionariesSignature();
    this.packsChanged = false;
    if (this.$route.path.startsWith('/lookup')) this.applyRoute(this.$route);
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
    // starts with it (picking ཀ་ཀ་ after typing ཀ keeps ཀ in the field)
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
    // The dictionaries switched on or off or reordered in Library, or packs
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
    },
    onSelectHeadword(term) {
      this.openTerm(term);
    },
    onSelectDefinition(term) {
      this.selectedDefinitionTerm = term;
      recordTerm(term);
      // The query led somewhere: it is worth keeping
      storePreviousQuery(this.query);
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
      writeLookupState({ query });
      this.$router.replace({ path: '/lookup', query: { mode: 'en', q: query } });
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
      // The term stays the last one selected: the text converted to Tibetan
      // may not be a term
      writeLookupState(newMode === 'en' ? { mode: newMode, query: text } : { mode: newMode });
      // The route drops the term or query of the other mode, so that a link
      // to them (a definition link to the same term) is a change again
      if (updateRoute) this.$router.replace({ path: '/lookup', query: { mode: newMode } });
    },
    search() {
      const query = (this.text || '').trim();
      if (!query) return;
      this.debouncedRunQuery.cancel();
      if (query !== this.query) this.selectedDefinitionTerm = '';
      this.query = query;
      storePreviousQuery(query);
      this.$router.push({ path: '/lookup', query: { mode: 'en', q: query } });
    },
    clear() {
      this.text = '';
      if (this.mode === 'en') {
        this.query = '';
        this.selectedDefinitionTerm = '';
      } else {
        this.selectedTerm = '';
      }
      writeLookupState(this.mode === 'en' ? { query: '' } : { term: '' });
      const route = { path: '/lookup', query: { mode: this.mode } };
      if (this.$route.fullPath !== this.$router.resolve(route).fullPath) this.$router.push(route);
    },
    onKeydown(event) {
      if (this.mode === 'en') {
        if (event.key === 'Enter') this.search();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.selectSibling(event.key === 'ArrowDown' ? 1 : -1);
      }
    },
    focusField() {
      this.$refs.field?.focus();
    },
  },
};
</script>

<template>
  <section class="lookup-page" data-testid="lookup-page">
    <h1 class="ui-visually-hidden">Lookup</h1>
    <lookup-field
      ref="field"
      v-model="text"
      :mode="mode"
      :typed-wylie="typedWylie"
      :read-as="readAs"
      @update:mode="changeMode"
      @keydown="onKeydown"
      @clear="clear"
      @submit="search"
    />
    <lookup-hints
      :mode="mode"
      :text="text"
      :typed-wylie="typedWylie"
      :as-typed="asTyped"
      :headword-count="matches.length"
      :definition-count="definitionCount"
      @switch="onHintSwitch"
    />
    <headword-results
      v-if="mode === 'bo' && text"
      :terms="matches"
      :selected="selectedTerm"
      :refresh-key="refreshKey"
      @select="onSelectHeadword"
    />
    <definition-results
      v-else-if="mode === 'en'"
      :query="query"
      :selected="selectedDefinitionTerm"
      :refresh-key="refreshKey"
      @select="onSelectDefinition"
      @search="searchPrevious"
      @count="definitionCount = $event"
    />
  </section>
</template>

<style scoped>
.lookup-page {
  box-sizing: border-box;
  max-width: var(--entry-max-width);
  padding: var(--space-6) var(--space-8);
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-ui);
}
</style>
