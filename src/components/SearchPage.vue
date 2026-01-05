<script>
import $ from 'jquery';
import _ from 'underscore';
import { useTheme } from 'vuetify';

import TibetanRegExps from 'tibetan-regexps';
import WylieToUnicode from '../services/wylie-to-unicode';
const wylieToUnicode = new WylieToUnicode();

import Decorator from '../services/decorator';
import PhoneticSearch from '../services/phonetic-search';
import SqlDatabase from '../services/sql-database';
import Storage from '../services/storage';
import {
  phoneticsLooseFor,
  phoneticsStrictFor,
  replaceTibetanGroups,
  syllablesFor,
} from '../utils.js';
import DictionariesDetailsMixin from './DictionariesDetailsMixin';
import DictionariesMenuMixin from './DictionariesMenuMixin';

import ResultsAndPaginationAndDictionaries from './ResultsAndPaginationAndDictionaries.vue';

export default {
  mixins: [DictionariesDetailsMixin, DictionariesMenuMixin],
  components: {
    ResultsAndPaginationAndDictionaries,
  },
  inject: ['snackbar'],
  setup() {
    const theme = useTheme();
    return { theme };
  },
  data() {
    return {
      loading: false,
      paginationLoading: false,
      entries: undefined,
      resultsPage: 1,
      searchQuery: this.$route.params.query,
      previousQueries: Storage.get('previousQueries') || [],
    };
  },
  watch: {
    '$route.params.query'(value) {
      this.searchQuery = value;
      Storage.set('searchQuery', value);
      if (value) this.performSearch({ query: value, fromNavigation: true });
    },
    previousQueries(value) {
      Storage.set('previousQueries', value);
    },
    resultsPage(value) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  },
  beforeRouteEnter(to, from, next) {
    var query = Storage.get('searchQuery');
    if (!to.params.query && query) next('/search/' + query);
    else next();
  },
  computed: {
    isDark() {
      return this.theme.global.current.value.dark;
    },
    numberOfEntriesPerPage() {
      return 25;
    },
    maxNumberOfEntriesPerRequest() {
      return 5000;
    },
    maxNumberOfPreviousQueries() {
      return 100;
    },
    sortedEntries() {
      // Multi-factor sorting with BM25 relevance ranking
      // Priority: 1) starts with search term, 2) BM25 rank, 3) term length, 4) dictionary position
      const searchTermLower = this.regularSearchTerms[0]?.toLowerCase() || '';

      return _.chain(this.entriesForEnabledDictionaries)
        .sortBy((entry) => {
          // Factor 1: Does term START WITH the search query? (0 = yes, 1 = no)
          const startsWithBonus = entry.term.toLowerCase().startsWith(searchTermLower) ? 0 : 1;

          // Factor 2: BM25 rank (negative values, closer to 0 = better match)
          // Add offset to make all values positive for string comparison
          const rankScore = (entry.rank || 0) + 1000;

          // Factor 3: Term length (shorter = more specific match)
          const termLength = entry.term.length;

          // Factor 4: Dictionary position (user's preferred order)
          const dictPos = entry.dictionaryPosition || 999;

          return [startsWithBonus, rankScore, termLength, dictPos].map((x) =>
            x.toString().padStart(10, '0')
          );
        })
        .value();
    },
    limitedEntries() {
      return this.sortedEntries
        .slice((this.resultsPage - 1) * this.numberOfEntriesPerPage)
        .slice(0, this.numberOfEntriesPerPage);
    },
    limitedAndDecoratedEntries() {
      var entries = this.decorateEntries(this.limitedEntries);
      this.paginationLoading = false;
      return entries;
    },
    totalNumberOfEntriesForEnabledDictionaries() {
      return this.entriesForEnabledDictionaries?.length || 0;
    },
    searchTerms() {
      if (!this.searchQuery) return [];
      else
        return _.compact(
          this.substituteWylieTerms(this.searchQuery)
            .split('&')
            .map((t) => t.trim())
        );
    },
    regularSearchTerms() {
      return this.searchTerms.filter((term) => !term.match(/^[\[\{].*[\]\}]$/));
    },
    phoneticsStrictSearchTerms() {
      var terms = this.phoneticsTerms(/^\[.*\]$/, phoneticsStrictFor);
      return terms.map((term) =>
        PhoneticSearch.prepareTermForStrictMatching(term)
      );
    },
    phoneticsLooseSearchTerms() {
      var terms = this.phoneticsTerms(/^\{.*\}$/, phoneticsLooseFor);
      return terms.map((term) =>
        PhoneticSearch.prepareTermForLooseMatching(term)
      );
    },
  },
  methods: {
    substituteWylieTerms(text) {
      return text.replace(/\(([^)]*)\)/g, (wylieWithParenthesis) => {
        let wylieWithoutParenthesis = wylieWithParenthesis.slice(1, -1);
        return wylieToUnicode.convert(wylieWithoutParenthesis);
      });
    },
    phoneticsTerms(regexp, convert) {
      return _.chain(this.searchTerms.map((term) => term.match(regexp)))
        .compact()
        .flatten()
        .value()
        .map((term) => term.slice(1, -1))
        .map((term) =>
          replaceTibetanGroups(term, (tibetan) => convert(tibetan) + ' ')
        );
    },
    decorateEntries(entries) {
      return entries.map((entry) => {
        var term = this.highlightSearchTerms(entry.term);
        var definition = Decorator.decorate(entry);
        definition = this.highlightSearchTerms(definition);
        return { ...entry, term: term, definition: definition };
      });
    },
    wrapAllTibetanWithSpansAndAddTshekIfMissing(definition) {
      return Decorator.wrapAllTibetanWithSpansAndAddTshekIfMissing(definition);
    },
    highlightSearchTerms(definition) {
      // Split by HTML tags - the regex captures tags so they're included in the result
      const parts = definition.split(/(<[^>]+>)/);

      return parts
        .map((part) => {
          // Skip HTML tags - only process text nodes
          if (part.startsWith('<') && part.endsWith('>')) {
            return part;
          }
          // Apply highlighting to text nodes only
          let highlighted = part;
          this.regularSearchTerms.forEach((term) => {
            var escapedTerm = this.escapeForRegExp(term);
            var regexp = new RegExp('(' + escapedTerm + ')', 'ig');
            highlighted = highlighted.replace(regexp, '<em>$1</em>');
          });
          this.phoneticsStrictSearchTerms.forEach((term) => {
            highlighted = this.highlightTibetanMatchingPhonetics(
              highlighted,
              term,
              phoneticsStrictFor
            );
          });
          this.phoneticsLooseSearchTerms.forEach((term) => {
            highlighted = this.highlightTibetanMatchingPhonetics(
              highlighted,
              term,
              phoneticsLooseFor
            );
          });
          return highlighted;
        })
        .join('');
    },
    highlightTibetanMatchingPhonetics(definition, term, convert) {
      return replaceTibetanGroups(definition, (group) => {
        var numberOfSyllablesForTerm = term.split(' ').length;
        var combinations = this.everySyllablesCombinationsOfGivenLengthFor(
          group,
          numberOfSyllablesForTerm
        );
        var match = combinations.find((subgroup) => {
          var groupInPhonetics = convert(subgroup);
          return groupInPhonetics.includes(term);
        });
        if (match) {
          var matchWithoutEndingTshek = match.replace(/་$/, '');
          return group.replace(
            new RegExp(`(${matchWithoutEndingTshek}[་།༎༑༔]?)`, 'g'),
            '<em>$1</em>'
          );
        } else return group;
      });
    },
    everySyllablesCombinationsOfGivenLengthFor(
      source,
      numberOfSyllablesForTerm
    ) {
      var syllables = syllablesFor(source);
      var numberOfSyllables = syllables.length;
      var combinations = [];
      for (var i = 0; i < numberOfSyllables; i++) {
        for (var j = numberOfSyllables; j > 0; j--) {
          var slice = syllables.slice(i, j);
          if (slice.length == numberOfSyllablesForTerm)
            combinations.push(slice.join('་') + '་');
        }
      }
      return _.chain(combinations).uniq().sortBy('length').value();
    },
    escapeForRegExp(text) {
      return text.replace(/([\[\]\{\}\.\*\?])/, '\\$1');
    },
    clear() {
      this.searchQuery = '';
      Storage.delete('searchQuery');
      this.pushRoute();
      this.entries = undefined;
    },
    clearPreviousQueries() {
      this.previousQueries = [];
      this.focusInput();
    },
    focusInput() {
      this.$refs.input.focus();
    },
    setPageTitle() {
      return;
      document.title = 'Translator / Search';
      if (this.searchQuery) document.title += ' / ' + this.searchQuery;
    },
    prepareTerm(term) {
      return `"${term.replace(/'/g, "''").replace(/"/g, '""')}"`;
    },
    storeQuery() {
      this.previousQueries = this.previousQueries.filter(
        (query) => query != this.searchQuery
      );
      this.previousQueries.unshift(this.searchQuery);
      if (this.previousQueries.length > this.maxNumberOfPreviousQueries)
        this.previousQueries = this.previousQueries.slice(
          0,
          this.maxNumberOfPreviousQueries
        );
    },
    pushRoute() {
      var path = '/search/' + encodeURIComponent(this.searchQuery);
      if (path != this.$route.path) {
        this.setPageTitle();
        this.$router.push({ path: path });
      }
    },
    changePage(page) {
      this.paginationLoading = true;
      setTimeout(() => (this.resultsPage = page), 280);
    },
    performSearch(options = {}) {
      this.searchQuery =
        options.query || this.$refs.input.$el.querySelector('input').value;
      if (this.searchQuery?.trim()) {
        this.loading = true;
        if (!options.fromNavigation) {
          this.storeQuery();
          this.pushRoute();
        }
        this.resultsPage = 1;
        var conditions = [];
        var params = [];
        this.regularSearchTerms.forEach((term) => {
          conditions.push(
            `(entries_fts MATCH 'term:${this.prepareTerm(
              term
            )} OR definition:${this.prepareTerm(term)}')`
          );
        });
        this.phoneticsStrictSearchTerms.forEach((phoneticsStrictTerm) => {
          // Generate syllable split variants for spaceless searches
          // e.g., "sangye" -> try "sanggye" -> split to "sang gye"
          const searchVariants = phoneticsStrictTerm.includes(' ')
            ? [phoneticsStrictTerm]
            : PhoneticSearch.processSpacelessPhoneticSearch(
                phoneticsStrictTerm
              );

          // Build OR conditions for all variants
          const termConditions = searchVariants
            .map(
              (variant) => `termPhoneticsStrict:${this.prepareTerm(variant)}`
            )
            .join(' OR ');

          conditions.push(
            `(entries_fts MATCH '(${termConditions}) OR definitionPhoneticsWordsStrict:${this.prepareTerm(
              phoneticsStrictTerm
            )}')`
          );
        });
        this.phoneticsLooseSearchTerms.forEach((phoneticsLooseTerm) => {
          // Generate syllable split variants for spaceless searches
          const searchVariants = phoneticsLooseTerm.includes(' ')
            ? [phoneticsLooseTerm]
            : PhoneticSearch.processSpacelessPhoneticSearch(phoneticsLooseTerm);

          // Build OR conditions for all variants
          const termConditions = searchVariants
            .map((variant) => `termPhoneticsLoose:${this.prepareTerm(variant)}`)
            .join(' OR ');

          conditions.push(
            `(entries_fts MATCH '(${termConditions}) OR definitionPhoneticsWordsLoose:${this.prepareTerm(
              phoneticsLooseTerm
            )}')`
          );
        });
        // BM25 column weights: term(10), termPhoneticsStrict(8), termPhoneticsLoose(8),
        // definition(1), definitionPhoneticsWordsStrict(1), definitionPhoneticsWordsLoose(1)
        // Higher weights = more important for ranking. Term matches weighted 10x over definition.
        var query = `
            SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition,
                   bm25(entries_fts, 10.0, 8.0, 8.0, 1.0, 1.0, 1.0) AS rank
            FROM entries
            INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
            INNER JOIN entries_fts ON entries.id = entries_fts.rowid
            WHERE ${conditions.join(' AND ')}
            ORDER BY rank
            LIMIT ${this.maxNumberOfEntriesPerRequest}
          `;
        SqlDatabase.exec(query, params)
          .then((rows) => {
            this.entries = rows;
            this.resetDictionariesToDefaultAndSetNumberOfEntries();
          })
          .finally(() => this.$nextTick(() => (this.loading = false)));
      } else this.clear();
    },
    shortDictionaryLabelFor(entry) {
      return this.dictionaryLabelFor(entry.dictionary, { short: true });
    },
    shortDictionaryLabelForHasTibetan(entry) {
      return this.shortDictionaryLabelFor(entry).match(
        TibetanRegExps.tibetanGroups
      );
    },
    openDictionaryAbout(entry) {
      this.snackbar.open(this.dictionaryAboutFor(entry.dictionary));
    },
  },
  mounted() {
    this.setPageTitle();
    if (this.searchQuery) this.performSearch();
  },
  updated() {
    $('td.active').get(0)?.scrollIntoViewIfNeeded();
  },
};
</script>

