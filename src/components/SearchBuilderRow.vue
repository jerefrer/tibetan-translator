<script>
import { UiIcon, UiSelect } from '../ui';
import MobileResponsiveMixin from './mixins/MobileResponsiveMixin';

// One condition of the query builder: how to match (the mode) and what.
// Board "B · Search, query builder open": the mode and the term share one
// box, the mode on the left; on a phone the mode sits above the term.
// The term is typed as is: no Wylie conversion here, the mode decides how
// the query reads it.
export default {
  components: { UiIcon, UiSelect },
  mixins: [MobileResponsiveMixin],
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
      modes: [
        { value: 'contains', label: 'contains' },
        { value: 'wylie', label: 'contains (Wylie)' },
        { value: 'phonetic-strict', label: 'sounds precisely like' },
        { value: 'phonetic-loose', label: 'sounds more or less like' }
      ]
    };
  },
  computed: {
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
  <div class="builder-row" :class="{ 'is-phone': isMobile }" data-testid="search-builder-row">
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
    </div>
    <button
      v-if="canRemove"
      type="button"
      class="builder-row__remove"
      aria-label="Remove this condition"
      title="Remove this condition"
      data-testid="search-builder-remove"
      @click="$emit('remove')"
    >
      <ui-icon name="circle-minus" :size="18" />
    </button>
  </div>
</template>

<style lang="stylus" scoped>
.builder-row
  display flex
  align-items center
  gap 10px

// The mode and the term in one 44px box
.builder-row__fields
  flex 1
  min-width 0
  display flex
  align-items stretch
  height 2.75rem
  box-sizing border-box
  border 1.5px solid var(--line-strong)
  border-radius var(--radius-lg)
  background var(--surface)
  overflow hidden

  &:focus-within
    border-color var(--accent)
    box-shadow 0 0 0 3px var(--ring)

.builder-row__mode
  flex none
  width 13.75rem
  gap 0

  :deep(.ui-select__trigger)
    width 100%
    height 100%
    min-height 0
    padding 0 14px
    border 0
    border-right 1px solid var(--line)
    border-radius 0
    background var(--soft)
    font-weight 400
    font-size var(--text-base)
    box-shadow none

  :deep(.ui-select__trigger:focus-visible)
    outline 2px solid var(--accent)
    outline-offset -2px

.builder-row__term
  flex 1
  min-width 0
  box-sizing border-box
  padding 0 14px
  border 0
  outline 0
  background transparent
  color var(--ink)
  // Tibetan falls through Source Serif to DDC Uchen
  font-family 'Source Serif 4', var(--font-tibetan)
  font-size 1.125rem

  &::placeholder
    color var(--faint)

.builder-row__remove
  flex none
  display inline-flex
  align-items center
  justify-content center
  width 2.25rem
  height 2.25rem
  border 0
  border-radius var(--radius-md)
  background none
  color var(--muted)
  cursor pointer

  &:hover
    color var(--ink)
    background var(--soft)

  &:focus-visible
    outline 2px solid var(--accent)

// Phone (board "B · Search on a phone"): mode on top, term below
.builder-row.is-phone
  gap 8px

  .builder-row__fields
    flex-direction column
    height auto

  .builder-row__mode
    width auto

    :deep(.ui-select__trigger)
      height 2.5rem
      border-right 0
      border-bottom 1px solid var(--line)
      padding 0 12px

  .builder-row__term
    flex none
    height 2.75rem
    padding 0 12px

  .builder-row__remove
    width 2.75rem
    height 2.75rem
</style>
