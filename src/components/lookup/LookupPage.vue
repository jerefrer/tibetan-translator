<script>
import _ from 'underscore';

import { DEBOUNCE_SEARCH_MS } from '../../config/constants';
import { hasLatinDiacritics } from '../../services/non-wylie-input';
import SqlDatabase from '../../services/sql-database';
import { recordTerm } from '../../services/history';
import { TIBETAN_CHAR_RE, plural, termsStartingWith } from '../../services/quick-lookup';
import { initialTypedWylie, nextTypedWylie, typedWylieFor } from '../../services/typed-wylie';
import { readLookupState, writeLookupState } from '../../services/lookup-state';
import { UiIcon, UiResizeHandle } from '../../ui';
import MobileResponsiveMixin from '../mixins/MobileResponsiveMixin';
import PaneWidthMixin from '../mixins/PaneWidthMixin';
import ResultsFreshnessMixin from '../mixins/ResultsFreshnessMixin';
import TermEntry from '../entry/TermEntry.vue';
import HeadwordResults from './HeadwordResults.vue';
import LookupField from './LookupField.vue';
import LookupHints from './LookupHints.vue';
import LookupHome from './LookupHome.vue';
import HelpButton from '../help/HelpButton.vue';

// Lookup: a Tibetan term, typed in Tibetan or Wylie, and its entry.
// The route carries the term: /lookup/<term>. The old /define/<term> links
// are redirected here by the router. The term selected last is kept in
// `lookupState`. Searching the definitions is Search's (SearchPage); a hint
// leads there when what was typed is better searched than looked up.
// Results: the headwords starting with the field, the first selected after a
// pause, as Define did.
//
// Layout (boards Main, MobileHome, MobileResults, MobileEntry; lookup-layout.css,
// shared with Search). Desktop: the results column with the field on top, and
// the entry pane (the selected term, or LookupHome while there is none), each
// scrolling on its own; the divider between them can be dragged
// (PaneWidthMixin).
// Phone: the title, the field, then LookupHome while the field is empty or
// the results; a tapped result shows its entry full screen with a back link
// (MobileResponsiveMixin's mobileShowDefinition, as Define did).
// Keyboard: Up/Down move through the results, Escape clears the field.
export default {
  name: 'LookupPage',
  mixins: [
    MobileResponsiveMixin,
    ResultsFreshnessMixin,
    PaneWidthMixin({ storageKey: 'lookupResultsWidth', cssVariable: '--results-width', min: 300, reserve: 420 }),
  ],
  components: {
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
    // on showing what it shows; a new one takes back the term selected last
    if (to.params.term) next();
    else next((vm) => vm.restoreIfEmpty(to));
  },
  data() {
    return {
      text: '',
      // The Wylie behind the Tibetan in the field ("typed sangs rgyas")
      typedWylieState: initialTypedWylie(),
      // What was typed when it carried Latin diacritics (kākiṇī). The field
      // turns it into Tibetan, so it is kept as typed.
      asTyped: '',
      // The term selected (the route's)
      selectedTerm: '',
    };
  },
  computed: {
    typedWylie() {
      return typedWylieFor(this.typedWylieState, this.text);
    },
    matches() {
      this.allTermsVersion; // re-read when the terms change
      if (!this.text) return [];
      return termsStartingWith(SqlDatabase.allTerms, this.text);
    },
    // How the input was read, under the field
    readAs() {
      if (!this.text) return '';
      const count = plural(this.matches.length, 'term');
      return this.typedWylie ? `Wylie ${this.typedWylie} → ${this.text} · ${count}` : count;
    },
    // Phone: the entry full screen instead of the field and the results
    showingEntry() {
      return this.isMobile && this.mobileShowDefinition && !!this.selectedTerm;
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
      if (!value) this.asTyped = '';
      else if (hasLatinDiacritics(value)) {
        if (!TIBETAN_CHAR_RE.test(value) || !this.asTyped) this.asTyped = value.trim();
      } else if (!this.asTyped || !this.typedWylie) this.asTyped = '';
      this.debouncedSelectFirst();
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
    this.debouncedRecordTerm = _.debounce(this.recordSelectedTerm, DEBOUNCE_SEARCH_MS);
    if (this.$route.path.startsWith('/lookup')) {
      this.applyRoute(this.$route);
      // Created on a term: a deep link (/define/<term>) or a link from
      // another page, so on a phone the entry opens
      if (this.$route.params.term) this.setMobileShowDefinition(true);
    }
  },
  mounted() {
    this._onFocusLookup = () => {
      if (this.$route.path.startsWith('/lookup')) this.focusField();
    };
    window.addEventListener('focus-lookup', this._onFocusLookup);
  },
  activated() {
    this.$nextTick(() => this.focusField());
  },
  deactivated() {
    // A pause that ends on another page selects nothing
    this.debouncedSelectFirst.cancel();
    // The term selected before leaving is recorded now rather than lost
    this.debouncedRecordTerm.cancel();
    this.recordSelectedTerm();
  },
  beforeUnmount() {
    this.debouncedRecordTerm.cancel();
    window.removeEventListener('focus-lookup', this._onFocusLookup);
    this.debouncedSelectFirst.cancel();
  },
  methods: {
    applyRoute(route) {
      const term = route.params.term;
      if (!term) return;
      this.selectTerm(term);
      writeLookupState({ term });
    },
    // As Define's setSearchTerm: what was typed stays when the selected term
    // contains it (picking ཀ་ཀ་ after typing ཀ keeps ཀ in the field)
    selectTerm(term) {
      if (!this.text || !term.includes(this.text)) this.text = term;
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
    // As Define: after a pause in typing, the first match is selected
    selectFirstMatch() {
      if (!this.$route.path.startsWith('/lookup')) return;
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
    // A tap or a click on a result, a recent or saved term: on a phone the
    // entry opens full screen
    onOpen(term) {
      this.openTerm(term);
      this.setMobileShowDefinition(true);
    },
    // The phone's back link: the field and the results as they were
    backToResults() {
      this.showTermsList();
    },
    // The hint: what was typed, searched in the definitions
    searchDefinitions(text) {
      this.$router.push({ path: '/search', query: { q: text } });
    },
    selectSibling(step) {
      const index = this.matches.indexOf(this.selectedTerm);
      const next = this.matches[index + step];
      if (index + step >= 0 && next) this.openTerm(next);
    },
    restoreIfEmpty(to) {
      if (this.text) return;
      const { term } = readLookupState();
      if (term) this.$router.replace({ path: '/lookup/' + encodeURIComponent(term), query: to.query, hash: to.hash });
    },
    clear() {
      this.text = '';
      this.selectedTerm = '';
      writeLookupState({ term: '' });
      if (this.$route.path !== '/lookup') this.$router.push({ path: '/lookup' });
    },
    onKeydown(event) {
      const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
      if (event.key === 'Escape') {
        if (!this.text) return;
        event.preventDefault();
        this.clear();
      } else if (step) {
        event.preventDefault();
        this.selectSibling(step);
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
          :typed-wylie="typedWylie"
          :read-as="readAs"
          @keydown="onKeydown"
          @clear="clear"
        />
        <lookup-hints
          :text="text"
          :typed-wylie="typedWylie"
          :as-typed="asTyped"
          :headword-count="matches.length"
          @search="searchDefinitions"
        />
      </div>
      <div class="lookup-page__list">
        <headword-results
          v-if="text"
          :terms="matches"
          :selected="selectedTerm"
          :refresh-key="refreshKey"
          @select="onOpen"
        />
        <lookup-home v-else-if="isMobile" phone @open="onOpen" />
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
        <term-entry v-if="selectedTerm" :term="selectedTerm">
          <template v-if="isMobile" #leading>
            <button type="button" class="lookup-back" data-testid="lookup-back" @click="backToResults">
              <ui-icon name="chevron-left" :size="22" :stroke-width="2.4" />Lookup
            </button>
          </template>
        </term-entry>
        <lookup-home v-else-if="!isMobile" @open="onOpen" />
      </div>
    </div>
  </section>
</template>

<style scoped src="./lookup-layout.css"></style>
