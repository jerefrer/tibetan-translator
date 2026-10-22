<script>
import _ from "underscore";

import { TERMS_BATCH_SIZE, DEBOUNCE_SEARCH_MS } from "../config/constants";
import Storage from "../services/storage";
import SqlDatabase from "../services/sql-database";
import CopyService from "../services/copy-service";
import { getScanInfo } from "../services/scan-service";
import { supportsModularPacks } from "../config/platform";
import { hasLatinDiacritics } from "../services/non-wylie-input";
import { initialTypedWylie, nextTypedWylie, typedWylieFor } from "../services/typed-wylie";
import { UiButton, UiIcon, UiSpinner, UiTibetanField, UiTooltip } from "../ui";
import Entries from "./Entries.vue";
import QuickAddDialog from "./QuickAddDialog.vue";
import SearchInsteadHint from "./SearchInsteadHint.vue";
import UninstalledPacksNotice from "./UninstalledPacksNotice.vue";
import DictionariesMenuMixin from "./DictionariesMenuMixin";
import MobileResponsiveMixin from "./mixins/MobileResponsiveMixin";
import ResultsAndPaginationAndDictionaries from "./ResultsAndPaginationAndDictionaries.vue";

const TIBETAN = /[\u0F00-\u0FFF]/;

// Board "B · Define" (and its Empty, Dark and Phone variants).
// Desktop: the field on top, the terms starting with what was typed on the
// left, the definitions of the selected term on the right.
// Phone: the field and the terms; a tap shows the definitions, with a way
// back to the terms.
export default {
  mixins: [DictionariesMenuMixin, MobileResponsiveMixin],
  inject: ["snackbar"],
  components: {
    Entries,
    QuickAddDialog,
    SearchInsteadHint,
    UninstalledPacksNotice,
    ResultsAndPaginationAndDictionaries,
    UiButton,
    UiIcon,
    UiSpinner,
    UiTibetanField,
    UiTooltip,
  },
  data() {
    return {
      searchTerm: undefined,
      entries: [],
      displayedTermsCount: TERMS_BATCH_SIZE,
      termsBatchSize: TERMS_BATCH_SIZE,
      loading: false,
      allTermsVersion: 0,
      quickAddOpen: false,
      // What the user typed when it looked like Sanskrit or another Latin-script
      // language. The field turns it into Tibetan, so it has to be kept as typed.
      searchInsteadText: "",
      // The Wylie behind the Tibetan in the field ("typed ye shes")
      typedWylieState: initialTypedWylie(),
    };
  },
  watch: {
    searchTerm(value) {
      // Kept as typed: once the field has converted part of it (kākiṇī ->
      // ཀཱཀིṇī་), it is no longer what the user would search for. A paste
      // arrives converted already, so that is all there is to keep then.
      if (hasLatinDiacritics(value) && (!TIBETAN.test(value) || !this.searchInsteadText))
        this.searchInsteadText = value.trim();
      else if (!value) this.searchInsteadText = "";
      this.typedWylieState = nextTypedWylie(this.typedWylieState, value || "");
      // Reset displayed count when search term changes
      this.displayedTermsCount = this.termsBatchSize;
      // Clear stale entries if selected term is no longer in filtered list
      if (this.selectedTerm && this.termsStartingWithSearchTerm.indexOf(this.selectedTerm) === -1) {
        this.entries = [];
      }
      this.debouncedSelectFirstTermOrClearEntries();
      // Reconnect observer after terms change
      this.$nextTick(() => this.setupTermsInfiniteScroll());
    },
    visibleTerms() {
      // Reconnect observer when visible terms change (e.g., after loading more)
      this.$nextTick(() => this.setupTermsInfiniteScroll());
    },
    selectedTerm(newTerm, oldTerm) {
      // While another page is open the route has no term; the cached page
      // ignores that, and coming back to the term it already shows, so
      // what was typed, the list and its scroll stay as they were
      if (!this.$route.path.startsWith("/define")) return;
      if (newTerm === this.shownTerm) return;
      this.shownTerm = newTerm;
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
      this.$nextTick(() => this.scrollSelectedTermIntoView());
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
    window.scrollTo(0, 0);
  },
  computed: {
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
      this.allTermsVersion; // reactive dependency — forces re-evaluation when allTerms changes
      if (!this.searchTerm) return [];
      // Read the prefix once: through `this` inside the filter it was a
      // tracked reactive read for each of the ~285,000 terms
      const prefix = this.searchTerm;
      return SqlDatabase.allTerms
        .filter((key) => key.startsWith(prefix))
        .sort();
    },
    numberOfTermsStartingWithSearchTerm() {
      return this.termsStartingWithSearchTerm.length;
    },
    copyableEntries() {
      // Scanned-dictionary entries hold a page number, not a definition — exclude them.
      return this.entriesForEnabledDictionaries.filter(
        (entry) => !getScanInfo(entry.dictionary)
      );
    },
    canAddToLexicon() {
      return supportsModularPacks();
    },
    showCopyAll() {
      return !this.loading && this.copyableEntries.length > 0;
    },
    showAddDefinition() {
      return !this.loading && this.canAddToLexicon && !!this.selectedTerm;
    },
    showingEntries() {
      return this.isMobile && this.mobileShowDefinition;
    },
    typedWylie() {
      return typedWylieFor(this.typedWylieState, this.searchTerm);
    },
  },
  methods: {
    pushRoute(term) {
      var path = "/define";
      if (term) path = path + "/" + encodeURIComponent(term);
      if (path != this.$route.path) {
        this.$router.push({ path: path });
      }
    },
    clear() {
      Storage.delete("selectedTerm");
      this.entries = [];
      this.searchTerm = "";
      this.pushRoute("");
    },
    async copyAll() {
      try {
        await CopyService.writeToClipboard(
          CopyService.entriesToText(this.selectedTerm, this.copyableEntries)
        );
        this.snackbar.open("Copied");
      } catch (err) {
        this.snackbar.open("Copy failed");
      }
    },
    setSearchTerm() {
      if (!this.searchTerm || !this.selectedTerm?.includes(this.searchTerm))
        this.searchTerm = this.selectedTerm;
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
    onLexiconEntrySaved() {
      // Re-run the current lookup so the new definition shows immediately.
      if (this.selectedTerm) this.setEntriesForSelectedTerm();
    },
    selectFirstTermOrClearEntries() {
      var firstTerm =
        this.visibleTerms &&
        this.visibleTerms[0];
      if (firstTerm) {
        this.pushRoute(firstTerm);
        // If route already matches (pushRoute was a no-op), ensure entries are loaded
        if (this.selectedTerm === firstTerm && !this.entriesForEnabledDictionaries.length)
          this.setEntriesForSelectedTerm();
      } else this.entries = [];
    },
    selectPreviousTerm() {
      if (this.selectedTermIndex > 0) {
        var previousTerm =
          this.termsStartingWithSearchTerm[this.selectedTermIndex - 1];
        this.pushRoute(previousTerm);
      }
    },
    selectNextTerm() {
      if (
        this.selectedTermIndex <
        this.termsStartingWithSearchTerm.length - 1
      ) {
        var nextTerm =
          this.termsStartingWithSearchTerm[this.selectedTermIndex + 1];
        this.pushRoute(nextTerm);
      }
    },
    onFieldKeydown(event) {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        this.selectPreviousTerm();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        this.selectNextTerm();
      }
    },
    focusInput() {
      this.$refs.input?.focus();
    },
    selectTermMobile(term) {
      this.pushRoute(term);
      this.setMobileShowDefinition(true);
    },
    scrollSelectedTermIntoView() {
      const active = this.$refs.termsList?.querySelector(".term-item.is-active");
      active?.scrollIntoView?.({ block: "nearest" });
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
    this.shownTerm = this.selectedTerm;
    this.setSearchTerm();
    this.setEntriesForSelectedTerm();
    this.debouncedSetEntriesForSelectedTerm = _.debounce(
      this.setEntriesForSelectedTerm,
      DEBOUNCE_SEARCH_MS
    );
    this.debouncedSelectFirstTermOrClearEntries = _.debounce(
      this.selectFirstTermOrClearEntries,
      DEBOUNCE_SEARCH_MS
    );
    this._onAllTermsUpdated = () => { this.allTermsVersion++; };
    window.addEventListener('all-terms-updated', this._onAllTermsUpdated);
    this.setupTermsInfiniteScroll();
  },
  activated() {
    this.$nextTick(() => this.focusInput());
  },
  beforeUnmount() {
    window.removeEventListener('all-terms-updated', this._onAllTermsUpdated);
    this.teardownTermsInfiniteScroll();
    this.debouncedSetEntriesForSelectedTerm?.cancel();
    this.debouncedSelectFirstTermOrClearEntries?.cancel();
  },
};
</script>

<template>
  <div
    class="define-page"
    :class="{ 'is-phone': isMobile, 'mobile-show-definition': showingEntries }"
    data-testid="define-page"
  >
    <div v-show="!showingEntries" class="define-search">
      <ui-tibetan-field
        ref="input"
        v-model="searchTerm"
        class="define-field"
        prepend-icon="search"
        placeholder="Type a Tibetan term"
        aria-label="Term to define"
        enterkeyhint="search"
        autofocus
        clearable
        data-testid="define-field"
        @clear="clear"
        @keydown="onFieldKeydown"
        @focus="showTermsList"
      >
        <template v-if="typedWylie && !isMobile" #append>
          <span class="typed-wylie" data-testid="define-typed">typed <b>{{ typedWylie }}</b></span>
        </template>
      </ui-tibetan-field>
    </div>

    <div class="define-body">
      <section v-show="!showingEntries" class="terms-pane" aria-label="Terms">
        <div v-if="numberOfTermsStartingWithSearchTerm" class="terms-header">
          <span class="terms-count" data-testid="define-terms-count">
            Showing {{ visibleTerms.length }} of {{ numberOfTermsStartingWithSearchTerm }} terms
          </span>
          <ResultsAndPaginationAndDictionaries
            :dictionaries="dictionariesForCurrentResults"
            :totalNumberOfEntries="numberOfTermsStartingWithSearchTerm"
            :hidePagination="true"
            @close:dictionariesMenu="focusInput"
          />
        </div>

        <div
          v-if="termsStartingWithSearchTerm.length"
          ref="termsList"
          class="terms-list"
          role="listbox"
          aria-label="Terms starting with what you typed"
          data-testid="define-terms"
        >
          <div
            v-for="term in visibleTerms"
            :key="term"
            class="term-item"
            :class="{ 'is-active': selectedTerm == term }"
            role="option"
            :aria-selected="selectedTerm == term ? 'true' : 'false'"
            data-testid="define-term"
            @click="selectTermMobile(term)"
          >{{ term }}</div>

          <!-- Sentinel for infinite scroll. Hidden from assistive technology:
               a listbox may only contain options. -->
          <div ref="termsLoadMoreSentinel" class="terms-load-more-sentinel" aria-hidden="true">
            <ui-spinner v-if="hasMoreTerms" :size="20" label="Loading more terms" />
          </div>
        </div>
        <div v-else-if="searchTerm" class="no-results" data-testid="define-no-results">
          No results.
        </div>

        <SearchInsteadHint
          v-if="searchInsteadText"
          :text="searchInsteadText"
        />
        <UninstalledPacksNotice
          v-if="searchTerm"
          :result-count="numberOfTermsStartingWithSearchTerm"
        />
      </section>

      <section v-show="!isMobile || showingEntries" class="entries-pane" aria-label="Definitions">
        <div class="entries-actions">
          <button
            v-if="isMobile"
            type="button"
            class="back-link"
            data-testid="define-back"
            @click="showTermsList"
          >
            <span class="back-link__icon"><ui-icon name="chevron-left" :size="22" :stroke-width="2.4" /></span>
            Terms
          </button>
          <div class="ui-spacer" />
          <ui-button
            v-if="showCopyAll"
            variant="ghost"
            size="sm"
            class="copy-all"
            data-testid="define-copy-all"
            @click="copyAll"
          >
            <ui-icon name="copy" :size="17" />
            Copy all
          </ui-button>
          <ui-tooltip v-if="showAddDefinition" text="Add my definition">
            <ui-button
              variant="ghost"
              size="sm"
              icon
              class="add-definition"
              aria-label="Add my definition"
              data-testid="define-add"
              @click="quickAddOpen = true"
            >
              <ui-icon name="book-plus" :size="20" />
            </ui-button>
          </ui-tooltip>
        </div>

        <div
          v-if="isMobile && selectedTerm && !loading"
          class="headword"
          data-testid="define-headword"
        >{{ selectedTerm }}</div>

        <!-- Loading state when fetching definitions -->
        <div v-if="loading" class="loading-state" data-testid="define-loading">
          <ui-spinner :size="40" />
          <div>Loading definitions...</div>
        </div>

        <transition name="ui-fade" mode="out-in" appear>
          <div
            v-if="!loading && entriesForEnabledDictionaries.length"
            class="entries-card"
            data-testid="define-entries"
          >
            <Entries
              :entries="entriesForEnabledDictionaries"
              :initialNumberOfEntries="25"
              :cards="isMobile"
            />
          </div>
        </transition>
      </section>
    </div>

    <!-- Mounted at page level (not inside .entries-actions) so it survives
         the loading state (e.g. loading=true on term change) while open,
         instead of being torn down and losing whatever the user typed. -->
    <QuickAddDialog
      v-model="quickAddOpen"
      :term="selectedTerm || ''"
      @saved="onLexiconEntrySaved"
    />
  </div>
</template>

<style lang="stylus" scoped>
.define-page
  box-sizing border-box
  height 100%
  display flex
  flex-direction column
  gap 18px
  padding 28px 40px 0
  overflow hidden
  background var(--bg)
  color var(--ink)
  font-family var(--font-ui)
  font-size var(--text-base)

// The field: 60px, accent ring when focused (UiTextField does the focus)
.define-search
  flex none
  display flex

.define-field
  flex 1
  max-width 55rem

  :deep(.ui-field__control)
    min-height var(--control-lg)
    padding 0 12px 0 18px
    border-radius var(--radius-card)

  :deep(.ui-field__prepend)
    color var(--ink)

  :deep(.ui-field__input)
    font-size var(--text-tibetan-lg)
    padding-top 0.5rem

  :deep(.ui-field__input::placeholder)
    font-family var(--font-ui)
    font-size var(--text-md)

  // The "typed …" echo sits before the clear button, as on the board
  :deep(.ui-field__clear)
    order 1

.typed-wylie
  flex none
  max-width 40%
  overflow hidden
  text-overflow ellipsis
  white-space nowrap
  font-size var(--text-sm)
  color var(--muted)

  b
    font-weight 600
    color var(--ink)

.define-body
  flex 1
  min-height 0
  display flex
  gap 28px
  margin-top 4px

// Terms
// The drawer stops at 40% of the body: at a fixed 22.5rem it kept 360px for
// the terms between 600 and 1180px and squeezed the definitions
.terms-pane
  width unquote('min(22.5rem, 40%)')
  flex none
  min-height 0
  display flex
  flex-direction column
  gap 14px
  padding-bottom 28px
  box-sizing border-box

.terms-header
  flex none
  display flex
  align-items center
  justify-content space-between
  gap 10px
  margin-bottom -4px

.terms-count
  // Wraps rather than running under the Dictionaries button at a large Text size
  font-size var(--text-sm)
  color var(--muted)

.card
  background var(--surface)
  border 1px solid var(--line)
  border-radius var(--radius-card)
  box-shadow var(--shadow-card)

.terms-list
  @extend .card
  flex 0 1 auto
  min-height 0
  overflow-y auto
  overscroll-behavior contain

.term-item
  box-sizing border-box
  min-height 3rem
  // Same centre for one line as before; room under the last line when it wraps
  padding 0.5875rem 18px 0.2875rem
  display flex
  align-items center
  border-bottom 1px solid var(--soft)
  font-family var(--font-tibetan)
  font-size var(--text-tibetan-sm)
  // A term longer than the drawer wraps (after a tsheg) instead of being cut
  overflow-wrap anywhere
  cursor pointer

  &:hover
    background var(--soft)

  &.is-active
    background var(--accent)
    color var(--on-accent)
    border-bottom-color transparent

.terms-load-more-sentinel
  display flex
  justify-content center
  align-items center
  min-height 2.75rem
  color var(--muted)

  &:empty
    min-height 1px

.no-results
  @extend .card
  flex none
  padding 16px 18px
  font-size var(--text-base)
  color var(--muted)

.terms-pane :deep(.uninstalled-notice)
  margin 0

// Definitions
.entries-pane
  flex 1
  min-width 0
  min-height 0
  display flex
  flex-direction column

.entries-actions
  flex none
  display flex
  align-items center
  justify-content flex-end
  gap 6px
  height var(--control-sm)
  margin-bottom 10px

.copy-all
  padding 0 6px

.back-link
  display flex
  align-items center
  height 2.75rem
  padding 0 8px 0 0
  border 0
  background none
  color var(--accent)
  font 600 var(--text-md) var(--font-ui)
  cursor pointer

.back-link__icon
  display inline-flex
  align-items center
  justify-content center
  width 2.75rem
  height 2.75rem

.entries-card
  @extend .card
  flex 0 1 auto
  min-height 0
  margin-bottom 28px
  overflow-y auto

.loading-state
  display flex
  flex-direction column
  align-items center
  justify-content center
  gap 16px
  height 12.5rem
  color var(--muted)

.headword
  flex none
  font-family var(--font-tibetan)
  font-size 2.125rem
  line-height 1.5
  color var(--accent)
  overflow-wrap anywhere

// Phone (boards "B · Define on a phone" and "… entries")
.define-page.is-phone
  gap 14px
  padding 16px 16px 0

  .define-field
    max-width none

    :deep(.ui-field__control)
      min-height 3.375rem
      padding 0 8px 0 14px

    :deep(.ui-field__input)
      font-size var(--text-tibetan-md)

  .define-body
    flex-direction column
    margin-top 0

  .terms-pane
    width auto
    flex 1
    padding-bottom 16px

  .terms-header
    margin-bottom 0

  .term-item
    min-height 3.25rem
    font-size var(--text-tibetan-md)

  // Room for the floating help button after the last term (the pane
  // already leaves 16px under the list)
  .terms-list
    padding-bottom calc(var(--phone-help-clearance) - 16px)

  .entries-pane
    flex 1
    overflow-y auto
    -webkit-overflow-scrolling touch
    gap 14px
    padding-bottom var(--phone-help-clearance)

  .entries-actions
    height auto
    margin 0 -6px

  .copy-all,
  .add-definition
    height 2.75rem

  .add-definition
    width 2.75rem

  .entries-card
    flex none
    margin-bottom 0
    overflow visible
    background none
    border 0
    border-radius 0
    box-shadow none
</style>
