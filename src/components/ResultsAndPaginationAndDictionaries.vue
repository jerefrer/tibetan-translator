<script>
import $ from "jquery";
import pluralize from "pluralize";

import DictionariesFuzzySearchMixin from "./DictionariesFuzzySearchMixin";
import DictionariesMenuHelpTab from "./DictionariesMenuHelpTab.vue";
import EventHandlers from "../services/event-handlers";

export default {
  mixins: [DictionariesFuzzySearchMixin],
  components: {
    DictionariesMenuHelpTab,
  },
  props: {
    page: Number,
    loading: Boolean,
    dictionaries: Array,
    numberOfEntriesPerPage: Number,
    totalNumberOfEntries: Number,
  },
  emits: ['change:page', 'close:dictionariesMenu'],
  data() {
    return {
      dictionariesMenu: false,
      term: "",
    };
  },
  watch: {
    dictionariesMenu(value) {
      if (value == false) this.$emit("close:dictionariesMenu");
    },
  },
  computed: {
    dictionariesDifferentThanGlobally() {
      return this.dictionaries.find(
        (dictionary) => dictionary.enabled != dictionary.enabledInPreferences
      );
    },
    enabledDictionaries() {
      return this.dictionaries.filter((dictionary) => dictionary.enabled);
    },
    preferedDictionaries() {
      return this.dictionaries.filter(
        (dictionary) => dictionary.enabledInPreferences
      );
    },
    numberOfEntriesForAllMatchedDictionaries() {
      return this.sumNumberOfEntriesFor(this.fuzzyMatchedDictionaries);
    },
    numberOfEntriesForPreferedDictionaries() {
      return this.sumNumberOfEntriesFor(this.preferedDictionaries);
    },
  },
  methods: {
    pluralize: pluralize,
    sumNumberOfEntriesFor(dictionaries) {
      return dictionaries.reduce(
        (sum, dictionary) => sum + dictionary.numberOfEntries,
        0
      );
    },
    enableAllMatchedDictionaries() {
      this.fuzzyMatchedDictionaries.map(
        (dictionary) => (dictionary.enabled = true)
      );
    },
    disableAllMatchedDictionaries() {
      this.fuzzyMatchedDictionaries.map(
        (dictionary) => (dictionary.enabled = false)
      );
    },
    disableAllDictionaries() {
      this.dictionaries.map((dictionary) => (dictionary.enabled = false));
    },
    enableOnlyPreferedDictionaries() {
      this.dictionaries.map(
        (dictionary) => (dictionary.enabled = dictionary.enabledInPreferences)
      );
    },
    enableOnlyMatchedDictionaries() {
      this.disableAllDictionaries();
      this.enableAllMatchedDictionaries();
      this.delayedCloseMenu();
    },
    selectSingleDictionary(dictionary) {
      this.disableAllDictionaries();
      dictionary.enabled = true;
      this.delayedCloseMenu();
    },
    openMenu() {
      this.dictionariesMenu = true;
    },
    delayedCloseMenu() {
      setTimeout(() => this.closeMenu(), 500);
    },
    closeMenu() {
      this.dictionariesMenu = false;
    },
    menuIsOpened() {
      return this.dictionariesMenu;
    },
  },
  mounted() {
    var vm = this;
    EventHandlers.add({
      id: "dictionary-menu",
      type: "keydown",
      callback(event) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() == "b" && !vm.menuIsOpened()) vm.openMenu();
        else if (vm.menuIsOpened()) {
          var highlightedDictionary = $(
            ".dictionaries-menu .v-list-item--highlighted"
          ).get(0);
          if (event.key == "Esc") vm.closeMenu();
          else if (event.key == " ") {
            var dictionaryIndex = $(
              ".dictionaries-menu .v-list-item--highlighted"
            ).data("dictionary-index");
            if (dictionaryIndex != undefined) {
              var dictionary = vm.fuzzyMatchedDictionaries[dictionaryIndex];
              dictionary.enabled = !dictionary.enabled;
              event.preventDefault();
            }
          } else if (event.key == "ArrowUp" || event.key == "ArrowDown") {
            if (highlightedDictionary)
              highlightedDictionary.scrollIntoViewIfNeeded();
          } else if (event.ctrlKey || event.shiftKey) {
            if (event.key == "Enter") vm.enableOnlyMatchedDictionaries();
            else if (event.key.toLowerCase() == "a")
              vm.enableAllMatchedDictionaries();
            else if (event.key.toLowerCase() == "n")
              vm.disableAllMatchedDictionaries();
            else if (event.key.toLowerCase() == "r")
              vm.enableOnlyPreferedDictionaries();
            if (["enter", "a", "n", "r"].includes(event.key.toLowerCase()))
              event.preventDefault();
          } else if (event.key == "Enter" && !highlightedDictionary)
            vm.enableOnlyMatchedDictionaries();
        }
      },
    });
  },
  unmounted() {
    EventHandlers.remove("dictionary-menu");
  },
};
</script>

