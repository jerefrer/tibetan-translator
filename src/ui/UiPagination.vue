<script>
import {
  PaginationRoot,
  PaginationList,
  PaginationListItem,
  PaginationPrev,
  PaginationNext,
  PaginationEllipsis,
} from 'reka-ui';
import UiIcon from './UiIcon.vue';

// Replaces <v-pagination>. `length` is the page count (Vuetify's), `page` is
// 1-based and v-modelled. `visible` is the number of page buttons around the
// current one; 0 shows only the arrows and the current page.
export default {
  name: 'UiPagination',
  components: {
    PaginationRoot,
    PaginationList,
    PaginationListItem,
    PaginationPrev,
    PaginationNext,
    PaginationEllipsis,
    UiIcon,
  },
  props: {
    modelValue: { type: Number, default: 1 },
    length: { type: Number, required: true },
    visible: { type: Number, default: 7 },
  },
  emits: ['update:modelValue'],
  computed: {
    siblings() {
      return Math.max(0, Math.floor((this.visible - 3) / 2));
    },
  },
};
</script>

<template>
  <pagination-root
    class="ui-pagination"
    :page="modelValue"
    :total="length"
    :items-per-page="1"
    :sibling-count="siblings"
    show-edges
    data-testid="ui-pagination"
    @update:page="$emit('update:modelValue', $event)"
  >
    <pagination-list v-slot="{ items }" class="ui-pagination__list">
      <pagination-prev class="ui-pagination__button" aria-label="Previous page" data-testid="ui-pagination-prev">
        <ui-icon name="chevron-left" :size="18" />
      </pagination-prev>
      <template v-for="(item, index) in items" :key="index">
        <pagination-list-item
          v-if="item.type === 'page' && (visible > 0 || item.value === modelValue)"
          :value="item.value"
          class="ui-pagination__button ui-pagination__page"
          :data-testid="'ui-pagination-page-' + item.value"
        >
          {{ item.value }}
        </pagination-list-item>
        <pagination-ellipsis v-else-if="item.type === 'ellipsis' && visible > 0" class="ui-pagination__ellipsis">
          &hellip;
        </pagination-ellipsis>
      </template>
      <pagination-next class="ui-pagination__button" aria-label="Next page" data-testid="ui-pagination-next">
        <ui-icon name="chevron-right" :size="18" />
      </pagination-next>
    </pagination-list>
  </pagination-root>
</template>

<style>
.ui-pagination { font-family: var(--font-ui); }
.ui-pagination__list { display: flex; align-items: center; justify-content: center; gap: var(--space-1); }
.ui-pagination__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--control-sm);
  height: var(--control-sm);
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--ink);
  font: 500 var(--text-base) var(--font-ui);
  cursor: pointer;
}
.ui-pagination__button:hover:not(:disabled) { background: var(--soft); }
.ui-pagination__button:disabled { opacity: 0.4; cursor: not-allowed; }
.ui-pagination__button:focus-visible { outline: 2px solid var(--accent); }
.ui-pagination__page[data-selected] { background: var(--accent); color: var(--on-accent); font-weight: 600; }
.ui-pagination__ellipsis { color: var(--muted); padding: 0 var(--space-1); }
</style>
