<script>
import { SwitchRoot, SwitchThumb } from 'reka-ui';

let uid = 0;

// Replaces <v-switch>. The label is the default slot or the `label` prop;
// without a visible label, `aria-label` names the control itself.
export default {
  name: 'UiSwitch',
  components: { SwitchRoot, SwitchThumb },
  props: {
    modelValue: { type: Boolean, default: false },
    label: { type: String, default: '' },
    ariaLabel: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  data() {
    return { id: `ui-switch-${++uid}` };
  },
};
</script>

<template>
  <div class="ui-switch" data-testid="ui-switch">
    <switch-root
      :id="id"
      class="ui-switch__root"
      :model-value="modelValue"
      :disabled="disabled"
      :aria-label="ariaLabel"
      data-testid="ui-switch-control"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <switch-thumb class="ui-switch__thumb" />
    </switch-root>
    <label v-if="label || $slots.default" :for="id" class="ui-switch__label"><slot>{{ label }}</slot></label>
  </div>
</template>

<style>
.ui-switch { display: inline-flex; align-items: center; gap: var(--space-3); font-family: var(--font-ui); }
.ui-switch__root {
  flex: none;
  position: relative;
  width: 2.5rem;
  height: 1.5rem;
  padding: 0;
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-pill);
  background: var(--soft);
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}
.ui-switch__root[data-state='checked'] { background: var(--accent); border-color: var(--accent); }
.ui-switch__root:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ui-switch__root:disabled { opacity: 0.5; cursor: not-allowed; }
.ui-switch__thumb {
  display: block;
  width: 1.0625rem;
  height: 1.0625rem;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transform: translateX(0.125rem);
  transition: transform 0.15s;
}
.ui-switch__thumb[data-state='checked'] { transform: translateX(1.1875rem); background: var(--on-accent); }
.ui-switch__label { font-size: var(--text-base); color: var(--ink); cursor: pointer; }
</style>