<template>
  <transition-group
    name="list"
    tag="div"
    class="results-and-pagination-and-dictionaries d-flex align-center text-caption text-grey"
  >
    <span
      class="list-item"
      v-if="totalNumberOfEntries > numberOfEntriesPerPage"
      key="entries"
    >
      Entries
    </span>

    <span
      class="list-item"
      v-if="totalNumberOfEntries > numberOfEntriesPerPage"
      :key="totalNumberOfEntries + '-' + page"
    >
      {{ (page - 1) * numberOfEntriesPerPage }}-{{
        Math.min(page * numberOfEntriesPerPage, totalNumberOfEntries)
      }}
    </span>

    <span
      class="list-item"
      v-if="totalNumberOfEntries > numberOfEntriesPerPage"
      key="out-of"
    >
      out of
    </span>

    <span class="list-item" :key="totalNumberOfEntries">
      {{ totalNumberOfEntries }}
    </span>

    <span
      class="list-item"
      v-if="totalNumberOfEntries <= numberOfEntriesPerPage"
      key="results"
    >
      {{ pluralize("result", totalNumberOfEntries) }}
    </span>

    <div key="pagination-and-dictionaries" class="pagination-and-dictionaries">
      <v-pagination
        rounded
        v-if="totalNumberOfEntries > numberOfEntriesPerPage"
        class="list-item"
        :model-value="page"
        :length="Math.ceil(totalNumberOfEntries / numberOfEntriesPerPage)"
        :total-visible="0"
        :disabled="loading"
        :prev-icon="loading ? 'mdi-loading mdi-spin' : 'mdi-chevron-left'"
        :next-icon="loading ? 'mdi-loading mdi-spin' : 'mdi-chevron-right'"
        @update:model-value="$emit('change:page', $event)"
      />

      <v-menu
        v-model="dictionariesMenu"
        location="bottom end"
        :close-on-content-click="false"
      >
        <template v-slot:activator="{ props }">
          <v-btn
            v-if="totalNumberOfEntries > 0"
            rounded
            height="32"
            class="ml-2 dictionaries-menu-button"
            :class="{
              'bg-primary': dictionariesDifferentThanGlobally,
            }"
            key="filter-menu"
            v-bind="props"
          >
            <v-icon class="ma-0" style="font-size: 18px">
              mdi-book-multiple
            </v-icon>
            <span class="ml-1">{{ enabledDictionaries.length }}</span>
            <span class="dict-total">/{{ dictionaries.length }}</span>
          </v-btn>
        </template>

        <v-card class="dictionaries-menu" elevation="8">
          <div class="dictionaries-menu-header">
            <v-text-field
              autofocus
              clearable
              hide-details
              variant="outlined"
              density="compact"
              v-model="term"
              placeholder="Filter dictionaries..."
              prepend-inner-icon="mdi-magnify"
              class="search-field"
            />

            <div class="action-buttons">
              <v-btn
                variant="tonal"
                color="success"
                @click="enableAllMatchedDictionaries"
              >
                <v-icon start>mdi-check-all</v-icon>
                Enable &nbsp;<u>a</u>ll
              </v-btn>

              <v-btn
                variant="tonal"
                color="error"
                @click="disableAllMatchedDictionaries"
              >
                <v-icon start>mdi-close-circle-multiple</v-icon>
                Enable &nbsp;<u>n</u>one
              </v-btn>

              <v-btn
                variant="tonal"
                color="warning"
                @click="enableOnlyPreferedDictionaries"
              >
                <v-icon start>mdi-restore</v-icon>
                <u>R</u>estore preferences
              </v-btn>
            </div>
          </div>

          <v-divider />

          <v-card-text class="dictionaries-list-container">
            <v-list v-if="fuzzyMatchedDictionaries.length" density="compact" class="dictionaries-list">
              <v-list-item
                v-for="(dictionary, index) in fuzzyMatchedDictionaries"
                :key="index"
                :data-dictionary-index="index"
                @click="dictionary.enabled = !dictionary.enabled"
              >
                <v-list-item-title>
                  <span
                    :class="{ 'text-grey': !dictionary.enabled }"
                    v-html="fuzzyDisplayFor(dictionary)"
                  />
                </v-list-item-title>
                <template v-slot:append>
                  <v-switch
                    v-model="dictionary.enabled"
                    hide-details
                    density="compact"
                    class="switch"
                    color="primary"
                    @click.stop
                  />
                </template>
              </v-list-item>
            </v-list>

            <div v-else class="no-results">
              <v-icon size="48" color="grey-lighten-1">mdi-book-search</v-icon>
              <div class="mt-2 text-grey">No matching dictionary</div>
            </div>
          </v-card-text>
        </v-card>
      </v-menu>
    </div>
  </transition-group>
