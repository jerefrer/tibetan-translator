<script>
import { CheckboxRoot, CheckboxIndicator } from 'reka-ui';
import UiIcon from './UiIcon.vue';

let uid = 0;

// Replaces <v-checkbox>. v-model is a boolean.
export default {
  name: 'UiCheckbox',
  components: { CheckboxRoot, CheckboxIndicator, UiIcon },
  props: {
    modelValue: { type: Boolean, default: false },
    label: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  data() {
    return { id: `ui-checkbox-${++uid}` };
  },
};
</script>

<template>
  <div class="ui-checkbox" data-testid="ui-checkbox">
    <checkbox-root
      :id="id"
      class="ui-checkbox__root"
      :model-value="modelValue"
      :disabled="disabled"
      data-testid="ui-checkbox-control"
      @update:model-value="$emit('update:modelValue', $event === true)"
    >
      <checkbox-indicator class="ui-checkbox__indicator">
        <ui-icon name="check" :size="14" :stroke-width="3" />
      </checkbox-indicator>
    </checkbox-root>
    <label v-if="label || $slots.default" :for="id" class="ui-checkbox__label"><slot>{{ label }}</slot></label>
  </div>
</template>

<style>
.ui-checkbox { display: inline-flex; align-items: center; gap: var(--space-3); font-family: var(--font-ui); }
.ui-checkbox__root {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--on-accent);
  cursor: pointer;
}
.ui-checkbox__root[data-state='checked'] { background: var(--accent); border-color: var(--accent); }
.ui-checkbox__root:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ui-checkbox__root:disabled { opacity: 0.5; cursor: not-allowed; }
.ui-checkbox__indicator { display: inline-flex; }
.ui-checkbox__label { font-size: var(--text-base); color: var(--ink); cursor: pointer; }
</style>
