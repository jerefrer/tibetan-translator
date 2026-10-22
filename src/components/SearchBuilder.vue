<script>
import { UiIcon } from '../ui';
import MobileResponsiveMixin from './mixins/MobileResponsiveMixin';
import SearchBuilderRow from './SearchBuilderRow.vue';

// Syntax definitions for each mode
const MODE_SYNTAX = {
  'contains': { prefix: '', suffix: '' },
  'wylie': { prefix: '(', suffix: ')' },
  'phonetic-strict': { prefix: '[', suffix: ']' },
  'phonetic-loose': { prefix: '{', suffix: '}' }
};

// The query builder (board "B · Search, query builder open"): one row per
// condition, kept in sync both ways with the query in the search field.
export default {
  components: {
    SearchBuilderRow,
    UiIcon
  },
  mixins: [MobileResponsiveMixin],
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    visible: {
      type: Boolean,
      default: true
    }
  },
  emits: ['update:modelValue', 'update:visible', 'submit'],
  data() {
    return {
      rows: [{ term: '', mode: 'contains' }],
      isUpdatingFromText: false,
      isUpdatingFromRows: false
    };
  },
  watch: {
    modelValue: {
      immediate: true,
      handler(newValue) {
        if (this.isUpdatingFromRows) return;
        this.isUpdatingFromText = true;
        this.parseQueryToRows(newValue);
        this.$nextTick(() => {
          this.isUpdatingFromText = false;
        });
      }
    },
    rows: {
      deep: true,
      handler() {
        if (this.isUpdatingFromText) return;
        this.isUpdatingFromRows = true;
        const query = this.rowsToQuery();
        this.$emit('update:modelValue', query);
        this.$nextTick(() => {
          this.isUpdatingFromRows = false;
        });
      }
    }
  },
  methods: {
    parseQueryToRows(query) {
      if (!query || !query.trim()) {
        this.rows = [{ term: '', mode: 'contains' }];
        return;
      }

      // Split by & and parse each term
      const terms = query.split('&').map(t => t.trim()).filter(t => t);

      if (terms.length === 0) {
        this.rows = [{ term: '', mode: 'contains' }];
        return;
      }

      this.rows = terms.map(term => this.parseTermToRow(term));
    },

    parseTermToRow(term) {
      // Check for phonetic strict: [term]
      const strictMatch = term.match(/^\[(.+)\]$/);
      if (strictMatch) {
        return { term: strictMatch[1], mode: 'phonetic-strict' };
      }

      // Check for phonetic loose: {term}
      const looseMatch = term.match(/^\{(.+)\}$/);
      if (looseMatch) {
        return { term: looseMatch[1], mode: 'phonetic-loose' };
      }

      // Check for wylie: (term)
      const wylieMatch = term.match(/^\((.+)\)$/);
      if (wylieMatch) {
        return { term: wylieMatch[1], mode: 'wylie' };
      }

      // Default: regular contains
      return { term: term, mode: 'contains' };
    },

    rowsToQuery() {
      const parts = this.rows
        .filter(row => row.term && row.term.trim())
        .map(row => {
          const syntax = MODE_SYNTAX[row.mode];
          return syntax.prefix + row.term.trim() + syntax.suffix;
        });

      return parts.join(' & ');
    },

    addRow() {
      this.rows.push({ term: '', mode: 'contains' });
      this.$nextTick(() => this.$refs.rowComponents?.at(-1)?.focus());
    },

    removeRow(index) {
      if (this.rows.length > 1) {
        this.rows.splice(index, 1);
      } else {
        // If last row, just clear it
        this.rows[0] = { term: '', mode: 'contains' };
      }
    },

    updateRowTerm(index, term) {
      this.rows[index].term = term;
    },

    updateRowMode(index, mode) {
      this.rows[index].mode = mode;
    },

    hide() {
      this.$emit('update:visible', false);
    },

    handleSubmit() {
      this.$emit('submit');
    }
  }
};
</script>

<template>
  <transition name="ui-fade">
    <section
      v-if="visible"
      class="search-builder"
      :class="{ 'is-phone': isMobile }"
      aria-label="Query builder"
      data-testid="search-builder"
    >
      <div class="search-builder__header">
        <span class="search-builder__title">Query builder</span>
        <button
          type="button"
          class="search-builder__link"
          data-testid="search-builder-hide"
          @click="hide"
        >
          Hide
        </button>
      </div>

      <div class="search-builder__rows">
        <SearchBuilderRow
          v-for="(row, index) in rows"
          :key="index"
          ref="rowComponents"
          :term="row.term"
          :mode="row.mode"
          :can-remove="rows.length > 1"
          @update:term="updateRowTerm(index, $event)"
          @update:mode="updateRowMode(index, $event)"
          @remove="removeRow(index)"
          @submit="handleSubmit"
        />
      </div>

      <div class="search-builder__footer">
        <button
          type="button"
          class="search-builder__add"
          data-testid="search-builder-add"
          @click="addRow"
        >
          <ui-icon name="plus" :size="14" :stroke-width="2" />
          Add condition
        </button>
        <span class="search-builder__note">
          {{ isMobile ? 'Match every condition' : 'An entry must match every condition.' }}
        </span>
      </div>
    </section>
  </transition>
</template>

<style lang="stylus" scoped>
.search-builder
  flex none
  box-sizing border-box
  padding 16px 22px 18px
  background var(--surface)
  border 1px solid var(--line)
  border-radius var(--radius-card)
  box-shadow var(--shadow-card)
  font-family var(--font-ui)
  color var(--ink)

.search-builder__header
  display flex
  align-items center
  justify-content space-between
  margin -8px 0 -8px

.search-builder__title
  font-size var(--text-xs)
  font-weight 600
  letter-spacing 0.08em
  text-transform uppercase
  color var(--muted)

.search-builder__link
  border 0
  background none
  padding 8px
  margin-right -8px
  color var(--accent)
  font 600 var(--text-sm-plus) var(--font-ui)
  cursor pointer

  &:hover
    text-decoration underline

  &:focus-visible
    outline 2px solid var(--accent)
    border-radius var(--radius-sm)

.search-builder__rows
  display flex
  flex-direction column
  gap 10px
  margin-top 12px
  max-width 55rem

.search-builder__footer
  display flex
  align-items center
  gap 14px
  margin-top 14px

.search-builder__add
  display inline-flex
  align-items center
  gap 6px
  height 2.25rem
  padding 0 14px
  border 0
  border-radius var(--radius-lg)
  background var(--accent-soft)
  color var(--accent)
  font 600 var(--text-sm-plus) var(--font-ui)
  cursor pointer

  &:hover
    background var(--accent-line)

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset 2px

.search-builder__note
  font-size var(--text-sm)
  color var(--muted)

// Phone (board "B · Search on a phone")
.search-builder.is-phone
  padding 12px 14px

  .search-builder__rows
    margin-top 10px

  .search-builder__footer
    justify-content space-between
    margin-top 10px

  .search-builder__add
    height 2.75rem

  .search-builder__note
    font-size var(--text-chip)
</style>
