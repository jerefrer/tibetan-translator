<script>
  import $ from 'jquery'

  import DictionariesFuzzySearchMixin from './DictionariesFuzzySearchMixin'
  import EventHandlers from '../services/event-handlers'

  export default {
    mixins: [DictionariesFuzzySearchMixin],
    props: {
      page: Number,
      loading: Boolean,
      dictionaries: Array,
      numberOfEntriesPerPage: Number,
      totalNumberOfEntries: Number
    },
    data () {
      return {
        dictionariesMenu: false,
        term: ''
      }
    },
    watch: {
      dictionariesMenu (value) {
        if (value == false)
          this.$emit('close:dictionariesMenu');
      }
    },
    computed: {
      dictionariesDifferentThanGlobally () {
        return this.dictionaries.find(
          (dictionary) => dictionary.enabled != dictionary.enabledInPreferences
        )
      },
      enabledDictionaries () {
        return this.dictionaries.filter((dictionary) => dictionary.enabled);
      },
      preferedDictionaries () {
        return this.dictionaries.filter((dictionary) => dictionary.enabledInPreferences);
      },
      numberOfEntriesForAllMatchedDictionaries () {
        return this.fuzzyMatchedDictionaries.sum('numberOfEntries');
      },
      numberOfEntriesForPreferedDictionaries () {
        return this.preferedDictionaries.sum('numberOfEntries');
      }
    },
    methods: {
      pluralize (text, number, includeNumber = false) {
        var pluralized = number == 1 ? text : text.pluralize();
        return includeNumber ? number.toString() + ' ' + pluralized : pluralized;
      },
      enableAllMatchedDictionaries () {
        this.fuzzyMatchedDictionaries.map((dictionary) => dictionary.enabled = true);
      },
      disableAllMatchedDictionaries () {
        this.fuzzyMatchedDictionaries.map((dictionary) => dictionary.enabled = false);
      },
      disableAllDictionaries () {
        this.dictionaries.map((dictionary) => dictionary.enabled = false);
      },
      enableOnlyPreferedDictionaries () {
        this.dictionaries.map((dictionary) => dictionary.enabled = dictionary.enabledInPreferences);
      },
      enableOnlyMatchedDictionaries () {
        this.disableAllDictionaries();
        this.enableAllMatchedDictionaries();
        this.delayedCloseMenu();
      },
      selectSingleDictionary (dictionary) {
        this.disableAllDictionaries();
        dictionary.enabled = true;
        this.delayedCloseMenu();
      },
      openMenu () {
        this.dictionariesMenu = true;
      },
      delayedCloseMenu () {
        setTimeout(() => this.closeMenu(), 500);
      },
      closeMenu () {
        this.dictionariesMenu = false;
      },
      menuIsOpened () {
        return this.dictionariesMenu;
      }
    },
    mounted () {
      var vm = this;
      EventHandlers.add({
        id: 'dictionary-menu',
        type: 'keydown',
        callback (event) {
          if (event.ctrlKey && event.key == ' ')
            vm.openMenu();
          else if (vm.menuIsOpened()) {
            var highlightedDictionary =
              $('.dictionaries-menu .v-list-item--highlighted').get(0);
            if (event.key == 'Esc')
              vm.closeMenu();
            else if (event.key == ' ') {
              var dictionaryIndex =
                $('.dictionaries-menu .v-list-item--highlighted').
                data('dictionary-index');
              if (dictionaryIndex != undefined) {
                var dictionary = vm.fuzzyMatchedDictionaries[dictionaryIndex];
                dictionary.enabled = !dictionary.enabled;
                event.preventDefault();
              }
            } else if (event.key == 'ArrowUp' || event.key == 'ArrowDown') {
              if (highlightedDictionary)
                highlightedDictionary.scrollIntoViewIfNeeded();
            } else if (event.ctrlKey || event.shiftKey) {
              if (event.key == 'Enter')
                vm.enableOnlyMatchedDictionaries();
              else if (event.key.toLowerCase() == 'e')
                vm.enableAllMatchedDictionaries();
              else if (event.key.toLowerCase() == 'd')
                vm.disableAllMatchedDictionaries();
              else if (event.key.toLowerCase() == 'r')
                vm.enableOnlyPreferedDictionaries();
              if (['enter', 'e', 'd', 'r'].includes(event.key.toLowerCase()))
                event.preventDefault();
            } else if (event.key == 'Enter' && !highlightedDictionary)
              vm.enableOnlyMatchedDictionaries();
          }
        }
      });
    },
    destroyed () {
      EventHandlers.remove('dictionary-menu');
    }
  }
</script>

