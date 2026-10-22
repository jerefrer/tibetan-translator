<script>
import UiSpinner from './UiSpinner.vue';

// Replaces <v-btn>. Variants map from Vuetify as: flat -> solid,
// outlined -> outline, text -> ghost; `danger` is a destructive solid button.
export default {
  name: 'UiButton',
  components: { UiSpinner },
  props: {
    variant: {
      type: String,
      default: 'solid',
      validator: (value) => ['solid', 'outline', 'ghost', 'danger'].includes(value),
    },
    size: { type: String, default: 'md', validator: (value) => ['sm', 'md'].includes(value) },
    // Square button holding only an icon; give it an aria-label
    icon: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    block: { type: Boolean, default: false },
    type: { type: String, default: 'button' },
  },
  watch: {
    // A loading button is disabled, and the browser drops the focus of a
    // disabled button: give it back once loading ends (Split words, Search)
    loading(isLoading) {
      if (isLoading) {
        this.hadFocus = document.activeElement === this.$el;
      } else if (this.hadFocus) {
        this.hadFocus = false;
        this.$nextTick(() => {
          if (!document.activeElement || document.activeElement === document.body) this.$el?.focus?.();
        });
      }
    },
  },
};
</script>

<template>
  <button
    class="ui-button"
    :class="[
      'ui-button--' + variant,
      'ui-button--' + size,
      { 'ui-button--icon': icon, 'ui-button--block': block, 'is-loading': loading },
    ]"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
    data-testid="ui-button"
  >
    <ui-spinner v-if="loading" :size="16" />
    <slot />
  </button>
</template>

<style>
.ui-button {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: var(--control-md);
  padding: 0 var(--space-4);
  border: 1.5px solid transparent;
  border-radius: var(--radius-lg);
  font: 600 var(--text-base) var(--font-ui);
  cursor: pointer;
  transition: background-color 0.12s, border-color 0.12s, opacity 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.ui-button--sm {
  height: var(--control-sm);
  padding: 0 14px;
  font-size: var(--text-sm-plus);
  border-radius: var(--radius-md);
}
.ui-button--solid {
  background: var(--accent);
  color: var(--on-accent);
}
.ui-button--solid:hover:not(:disabled) { opacity: 0.9; }
.ui-button--outline {
  background: var(--surface);
  color: var(--ink);
  border-color: var(--line-strong);
  font-weight: 500;
}
.ui-button--outline:hover:not(:disabled) { background: var(--soft); }
.ui-button--ghost {
  background: transparent;
  color: var(--accent);
  padding: 0 var(--space-3);
}
.ui-button--ghost:hover:not(:disabled) { background: var(--accent-soft); }
.ui-button--danger {
  background: var(--danger);
  color: var(--on-danger);
}
.ui-button--danger:hover:not(:disabled) { opacity: 0.9; }
.ui-button--icon {
  width: var(--control-md);
  padding: 0;
}
.ui-button--icon.ui-button--sm { width: var(--control-sm); }
.ui-button--block { display: flex; width: 100%; }
.ui-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.ui-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ui-button.is-loading { cursor: progress; }
.ui-button .ui-spinner { color: currentColor; }
</style>
