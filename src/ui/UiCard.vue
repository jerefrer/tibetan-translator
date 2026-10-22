<script>
// Replaces the v-card family: v-card, v-card-title, v-card-subtitle,
// v-card-text and v-card-actions, as the `title`, `subtitle`, default and
// `actions` slots (or props).
export default {
  name: 'UiCard',
  props: {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    // Drop the border and shadow, e.g. for a card nested in a card
    flat: { type: Boolean, default: false },
  },
};
</script>

<template>
  <section class="ui-card" :class="{ 'ui-card--flat': flat }" data-testid="ui-card">
    <header v-if="title || subtitle || $slots.header" class="ui-card__header">
      <slot name="header">
        <h3 v-if="title" class="ui-card__title">{{ title }}</h3>
        <p v-if="subtitle" class="ui-card__subtitle">{{ subtitle }}</p>
      </slot>
    </header>
    <div class="ui-card__body"><slot /></div>
    <footer v-if="$slots.actions" class="ui-card__actions"><slot name="actions" /></footer>
  </section>
</template>

<style>
.ui-card {
  box-sizing: border-box;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  font-family: var(--font-ui);
  overflow: hidden;
}
.ui-card--flat {
  border-color: transparent;
  box-shadow: none;
}
.ui-card__header {
  padding: var(--space-4) var(--space-5) 0;
}
.ui-card__title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: 600;
}
.ui-card__subtitle {
  margin: 2px 0 0;
  font-size: var(--text-sm);
  color: var(--muted);
}
.ui-card__body {
  padding: var(--space-4) var(--space-5);
  font-size: var(--text-body);
  line-height: 1.5;
}
.ui-card__actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-4) var(--space-4);
}
</style>
