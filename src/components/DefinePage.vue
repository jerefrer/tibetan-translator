<script>
import Vue from "vue";

import $ from "jquery";
import _ from "underscore";

import Storage from "../services/storage";
import SqlDatabase from "../services/sql-database";
import Entries from "./Entries";
import TibetanTextField from "./TibetanTextField";
import DictionariesMenuMixin from "./DictionariesMenuMixin";
import DictionariesDetailsMixin from "./DictionariesDetailsMixin";
import ResultsAndPaginationAndDictionaries from "./ResultsAndPaginationAndDictionaries";

export default {
  mixins: [DictionariesDetailsMixin, DictionariesMenuMixin],
  components: {
    Entries,
    TibetanTextField,
    ResultsAndPaginationAndDictionaries,
  },
  data() {
    return {
      searchTerm: undefined,
      entries: [],
      termsPage: 1,
      loading: false,
    };
  },
  watch: {
    searchTerm() {
      this.debouncedSelectFirstTermOrClearEntries();
    },
    selectedTerm() {
      this.setSearchTerm();
      this.debouncedSetEntriesForSelectedTerm();
      this.termsPage =
        Math.floor(this.selectedTermIndex / this.numberOfTermsPerPage) + 1;
    },
  },
  beforeRouteEnter(to, from, next) {
    var storedKey = Storage.get("selectedTerm");
    if (!to.params.term && storedKey) next("/define/" + storedKey);
    else next();
  },
  beforeRouteUpdate(to, from, next) {
    next();
    Storage.set("selectedTerm", to.params.term);
    $(window).scrollTop(0);
  },
  computed: {
    numberOfTermsPerPage() {
      return 100;
    },
    selectedTerm() {
      return this.$route.params.term;
    },
    selectedTermIndex() {
      return this.termsStartingWithSearchTerm.indexOf(this.selectedTerm);
    },
    limitedTermsStartingWithSearchTerm() {
      return this.termsStartingWithSearchTerm
        .slice((this.termsPage - 1) * this.numberOfTermsPerPage)
        .slice(0, this.numberOfTermsPerPage);
    },
    termsStartingWithSearchTerm() {
      if (!this.searchTerm) return [];
      return SqlDatabase.allTerms
        .filter((key) => key.indexOf(this.searchTerm) == 0)
        .sort();
    },
    numberOfTermsStartingWithSearchTerm() {
      return this.termsStartingWithSearchTerm.length;
    },
  },
  methods: {
    pushRoute(term) {
      var path = "/define";
      if (term) path = path + "/" + encodeURIComponent(term);
      if (path != this.$route.path) {
        this.setPageTitle(term);
        this.$router.push({ path: path });
      }
    },
    clear() {
      Storage.delete("selectedTerm");
      this.entries = [];
      this.pushRoute("");
    },
    setSearchTerm() {
      if (!this.searchTerm || !this.selectedTerm?.includes(this.searchTerm))
        this.searchTerm = this.selectedTerm;
    },
    setPageTitle(term) {
      return;
      document.title = "Translator / Define";
      if (term) document.title += " / " + term;
    },
    setEntriesForSelectedTerm() {
      if (this.selectedTerm) {
        this.loading = true;
        SqlDatabase.getEntriesFor(this.selectedTerm)
          .then((rows) => {
            this.entries = rows;
            this.resetDictionariesToDefaultAndSetNumberOfEntries();
          })
          .finally(() => (this.loading = false));
      }
    },
    selectFirstTermOrClearEntries() {
      var firstTerm =
        this.limitedTermsStartingWithSearchTerm &&
        this.limitedTermsStartingWithSearchTerm[0];
      if (firstTerm) {
        if (
          firstTerm == this.searchTerm &&
          !this.entriesForEnabledDictionaries.length
        )
          this.setEntriesForSelectedTerm();
        else this.pushRoute(firstTerm);
      } else this.entries = [];
    },
    selectPreviousTerm() {
      if (this.selectedTermIndex > 0) {
        var previousTerm =
          this.termsStartingWithSearchTerm[this.selectedTermIndex - 1];
        this.pushRoute(previousTerm);
      }
    },
    selectNextTerm(event) {
      if (
        this.selectedTermIndex <
        this.termsStartingWithSearchTerm.length - 1
      ) {
        var nextTerm =
          this.termsStartingWithSearchTerm[this.selectedTermIndex + 1];
        this.pushRoute(nextTerm);
      }
    },
    focusInput() {
      this.$refs.input.focus();
    },
  },
  mounted() {
    this.setSearchTerm();
    this.setPageTitle(this.selectedTerm);
    this.setEntriesForSelectedTerm();
    this.debouncedSetEntriesForSelectedTerm = _.debounce(
      this.setEntriesForSelectedTerm,
      500
    );
    this.debouncedSelectFirstTermOrClearEntries = _.debounce(
      this.selectFirstTermOrClearEntries,
      500
    );
  },
  updated() {
    $("td.active").get(0)?.scrollIntoViewIfNeeded();
  },
};
</script>

