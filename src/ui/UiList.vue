<script>
// Replaces <v-list>. Rows are <UiListItem> (v-list-item, -title, -subtitle).
export default {
  name: 'UiList',
};
</script>

<template>
  <ul class="ui-list" role="list" data-testid="ui-list"><slot /></ul>
</template>

<style>
.ui-list {
  margin: 0;
  padding: 0;
  list-style: none;
  font-family: var(--font-ui);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  overflow: hidden;
}
</style>
