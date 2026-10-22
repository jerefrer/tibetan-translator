<script>
import { Separator } from 'reka-ui';

// Replaces <v-divider>.
export default {
  name: 'UiDivider',
  components: { Separator },
  props: {
    vertical: { type: Boolean, default: false },
  },
};
</script>

<template>
  <separator
    class="ui-divider"
    :orientation="vertical ? 'vertical' : 'horizontal'"
    decorative
    data-testid="ui-divider"
  />
</template>

<style>
.ui-divider { flex: none; background: var(--line); }
.ui-divider[data-orientation='horizontal'] { height: 1px; width: 100%; margin: var(--space-3) 0; }
.ui-divider[data-orientation='vertical'] { width: 1px; align-self: stretch; margin: 0 var(--space-3); }
</style>
