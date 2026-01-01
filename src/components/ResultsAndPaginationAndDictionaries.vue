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
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() == "d" && !vm.menuIsOpened()) vm.openMenu();
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
            else if (event.key.toLowerCase() == "e")
              vm.enableAllMatchedDictionaries();
            else if (event.key.toLowerCase() == "d")
              vm.disableAllMatchedDictionaries();
            else if (event.key.toLowerCase() == "r")
              vm.enableOnlyPreferedDictionaries();
            if (["enter", "e", "d", "r"].includes(event.key.toLowerCase()))
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
            rounded
            height="32"
            class="ml-2 dictionaries-menu-button"
            :class="{
              'bg-primary': dictionariesDifferentThanGlobally,
            }"
            key="filter-menu"
            v-bind="props"
          >
            <v-icon class="ma-0" style="font-size: 21px">
              mdi-book-multiple
            </v-icon>
            <span>{{ enabledDictionaries.length }}</span>
            <span class="text-caption">/{{ dictionaries.length }}</span>
          </v-btn>
        </template>

        <v-card class="dictionaries-menu">
          <v-toolbar>
            <v-text-field
              autofocus
              clearable
              hide-details
              v-model="term"
              append-inner-icon="mdi-magnify"
            />

            <v-btn
              class="ml-4"
              color="primary"
              @click="enableAllMatchedDictionaries"
            >
              <u>E</u>nable all
              <span class="ml-1 text-caption text-secondary">
                ({{ pluralize("dict", fuzzyMatchedDictionaries.length, true) }},
                {{
                  pluralize(
                    "result",
                    numberOfEntriesForAllMatchedDictionaries,
                    true
                  )
                }})
              </span>
            </v-btn>

            <v-btn
              class="ml-2"
              color="primary-darken-2"
              @click="disableAllMatchedDictionaries"
            >
              <u>D</u>isable all
            </v-btn>

            <v-btn
              class="ml-2"
              color="orange"
              @click="enableOnlyPreferedDictionaries"
            >
              <u>R</u>estore preferences
              <span class="ml-1 text-caption text-secondary">
                ({{ pluralize("dict", preferedDictionaries.length, true) }},
                {{
                  pluralize(
                    "result",
                    numberOfEntriesForPreferedDictionaries,
                    true
                  )
                }})
              </span>
            </v-btn>
          </v-toolbar>

          <v-card-text>
            <v-list v-if="fuzzyMatchedDictionaries.length" density="compact">
              <v-list-item
                v-for="(dictionary, index) in fuzzyMatchedDictionaries"
                :key="index"
                :data-dictionary-index="index"
                @click="selectSingleDictionary(dictionary)"
              >
                <v-list-item-title>
                  <span class="text-grey-darken-1"
                    >{{ index + 1 }}.
                  </span>
                  <span
                    :class="{
                      'text-grey-darken-1':
                        !dictionary.enabledInPreferences,
                    }"
                    v-html="fuzzyDisplayFor(dictionary)"
                  />
                </v-list-item-title>
                <template v-slot:append>
                  <span class="nowrap text-grey-darken-1 text-caption flex-shrink-0 mr-2">
                    ({{ dictionary.numberOfEntries }}
                    {{ pluralize("result", dictionary.numberOfEntries) }})
                  </span>
                  <v-switch
                    v-model="dictionary.enabled"
                    hide-details
                    density="compact"
                    class="switch ml-2"
                    color="primary"
                    @click.stop
                  />
                </template>
              </v-list-item>
            </v-list>

            <div v-else class="text-center text-grey-darken-2">
              No matching dictionary.
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
      top 2px
      left -2px

.dictionaries-menu
  width 80vw
  max-width 1200px
  .v-card__text
    max-height 60vh
    overflow-y auto
    .v-list
      display grid
</style>

<style>
.dictionaries-menu .v-card__text .v-list {
  grid-template-columns: repeat(auto-fill, minmax(min(360px, 100%), 1fr));
}
</style>
