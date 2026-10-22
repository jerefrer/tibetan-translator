<script>
// Replaces <v-progress-circular indeterminate>.
export default {
  name: 'UiSpinner',
  props: {
    // px at the default text size
    size: { type: Number, default: 24 },
    label: { type: String, default: 'Loading' },
  },
};
</script>

<template>
  <span
    class="ui-spinner"
    role="status"
    :aria-label="label"
    data-testid="ui-spinner"
    :style="{ width: size / 16 + 'rem', height: size / 16 + 'rem' }"
  >
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.2" stroke-width="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </svg>
  </span>
</template>

<style>
.ui-spinner {
  display: inline-flex;
  flex: none;
  color: var(--accent);
  animation: ui-spin 0.8s linear infinite;
}
.ui-spinner svg {
  width: 100%;
  height: 100%;
}
@keyframes ui-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .ui-spinner { animation-duration: 2.4s; }
}
</style>