</template>

<style lang="stylus">
.results-and-pagination-and-dictionaries
  white-space nowrap
  .list-item
    margin 0 2px
    cursor pointer
  .pagination-and-dictionaries
    flex 1
    display flex
    justify-content flex-end
    align-items center
    /* Vuetify 3 pagination structure */
    .v-pagination
      margin-left 10px
      .v-pagination__list
        gap 0
      .v-pagination__prev,
      .v-pagination__next
        .v-btn
          width 32px !important
          height 32px !important
          min-width 32px !important
          background #333333 !important
          border-radius 50% !important
          margin 0 3px
          box-shadow none !important
          .v-icon
            margin 0
            font-size 20px
            color white

.v-theme--light
  .results-and-pagination-and-dictionaries
    .text-caption
      color #616161 !important

.dictionaries-menu-button
  .v-btn__content
    align-items baseline
    .v-icon
      top 1px
  .dict-total
    opacity 0.6
    font-size 0.85em

.dictionaries-menu
  width auto
  min-width 400px
  max-width 600px
  border-radius 12px !important
  overflow hidden

  .dictionaries-menu-header
    padding 16px
    background linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%)

    .search-field
      margin-bottom 12px

    .action-buttons
      display flex
      justify-content space-between
      gap 8px

  .dictionaries-list-container
    max-height 400px
    overflow-y auto
    padding 8px 0 !important

  .dictionaries-list
    background transparent

    .v-list-item
      border-radius 8px
      padding 6px 12px
      min-height 40px
      transition all 0.15s ease

      &:hover
        background rgba(0, 0, 0, 0.04)

  .no-results
    display flex
    flex-direction column
    align-items center
    justify-content center
    padding 48px 16px

/* Dark theme */
.v-theme--dark .dictionaries-menu
  .dictionaries-menu-header
    background linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%)

  .dictionaries-list .v-list-item
    &:hover
      background rgba(255, 255, 255, 0.06)
</style>

<style>
@media (max-width: 600px) {
  .dictionaries-menu {
    width: 95vw !important;
    min-width: unset !important;
    max-width: unset !important;
  }
  .dictionaries-menu .dictionaries-menu-header .action-buttons {
    flex-direction: column;
  }
  .dictionaries-menu .dictionaries-menu-header .action-buttons .v-btn {
    width: 100%;
  }
}
</style>
