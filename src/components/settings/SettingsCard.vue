<script>
import { UiCard } from '../../ui';

// One section of the Library (and of Settings): a title,
// an optional muted subtitle, an `aside` slot on the right of the header
// (switch, button) and the body below.
export default {
  name: 'SettingsCard',
  components: { UiCard },
  props: {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
  },
};
</script>

<template>
  <ui-card class="settings-card">
    <template v-if="title || $slots.aside" #header>
      <div class="settings-card__header">
        <div class="settings-card__heading">
          <h2 class="settings-card__title">{{ title }}</h2>
          <p v-if="subtitle || $slots.subtitle" class="settings-card__subtitle">
            <slot name="subtitle">{{ subtitle }}</slot>
          </p>
        </div>
        <slot name="aside" />
      </div>
    </template>
    <slot />
  </ui-card>
</template>

<style>
/* Library frame. Desktop: a hairline section, no box. Phone: a small
   uppercase label above a white group on the grey ground. */
.settings-card.ui-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5) 0;
  border: 0;
  border-top: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  overflow: visible;
}
.settings-card .ui-card__header,
.settings-card .ui-card__body {
  padding: 0;
}
.settings-card .ui-card__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: var(--text-base);
}
.settings-card .ui-card__body:empty {
  display: none;
}
.settings-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.settings-card__heading {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.settings-card__title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: 600;
}
.settings-card__subtitle {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--muted);
}

@media (max-width: 600px) {
  .settings-card.ui-card {
    gap: var(--space-2);
    padding: 0;
    border-top: 0;
  }
  .settings-card__heading {
    padding: 0 var(--space-1);
  }
  .settings-card__title {
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .settings-card .ui-card__body {
    gap: var(--space-3);
    padding: 14px var(--space-4);
    border-radius: var(--radius-group);
    background: var(--surface);
  }
}
</style>
