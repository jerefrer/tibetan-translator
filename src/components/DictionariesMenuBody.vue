<script>
import { UiButton, UiIcon, UiSwitch, UiTextField } from "../ui";

// The inside of the Dictionaries menu: the filter, the All / None / Reset row
// and the list grouped by pack. The popover (desktop) and the sheet (phone)
// of ResultsAndPaginationAndDictionaries both show it; the state stays there.
export default {
  components: { UiButton, UiIcon, UiSwitch, UiTextField },
  props: {
    // [{ id, label, items: [{ dictionary, index }] }], index = row position
    groups: { type: Array, required: true },
    modelValue: { type: String, default: "" },
    highlightedIndex: { type: Number, default: -1 },
    labelFor: { type: Function, required: true },
    // Phone: short action labels, ghost buttons
    compact: { type: Boolean, default: false },
  },
  emits: [
    "update:modelValue",
    "all",
    "none",
    "restore",
    "row-click",
    "press-start",
    "press-cancel",
  ],
  computed: {
    hasRows() {
      return this.groups.length > 0;
    },
  },
  methods: {
    focusFilter() {
      this.$refs.filterField?.focus();
    },
    rowElement(index) {
      return this.$refs.rows?.find((row) => Number(row.dataset.dictionaryIndex) === index);
    },
  },
};
</script>

<template>
  <div class="dictionaries-menu-body">
    <div class="dictionaries-menu-header">
      <ui-text-field
        ref="filterField"
        :model-value="modelValue"
        clearable
        prepend-icon="search"
        placeholder="Filter dictionaries"
        aria-label="Filter dictionaries"
        class="search-field"
        data-testid="dictionaries-menu-filter"
        @update:model-value="$emit('update:modelValue', $event)"
      />

      <div class="action-buttons" data-testid="dictionaries-menu-actions">
        <ui-button
          :variant="compact ? 'ghost' : 'outline'"
          size="sm"
          data-testid="dictionaries-menu-all"
          @click="$emit('all')"
        >
          <ui-icon name="check-check" :size="15" :stroke-width="2.2" />
          <span v-if="compact">All</span>
          <span v-else>Enable <u>a</u>ll</span>
        </ui-button>
        <ui-button
          :variant="compact ? 'ghost' : 'outline'"
          size="sm"
          data-testid="dictionaries-menu-none"
          @click="$emit('none')"
        >
          <ui-icon name="x" :size="15" :stroke-width="2.2" />
          <span v-if="compact">None</span>
          <span v-else>Enable <u>n</u>one</span>
        </ui-button>
        <ui-button
          :variant="compact ? 'ghost' : 'outline'"
          size="sm"
          data-testid="dictionaries-menu-restore"
          @click="$emit('restore')"
        >
          <ui-icon name="rotate-ccw" :size="15" :stroke-width="2.2" />
          <span v-if="compact">Reset</span>
          <span v-else><u>R</u>estore preferences</span>
        </ui-button>
      </div>
    </div>

    <div class="dictionaries-list-container">
      <template v-if="hasRows">
        <section
          v-for="group in groups"
          :key="group.id"
          class="dictionaries-group"
          :data-group="group.id"
          data-testid="dictionaries-menu-group"
        >
          <h3 class="dictionaries-group__label" data-testid="dictionaries-menu-group-label">
            {{ group.label }}
          </h3>
          <div class="dictionaries-list" role="list">
            <div
              v-for="item in group.items"
              :key="item.dictionary.id"
              ref="rows"
              class="dictionary-row"
              :class="{
                'is-highlighted': item.index === highlightedIndex,
                'is-disabled': !item.dictionary.enabled,
              }"
              role="listitem"
              :data-dictionary-index="item.index"
              data-testid="dictionaries-menu-row"
              @click="$emit('row-click', $event, item.dictionary)"
              @touchstart.passive="$emit('press-start', item.dictionary)"
              @touchend="$emit('press-cancel')"
              @touchcancel="$emit('press-cancel')"
              @touchmove.passive="$emit('press-cancel')"
            >
              <!-- eslint-disable-next-line vue/no-v-html -- labels from the bundled details -->
              <span class="dictionary-row__label" v-html="labelFor(item.dictionary)" />
              <ui-switch
                v-model="item.dictionary.enabled"
                :aria-label="item.dictionary.shortLabel"
                @click.stop
              />
            </div>
          </div>
        </section>
      </template>

      <div v-else class="no-results" data-testid="dictionaries-menu-empty">
        <ui-icon name="book-search" :size="36" />
        <div>No matching dictionary</div>
      </div>
    </div>
  </div>
</template>

<style lang="stylus">
.dictionaries-menu-body
  display flex
  flex-direction column
  flex 1
  min-height 0
  font-family var(--font-ui)

  .dictionaries-menu-header
    flex none
    display flex
    flex-direction column
    gap 10px
    padding 14px
    border-bottom 1px solid var(--line)

  .action-buttons
    display flex
    flex-wrap nowrap
    gap 6px

    .ui-button
      flex 1 1 auto
      white-space nowrap
      gap 6px
      // With their icons the three fit the menu's width only this tight
      padding-inline 10px

  .dictionaries-list-container
    flex 1
    min-height 0
    overflow-y auto
    padding 6px

  .dictionaries-group__label
    margin 0
    padding 10px 10px 4px
    font-size var(--text-sm)
    font-weight 600
    color var(--muted)

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
      color var(--muted)

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
  .dictionaries-menu-body .dictionary-row
    min-height 2.75rem
</style>
