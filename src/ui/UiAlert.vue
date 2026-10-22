<script>
import UiIcon from './UiIcon.vue';

const ICONS = {
  info: 'info',
  success: 'circle-check',
  warning: 'triangle-alert',
  error: 'circle-alert',
};

// Replaces <v-alert>. `type` is Vuetify's: info, success, warning, error.
export default {
  name: 'UiAlert',
  components: { UiIcon },
  props: {
    type: { type: String, default: 'info', validator: (v) => Object.keys(ICONS).includes(v) },
    title: { type: String, default: '' },
    dismissible: { type: Boolean, default: false },
  },
  emits: ['dismiss'],
  computed: {
    icon() {
      return ICONS[this.type];
    },
    role() {
      return this.type === 'error' || this.type === 'warning' ? 'alert' : 'status';
    },
  },
};
</script>

<template>
  <div class="ui-alert" :class="'ui-alert--' + type" :role="role" data-testid="ui-alert">
    <ui-icon :name="icon" :size="20" class="ui-alert__icon" />
    <div class="ui-alert__content">
      <strong v-if="title" class="ui-alert__title">{{ title }}</strong>
      <div class="ui-alert__body"><slot /></div>
    </div>
    <button
      v-if="dismissible"
      type="button"
      class="ui-alert__close"
      aria-label="Dismiss"
      data-testid="ui-alert-dismiss"
      @click="$emit('dismiss')"
    >
      <ui-icon name="x" :size="16" />
    </button>
  </div>
</template>

<style>
.ui-alert {
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-xl);
  background: var(--soft);
  color: var(--ink);
  font: var(--text-base) / 1.5 var(--font-ui);
}
.ui-alert--success { background: var(--success-soft); border-color: var(--success-line); }
.ui-alert--warning { background: var(--amber-bg); border-color: var(--amber-line); color: var(--amber-ink); }
.ui-alert--error { background: var(--danger-soft); border-color: var(--danger-line); }
.ui-alert__icon { margin-top: 1px; }
.ui-alert--info .ui-alert__icon { color: var(--accent); }
.ui-alert--success .ui-alert__icon { color: var(--success-ink); }
.ui-alert--warning .ui-alert__icon { color: var(--amber-ink); }
.ui-alert--error .ui-alert__icon { color: var(--danger-ink); }
.ui-alert__content { flex: 1; min-width: 0; }
.ui-alert__title { display: block; font-weight: 600; }
.ui-alert__close {
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  padding: 2px;
  opacity: 0.7;
}
.ui-alert__close:hover { opacity: 1; }
.ui-alert__close:focus-visible { outline: 2px solid var(--accent); }
</style>
