<script>
import $ from "jquery";
import _ from "underscore";
import { useTheme } from "vuetify";

import Storage from "../services/storage";
import SqlDatabase from "../services/sql-database";
import Entries from "./Entries.vue";
import TibetanTextField from "./TibetanTextField.vue";
import DictionariesMenuMixin from "./DictionariesMenuMixin";
import DictionariesDetailsMixin from "./DictionariesDetailsMixin";
import ResultsAndPaginationAndDictionaries from "./ResultsAndPaginationAndDictionaries.vue";

export default {
  mixins: [DictionariesDetailsMixin, DictionariesMenuMixin],
  components: {
    Entries,
    TibetanTextField,
    ResultsAndPaginationAndDictionaries,
  },
  setup() {
    const theme = useTheme();
    return { theme };
  },
  data() {
    return {
      searchTerm: undefined,
      entries: [],
      termsPage: 1,
      loading: false,
      mobileShowDefinition: false,
      isMobile: window.innerWidth <= 600,
    };
  },
  watch: {
    searchTerm() {
      // Reset pagination when search term changes
      this.termsPage = 1;
      this.debouncedSelectFirstTermOrClearEntries();
    },
    selectedTerm(newTerm, oldTerm) {
      this.setSearchTerm();
      // Clear entries and show loading immediately when term changes
      if (newTerm !== oldTerm && newTerm) {
        this.entries = [];
        this.loading = true;
      }
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
    isDark() {
      return this.theme.global.current.value.dark;
    },
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
    handleResize() {
      this.isMobile = window.innerWidth <= 600;
      if (!this.isMobile) {
        this.mobileShowDefinition = false;
      }
    },
    selectTermMobile(term) {
      this.pushRoute(term);
      if (this.isMobile) {
        this.mobileShowDefinition = true;
      }
    },
    showTermsList() {
      if (this.isMobile) {
        this.mobileShowDefinition = false;
      }
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
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
  },
  updated() {
    $("td.active").get(0)?.scrollIntoViewIfNeeded();
  },
};
</script>

<template>
  <div class="define-page" :class="{ 'mobile-show-definition': isMobile && mobileShowDefinition }">
    <div class="search-bar">
      <TibetanTextField
        density="compact"
        autofocus
        clearable
        hide-details
        height="56"
        ref="input"
        v-model="searchTerm"
        :menu-props="{ maxHeight: '80vh' }"
        @click:clear="clear"
        @keydown.up="selectPreviousTerm"
        @keydown.down="selectNextTerm"
        @focus="showTermsList"
        class="flex-grow-1"
      />
    </div>

    <div class="define-content-area">
      <div class="terms-drawer">
        <ResultsAndPaginationAndDictionaries
          :page="termsPage"
          :dictionaries="dictionariesForCurrentResults"
          :numberOfEntriesPerPage="numberOfTermsPerPage"
          :totalNumberOfEntries="numberOfTermsStartingWithSearchTerm"
          @change:page="termsPage = $event"
          @close:dictionariesMenu="focusInput"
        />
        <v-table v-if="termsStartingWithSearchTerm.length" class="terms-table">
          <tbody>
            <tr v-for="term in limitedTermsStartingWithSearchTerm" class="term">
              <td
                class="link tibetan"
                :class="{
                  'active bg-primary': selectedTerm == term,
                  'text-white': selectedTerm == term && !isDark,
                  'bg-primary-darken-2': selectedTerm == term && isDark,
                }"
                @click="selectTermMobile(term)"
              >
                <span v-html="term" />
              </td>
            </tr>
          </tbody>
        </v-table>
        <div
          v-else-if="searchTerm"
          class="d-flex align-center mx-4 text-caption text-grey"
          style="height: 48px"
        >
          No results.
        </div>
      </div>

      <div class="definitions-container">
        <!-- Loading state when fetching definitions -->
        <div v-if="loading" class="loading-state">
          <v-progress-circular indeterminate size="64" color="primary" />
          <div class="mt-4 text-grey">Loading definitions...</div>
        </div>

        <v-fade-transition mode="out-in" appear v-else>
          <div v-if="entriesForEnabledDictionaries.length">
            <Entries
              :entries="entriesForEnabledDictionaries"
              :initialNumberOfEntries="25"
            />
          </div>
        </v-fade-transition>
      </div>
    </div>
  </div>
</template>

<style lang="stylus">
.define-page
  display flex
  flex-direction column
  height 100%

  .search-bar
    flex-shrink 0
    height 63px
    padding 0 15px
    background #f0f0f0
    display flex
    align-items center

  .define-content-area
    flex 1
    display flex
    overflow hidden

  .terms-drawer
    width 400px
    flex-shrink 0
    background #f0f0f0
    overflow-y auto

    .results-and-pagination-and-dictionaries
      position sticky
      top 0
      z-index 1
      padding 7px 15px
      height 48px
      background #f0f0f0
      border-bottom 2px solid rgba(0, 0, 0, 0.08)

    .v-table,
    .v-table *
      border-radius 0 !important

    .v-table.terms-table
      td:last-child
        border-bottom thin solid rgba(0, 0, 0, 0.08)

    .v-table td.link
      height 42px !important
      line-height 42px !important
      font-size 21px !important
      transition all 0.28s cubic-bezier(0.4, 0, 0.2, 1)
      cursor pointer

  .definitions-container
    flex 1
    overflow-y auto
    padding 0
    position relative

    .loading-state,
    .empty-state
      display flex
      flex-direction column
      align-items center
      justify-content center
      height 200px
      text-align center

  .v-input
    .v-input__control
      height 63px
    .v-field
      padding 0
      height 63px
    .v-field__input
      padding 0
      height 63px !important
      min-height 63px !important
      font-size 26px !important
      font-family "DDC_Uchen" !important
    .v-field__append-inner
      height 100%
      align-items center
      padding 0
      .v-icon
        font-size 28px
    .v-field__outline
      display none
    .v-field__overlay
      display none

// Dark theme
.v-theme--dark .define-page
  .search-bar
    background #1e1e1e
  .terms-drawer
    background #1e1e1e
    .results-and-pagination-and-dictionaries
      background #1e1e1e
      border-bottom-color rgba(255, 255, 255, 0.12)
    .v-table.terms-table td:last-child
      border-bottom-color rgba(255, 255, 255, 0.12)
    .v-table td.link:hover
      background #444

// Light theme hover
.v-theme--light .define-page
  .terms-drawer
    .v-table td.link:hover
      background #ddd

// Mobile styles
@media (max-width: 600px)
  .define-page
    .search-bar
      padding 0 10px

    .define-content-area
      flex-direction column

    .terms-drawer
      width 100%
      flex none
      overflow-y visible

      .results-and-pagination-and-dictionaries
        position relative
        padding 7px 10px

      .v-table td.link
        padding-left 10px

    .definitions-container
      display none
      padding 0 10px

    // When showing definition on mobile
    &.mobile-show-definition
      .terms-drawer
        display none

      .definitions-container
        display block
        flex 1
</style>
