<script>
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent } from 'reka-ui';

// Replaces <v-tooltip>. The default slot is the element that triggers it
// (it must be a single element); `text` or the `content` slot is the tip.
export default {
  name: 'UiTooltip',
  components: { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent },
  props: {
    text: { type: String, default: '' },
    side: { type: String, default: 'top' },
    delay: { type: Number, default: 300 },
    // For tests and the showcase
    open: { type: Boolean, default: undefined },
  },
};
</script>

<template>
  <tooltip-provider :delay-duration="delay">
    <tooltip-root :open="open">
      <tooltip-trigger as-child><slot /></tooltip-trigger>
      <tooltip-portal>
        <tooltip-content class="ui-tooltip" :side="side" :side-offset="6" data-testid="ui-tooltip">
          <slot name="content">{{ text }}</slot>
        </tooltip-content>
      </tooltip-portal>
    </tooltip-root>
  </tooltip-provider>
</template>

<style>
.ui-tooltip {
  z-index: 3000;
  max-width: 20rem;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  background: var(--dark);
  color: var(--on-dark);
  font: 500 var(--text-sm) / 1.35 var(--font-ui);
  box-shadow: var(--shadow-pop);
}
</style>
