<script>
// A segmented control: a radio group whose options sit side by side in a
// quiet track, the chosen one raised (Saved's Newest / Tibetan order). Only the
// chosen option is in the tab order; the arrow keys move the choice.
export default {
  name: 'UiSegmented',
  props: {
    modelValue: { type: [String, Number], default: '' },
    // [{ value, label, ariaLabel?, tibetan? }]
    options: { type: Array, required: true },
    // The group's accessible name
    label: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  methods: {
    choose(value) {
      if (value !== this.modelValue) this.$emit('update:modelValue', value);
    },
    onKeydown(event, index) {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const count = this.options.length;
      const next = (index + step + count) % count;
      this.choose(this.options[next].value);
      this.$refs.option?.[next]?.focus();
    },
  },
};
</script>

<template>
  <div class="ui-segmented" role="radiogroup" :aria-label="label || undefined">
    <button
      v-for="(option, index) in options"
      :key="option.value"
      ref="option"
      type="button"
      role="radio"
      class="ui-segmented__option"
      :class="{ 'ui-segmented__option--tibetan': option.tibetan, 'is-checked': option.value === modelValue }"
      :aria-checked="option.value === modelValue ? 'true' : 'false'"
      :aria-label="option.ariaLabel || undefined"
      :tabindex="option.value === modelValue ? 0 : -1"
      @click="choose(option.value)"
      @keydown="onKeydown($event, index)"
    >{{ option.label }}</button>
  </div>
</template>

<style>
.ui-segmented {
  display: inline-flex;
  flex: none;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-lg);
  background: var(--soft);
}

.ui-segmented__option {
  min-width: var(--control-md);
  height: var(--control-md);
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--muted);
  font: 500 var(--text-sm) var(--font-ui);
  white-space: nowrap;
  cursor: pointer;
}

.ui-segmented__option:hover {
  color: var(--ink);
}

.ui-segmented__option.is-checked {
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-card);
}

.ui-segmented__option:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.ui-segmented__option--tibetan {
  font-family: var(--font-tibetan);
  font-size: var(--text-md);
}

.ui-segmented__option--tibetan.is-checked {
  color: var(--rubric);
}
</style>
