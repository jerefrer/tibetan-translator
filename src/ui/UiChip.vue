<script>
import UiIcon from './UiIcon.vue';

// Replaces <v-chip> and <v-chip-group>. A plain chip is a label (the
// dictionary tags); `clickable` makes it a toggle button (filters, with
// `selected`), `removable` adds a close button.
// A clickable chip comes in three looks: `toggle` (accent when selected, with
// a check), `pill` (a filter row whose selected chip turns dark) and `tag` (a
// subject tag in its tone, solid when selected). `count` shows a number after
// the label. A plain label with `selected` is a highlighted tag: solid in its
// tone.
export default {
  name: 'UiChip',
  components: { UiIcon },
  props: {
    tone: { type: String, default: 'accent', validator: (v) => ['accent', 'neutral', 'amber'].includes(v) },
    outlined: { type: Boolean, default: false },
    clickable: { type: Boolean, default: false },
    selected: { type: Boolean, default: false },
    removable: { type: Boolean, default: false },
    variant: { type: String, default: 'toggle', validator: (v) => ['toggle', 'pill', 'tag'].includes(v) },
    count: { type: [Number, String], default: null },
  },
  emits: ['click', 'remove'],
};
</script>

<template>
  <component
    :is="clickable ? 'button' : 'span'"
    class="ui-chip"
    :class="[
      'ui-chip--' + tone,
      { 'ui-chip--outlined': outlined, 'is-selected': selected, 'is-clickable': clickable },
      clickable ? 'ui-chip--' + variant : null,
    ]"
    :type="clickable ? 'button' : undefined"
    :aria-pressed="clickable ? String(selected) : undefined"
    data-testid="ui-chip"
    @click="clickable && $emit('click', $event)"
  >
    <ui-icon v-if="selected && clickable && variant === 'toggle'" name="check" :size="14" />
    <slot />
    <span v-if="count !== null" class="ui-chip__count" data-testid="ui-chip-count">{{ count }}</span>
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
.ui-chip--accent.is-selected:not(.is-clickable) { color: var(--on-accent); background: var(--accent); }
.ui-chip--neutral.is-selected:not(.is-clickable) { color: var(--on-dark); background: var(--dark); }
.ui-chip--amber.is-selected:not(.is-clickable) { color: var(--on-amber-solid); background: var(--amber-solid); }
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
.ui-chip.is-clickable.ui-chip--pill {
  height: var(--control-sm);
  padding: 0 14px;
  font-size: var(--text-sm);
}
.ui-chip.is-clickable.ui-chip--pill.is-selected {
  background: var(--dark);
  color: var(--on-dark);
  border-color: var(--dark);
  font-weight: 600;
}
.ui-chip.is-clickable.ui-chip--tag {
  height: 1.875rem;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  border-radius: 8px;
  border-color: transparent;
  font-size: var(--text-sm);
}
.ui-chip--tag.ui-chip--amber { background: var(--amber-bg); color: var(--amber-ink); }
.ui-chip--tag.ui-chip--accent { background: var(--accent-soft); color: var(--accent); }
.ui-chip--tag.ui-chip--neutral { background: var(--soft); color: var(--muted); }
.ui-chip.is-clickable.ui-chip--tag.is-selected { font-weight: 600; }
.ui-chip--tag.ui-chip--amber.is-selected { background: var(--amber-solid); color: var(--on-amber-solid); }
.ui-chip--tag.ui-chip--accent.is-selected { background: var(--accent); color: var(--on-accent); }
.ui-chip--tag.ui-chip--neutral.is-selected { background: var(--dark); color: var(--on-dark); }
.ui-chip__count {
  font-weight: 500;
  opacity: 0.75;
}
.ui-chip.is-selected .ui-chip__count { opacity: 0.85; }
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