<template>
  <div class="search-page">
    <v-system-bar height="63">
      <v-text-field
        autofocus
        clearable
        hide-details
        height="63"
        ref="input"
        class="flex-grow-1 text-center tibetan"
        placeholder="Type in your query"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        v-model="searchQuery"
        @keyup.enter="performSearch()"
        @click:clear="clear"
      >
        <template v-slot:prepend-inner>
          &nbsp;
          <ResultsAndPaginationAndDictionaries
            ref="resultsAndPaginationAndDictionaries"
            v-if="entries != undefined"
            :loading="paginationLoading"
            :page="resultsPage"
            :dictionaries="dictionariesForCurrentResults"
            :numberOfEntriesPerPage="numberOfEntriesPerPage"
            :totalNumberOfEntries="totalNumberOfEntriesForEnabledDictionaries"
            @change:page="changePage($event)"
            @close:dictionariesMenu="focusInput"
          />
        </template>
        <template v-slot:append-inner>
          <v-progress-circular
            size="24"
            color="info"
            indeterminate
            :style="{
              opacity: loading ? 1 : 0,
            }"
          />
          <v-btn
            variant="text"
            size="x-large"
            height="60"
            color="primary"
            :disabled="!searchQuery || !searchQuery.trim()"
            @click="performSearch()"
          >
            <v-icon start>mdi-magnify</v-icon>
          </v-btn>
        </template>
      </v-text-field>
    </v-system-bar>

    <!-- Mobile controls (shown below search bar on mobile) -->
    <div class="mobile-controls d-sm-none" v-if="entries != undefined">
      <ResultsAndPaginationAndDictionaries
        :loading="paginationLoading"
        :page="resultsPage"
        :dictionaries="dictionariesForCurrentResults"
        :numberOfEntriesPerPage="numberOfEntriesPerPage"
        :totalNumberOfEntries="totalNumberOfEntriesForEnabledDictionaries"
        @change:page="changePage($event)"
        @close:dictionariesMenu="focusInput"
      />
    </div>

    <template v-if="!loading">
      <template v-if="entries == undefined">
        <div
          v-if="previousQueries.length > 0"
          class="previous-queries"
        >
          <div class="header">
            <v-icon size="small" class="mr-2">mdi-history</v-icon>
            Recent Searches
          </div>

          <v-fade-transition group tag="div" class="buttons">
            <v-btn
              variant="text"
              v-for="query in previousQueries"
              :key="query"
              color="grey"
              class="previous-query"
              @click="performSearch({ query: query })"
              v-html="wrapAllTibetanWithSpansAndAddTshekIfMissing(query)"
            />
          </v-fade-transition>

          <div class="clear-button-container">
            <v-btn
              variant="tonal"
              size="small"
              color="grey"
              @click="clearPreviousQueries"
            >
              <v-icon start size="small">mdi-delete-clock</v-icon>
              Clear History
            </v-btn>
          </div>
        </div>
      </template>

      <v-table v-else-if="limitedAndDecoratedEntries.length" key="entries">
        <tbody>
          <tr v-for="entry in limitedAndDecoratedEntries" class="entry">
            <td>
              <v-row>
                <v-col cols="12" sm="2">
                  <div class="term tibetan" v-html="entry.term" />
                </v-col>
                <v-col cols="12" sm="2" class="dictionary-label-col">
                  <v-chip
                    variant="flat"
                    size="small"
                    class="ml-2 px-2 dictionary-label"
                    color="grey-darken-2"
                    v-html="shortDictionaryLabelFor(entry)"
                    :class="{
                      'has-tibetan': shortDictionaryLabelForHasTibetan(entry),
                    }"
                    @click="openDictionaryAbout(entry)"
                  />
                </v-col>
                <v-col cols="12" sm="8" class="d-flex">
                  <div class="definition" v-html="entry.definition" />
                </v-col>
              </v-row>
            </td>
          </tr>
        </tbody>
      </v-table>

      <v-alert v-else class="text-center" key="no-entries">No entries</v-alert>
    </template>
  </div>
