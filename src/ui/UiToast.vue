<script>
import { ToastProvider, ToastRoot, ToastDescription, ToastClose, ToastViewport } from 'reka-ui';

// Replaces <v-snackbar>. Controlled with v-model like the app's snackbar
// state ({ show, content }). The message is the default slot, so it can carry
// HTML such as links; the Close button is built in.
export default {
  name: 'UiToast',
  components: { ToastProvider, ToastRoot, ToastDescription, ToastClose, ToastViewport },
  props: {
    modelValue: { type: Boolean, default: false },
    // ms before it closes by itself; 0 keeps it open until dismissed
    duration: { type: Number, default: 5000 },
    closeLabel: { type: String, default: 'Close' },
  },
  emits: ['update:modelValue'],
  computed: {
    effectiveDuration() {
      return this.duration > 0 ? this.duration : Infinity;
    },
  },
};
</script>

<template>
  <toast-provider :duration="effectiveDuration" label="Notification">
    <toast-root
      class="ui-toast"
      :open="modelValue"
      data-testid="ui-toast"
      @update:open="$emit('update:modelValue', $event)"
    >
      <toast-description class="ui-toast__message"><slot /></toast-description>
      <toast-close class="ui-toast__close" data-testid="ui-toast-close">{{ closeLabel }}</toast-close>
    </toast-root>
    <toast-viewport class="ui-toast__viewport" />
  </toast-provider>
</template>

<style>
.ui-toast__viewport {
  position: fixed;
  z-index: 4000;
  left: 50%;
  bottom: calc(var(--space-4) + var(--safe-bottom));
  transform: translateX(-50%);
  width: min(32rem, calc(100vw - 2 * var(--space-4)));
  margin: 0;
  padding: 0;
  list-style: none;
  outline: none;
}
.ui-toast {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  background: var(--dark);
  color: var(--on-dark);
  box-shadow: var(--shadow-pop);
  font: var(--text-base) / 1.45 var(--font-ui);
}
.ui-toast[data-state='open'] { animation: ui-toast-in 0.18s ease-out; }
.ui-toast__message { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.ui-toast__message a { color: inherit; text-decoration: underline; }
.ui-toast__close {
  flex: none;
  border: 0;
  background: none;
  color: inherit;
  font: 600 var(--text-sm) var(--font-ui);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-decoration: underline;
}
.ui-toast__close:focus-visible { outline: 2px solid currentColor; }
@keyframes ui-toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
</style>
