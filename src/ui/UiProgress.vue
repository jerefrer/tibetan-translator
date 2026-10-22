<script>
import { ProgressRoot, ProgressIndicator } from 'reka-ui';

// Replaces <v-progress-linear>. No `value` means indeterminate.
export default {
  name: 'UiProgress',
  components: { ProgressRoot, ProgressIndicator },
  props: {
    value: { type: Number, default: null },
    label: { type: String, default: 'Progress' },
  },
};
</script>

<template>
  <progress-root
    class="ui-progress"
    :model-value="value"
    :aria-label="label"
    data-testid="ui-progress"
  >
    <progress-indicator
      class="ui-progress__bar"
      :class="{ 'is-indeterminate': value === null }"
      :style="value === null ? undefined : { width: value + '%' }"
    />
  </progress-root>
</template>

<style>
.ui-progress {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--soft);
}
.ui-progress__bar {
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--accent);
  transition: width 0.2s;
}
.ui-progress__bar.is-indeterminate {
  width: 35%;
  animation: ui-progress-slide 1.2s ease-in-out infinite;
}
@keyframes ui-progress-slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(300%); }
}
</style>
