<script>
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemText,
  SelectItemIndicator,
} from 'reka-ui';
import UiIcon from './UiIcon.vue';

let uid = 0;

// Replaces <v-select>. options: [{ value, label }]; values must be non-empty
// strings (Reka's rule), so map numbers with String() at the call site.
export default {
  name: 'UiSelect',
  components: {
    SelectRoot,
    SelectTrigger,
    SelectValue,
    SelectPortal,
    SelectContent,
    SelectViewport,
    SelectItem,
    SelectItemText,
    SelectItemIndicator,
    UiIcon,
  },
  props: {
    modelValue: { type: String, default: undefined },
    options: { type: Array, required: true },
    label: { type: String, default: '' },
    // Names the trigger when there is no visible label
    ariaLabel: { type: String, default: undefined },
    placeholder: { type: String, default: 'Select' },
    disabled: { type: Boolean, default: false },
    open: { type: Boolean, default: undefined },
  },
  emits: ['update:modelValue'],
  data() {
    return { id: `ui-select-${++uid}` };
  },
  computed: {
    // Rendered here rather than left to SelectValue, which can only read the
    // label of an item that has been mounted (not the case while closed).
    selectedLabel() {
      return this.options.find((option) => option.value === this.modelValue)?.label;
    },
  },
};
</script>

<template>
  <div class="ui-select" data-testid="ui-select">
    <label v-if="label" class="ui-select__label" :for="id">{{ label }}</label>
    <select-root
      :model-value="modelValue"
      :disabled="disabled"
      :open="open"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <select-trigger :id="id" :aria-label="label ? undefined : ariaLabel" class="ui-select__trigger" data-testid="ui-select-trigger">
        <select-value :placeholder="placeholder">{{ selectedLabel ?? placeholder }}</select-value>
        <ui-icon name="chevron-down" :size="16" />
      </select-trigger>
      <select-portal>
        <select-content class="ui-select__content" position="popper" :side-offset="6" data-testid="ui-select-content">
          <select-viewport class="ui-select__viewport">
            <select-item
              v-for="option in options"
              :key="option.value"
              :value="option.value"
              class="ui-select__item"
              :data-testid="'ui-select-option-' + option.value"
            >
              <select-item-text>{{ option.label }}</select-item-text>
              <select-item-indicator class="ui-select__check">
                <ui-icon name="check" :size="16" />
              </select-item-indicator>
            </select-item>
          </select-viewport>
        </select-content>
      </select-portal>
    </select-root>
  </div>
</template>

<style>
.ui-select { display: flex; flex-direction: column; gap: 6px; font-family: var(--font-ui); }
.ui-select__label { font-size: var(--text-sm); font-weight: 500; color: var(--muted); }
.ui-select__trigger {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: var(--control-md);
  padding: 0 var(--space-3) 0 var(--space-4);
  background: var(--surface);
  color: var(--ink);
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-lg);
  font: 500 var(--text-base) var(--font-ui);
  cursor: pointer;
}
.ui-select__trigger[data-placeholder] { color: var(--muted); }
.ui-select__trigger:focus-visible,
.ui-select__trigger[data-state='open'] {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--ring);
}
.ui-select__trigger[data-disabled] { opacity: 0.5; cursor: not-allowed; }
.ui-select__content {
  z-index: 3000;
  min-width: var(--reka-select-trigger-width);
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-pop);
  font-family: var(--font-ui);
}
.ui-select__viewport { padding: var(--space-1); }
.ui-select__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: var(--control-sm);
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  cursor: pointer;
  outline: none;
}
.ui-select__item[data-highlighted] { background: var(--soft); }
.ui-select__item[data-state='checked'] { color: var(--accent); font-weight: 600; }
.ui-select__item[data-disabled] { opacity: 0.45; }
.ui-select__check { display: inline-flex; }
</style>
