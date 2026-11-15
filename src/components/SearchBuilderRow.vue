<script>
import { UiIcon, UiSelect } from '../ui';
import { MATCH_MODES } from '../services/query-conditions';

// One condition of the query builder: how to match (the mode) and what.
// Board "B · Search, query builder open": one box holds the mode as a chip,
// the term and the remove control, with a line under it saying what the mode
// matches. The row stays on one line at any width.
// The term is typed as is: no Wylie conversion here, the mode decides how
// the query reads it.
export default {
  components: { UiIcon, UiSelect },
  props: {
    term: {
      type: String,
      default: ''
    },
    mode: {
      type: String,
      default: 'contains',
      validator: (v) => ['contains', 'wylie', 'phonetic-strict', 'phonetic-loose'].includes(v)
    },
    canRemove: {
      type: Boolean,
      default: true
    }
  },
  emits: ['update:term', 'update:mode', 'remove', 'submit'],
  data() {
    return {
      modes: MATCH_MODES.map(({ value, label }) => ({ value, label }))
    };
  },
  computed: {
    hint() {
      return (MATCH_MODES.find((mode) => mode.value === this.mode) || MATCH_MODES[0]).hint;
    },
    inputPlaceholder() {
      switch (this.mode) {
        case 'wylie': return 'sangs rgyas';
        case 'phonetic-strict': return 'sangye';
        case 'phonetic-loose': return 'sangye';
        default: return 'བོད་ཡིག་ or text';
      }
    }
  },
  methods: {
    focus() {
      this.$refs.input?.focus();
    }
  }
};
</script>

<template>
  <div class="builder-row" data-testid="search-builder-row">
    <div class="builder-row__fields">
      <ui-select
        class="builder-row__mode"
        :model-value="mode"
        :options="modes"
        aria-label="How to match"
        data-testid="search-builder-mode"
        @update:model-value="$emit('update:mode', $event)"
      />
      <input
        ref="input"
        :value="term"
        type="text"
        :placeholder="inputPlaceholder"
        aria-label="Search for"
        class="builder-row__term"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        enterkeyhint="search"
        data-testid="search-builder-term"
        @input="$emit('update:term', $event.target.value)"
        @keyup.enter="$emit('submit')"
      />
      <button
        v-if="canRemove"
        type="button"
        class="builder-row__remove"
        aria-label="Remove this condition"
        title="Remove this condition"
        data-testid="search-builder-remove"
        @click="$emit('remove')"
      >
        <ui-icon name="x" :size="16" />
      </button>
    </div>
    <p class="builder-row__hint" data-testid="search-builder-hint">{{ hint }}</p>
  </div>
</template>

<style lang="stylus" scoped>
// The mode chip, the term and the remove control in one 44px box
.builder-row__fields
  display flex
  align-items center
  gap 8px
  height 2.75rem
  padding 0 6px
  box-sizing border-box
  border 1.5px solid var(--line-strong)
  border-radius var(--radius-lg)
  background var(--surface)

  &:focus-within
    border-color var(--accent)
    box-shadow 0 0 0 3px var(--ring)

// The select's trigger restyled as an inline chip that never shrinks
.builder-row__mode
  flex none
  width auto
  gap 0

  :deep(.ui-select__trigger)
    height 1.875rem
    min-height 0
    padding 0 8px 0 10px
    gap 4px
    border 0
    border-radius var(--radius-md)
    background var(--accent-soft)
    color var(--accent)
    font 500 var(--text-sm) var(--font-ui)
    white-space nowrap
    box-shadow none

  :deep(.ui-select__trigger svg)
    width 14px
    height 14px

  :deep(.ui-select__trigger:focus-visible)
    outline 2px solid var(--accent)
    box-shadow none

.builder-row__term
  flex 1
  min-width 0
  box-sizing border-box
  padding 0 6px
  border 0
  outline 0
  background transparent
  color var(--ink)
  // Tibetan falls through Source Serif to DDC Uchen, scaled to match. The
  // compact face and the baseline lowered a little keep its vowels inside
  font-family 'Source Serif 4', 'DDC_Uchen inline compact'
  font-size 1.125rem
  padding-top 4px

  &::placeholder
    color var(--muted)

.builder-row__remove
  flex none
  display inline-flex
  align-items center
  justify-content center
  width 28px
  height 28px
  padding 0
  border 0
  border-radius var(--radius-md)
  background none
  color var(--faint)
  cursor pointer

  &:hover
    color var(--ink)
    background var(--soft)

  &:focus-visible
    outline 2px solid var(--accent)

// What the mode matches, under the box
.builder-row__hint
  margin 4px 2px 0
  font-size var(--text-xs)
  color var(--faint)
  line-height 1.4
</style>
