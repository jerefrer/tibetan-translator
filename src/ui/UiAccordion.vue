<script>
import { AccordionRoot, AccordionItem, AccordionHeader, AccordionTrigger, AccordionContent } from 'reka-ui';
import UiIcon from './UiIcon.vue';

// Replaces <v-expansion-panels>. items: [{ value, title }]; each panel's body
// is the slot `item-<value>`. Single-open and collapsible by default.
export default {
  name: 'UiAccordion',
  components: { AccordionRoot, AccordionItem, AccordionHeader, AccordionTrigger, AccordionContent, UiIcon },
  props: {
    items: { type: Array, required: true },
    modelValue: { type: String, default: undefined },
  },
  emits: ['update:modelValue'],
};
</script>

<template>
  <accordion-root
    class="ui-accordion"
    type="single"
    collapsible
    :model-value="modelValue"
    data-testid="ui-accordion"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <accordion-item v-for="item in items" :key="item.value" :value="item.value" class="ui-accordion__item">
      <accordion-header class="ui-accordion__header">
        <accordion-trigger class="ui-accordion__trigger" :data-testid="'ui-accordion-trigger-' + item.value">
          {{ item.title }}
          <ui-icon name="chevron-down" :size="18" class="ui-accordion__chevron" />
        </accordion-trigger>
      </accordion-header>
      <accordion-content class="ui-accordion__content">
        <div class="ui-accordion__inner"><slot :name="'item-' + item.value" /></div>
      </accordion-content>
    </accordion-item>
  </accordion-root>
</template>

<style>
.ui-accordion { font-family: var(--font-ui); border-top: 1px solid var(--line); }
.ui-accordion__item { border-bottom: 1px solid var(--line); }
.ui-accordion__header { margin: 0; display: flex; }
.ui-accordion__trigger {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--control-md);
  padding: 0 var(--space-1);
  border: 0;
  background: none;
  color: var(--ink);
  font: 500 var(--text-base) var(--font-ui);
  text-align: left;
  cursor: pointer;
}
.ui-accordion__trigger:focus-visible { outline: 2px solid var(--accent); }
.ui-accordion__chevron { transition: transform 0.15s; color: var(--muted); }
.ui-accordion__trigger[data-state='open'] .ui-accordion__chevron { transform: rotate(180deg); }
.ui-accordion__inner { padding: 0 var(--space-1) var(--space-3); font-size: var(--text-base); }
</style>
