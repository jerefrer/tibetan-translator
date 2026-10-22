<script>
import pluralize from "pluralize";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
} from "reka-ui";

import { UiButton, UiIcon, UiPagination, UiSwitch, UiTextField } from "../ui";
import DictionariesFuzzySearchMixin from "./DictionariesFuzzySearchMixin";
import EventHandlers from "../services/event-handlers";

// The "Dictionaries" button and its menu, shared by Define, Search and Split.
// The menu picks which dictionaries the current results come from, for this
// lookup only (the page resets it to the Settings choice on the next one).
//
// The pagination half is kept for callers that do not pass hidePagination;
// none does today.
export default {
  mixins: [DictionariesFuzzySearchMixin],
  components: {
    PopoverRoot,
    PopoverTrigger,
    PopoverPortal,
    PopoverContent,
    UiButton,
    UiIcon,
    UiPagination,
    UiSwitch,
    UiTextField,
  },
  props: {
    page: Number,
    loading: Boolean,
    dictionaries: Array,
    numberOfEntriesPerPage: Number,
    totalNumberOfEntries: Number,
    hidePagination: Boolean,
  },
  emits: ['change:page', 'close:dictionariesMenu'],
  data() {
    return {
      dictionariesMenu: false,
      term: "",
      // Row moved to with Up/Down; -1 when none
      highlightedIndex: -1,
      longPressTimer: null,
      longPressTriggered: false,
    };
  },
  watch: {
    dictionariesMenu(value) {
      this.highlightedIndex = -1;
      if (value) {
        this.$nextTick(() => this.$refs.menuSearchField?.focus());
      } else {
        this.$emit("close:dictionariesMenu");
      }
    },
    term() {
      this.highlightedIndex = -1;
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
    preferredDictionaries() {
      return this.dictionaries.filter(
        (dictionary) => dictionary.enabledInPreferences
      );
    },
    numberOfEntriesForAllMatchedDictionaries() {
      return this.sumNumberOfEntriesFor(this.fuzzyMatchedDictionaries);
    },
    numberOfEntriesForPreferredDictionaries() {
      return this.sumNumberOfEntriesFor(this.preferredDictionaries);
    },
    buttonCount() {
      const enabled = this.enabledDictionaries.length;
      const total = this.dictionaries.length;
      return enabled === total ? String(total) : `${enabled}/${total}`;
    },
    showPagination() {
      return !this.hidePagination && this.totalNumberOfEntries > this.numberOfEntriesPerPage;
    },
    pageCount() {
      return Math.ceil(this.totalNumberOfEntries / this.numberOfEntriesPerPage);
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
    handleDictionaryClick(event, dictionary) {
      // Ctrl/Cmd+click selects only this dictionary
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        this.selectSingleDictionary(dictionary);
      } else if (!this.longPressTriggered) {
        // Normal click toggles
        dictionary.enabled = !dictionary.enabled;
      }
      this.longPressTriggered = false;
    },
    startLongPress(dictionary) {
      this.longPressTriggered = false;
      this.longPressTimer = setTimeout(() => {
        this.longPressTriggered = true;
        this.selectSingleDictionary(dictionary);
      }, 500);
    },
    cancelLongPress() {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
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
    moveHighlight(step) {
      const count = this.fuzzyMatchedDictionaries.length;
      if (!count) return;
      const start = this.highlightedIndex < 0 ? (step > 0 ? -1 : count) : this.highlightedIndex;
      this.highlightedIndex = Math.min(Math.max(start + step, 0), count - 1);
      this.$nextTick(() => {
        this.$refs.dictionaryRows?.[this.highlightedIndex]?.scrollIntoView?.({ block: "nearest" });
      });
    },
    highlightedDictionary() {
      return this.fuzzyMatchedDictionaries[this.highlightedIndex];
    },
    registerKeyboardHandler() {
      var vm = this;
      // Remove any existing handler first to ensure fresh registration
      EventHandlers.remove("dictionary-menu");
      EventHandlers.add({
        id: "dictionary-menu",
        type: "keydown",
        callback(event) {
          const key = event.key || "";
          // Only handle Ctrl/Cmd+B when dictionaries button is visible (has entries)
          if ((event.ctrlKey || event.metaKey) && key.toLowerCase() == "b" && !vm.menuIsOpened() && vm.totalNumberOfEntries > 0) {
            event.preventDefault();
            vm.openMenu();
          } else if (vm.menuIsOpened()) {
            var highlighted = vm.highlightedDictionary();
            if (key == "Escape") vm.closeMenu();
            else if (key == "ArrowDown" || key == "ArrowUp") {
              event.preventDefault();
              vm.moveHighlight(key == "ArrowDown" ? 1 : -1);
            } else if (key == " " && highlighted) {
              event.preventDefault();
              highlighted.enabled = !highlighted.enabled;
            } else if (event.ctrlKey || event.shiftKey) {
              if (key == "Enter") vm.enableOnlyMatchedDictionaries();
              else if (key.toLowerCase() == "a")
                vm.enableAllMatchedDictionaries();
              else if (key.toLowerCase() == "n")
                vm.disableAllMatchedDictionaries();
              else if (key.toLowerCase() == "r")
                vm.enableOnlyPreferedDictionaries();
              if (["enter", "a", "n", "r"].includes(key.toLowerCase()))
                event.preventDefault();
            } else if (key == "Enter") {
              event.preventDefault();
              if (highlighted) vm.selectSingleDictionary(highlighted);
              else vm.enableOnlyMatchedDictionaries();
            }
          }
        },
      });
    },
  },
  mounted() {
    this.registerKeyboardHandler();
  },
  activated() {
    // Re-register when component is activated from keep-alive cache
    this.registerKeyboardHandler();
  },
  deactivated() {
    // Remove handler when component is deactivated (cached by keep-alive)
    EventHandlers.remove("dictionary-menu");
  },
  unmounted() {
    EventHandlers.remove("dictionary-menu");
    this.cancelLongPress();
  },
};
</script>

<template>
  <div class="results-and-pagination-and-dictionaries">
    <template v-if="showPagination">
      <span class="results-count" data-testid="results-range">
        Entries {{ (page - 1) * numberOfEntriesPerPage }}-{{
          Math.min(page * numberOfEntriesPerPage, totalNumberOfEntries)
        }} out of {{ totalNumberOfEntries }}
      </span>
      <ui-pagination
        :model-value="page"
        :length="pageCount"
        :visible="0"
        @update:model-value="$emit('change:page', $event)"
      />
    </template>
    <span v-else-if="!hidePagination" class="results-count" data-testid="results-range">
      {{ totalNumberOfEntries }} {{ pluralize("result", totalNumberOfEntries) }}
    </span>

    <popover-root v-model:open="dictionariesMenu">
      <popover-trigger v-if="totalNumberOfEntries > 0" as-child>
        <button
          type="button"
          class="dictionaries-menu-button"
          :class="{ 'is-filtered': dictionariesDifferentThanGlobally }"
          :title="dictionariesDifferentThanGlobally ? 'Not the dictionaries chosen in Settings' : 'Choose dictionaries (Ctrl/Cmd+B)'"
          data-testid="dictionaries-menu-button"
        >
          Dictionaries · {{ buttonCount }}
          <ui-icon name="chevron-down" :size="12" :stroke-width="2.4" />
        </button>
      </popover-trigger>

      <popover-portal>
        <popover-content
          class="dictionaries-menu"
          align="end"
          :side-offset="6"
          :collision-padding="16"
          data-testid="dictionaries-menu"
          @open-auto-focus.prevent
          @close-auto-focus.prevent
        >
          <div class="dictionaries-menu-header">
            <ui-text-field
              ref="menuSearchField"
              v-model="term"
              clearable
              prepend-icon="search"
              placeholder="Filter dictionaries"
              aria-label="Filter dictionaries"
              class="search-field"
              data-testid="dictionaries-menu-filter"
            />

            <div class="action-buttons">
              <ui-button variant="outline" size="sm" data-testid="dictionaries-menu-all" @click="enableAllMatchedDictionaries">
                <span>Enable <u>a</u>ll</span>
              </ui-button>
              <ui-button variant="outline" size="sm" data-testid="dictionaries-menu-none" @click="disableAllMatchedDictionaries">
                <span>Enable <u>n</u>one</span>
              </ui-button>
              <ui-button variant="outline" size="sm" data-testid="dictionaries-menu-restore" @click="enableOnlyPreferedDictionaries">
                <span><u>R</u>estore preferences</span>
              </ui-button>
            </div>
          </div>

          <div class="dictionaries-list-container">
            <div v-if="fuzzyMatchedDictionaries.length" class="dictionaries-list" role="list">
              <div
                v-for="(dictionary, index) in fuzzyMatchedDictionaries"
                :key="dictionary.id"
                ref="dictionaryRows"
                class="dictionary-row"
                :class="{ 'is-highlighted': index === highlightedIndex, 'is-disabled': !dictionary.enabled }"
                role="listitem"
                :data-dictionary-index="index"
                data-testid="dictionaries-menu-row"
                @click="handleDictionaryClick($event, dictionary)"
                @touchstart.passive="startLongPress(dictionary)"
                @touchend="cancelLongPress"
                @touchcancel="cancelLongPress"
                @touchmove.passive="cancelLongPress"
              >
                <!-- eslint-disable-next-line vue/no-v-html -- labels from the bundled details -->
                <span class="dictionary-row__label" v-html="fuzzyDisplayFor(dictionary)" />
                <ui-switch
                  v-model="dictionary.enabled"
                  :aria-label="dictionary.shortLabel"
                  @click.stop
                />
              </div>
            </div>

            <div v-else class="no-results" data-testid="dictionaries-menu-empty">
              <ui-icon name="book-search" :size="36" />
              <div>No matching dictionary</div>
            </div>
          </div>
        </popover-content>
      </popover-portal>
    </popover-root>
  </div>
</template>

<style lang="stylus">
.results-and-pagination-and-dictionaries
  display flex
  align-items center
  justify-content flex-end
  gap 10px
  min-width 0
  font-family var(--font-ui)

  .results-count
    font-size var(--text-sm)
    color var(--muted)
    white-space nowrap

.dictionaries-menu-button
  box-sizing border-box
  flex none
  display inline-flex
  align-items center
  gap 8px
  height 2.25rem
  padding 0 14px
  border 1.5px solid var(--line-strong)
  border-radius var(--radius-lg)
  background var(--surface)
  color var(--ink)
  font 500 var(--text-sm-plus) var(--font-ui)
  white-space nowrap
  cursor pointer

  &:hover
    background var(--soft)

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset 2px

  // The choice differs from Settings for this lookup
  &.is-filtered
    border-color var(--accent)
    background var(--accent-soft)
    color var(--accent)
    font-weight 600

.dictionaries-menu
  z-index 3000
  box-sizing border-box
  width unquote('min(28rem, calc(100vw - 32px))')
  max-height unquote('min(34rem, calc(100dvh - 120px))')
  display flex
  flex-direction column
  background var(--surface)
  color var(--ink)
  border 1px solid var(--line)
  border-radius var(--radius-card)
  box-shadow var(--shadow-pop)
  font-family var(--font-ui)
  overflow hidden

  &:focus
    outline none

  .dictionaries-menu-header
    flex none
    display flex
    flex-direction column
    gap 10px
    padding 14px
    border-bottom 1px solid var(--line)

  .action-buttons
    display flex
    flex-wrap wrap
    gap 6px

    .ui-button
      flex 1 1 auto

  .dictionaries-list-container
    flex 1
    min-height 0
    overflow-y auto
    padding 6px

  .dictionary-row
    display flex
    align-items center
    justify-content space-between
    gap 12px
    min-height 2.5rem
    padding 0 10px
    border-radius var(--radius-md)
    font-size var(--text-base)
    cursor pointer
    user-select none
    -webkit-user-select none

    &:hover,
    &.is-highlighted
      background var(--soft)

    &.is-disabled .dictionary-row__label
      color var(--faint)

    b
      color var(--accent)

  .dictionary-row__label
    min-width 0
    overflow-wrap anywhere

  .no-results
    display flex
    flex-direction column
    align-items center
    gap 8px
    padding 40px 16px
    color var(--muted)

@media (max-width: 600px)
  .dictionaries-menu-button
    height 2.75rem

  .dictionaries-menu .action-buttons
    flex-direction column

  .dictionaries-menu .dictionary-row
    min-height 2.75rem
</style>
