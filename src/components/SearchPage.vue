<script>
import $ from "jquery";
import _ from "underscore";

import TibetanRegExps from "tibetan-regexps";
import WylieToUnicode from "../services/wylie-to-unicode";
const wylieToUnicode = new WylieToUnicode();

import Storage from "../services/storage";
import Decorator from "../services/decorator";
import SqlDatabase from "../services/sql-database";
import PhoneticSearch from "../services/phonetic-search";
import DictionariesMenuMixin from "./DictionariesMenuMixin";
import DictionariesDetailsMixin from "./DictionariesDetailsMixin";
import {
  phoneticsStrictFor,
  phoneticsLooseFor,
  replaceTibetanGroups,
  syllablesFor,
} from "../utils.js";

import ResultsAndPaginationAndDictionaries from "./ResultsAndPaginationAndDictionaries";

export default {
  mixins: [DictionariesDetailsMixin, DictionariesMenuMixin],
  components: {
    ResultsAndPaginationAndDictionaries,
  },
  data() {
    return {
      loading: false,
      paginationLoading: false,
      entries: undefined,
      resultsPage: 1,
      searchQuery: this.$route.params.query,
      previousQueries: Storage.get("previousQueries") || [],
    };
  },
  watch: {
    "$route.params.query"(value) {
      this.searchQuery = value;
      Storage.set("searchQuery", value);
      if (value) this.performSearch({ query: value, fromNavigation: true });
    },
    previousQueries(value) {
      Storage.set("previousQueries", value);
    },
    resultsPage(value) {
      this.$vuetify.goTo(0);
    },
  },
  beforeRouteEnter(to, from, next) {
    var query = Storage.get("searchQuery");
    if (!to.params.query && query) next("/search/" + query);
    else next();
  },
  computed: {
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
      return _(this.entriesForEnabledDictionaries).sortBy((entry) => {
        var positions = [];
        this.regularSearchTerms.forEach((term) => {
          positions.push((entry.term + entry.definition).indexOf(term));
        });
        this.phoneticsStrictSearchTerms.forEach((phoneticsStrictTerm) => {
          positions.push(
            (
              entry.termPhoneticsStrict + entry.definitionPhoneticsWordsStrict
            ).indexOf(phoneticsStrictTerm)
          );
        });
        this.phoneticsLooseSearchTerms.forEach((phoneticsLooseTerm) => {
          positions.push(
            (
              entry.termPhoneticsLoose + entry.definitionPhoneticsWordsLoose
            ).indexOf(phoneticsLooseTerm)
          );
        });
        return [
          positions.reduce((sum, n) => sum + n), // [  9 ] < [ 10 ] => false
          entry.term.length, // ["09"] < ["10"] => true
          entry.term, // Comparison is actually made on strings
          entry.dictionaryPosition, // So we take the initiative
        ].map((x) => x.toString().padStart(10, "0")); // To toString & padStart all ourselves
      });
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
            .split("&")
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
        return wylieToUnicode.convert();
      });
    },
    phoneticsTerms(regexp, convert) {
      return _.chain(this.searchTerms.map((term) => term.match(regexp)))
        .compact()
        .flatten()
        .value()
        .map((term) => term.slice(1, -1))
        .map((term) =>
          replaceTibetanGroups(term, (tibetan) => convert(tibetan) + " ")
        );
    },
    decorateEntries(entries) {
      return entries.map((entry) => {
        var term = this.highlightSearchTerms(entry.term);
        var definition = Decorator.decorate(entry);
        definition = this.highlightSearchTerms(definition);
        definition = this.cleanUpEmFromLinks(definition);
        return { ...entry, term: term, definition: definition };
      });
    },
    wrapAllTibetanWithSpansAndAddTshekIfMissing(definition) {
      return Decorator.wrapAllTibetanWithSpansAndAddTshekIfMissing(definition);
    },
    highlightSearchTerms(definition) {
      var highlighted = definition;
      this.regularSearchTerms.forEach((term) => {
        var escapedTerm = this.escapeForRegExp(term);
        var regexp = new RegExp("(" + escapedTerm + ")", "ig");
        highlighted = highlighted.replace(regexp, "<em>$1</em>");
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
    },
    highlightTibetanMatchingPhonetics(definition, term, convert) {
      return replaceTibetanGroups(definition, (group) => {
        var numberOfSyllablesForTerm = term.split(" ").length;
        var combinations = this.everySyllablesCombinationsOfGivenLengthFor(
          group,
          numberOfSyllablesForTerm
        );
        var match = combinations.find((subgroup) => {
          var groupInPhonetics = convert(subgroup);
          return groupInPhonetics.includes(term);
        });
        if (match) {
          var matchWithoutEndingTshek = match.replace(/་$/, "");
          return group.replace(
            new RegExp(`(${matchWithoutEndingTshek}[་།༎༑༔]?)`, "g"),
            "<em>$1</em>"
          );
        } else return group;
      });
    },
    cleanUpEmFromLinks(text) {
      return text.replace(/href="[^\"]*"/g, (match) =>
        match.replace(/<\/?em>/g, "")
      );
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
            combinations.push(slice.join("་") + "་");
        }
      }
      return _.chain(combinations).uniq().sortBy("length").value();
    },
    escapeForRegExp(text) {
      return text.replace(/([\[\]\{\}\.\*\?])/, "\\$1");
    },
    clear() {
      this.searchQuery = "";
      Storage.delete("searchQuery");
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
      document.title = "Translator / Search";
      if (this.searchQuery) document.title += " / " + this.searchQuery;
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
      var path = "/search/" + encodeURIComponent(this.searchQuery);
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
      this.searchQuery = options.query || this.$refs.input.$refs.input.value;
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
          conditions.push(
            `(entries_fts MATCH 'termPhoneticsStrict:${this.prepareTerm(
              phoneticsStrictTerm
            )} OR definitionPhoneticsWordsStrict:${this.prepareTerm(
              phoneticsStrictTerm
            )}')`
          );
        });
        this.phoneticsLooseSearchTerms.forEach((phoneticsLooseTerm) => {
          conditions.push(
            `(entries_fts MATCH 'termPhoneticsLoose:${this.prepareTerm(
              phoneticsLooseTerm
            )} OR definitionPhoneticsWordsLoose:${this.prepareTerm(
              phoneticsLooseTerm
            )}')`
          );
        });
        var query = `
            SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition
            FROM entries
            INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
            INNER JOIN entries_fts ON entries.id = entries_fts.rowid
            AND ${conditions.join(" AND ")}
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
  },
  mounted() {
    this.setPageTitle();
    if (this.searchQuery) this.performSearch();
  },
  updated() {
    $("td.active").get(0)?.scrollIntoViewIfNeeded();
  },
};
</script>

<template>
  <div class="search-page">
    <v-system-bar app height="63">
      <v-text-field
        autofocus
        clearable
        hide-details
        height="63"
        ref="input"
        class="flex-grow-1 text-center tibetan"
        :value="searchQuery"
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
        <template v-slot:append>
          <v-progress-circular
            size="24"
            color="info"
            indeterminate
            :style="{
              opacity: loading ? 1 : 0,
            }"
          />
          <v-btn
            text
            tile
            x-large
            height="60"
            color="primary"
            :disabled="!searchQuery || !searchQuery.trim()"
            @click="performSearch()"
          >
            <v-icon left>mdi-magnify</v-icon>
          </v-btn>
        </template>
      </v-text-field>
    </v-system-bar>

    <v-fade-transition mode="out-in" appear>
      <template v-if="!loading">
        <template v-if="entries == undefined">
          <div
            v-if="previousQueries.length > 0"
            class="previous-queries grey--text"
          >
            <div class="header">
              <v-btn
                fab
                x-small
                class="mr-2 grey--text"
                elevation="0"
                @click="clearPreviousQueries"
              >
                <v-icon>mdi-delete-clock</v-icon>
              </v-btn>
              Last Queries:
            </div>

            <v-fade-transition group tag="div" class="buttons">
              <v-btn
                text
                v-for="query in previousQueries"
                :key="query"
                color="grey"
                class="previous-query"
                @click="performSearch({ query: query })"
                v-html="wrapAllTibetanWithSpansAndAddTshekIfMissing(query)"
              />
            </v-fade-transition>
          </div>
        </template>

        <v-simple-table
          v-else-if="limitedAndDecoratedEntries.length"
          key="entries"
        >
          <tbody>
            <tr v-for="entry in limitedAndDecoratedEntries" class="entry">
              <td>
                <v-row>
                  <v-col cols="12" sm="2">
                    <div class="term tibetan" v-html="entry.term" />
                  </v-col>
                  <v-col cols="12" sm="2">
                    <v-chip
                      label
                      small
                      class="ml-2 px-2"
                      color="dictionary-label grey darken-2"
                      v-html="shortDictionaryLabelFor(entry)"
                      :class="{
                        'has-tibetan': shortDictionaryLabelForHasTibetan(entry),
                      }"
                      @click="
                        $root.openSnackbarWith(
                          dictionaryAboutFor(entry.dictionary)
                        )
                      "
                    />
                  </v-col>
                  <v-col cols="12" sm="8" class="d-flex">
                    <div class="definition" v-html="entry.definition" />
                  </v-col>
                </v-row>
              </td>
            </tr>
          </tbody>
        </v-simple-table>

        <v-alert v-else class="text-center" key="no-entries">
          No entries
        </v-alert>
      </template>
    </v-fade-transition>
  </div>
</template>

<style>
.search-page {
  display: flex;
  justify-content: center;
}

.search-page .v-input {
  background: #f0f0f0;
}

.theme--dark .search-page .v-input {
  background: #1e1e1e;
}

.search-page .v-system-bar {
  top: 63px;
}

.search-page .v-input {
  margin: 0;
  padding: 0;
}

.search-page .v-input .v-input__slot .v-input__prepend-inner {
  width: 420px;
  align-items: center;
  height: 100%;
  margin: 0;
  padding-left: 1em;
}

.search-page
  .v-input
  .v-input__slot
  .v-input__prepend-inner
  .results-and-pagination {
}

.search-page .v-input .v-input__slot .v-text-field__slot {
  margin-right: 322px;
}

.search-page .v-input .v-input__slot .v-text-field__slot input {
  font-size: 26px !important;
  height: 46px !important;
  line-height: 46px !important;
}

.search-page .v-input .v-input__slot .v-input__append-inner {
  height: 100%;
  margin: 0;
  align-items: center;
}

.search-page .v-input .v-input__slot .v-input__append-inner .v-btn {
  min-width: 75px;
}

.search-page .v-input .v-input__slot .v-input__append-inner .v-btn .v-icon {
  margin: 0;
  color: #2196f3;
}

.search-page .v-input .v-input__slot .v-input__append-inner .v-icon {
  font-size: 28px;
}

.search-page .v-input .v-input__slot .v-input__append-inner:not(:last-child) {
  width: 30px;
}

.search-page .v-data-table {
  flex: 1;
}

.search-page
  .v-data-table
  > .v-data-table__wrapper
  > table
  > tbody
  > tr:hover:not(.v-data-table__expanded__content):not(
    .v-data-table__empty-wrapper
  ) {
  background: transparent !important;
}

.theme--dark .search-page .v-data-table {
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

.theme--dark .search-page .v-alert {
  background-color: #252525;
}

.search-page .previous-queries {
  display: flex;
  margin-top: 12px;
}

.search-page .previous-queries .header {
  display: flex;
  align-items: baseline;
  margin: 0 16px;
  padding-top: 5px;
  font-family: "Segoe UI", "Roboto", sans-serif;
  font-variant: small-caps;
  white-space: nowrap;
}

.search-page .previous-queries .buttons {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
}

.search-page .previous-queries .buttons .previous-query {
  padding: 24px 32px;
  text-transform: none;
}

.search-page .previous-queries .buttons .previous-query span.tibetan {
  margin: 0 5px;
}
</style>
