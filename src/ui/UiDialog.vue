<script>
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from 'reka-ui';

// Replaces <v-dialog>. Controlled with v-model; the footer buttons go in the
// `actions` slot (replacing v-card-actions). `persistent` ignores Escape and
// clicks outside, like Vuetify's prop of the same name.
export default {
  name: 'UiDialog',
  components: { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription },
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    // px at the default text size
    maxWidth: { type: Number, default: 520 },
    persistent: { type: Boolean, default: false },
    // Phones: a sheet about 90% of the visible height, the body filling it and
    // scrolling inside (the title and the actions stay put). Ignored elsewhere.
    tall: { type: Boolean, default: false },
    // false keeps the first field from taking focus at opening (no keyboard)
    autoFocus: { type: Boolean, default: true },
  },
  emits: ['update:modelValue'],
  methods: {
    skipAutoFocus(event) {
      if (!this.autoFocus) event.preventDefault();
    },
    keepOpen(event) {
      if (this.persistent) event.preventDefault();
    },
  },
};
</script>

<template>
  <dialog-root :open="modelValue" @update:open="$emit('update:modelValue', $event)">
    <dialog-portal>
      <dialog-overlay class="ui-dialog__overlay" data-testid="ui-dialog-overlay" />
      <dialog-content
        class="ui-dialog"
        :class="{ 'ui-dialog--tall': tall }"
        :style="{ maxWidth: maxWidth / 16 + 'rem' }"
        :aria-describedby="description ? undefined : ''"
        data-testid="ui-dialog"
        @open-auto-focus="skipAutoFocus"
        @escape-key-down="keepOpen"
        @pointer-down-outside="keepOpen"
        @interact-outside="keepOpen"
      >
        <dialog-title class="ui-dialog__title">{{ title }}</dialog-title>
        <dialog-description v-if="description" class="ui-dialog__description">
          {{ description }}
        </dialog-description>
        <div class="ui-dialog__body"><slot /></div>
        <div v-if="$slots.actions" class="ui-dialog__actions" data-testid="ui-dialog-actions">
          <slot name="actions" />
        </div>
      </dialog-content>
    </dialog-portal>
  </dialog-root>
</template>

<style>
.ui-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--scrim);
}
.ui-dialog {
  position: fixed;
  z-index: 2001;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  width: calc(100vw - 2 * var(--space-4));
  max-height: calc(100dvh - 2 * var(--space-4));
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 28px 30px 22px;
  background: var(--surface);
  color: var(--ink);
  border-radius: var(--radius-dialog);
  box-shadow: var(--shadow-dialog);
  font-family: var(--font-ui);
}
.ui-dialog:focus { outline: none; }
.ui-dialog__title {
  margin: 0;
  font-size: var(--text-title);
  font-weight: 600;
}
.ui-dialog__description {
  margin: 0;
  font-size: var(--text-body);
  line-height: 1.55;
  color: var(--muted);
}
.ui-dialog__body {
  font-size: var(--text-body);
  line-height: 1.5;
}
.ui-dialog__body:empty { display: none; }
.ui-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}
/* Phones: a bottom sheet that rides above the keyboard (see keyboard-inset.js) */
@media (max-width: 600px) {
  .ui-dialog {
    top: auto;
    left: 0;
    right: 0;
    bottom: var(--keyboard-inset, 0px);
    transform: none;
    width: 100%;
    max-width: none !important;
    max-height: calc(var(--visible-height, 100dvh) - var(--safe-top) - var(--space-4));
    padding-bottom: max(22px, var(--safe-bottom));
    border-radius: var(--radius-dialog) var(--radius-dialog) 0 0;
  }
  .ui-dialog__actions > * { flex: 1; }
  .ui-dialog--tall {
    height: calc(var(--visible-height, 100dvh) * 0.9);
    overflow: hidden;
  }
  .ui-dialog--tall .ui-dialog__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
}
</style>
