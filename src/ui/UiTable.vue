<script>
// Replaces <v-table>: a styled <table>. Put <thead>/<tbody> in the slot.
export default {
  name: 'UiTable',
  props: {
    dense: { type: Boolean, default: false },
    hover: { type: Boolean, default: false },
  },
};
</script>

<template>
  <div class="ui-table-wrap" data-testid="ui-table">
    <table class="ui-table" :class="{ 'ui-table--dense': dense, 'ui-table--hover': hover }">
      <slot />
    </table>
  </div>
</template>

<style>
.ui-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
}
.ui-table {
  width: 100%;
  border-collapse: collapse;
  font: var(--text-base) / 1.4 var(--font-ui);
  color: var(--ink);
}
.ui-table th {
  text-align: left;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: var(--soft);
}
.ui-table th,
.ui-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--soft);
}
.ui-table--dense th,
.ui-table--dense td { padding: var(--space-2) var(--space-3); }
.ui-table tbody tr:last-child td { border-bottom: 0; }
.ui-table--hover tbody tr:hover { background: var(--soft); }
</style>
