<script>
import UiIcon from './UiIcon.vue';

// Replaces <v-toolbar> + <v-toolbar-title> + <v-spacer>: a header bar with an
// optional icon and title on the left and actions (default slot) on the right.
export default {
  name: 'UiToolbar',
  components: { UiIcon },
  props: {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    icon: { type: String, default: '' },
  },
};
</script>

<template>
  <header class="ui-toolbar" data-testid="ui-toolbar">
    <ui-icon v-if="icon" :name="icon" :size="24" class="ui-toolbar__icon" />
    <div class="ui-toolbar__titles">
      <h2 class="ui-toolbar__title"><slot name="title">{{ title }}</slot></h2>
      <p v-if="subtitle" class="ui-toolbar__subtitle">{{ subtitle }}</p>
    </div>
    <div class="ui-toolbar__actions"><slot /></div>
  </header>
</template>

<style>
.ui-toolbar {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: 3.5rem;
  padding: var(--space-2) var(--space-4);
  background: var(--soft);
  color: var(--ink);
  font-family: var(--font-ui);
}
.ui-toolbar__icon { color: var(--muted); }
.ui-toolbar__titles { flex: 1; min-width: 0; }
.ui-toolbar__title { margin: 0; font-size: var(--text-md); font-weight: 600; }
.ui-toolbar__subtitle { margin: 0; font-size: var(--text-xs); color: var(--muted); }
.ui-toolbar__actions { display: flex; align-items: center; gap: var(--space-2); }
.ui-toolbar__actions:empty { display: none; }
</style>
