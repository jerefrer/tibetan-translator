<script>
import UiIcon from './UiIcon.vue';
import UiSpinner from './UiSpinner.vue';

let uid = 0;

// Replaces <v-text-field> (and, with `multiline`, <v-textarea>).
// Class, style and data-testid go on the wrapper; every other attribute
// (placeholder, autocomplete, maxlength...) goes on the input itself.
// `tibetan` switches the input to DDC Uchen at the search-field size.
export default {
  name: 'UiTextField',
  components: { UiIcon, UiSpinner },
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number], default: '' },
    label: { type: String, default: '' },
    hint: { type: String, default: '' },
    // Error message; also marks the field invalid
    error: { type: String, default: '' },
    type: { type: String, default: 'text' },
    clearable: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    tibetan: { type: Boolean, default: false },
    multiline: { type: Boolean, default: false },
    rows: { type: Number, default: 3 },
    prependIcon: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'clear'],
  data() {
    return { id: `ui-field-${++uid}` };
  },
  computed: {
    wrapperAttrs() {
      const { class: cls, style, 'data-testid': testid } = this.$attrs;
      return { class: cls, style, 'data-testid': testid || 'ui-text-field' };
    },
    inputAttrs() {
      const { class: _c, style: _s, 'data-testid': _t, ...rest } = this.$attrs;
      return rest;
    },
    showClear() {
      return this.clearable && !this.disabled && String(this.modelValue ?? '') !== '';
    },
    describedBy() {
      return this.error || this.hint ? `${this.id}-msg` : undefined;
    },
  },
  methods: {
    onInput(event) {
      this.$emit('update:modelValue', event.target.value);
    },
    clear() {
      this.$emit('update:modelValue', '');
      this.$emit('clear');
      this.focus();
    },
    focus() {
      this.$refs.input?.focus();
    },
  },
};
</script>

<template>
  <div
    class="ui-field"
    :class="[{ 'is-error': !!error, 'is-disabled': disabled, 'ui-field--tibetan': tibetan, 'ui-field--multiline': multiline }, wrapperAttrs.class]"
    :style="wrapperAttrs.style"
    :data-testid="wrapperAttrs['data-testid']"
  >
    <label v-if="label" class="ui-field__label" :for="id">{{ label }}</label>
    <div class="ui-field__control">
      <ui-icon v-if="prependIcon" :name="prependIcon" :size="20" class="ui-field__prepend" />
      <textarea
        v-if="multiline"
        :id="id"
        ref="input"
        class="ui-field__input"
        :rows="rows"
        :value="modelValue"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        data-testid="ui-text-field-input"
        v-bind="inputAttrs"
        @input="onInput"
      />
      <input
        v-else
        :id="id"
        ref="input"
        class="ui-field__input"
        :type="type"
        :value="modelValue"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        data-testid="ui-text-field-input"
        v-bind="inputAttrs"
        @input="onInput"
      />
      <ui-spinner v-if="loading" :size="18" />
      <button
        v-if="showClear"
        type="button"
        class="ui-field__clear"
        aria-label="Clear"
        data-testid="ui-text-field-clear"
        @click="clear"
      >
        <ui-icon name="x" :size="18" />
      </button>
      <slot name="append" />
    </div>
    <p v-if="error || hint" :id="describedBy" class="ui-field__message" data-testid="ui-text-field-message">
      {{ error || hint }}
    </p>
  </div>
</template>

<style>
.ui-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: var(--font-ui);
  min-width: 0;
}
.ui-field__label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--muted);
}
.ui-field__control {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--control-md);
  padding: 0 var(--space-3) 0 var(--space-4);
  background: var(--surface);
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-xl);
  color: var(--ink);
  transition: border-color 0.12s, box-shadow 0.12s;
}
.ui-field__control:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--ring);
}
.ui-field.is-error .ui-field__control { border-color: var(--danger); }
.ui-field.is-disabled .ui-field__control { opacity: 0.55; background: var(--soft); }
.ui-field__prepend { color: var(--muted); }
.ui-field__input {
  flex: 1;
  min-width: 0;
  align-self: stretch;
  box-sizing: border-box;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font: var(--text-md) var(--font-ui);
  padding: 0;
}
.ui-field__input::placeholder { color: var(--muted); }
.ui-field--multiline .ui-field__control { align-items: flex-start; padding-top: var(--space-3); padding-bottom: var(--space-3); }
.ui-field--multiline .ui-field__input { resize: vertical; line-height: 1.5; }
.ui-field--tibetan .ui-field__input {
  font-family: var(--font-tibetan);
  font-size: var(--text-tibetan-lg);
  line-height: 1.5;
  padding-top: 0.3rem;
}
.ui-field__clear {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  background: none;
  color: var(--muted);
  cursor: pointer;
  border-radius: var(--radius-lg);
}
.ui-field__clear:hover { color: var(--ink); }
.ui-field__clear:focus-visible { outline: 2px solid var(--accent); }
.ui-field__message {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--muted);
}
.ui-field.is-error .ui-field__message { color: var(--danger-ink); }
</style>