<template>
  <div class="define-page">
    <v-system-bar app height="63">
      <TibetanTextField
        dense
        autofocus
        clearable
        hide-details
        height="56"
        ref="input"
        v-model="searchTerm"
        :menu-props="{ maxHeight: '80vh' }"
        @click:clear="clear"
        @keydown.up.native="selectPreviousTerm"
        @keydown.down.native="selectNextTerm"
        class="flex-grow-1"
      />
    </v-system-bar>

    <v-navigation-drawer app width="400px" permanent>
      <ResultsAndPaginationAndDictionaries
        :page="termsPage"
        :dictionaries="dictionariesForCurrentResults"
        :numberOfEntriesPerPage="numberOfTermsPerPage"
        :totalNumberOfEntries="numberOfTermsStartingWithSearchTerm"
        @change:page="termsPage = $event"
        @close:dictionariesMenu="focusInput"
      />
      <v-simple-table v-if="termsStartingWithSearchTerm.length">
        <tbody>
          <tr v-for="term in limitedTermsStartingWithSearchTerm" class="term">
            <td
              class="link tibetan"
              :class="{
                'active primary': selectedTerm == term,
                'white--text': selectedTerm == term && !$vuetify.theme.dark,
                'darken-2': selectedTerm == term && $vuetify.theme.dark,
              }"
              @click="pushRoute(term)"
            >
              <span v-html="term" />
            </td>
          </tr>
        </tbody>
      </v-simple-table>
      <div
        v-else-if="searchTerm"
        class="d-flex align-center mx-4 caption grey--text"
        style="height: 48px"
      >
        No results.
      </div>
    </v-navigation-drawer>

    <v-container fluid>
      <v-overlay absolute opacity="1" :value="loading">
        <v-progress-circular indeterminate size="64" />
      </v-overlay>

      <v-row no-gutters>
        <v-col cols="12">
          <v-fade-transition mode="out-in" appear>
            <div v-if="entriesForEnabledDictionaries.length">
              <Entries
                :entries="entriesForEnabledDictionaries"
                :initialNumberOfEntries="25"
              />
            </div>
          </v-fade-transition>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<style lang="stylus">
.define-page
  height 100%

  .v-system-bar
    top 63px
    padding 0
    background #f0f0f0
    &.theme--dark
      background #1e1e1e

    .v-text-field__slot
      margin 0 16px
      input
        height 46px !important
        line-height 46px !important
        font-size 26px !important
        font-family "DDC_Uchen" !important
        max-height none !important

  .v-input
    .v-input__slot
      .v-input__append-inner
        height 100%
        align-items center
        .v-input__icon
          width 40px
        .v-icon
          font-size 28px

  .v-navigation-drawer
    background #f0f0f0
    &.theme--dark
      background #1e1e1e

    .results-and-pagination-and-dictionaries
      position fixed
      padding 7px 15px
      height 48px
      left 0
      right 16px
      background #f0f0f0
      border-bottom 2px solid rgba(255, 255, 255, 0.12)

    .v-data-table,
    .v-data-table *
      border-radius 0 !important
    .v-data-table
      margin-top 48px
      td:last-child
        border-bottom thin solid rgba(255, 255, 255, 0.12)

    .v-data-table td.link
      height 42px !important
      line-height 42px !important
      font-size 21px !important
      transition all 0.28s cubic-bezier(0.4, 0, 0.2, 1)
      cursor pointer

  .container
    padding 0

.theme--dark
  .results-and-pagination-and-dictionaries
    background #1e1e1e !important
  .v-data-table > .v-data-table__wrapper > table > tbody > tr > td.link:hover
    background #444
    border-bottom 1px solid #444

.theme--light
  .v-data-table > .v-data-table__wrapper > table > tbody > tr > td.link:hover
    background #aaa
    border-bottom 1px solid #aaa
</style>
