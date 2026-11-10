<script>
import pluralize from "pluralize";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
} from "reka-ui";

import { UiButton, UiDialog, UiIcon, UiPagination } from "../ui";
import DictionariesFuzzySearchMixin from "./DictionariesFuzzySearchMixin";
import DictionariesMenuBody from "./DictionariesMenuBody.vue";
import MobileResponsiveMixin from "./mixins/MobileResponsiveMixin";
import { PACK_DEFINITIONS } from "../config/pack-definitions";
import EventHandlers from "../services/event-handlers";

// The "Dictionaries" button and its menu, shared by Define, Search and Split.
// The menu picks which dictionaries the current results come from, for this
// lookup only (the page resets it to the Settings choice on the next one).
//
// On a phone the menu is a tall bottom sheet (UiDialog) instead of a popover,
// opened without the keyboard; the dictionaries are grouped by pack.
//
// The pagination half is kept for callers that do not pass hidePagination;
// none does today.
export default {
  mixins: [DictionariesFuzzySearchMixin, MobileResponsiveMixin],
  components: {
    PopoverRoot,
    PopoverTrigger,
    PopoverPortal,
    PopoverContent,
    UiButton,
    UiDialog,
    UiIcon,
    UiPagination,
    DictionariesMenuBody,
  },
  props: {
    page: Number,
    loading: Boolean,
    dictionaries: Array,
    numberOfEntriesPerPage: Number,
    totalNumberOfEntries: Number,
    hidePagination: Boolean,
    // Which edge of the button the menu lines up with; Split's button sits
    // beside the navigation rail, so it opens towards the definitions
    menuAlign: { type: String, default: 'end' },
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
        // Not on a phone: the keyboard would cover half the sheet
        if (!this.isMobile) this.$nextTick(() => this.$refs.menuBody?.focusFilter());
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
    // The listed dictionaries by pack, in pack order, then the ones in no pack
    // (custom packs, lexicons); a group with nothing to list is left out
    dictionaryGroups() {
      const packOf = new Map();
      Object.values(PACK_DEFINITIONS).forEach((pack) =>
        pack.dictionaries.forEach((name) => packOf.set(name, pack.id))
      );
      const groups = [
        ...Object.values(PACK_DEFINITIONS).map((pack) => ({ id: pack.id, label: pack.name, items: [] })),
        { id: "custom", label: "Your dictionaries", items: [] },
      ];
      const byId = new Map(groups.map((group) => [group.id, group]));
      this.fuzzyMatchedDictionaries.forEach((dictionary) => {
        byId.get(packOf.get(dictionary.name) || "custom").items.push({ dictionary });
      });
      let index = 0;
      groups.forEach((group) => group.items.forEach((item) => (item.index = index++)));
      return groups.filter((group) => group.items.length);
    },
    // The rows in the order they are shown, which the keyboard walks through
    listedDictionaries() {
      return this.dictionaryGroups.flatMap((group) => group.items.map((item) => item.dictionary));
    },
    bodyProps() {
      return {
        groups: this.dictionaryGroups,
        modelValue: this.term,
        highlightedIndex: this.highlightedIndex,
        labelFor: this.fuzzyDisplayFor,
      };
    },
    bodyListeners() {
      return {
        "update:modelValue": (value) => (this.term = value || ""),
        all: this.enableAllMatchedDictionaries,
        none: this.disableAllMatchedDictionaries,
        restore: this.enableOnlyPreferedDictionaries,
        "row-click": this.handleDictionaryClick,
        "press-start": this.startLongPress,
        "press-cancel": this.cancelLongPress,
      };
    },
    menuSummary() {
      return `${this.enabledDictionaries.length} of ${this.dictionaries.length} on`;
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
    // Room the menu keeps from the window's edges; on a phone the bottom bar
    // covers the bottom of the window, so the menu stays above it too
    collisionPadding() {
      const bar = typeof document !== 'undefined' && document.querySelector('.app-nav--bar');
      return { top: 16, right: 16, left: 16, bottom: 16 + (bar ? bar.offsetHeight : 0) };
    },
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
      const count = this.listedDictionaries.length;
      if (!count) return;
      const start = this.highlightedIndex < 0 ? (step > 0 ? -1 : count) : this.highlightedIndex;
      this.highlightedIndex = Math.min(Math.max(start + step, 0), count - 1);
      this.$nextTick(() => {
        this.$refs.menuBody?.rowElement(this.highlightedIndex)?.scrollIntoView?.({ block: "nearest" });
      });
    },
    highlightedDictionary() {
      return this.listedDictionaries[this.highlightedIndex];
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
          <!-- The hidden widest label keeps the width: the count growing from
               "39" to "0/39" would shift the button, and the menu with it -->
          <span class="dictionaries-menu-button__label">
            <span data-testid="dictionaries-menu-label">Dictionaries · {{ buttonCount }}</span>
            <span class="dictionaries-menu-button__sizer" aria-hidden="true" data-testid="dictionaries-menu-sizer">Dictionaries · {{ dictionaries.length }}/{{ dictionaries.length }}</span>
          </span>
          <ui-icon name="chevron-down" :size="12" :stroke-width="2.4" />
        </button>
      </popover-trigger>

      <popover-portal v-if="!isMobile">
        <popover-content
          class="dictionaries-menu"
          :align="menuAlign"
          :side-offset="6"
          :collision-padding="collisionPadding()"
          data-testid="dictionaries-menu"
          @open-auto-focus.prevent
          @close-auto-focus.prevent
        >
          <dictionaries-menu-body v-bind="bodyProps" v-on="bodyListeners" ref="menuBody" />
        </popover-content>
      </popover-portal>
    </popover-root>

    <ui-dialog
      v-if="isMobile"
      v-model="dictionariesMenu"
      title="Dictionaries"
      :description="menuSummary"
      tall
      :auto-focus="false"
    >
      <dictionaries-menu-body
        v-bind="bodyProps"
        compact
        v-on="bodyListeners"
        ref="menuBody"
      />
      <template #actions>
        <ui-button data-testid="dictionaries-menu-done" @click="closeMenu">Done</ui-button>
      </template>
    </ui-dialog>
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
  font-variant-numeric tabular-nums
  cursor pointer

  &:hover
    background var(--soft)

  // Both labels in one cell: the cell is as wide as the wider one
  .dictionaries-menu-button__label
    display inline-grid
    justify-items start

    > span
      grid-area 1 / 1

  .dictionaries-menu-button__sizer
    visibility hidden
    // As bold as the filtered state, the wider of the two
    font-weight 600

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
  // No taller than the room left under (or over) the button, so the end of
  // the list never runs off the window; the list scrolls instead
  max-height unquote('min(34rem, var(--reka-popover-content-available-height, calc(100dvh - 120px)))')
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

@media (max-width: 600px)
  .dictionaries-menu-button
    height 2.75rem

</style>