</template>

<style>
.search-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0;
  padding: 0;
}

.search-page .v-input {
  background: var(--paper, #FAF3E0);
  border-bottom: 2px solid rgba(0, 0, 0, 0.1);
}

.v-theme--dark .search-page .v-input {
  background: #1e1e1e;
  border-bottom-color: rgba(255, 255, 255, 0.12);
}

.search-page > .v-system-bar {
  position: relative !important;
  z-index: 1 !important;
  width: 100%;
  padding: 0 15px !important;
  margin: 0 !important;
  top: 0 !important;
  background: #fffcf4 !important;
  box-shadow: none !important;
  border-bottom: 2px solid rgba(0, 0, 0, 0.1);
}

.v-theme--dark .search-page > .v-system-bar {
  background: #1e1e1e !important;
  border-bottom-color: rgba(255, 255, 255, 0.12);
}

.search-page .v-input {
  margin: 0;
  padding: 0;
  width: 100%;
  max-width: 100%;
}

/* Vuetify 3: Remove default field padding/borders */
.search-page .v-input .v-input__control {
  height: 63px;
}
.search-page .v-input .v-field {
  padding: 0;
  border-radius: 0;
  height: 63px;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  --v-field-padding-start: 0;
  --v-field-padding-end: 0;
  --v-field-padding-top: 0;
  --v-field-padding-bottom: 0;
}
.search-page .v-input .v-field__outline {
  display: none;
}
.search-page .v-input .v-field__overlay {
  display: none !important;
  background: transparent !important;
}
.search-page .v-input,
.search-page .v-input .v-input__control,
.search-page .v-input .v-field__field,
.search-page .v-input .v-field__field input {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.search-page .v-input .v-field__prepend-inner {
  width: 280px;
  flex: 0 0 280px;
  align-items: center;
  height: 100%;
  margin: 0;
  padding-left: 1em;
}

.search-page .v-input .v-field__field {
  flex: 1;
}

.search-page .v-input .v-field__field input {
  padding: 0 12px;
  height: 64px !important;
  font-size: 26px !important;
  line-height: 46px !important;
  text-align: center;
}

.search-page .v-input .v-field__field input::placeholder {
  font-family: "Segoe UI", "Roboto", sans-serif !important;
  font-size: 18px !important;
  opacity: 0.5;
  color: #666;
}

.v-theme--dark .search-page .v-input .v-field__field input::placeholder {
  color: #aaa;
}

.search-page .v-input .v-field__append-inner {
  width: 280px;
  flex: 0 0 280px;
  height: 100%;
  margin: 0;
  padding: 0;
  align-items: center;
  justify-content: flex-end;
}

/* Vuetify 3: Clear button styling */
.search-page .v-input .v-field__clearable {
  margin: 0;
  padding: 0 8px;
  align-items: center;
}
.search-page .v-input .v-field__clearable .v-icon {
  font-size: 24px;
  opacity: 1;
}

.search-page .v-input .v-field__append-inner .v-btn {
  min-width: 75px;
}

.search-page .v-input .v-field__append-inner .v-btn .v-icon {
  margin: 0;
  color: var(--deep-red);
}

.v-theme--dark .search-page .v-input .v-field__append-inner .v-btn .v-icon {
  color: var(--yellow);
}

.search-page .v-input .v-field__append-inner .v-icon {
  font-size: 28px;
}

.search-page .v-table {
  flex: 1;
  overflow: visible;
}

.search-page .v-table > .v-table__wrapper {
  overflow: visible;
}

.search-page
  .v-table
  > .v-table__wrapper
  > table
  > tbody
  > tr:hover:not(.v-data-table__expanded__content):not(
    .v-data-table__empty-wrapper
  ) {
  background: transparent !important;
}

.v-theme--dark .search-page .v-table {
  background-color: #252525;
}

.search-page .entry em {
  color: black;
  font-style: normal;
  background: #ffc107;
}

.search-page .entry .tibetan em {
  background: none;
  color: inherit;
  text-decoration: underline #ffc107 3px !important;
}

.search-page .entry .term {
  margin-top: 10px;
  line-height: 30px;
}

.search-page .entry .dictionary-label {
  height: auto;
  margin-top: 14.5px;
  white-space: break-spaces;
}

.search-page .entry .v-col:nth-child(2) {
  display: flex;
  align-items: flex-start;
}

.search-page .entry .dictionary-label.has-tibetan {
  margin-top: 5.5px;
}

.search-page .entry .dictionary-label .tibetan {
  line-height: 38px;
}

.search-page .entry .definition {
  padding: 8px 0;
  line-height: 30px;
}

.search-page .entry .definition .tibetan {
  line-height: 30px;
}

.search-page .v-alert {
  width: 100%;
  padding-right: 50px;
}

.v-theme--dark .search-page .v-alert {
  background-color: #252525;
}

.search-page .previous-queries {
  display: flex;
  flex-direction: column;
  padding: 16px;
  padding-top: 40px;
  max-width: 800px;
  margin: 0 auto;
}

.search-page .previous-queries .header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  font-family: 'Segoe UI', 'Roboto', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.v-theme--dark .search-page .previous-queries .header {
  color: #999;
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.search-page .previous-queries .buttons {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 4px;
}

.search-page .previous-queries .buttons .previous-query {
  padding: 20px 28px;
  text-transform: none;
}

.search-page .previous-queries .buttons .previous-query span.tibetan {
  margin: 0 5px;
}

.search-page .previous-queries .clear-button-container {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

/* Mobile styles */
@media (max-width: 600px) {
  .search-page .v-input .v-field__prepend-inner {
    display: none;
  }

  .search-page .v-input .v-field__append-inner {
    width: auto;
  }

  .search-page .v-input .v-field__field input {
    font-size: 20px !important;
  }

  .search-page .mobile-controls {
    display: flex;
    padding: 8px;
    background: var(--paper, #FAF3E0);
  }

  .v-theme--dark .search-page .mobile-controls {
    background: #1e1e1e;
  }

  .search-page .entry .dictionary-label-col {
    padding-top: 0;
    padding-bottom: 0;
  }

  .search-page .entry .dictionary-label {
    margin: 0 !important;
  }

  .search-page .entry .term {
    margin-top: 20px;
  }

  .search-page .entry .definition {
    padding: 0;
    margin-bottom: 15px;
  }

  .search-page .previous-queries {
    padding: 12px;
    padding-top: 32px;
  }

  .search-page .previous-queries .header {
    margin-bottom: 8px;
  }

  .search-page .previous-queries .buttons .previous-query {
    padding: 12px 16px;
  }

  .search-page .previous-queries .clear-button-container {
    margin-top: 16px;
  }
}
</style>
