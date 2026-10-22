<script>
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'reka-ui';

// Replaces <v-slider>. v-model is a single number.
export default {
  name: 'UiSlider',
  components: { SliderRoot, SliderTrack, SliderRange, SliderThumb },
  props: {
    modelValue: { type: Number, default: 0 },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    step: { type: Number, default: 1 },
    label: { type: String, default: 'Value' },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  computed: {
    values() {
      return [this.modelValue];
    },
  },
};
</script>

<template>
  <slider-root
    class="ui-slider"
    :model-value="values"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    data-testid="ui-slider"
    @update:model-value="$emit('update:modelValue', $event[0])"
  >
    <slider-track class="ui-slider__track">
      <slider-range class="ui-slider__range" />
    </slider-track>
    <slider-thumb class="ui-slider__thumb" :aria-label="label" data-testid="ui-slider-thumb" />
  </slider-root>
</template>

<style>
.ui-slider {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 1.5rem;
  touch-action: none;
  user-select: none;
}
.ui-slider__track {
  position: relative;
  flex: 1;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--soft);
  border: 1px solid var(--line);
  box-sizing: border-box;
}
.ui-slider__range {
  position: absolute;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--accent);
}
.ui-slider__thumb {
  display: block;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--accent);
  box-shadow: var(--shadow-card);
  cursor: grab;
}
.ui-slider__thumb:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.ui-slider[data-disabled] { opacity: 0.5; }
</style>
