<script>
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui';
import UiIcon from './UiIcon.vue';

// Replaces <v-tabs> + <v-tab> + <v-tabs-window(-item)>.
// items: [{ value, label, icon? }]. Each panel is the slot `panel-<value>`.
export default {
  name: 'UiTabs',
  components: { TabsRoot, TabsList, TabsTrigger, TabsContent, UiIcon },
  props: {
    modelValue: { type: String, default: '' },
    items: { type: Array, required: true },
    // Tabs share the full width (Vuetify's `grow`)
    grow: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
};
</script>

<template>
  <tabs-root
    class="ui-tabs"
    :model-value="modelValue || items[0]?.value"
    data-testid="ui-tabs"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <tabs-list class="ui-tabs__list" :class="{ 'ui-tabs__list--grow': grow }" aria-label="Sections">
      <tabs-trigger
        v-for="item in items"
        :key="item.value"
        :value="item.value"
        class="ui-tabs__trigger"
        :data-testid="'ui-tab-' + item.value"
      >
        <ui-icon v-if="item.icon" :name="item.icon" :size="18" />
        {{ item.label }}
      </tabs-trigger>
    </tabs-list>
    <tabs-content
      v-for="item in items"
      :key="item.value"
      :value="item.value"
      class="ui-tabs__panel"
      :data-testid="'ui-tab-panel-' + item.value"
    >
      <slot :name="'panel-' + item.value" />
    </tabs-content>
  </tabs-root>
</template>

<style>
.ui-tabs { font-family: var(--font-ui); }
.ui-tabs__list {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
}
.ui-tabs__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  height: var(--control-md);
  padding: 0 var(--space-4);
  border: 0;
  border-bottom: 3px solid transparent;
  margin-bottom: -1px;
  background: none;
  color: var(--muted);
  font: 500 var(--text-base) var(--font-ui);
  cursor: pointer;
}
.ui-tabs__list--grow .ui-tabs__trigger { flex: 1; justify-content: center; }
.ui-tabs__trigger:hover { color: var(--ink); }
.ui-tabs__trigger[data-state='active'] {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}
.ui-tabs__trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ui-tabs__panel { padding-top: var(--space-4); }
.ui-tabs__panel:focus { outline: none; }
</style>
