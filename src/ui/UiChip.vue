<script>
import UiIcon from './UiIcon.vue';

// Replaces <v-chip> and <v-chip-group>. A plain chip is a label (the
// dictionary tags); `clickable` makes it a toggle button (filters, with
// `selected`), `removable` adds a close button.
export default {
  name: 'UiChip',
  components: { UiIcon },
  props: {
    tone: { type: String, default: 'accent', validator: (v) => ['accent', 'neutral', 'amber'].includes(v) },
    outlined: { type: Boolean, default: false },
    clickable: { type: Boolean, default: false },
    selected: { type: Boolean, default: false },
    removable: { type: Boolean, default: false },
  },
  emits: ['click', 'remove'],
};
</script>

<template>
  <component
    :is="clickable ? 'button' : 'span'"
    class="ui-chip"
    :class="['ui-chip--' + tone, { 'ui-chip--outlined': outlined, 'is-selected': selected, 'is-clickable': clickable }]"
    :type="clickable ? 'button' : undefined"
    :aria-pressed="clickable ? String(selected) : undefined"
    data-testid="ui-chip"
    @click="clickable && $emit('click', $event)"
  >
    <ui-icon v-if="selected && clickable" name="check" :size="14" />
    <slot />
    <button
      v-if="removable"
      type="button"
      class="ui-chip__remove"
      aria-label="Remove"
      data-testid="ui-chip-remove"
      @click.stop="$emit('remove')"
    >
      <ui-icon name="x" :size="12" />
    </button>
  </component>
</template>

<style>
.ui-chip {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  font: 600 var(--text-chip) var(--font-ui);
  border-radius: var(--radius-sm);
  padding: 3px 9px;
  border: 1px solid transparent;
}
.ui-chip--accent { color: var(--accent); background: var(--accent-soft); }
.ui-chip--neutral { color: var(--muted); background: var(--soft); }
.ui-chip--amber { color: var(--amber-ink); background: var(--amber-bg); }
.ui-chip--outlined {
  background: transparent;
  border-color: currentColor;
}
.ui-chip.is-clickable {
  cursor: pointer;
  border-radius: var(--radius-pill);
  padding: 4px 12px;
  background: var(--surface);
  color: var(--ink);
  border-color: var(--line-strong);
  font-weight: 500;
}
.ui-chip.is-clickable.is-selected {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent);
}
.ui-chip.is-clickable:focus-visible,
.ui-chip__remove:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.ui-chip__remove {
  display: inline-flex;
  align-items: center;
  border: 0;
  background: none;
  color: inherit;
  padding: 0;
  cursor: pointer;
  opacity: 0.8;
}
.ui-chip__remove:hover { opacity: 1; }
</style>
