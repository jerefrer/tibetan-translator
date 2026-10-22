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
  },
  emits: ['update:modelValue'],
  methods: {
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
        :style="{ maxWidth: maxWidth / 16 + 'rem' }"
        :aria-describedby="description ? undefined : ''"
        data-testid="ui-dialog"
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
</style>