<template>

  <transition-group
    name="list"
    tag="div"
    class="results-and-pagination-and-dictionaries d-flex align-center caption grey--text"
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
      {{(page - 1) * numberOfEntriesPerPage}}-{{Math.min(page * numberOfEntriesPerPage, totalNumberOfEntries)}}
    </span>

    <span
      class="list-item"
      v-if="totalNumberOfEntries > numberOfEntriesPerPage"
      key="out-of"
    >
      out of
    </span>

    <span
      class="list-item"
      :key="totalNumberOfEntries"
    >
      {{totalNumberOfEntries}}
    </span>

    <span
      class="list-item"
      v-if="totalNumberOfEntries <= numberOfEntriesPerPage"
      key="results"
    >
      {{pluralize('result', totalNumberOfEntries)}}
    </span>

    <div
      key="pagination-and-dictionaries"
      class="pagination-and-dictionaries"
    >

      <v-pagination
        circle
        v-if="totalNumberOfEntries > numberOfEntriesPerPage"
        class="list-item"
        :value="page"
        :length="Math.ceil(totalNumberOfEntries / numberOfEntriesPerPage)"
        :total-visible="0"
        :disabled="loading"
        :prev-icon="loading ? 'mdi-loading mdi-spin' : 'mdi-chevron-left'"
        :next-icon="loading ? 'mdi-loading mdi-spin' : 'mdi-chevron-right'"
        @input="$emit('change:page', $event)"
      />

      <v-menu
        bottom
        left
        v-model="dictionariesMenu"
        content-class="dictionaries-menu"
        :offset-y="true"
        :close-on-content-click="false"
      >
        <template v-slot:activator="{ on, attrs }">
          <v-btn
            rounded
            height="32"
            class="ml-2 dictionaries-menu-button"
            :class="{
              primary: dictionariesDifferentThanGlobally
            }"
            key="filter-menu"
            v-bind="attrs"
            v-on="on"
          >
            <v-icon
              class="ma-0"
              style="font-size: 21px"
            >
              mdi-book-multiple
            </v-icon>
            <span>{{enabledDictionaries.length}}</span>
            <span class="caption grey--text text--darken-1">/{{dictionaries.length}}</span>
          </v-btn>
        </template>

        <v-card>

          <v-toolbar>

            <v-text-field
              autofocus
              clearable
              hide-details
              v-model="term"
              append-icon="mdi-magnify"
            />

            <v-btn
              class="ml-4"
              color="primary"
              @click="enableAllMatchedDictionaries"
            >
              <u>E</u>nable all
              <span
                class="ml-1 caption secondary--text"
              >
                ({{pluralize('dict', fuzzyMatchedDictionaries.length, true)}},
                 {{pluralize('result', numberOfEntriesForAllMatchedDictionaries, true)}}
              </span>
            </v-btn>

            <v-btn
              class="ml-2"
              color="primary darken-2"
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
              <span
                class="ml-1 caption secondary--text"
              >
                ({{pluralize('dict', preferedDictionaries.length, true)}},
                 {{pluralize('result', numberOfEntriesForPreferedDictionaries, true)}}
              </span>
            </v-btn>

          </v-toolbar>

          <v-card-text>

            <v-list
              v-if="fuzzyMatchedDictionaries.length"
              dense
            >
              <v-list-item
                link
                v-for="(dictionary, index) in fuzzyMatchedDictionaries"
                :key="index"
                :data-dictionary-index="index"
                @click="selectSingleDictionary(dictionary)"
              >
                <v-list-item-title>
                  <span class="grey--text text--darken-1">{{index + 1}}. </span>
                  <span
                    :class="{
                      'grey--text text--darken-1': !dictionary.enabledInPreferences
                    }"
                    v-html="fuzzyDisplayFor(dictionary)"
                  />
                </v-list-item-title>
                <v-list-item-action
                  class="nowrap grey--text text--darken-1 caption flex-shrink-0"
                >
                  ({{dictionary.numberOfEntries}}
                   {{pluralize('result', dictionary.numberOfEntries)}})
                </v-list-item-action>
                <v-list-item-action>
                  <v-switch
                    v-model="dictionary.enabled"
                    hide-details
                    class="switch ml-2"
                    @click.stop
                  />
                </v-list-item-action>
              </v-list-item>
            </v-list>

            <div
              v-else
              class="text-center grey--text text--darken-2"
            >
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
    .list-item
      margin 0 2px
      cursor pointer
    .pagination-and-dictionaries
      flex 1
      display flex
      justify-content flex-end
      nav
        ul.v-pagination
          margin-left 10px
          li button.v-pagination__navigation
            background #333333
            margin 0 5px
            i.v-icon
              margin 0
              font-size 24px

  .theme--light
    .results-and-pagination-and-dictionaries
      .caption
        color #616161 !important
      nav ul.v-pagination li button.v-pagination__navigation i.v-icon
        color white

  .dictionaries-menu-button
    .v-btn__content
      align-items baseline
      .v-icon
        top 2px
        left -2px

  .dictionaries-menu
    width 80%
    .v-card__text
      max-height 60vh
      overflow-y auto
      .v-list
        display grid
</style>

<style>
  .dictionaries-menu .v-card__text .v-list {
    grid-template-columns: repeat(auto-fill, minmax( min(360px, 100%), 1fr ));
  }
</style>
