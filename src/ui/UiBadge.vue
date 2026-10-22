<script>
// Replaces <v-badge>: a dot or count pinned to the corner of the slot.
export default {
  name: 'UiBadge',
  props: {
    // Count or short text; when empty the badge is a dot
    content: { type: [String, Number], default: '' },
    show: { type: Boolean, default: true },
    tone: { type: String, default: 'warning', validator: (v) => ['warning', 'danger', 'accent'].includes(v) },
  },
};
</script>

<template>
  <span class="ui-badge" data-testid="ui-badge">
    <slot />
    <span
      v-if="show"
      class="ui-badge__mark"
      :class="['ui-badge__mark--' + tone, { 'ui-badge__mark--dot': content === '' }]"
      data-testid="ui-badge-mark"
    >{{ content }}</span>
  </span>
</template>

<style>
.ui-badge { position: relative; display: inline-flex; }
.ui-badge__mark {
  position: absolute;
  top: -4px;
  right: -6px;
  box-sizing: border-box;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  font: 600 var(--text-caption) / 1.0625rem var(--font-ui);
  text-align: center;
  color: var(--on-accent);
  border: 2px solid var(--surface);
}
.ui-badge__mark--dot { min-width: 0; width: 0.75rem; height: 0.75rem; padding: 0; }
.ui-badge__mark--warning { background: var(--amber-line); }
.ui-badge__mark--danger { background: var(--danger); }
.ui-badge__mark--accent { background: var(--accent); }
</style>
