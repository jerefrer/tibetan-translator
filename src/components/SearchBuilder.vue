<script>
import { UiCollapse, UiIcon } from '../ui';
import MobileResponsiveMixin from './mixins/MobileResponsiveMixin';
import { conditionsQuery, queryConditions } from '../services/query-conditions';
import SearchBuilderRow from './SearchBuilderRow.vue';

// The query builder (board "B · Search, query builder open"): one row per
// condition, kept in sync both ways with the query in the search field.
export default {
  components: {
    SearchBuilderRow,
    UiCollapse,
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
      const conditions = queryConditions(query);
      this.rows = conditions.length ? conditions : [{ term: '', mode: 'contains' }];
    },

    rowsToQuery() {
      return conditionsQuery(this.rows);
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
      // Its remove button is gone: the focus goes to the row above
      const target = Math.max(0, index - 1);
      this.$nextTick(() => this.$refs.rowComponents?.[target]?.focus());
    },

    focusFirstRow() {
      this.$refs.rowComponents?.[0]?.focus();
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
  <!-- Opens and closes in place, sliding what is below; the wrapper, without
       padding or border, is what folds to nothing -->
  <ui-collapse>
    <div v-if="visible">
      <section
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
          <template v-for="(row, index) in rows" :key="index">
            <div v-if="index > 0" class="search-builder__and" data-testid="search-builder-and">AND</div>
            <SearchBuilderRow
              ref="rowComponents"
              :term="row.term"
              :mode="row.mode"
              :can-remove="rows.length > 1"
              @update:term="updateRowTerm(index, $event)"
              @update:mode="updateRowMode(index, $event)"
              @remove="removeRow(index)"
              @submit="handleSubmit"
            />
          </template>
        </div>

        <button
          type="button"
          class="search-builder__add"
          data-testid="search-builder-add"
          @click="addRow"
        >
          <ui-icon name="plus" :size="15" :stroke-width="2" />
          Add a condition
        </button>
      </section>
    </div>
  </ui-collapse>
</template>

<style lang="stylus" scoped>
.search-builder
  flex none
  box-sizing border-box
  padding 16px 22px 18px
  // Set apart from the white of the page, its fields white on it
  background var(--bg-quiet)
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

// Between two conditions: every one must match
.search-builder__and
  display flex
  align-items center
  gap 10px
  margin 2px 0
  font-size 10.5px
  font-weight 600
  letter-spacing 0.08em
  color var(--faint)

  &::before, &::after
    content ''
    flex 1
    height 1px
    background var(--line)

// A dashed slot after the last condition
.search-builder__add
  display flex
  align-items center
  justify-content center
  gap 6px
  width 100%
  height 2.5rem
  margin-top 10px
  box-sizing border-box
  border 1.5px dashed var(--line-strong)
  border-radius var(--radius-lg)
  background transparent
  color var(--accent)
  font 500 var(--text-sm) var(--font-ui)
  cursor pointer

  &:hover
    background var(--accent-soft)

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset 2px

// Phone (board "B · Search on a phone")
.search-builder.is-phone
  padding 12px 14px

  .search-builder__rows
    margin-top 10px
</style>
