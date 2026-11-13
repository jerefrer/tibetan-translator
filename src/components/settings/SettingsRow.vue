<script>
import { UiIcon } from '../../ui';

// One setting (boards DesktopSettings, MobileSettings): its name and a line
// of explanation on the left, its control on the right (default slot).
// `below` holds what goes under the text (a progress bar). `nested` indents
// the row under the one it belongs to.
//
// A row that leads somewhere (`clickable`) is a button with a chevron: its
// default slot then holds a value ("1 of 4") and it emits `click`. With
// `expanded` set (true or false) it is a disclosure instead, its chevron
// turned down while open.
export default {
  name: 'SettingsRow',
  components: { UiIcon },
  props: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    clickable: { type: Boolean, default: false },
    expanded: { type: Boolean, default: undefined },
    nested: { type: Boolean, default: false },
    tone: { type: String, default: '' },
  },
  emits: ['click'],
};
</script>

<template>
  <button
    v-if="clickable"
    type="button"
    class="settings-row is-clickable"
    :class="{ 'is-nested': nested }"
    :aria-expanded="expanded === undefined ? undefined : String(expanded)"
    @click="$emit('click', $event)"
  >
    <span class="settings-row__text">
      <span class="settings-row__title">{{ title }}</span>
      <span v-if="description" class="settings-row__description">{{ description }}</span>
    </span>
    <span v-if="$slots.default" class="settings-row__value"><slot /></span>
    <ui-icon
      name="chevron-right"
      :size="16"
      :stroke-width="2"
      class="settings-row__chevron"
      :class="{ 'is-open': expanded }"
    />
  </button>
  <div v-else class="settings-row" :class="[{ 'is-nested': nested }, tone && 'is-' + tone]">
    <span class="settings-row__text">
      <span class="settings-row__title">{{ title }}</span>
      <span v-if="description" class="settings-row__description">{{ description }}</span>
      <slot name="below" />
    </span>
    <span v-if="$slots.default" class="settings-row__control"><slot /></span>
  </div>
</template>

<style>
.settings-row {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
  min-height: 3.5rem;
  margin: 0;
  padding: 10px var(--space-4);
  border: 0;
  border-top: 1px solid var(--line-soft);
  background: transparent;
  font: inherit;
  text-align: left;
  color: var(--ink);
}
.settings-group__box > .settings-row:first-child,
.settings-group__box > :first-child > .settings-row:first-child {
  border-top: 0;
}
.settings-row.is-nested {
  padding-left: var(--space-8);
  background: color-mix(in srgb, var(--bg-quiet) 60%, var(--surface));
}
.settings-row.is-warning {
  background: color-mix(in srgb, var(--amber-bg) 55%, var(--surface));
}
.settings-row.is-clickable {
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.settings-row.is-clickable:hover {
  background: color-mix(in srgb, var(--soft) 50%, var(--surface));
}
.settings-row.is-clickable:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.settings-row__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.settings-row__title {
  font-size: var(--text-base);
  font-weight: 500;
}
.settings-row__description {
  font-size: var(--text-sm);
  line-height: 1.4;
  color: var(--muted);
}
.settings-row__control,
.settings-row__value {
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.settings-row__value {
  font-size: var(--text-base);
  color: var(--muted);
}
.settings-row__chevron {
  flex: none;
  color: var(--faint);
  transition: transform 0.15s ease;
}
.settings-row__chevron.is-open {
  transform: rotate(90deg);
}
@media (prefers-reduced-motion: reduce) {
  .settings-row__chevron,
  .settings-row.is-clickable {
    transition: none;
  }
}

/* Phone: iOS-like rows, the title a little larger */
@media (max-width: 600px) {
  .settings-row {
    min-height: 3.25rem;
    gap: var(--space-3);
  }
  .settings-row__title {
    font-size: var(--text-md);
    font-weight: 400;
  }
  .settings-row.is-nested {
    padding-left: var(--space-6);
  }
}
</style>
