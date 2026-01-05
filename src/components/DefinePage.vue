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
      displayedTermsCount: 100, // Start with 100 terms
      termsBatchSize: 100, // Load 100 more each time
      loading: false,
      mobileShowDefinition: false,
      isMobile: window.innerWidth <= 600,
    };
  },
  watch: {
    searchTerm() {
      // Reset displayed count when search term changes
      this.displayedTermsCount = this.termsBatchSize;
      this.debouncedSelectFirstTermOrClearEntries();
      // Reconnect observer after terms change
      this.$nextTick(() => this.setupTermsInfiniteScroll());
    },
    visibleTerms() {
      // Reconnect observer when visible terms change (e.g., after loading more)
      this.$nextTick(() => this.setupTermsInfiniteScroll());
    },
    selectedTerm(newTerm, oldTerm) {
      this.setSearchTerm();
      // Clear entries and show loading immediately when term changes
      if (newTerm !== oldTerm && newTerm) {
        this.entries = [];
        this.loading = true;
      }
      this.debouncedSetEntriesForSelectedTerm();
      // Ensure selected term is visible by expanding displayed count if needed
      if (this.selectedTermIndex >= this.displayedTermsCount) {
        this.displayedTermsCount = this.selectedTermIndex + this.termsBatchSize;
      }
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
    selectedTerm() {
      return this.$route.params.term;
    },
    selectedTermIndex() {
      return this.termsStartingWithSearchTerm.indexOf(this.selectedTerm);
    },
    visibleTerms() {
      // Only return terms up to displayedTermsCount - no upfront processing
      return this.termsStartingWithSearchTerm.slice(0, this.displayedTermsCount);
    },
    hasMoreTerms() {
      return this.displayedTermsCount < this.numberOfTermsStartingWithSearchTerm;
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
        this.visibleTerms &&
        this.visibleTerms[0];
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
    loadMoreTerms() {
      if (this.hasMoreTerms) {
        this.displayedTermsCount += this.termsBatchSize;
      }
    },
    setupTermsInfiniteScroll() {
      // Teardown existing observer first
      this.teardownTermsInfiniteScroll();

      this.$nextTick(() => {
        const sentinel = this.$refs.termsLoadMoreSentinel;
        const scrollContainer = this.$refs.termsList;
        if (!sentinel || !scrollContainer) return;

        this.termsObserver = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting && this.hasMoreTerms) {
            this.loadMoreTerms();
          }
        }, {
          root: scrollContainer, // Use the scroll container as root
          rootMargin: '100px'
        });

        this.termsObserver.observe(sentinel);
      });
    },
    teardownTermsInfiniteScroll() {
      if (this.termsObserver) {
        this.termsObserver.disconnect();
        this.termsObserver = null;
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
    this.setupTermsInfiniteScroll();
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
    this.teardownTermsInfiniteScroll();
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
        variant="plain"
        autofocus
        clearable
        hide-details
        height="56"
        ref="input"
        v-model="searchTerm"
        placeholder="Type in a Tibetan term"
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
        <div class="terms-header">
          <span class="terms-count text-caption text-grey" v-if="numberOfTermsStartingWithSearchTerm">
            Showing {{ visibleTerms.length }} of {{ numberOfTermsStartingWithSearchTerm }} terms
          </span>
          <ResultsAndPaginationAndDictionaries
            :dictionaries="dictionariesForCurrentResults"
            :totalNumberOfEntries="numberOfTermsStartingWithSearchTerm"
            :hidePagination="true"
            @close:dictionariesMenu="focusInput"
          />
        </div>
        <div v-if="termsStartingWithSearchTerm.length" ref="termsList" class="terms-list">
          <div
            v-for="term in visibleTerms"
            :key="term"
            class="term-item tibetan"
            :class="{
              'active bg-primary': selectedTerm == term,
              'text-white': selectedTerm == term && !isDark,
              'bg-primary-darken-2': selectedTerm == term && isDark,
            }"
            @click="selectTermMobile(term)"
          >
            <span v-html="term" />
          </div>

          <!-- Sentinel for infinite scroll -->
          <div ref="termsLoadMoreSentinel" class="terms-load-more-sentinel">
            <v-progress-circular
              v-if="hasMoreTerms"
              indeterminate
              size="20"
              color="grey"
            />
          </div>
        </div>
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
  height 100%  // Fill parent container
  overflow hidden

  .search-bar
    flex-shrink 0
    height 63px
    padding 0 15px
    background #fffcf4
    display flex
    align-items center
    border-bottom 2px solid rgba(0, 0, 0, 0.1)
    z-index 10

  .define-content-area
    flex 1
    display flex
    overflow hidden
    min-height 0

  .terms-drawer
    width 400px
    flex-shrink 0
    background var(--paper, #FAF3E0)
    border-right 2px solid rgba(0, 0, 0, 0.1)
    display flex
    flex-direction column
    overflow hidden

    .terms-header
      display flex
      align-items center
      justify-content space-between
      padding 7px 15px
      min-height 48px
      background var(--paper, #FAF3E0)
      border-bottom 2px solid rgba(0, 0, 0, 0.08)
      flex-shrink 0

      .terms-count
        white-space nowrap

    .terms-list
      flex 1
      overflow-y auto
      min-height 0

    .term-item
      min-height 48px
      line-height 48px
      font-size 21px
      padding 0 16px
      border-bottom thin solid rgba(0, 0, 0, 0.08)
      transition background 0.2s ease
      cursor pointer

      &:hover
        background rgba(0, 0, 0, 0.04)

    .terms-load-more-sentinel
      display flex
      justify-content center
      align-items center
      padding 12px
      min-height 44px

  .definitions-container
    flex 1
    overflow-y auto
    padding 0
    position relative
    background white

    .loading-state,
    .empty-state
      display flex
      flex-direction column
      align-items center
      justify-content center
      height 200px
      text-align center

// Input field styles - using flat CSS for proper specificity
.define-page .v-input
  background transparent !important

.define-page .v-input .v-input__control
  height 63px

.define-page .v-input .v-field
  padding 0
  height 63px
  background transparent !important
  --v-field-padding-start 0
  --v-field-padding-end 0

.define-page .v-input .v-field__field
  height 63px

.define-page .v-input .v-field__input
  padding 0 12px
  height 63px !important
  min-height 63px !important
  font-size 26px !important
  font-family "DDC_Uchen" !important

.define-page .v-input .v-field__input::placeholder
  font-family "Segoe UI", "Roboto", sans-serif !important
  font-size 18px !important
  opacity 0.5
  color #666

.define-page .v-input .v-field__append-inner,
.define-page .v-input .v-field__clearable
  height 63px
  display flex
  align-items center
  padding 0 8px

.define-page .v-input .v-field__append-inner .v-icon,
.define-page .v-input .v-field__clearable .v-icon
  font-size 28px

.define-page .v-input .v-field__outline
  display none

.define-page .v-input .v-field__overlay
  display none

// Remove any input borders to avoid conflict with container border
.define-page .v-input,
.define-page .v-input .v-field,
.define-page .v-input .v-field__field,
.define-page .v-input .v-field__input
  border none !important
  border-bottom none !important
  box-shadow none !important

// Dark theme input
.v-theme--dark .define-page .v-input
  background #1e1e1e !important

// Dark theme placeholder
.v-theme--dark .define-page .v-input .v-field__input::placeholder
  color #aaa

// Dark theme
.v-theme--dark .define-page
  .search-bar
    background #1e1e1e
    border-bottom-color rgba(255, 255, 255, 0.12)
  .terms-drawer
    background #1e1e1e
    border-right-color rgba(255, 255, 255, 0.12)
    .terms-header
      background #1e1e1e
      border-bottom-color rgba(255, 255, 255, 0.12)
    .term-item
      border-bottom-color rgba(255, 255, 255, 0.12)
      &:hover
        background rgba(255, 255, 255, 0.08)
  .definitions-container
    background #252525

// Light theme hover
.v-theme--light .define-page
  .terms-drawer
    .term-item:hover
      background #ddd

// Mobile styles
@media (max-width: 600px)
  .define-page
    height 100%

    .search-bar
      padding 0 10px

    .define-content-area
      flex-direction column
      flex 1
      min-height 0

    .terms-drawer
      width 100%
      flex 1
      display flex
      flex-direction column
      overflow hidden
      min-height 0

      .terms-header
        padding 7px 10px
        flex-shrink 0

      .terms-list
        flex 1
        overflow-y auto
        min-height 0
        -webkit-overflow-scrolling touch

      .term-item
        padding-left 10px

    .definitions-container
      display none
      padding 0 10px

    // When showing definition on mobile
    &.mobile-show-definition
      .terms-drawer
        display none

      .definitions-container
        display flex
        flex-direction column
        flex 1
        overflow-y auto
        min-height 0
</style>
