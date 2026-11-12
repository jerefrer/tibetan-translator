<script>
// Keyboard step, in px
const STEP = 16;

// The divider between two panes. Dragging it, or the arrow keys once it has
// focus, changes the width of one pane: the one before it (`pane: 'before'`,
// a column on the left) or after it (`'after'`, a panel on the right).
// v-model is that width in px, or null while the caller's CSS decides it (the
// pane is then measured when a move starts). The width stays between `min`
// and `max`, and leaves at least `reserve` px to the rest of the parent. A
// double-click emits `reset` for the caller to go back to its default width.
//
// It takes no room: it sits over the border between the panes, with a hit
// area a few px either side, and shows an accent line on hover or drag.
export default {
  name: 'UiResizeHandle',
  props: {
    modelValue: { type: Number, default: null },
    min: { type: Number, default: 0 },
    max: { type: Number, default: Infinity },
    reserve: { type: Number, default: 0 },
    pane: { type: String, default: 'before' },
    label: { type: String, default: 'Resize' },
  },
  emits: ['update:modelValue', 'reset'],
  data() {
    return { dragStart: null };
  },
  computed: {
    // Moving right widens the pane before, narrows the pane after
    direction() {
      return this.pane === 'after' ? -1 : 1;
    },
  },
  methods: {
    paneElement() {
      return this.pane === 'after' ? this.$el.nextElementSibling : this.$el.previousElementSibling;
    },
    // The width the pane has now
    current() {
      return this.modelValue ?? this.paneElement()?.offsetWidth ?? this.min;
    },
    upperBound() {
      const room = this.$el.parentElement?.clientWidth;
      return this.reserve && room ? Math.min(this.max, room - this.reserve) : this.max;
    },
    clamp(width) {
      return Math.round(Math.max(this.min, Math.min(this.upperBound(), width)));
    },
    set(width) {
      const clamped = this.clamp(width);
      if (clamped !== this.modelValue) this.$emit('update:modelValue', clamped);
    },
    onPointerDown(event) {
      if (event.button > 0) return;
      this.dragStart = { x: event.clientX, width: this.current() };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (error) {
        // Capture is a comfort (the drag keeps going outside the handle)
      }
      event.preventDefault();
    },
    onPointerMove(event) {
      if (!this.dragStart) return;
      this.set(this.dragStart.width + (event.clientX - this.dragStart.x) * this.direction);
    },
    onPointerUp() {
      this.dragStart = null;
    },
    onKeydown(event) {
      const width = this.current();
      const moves = {
        ArrowLeft: width - STEP * this.direction,
        ArrowRight: width + STEP * this.direction,
        Home: this.min,
        End: this.upperBound(),
      };
      if (!(event.key in moves)) return;
      event.preventDefault();
      this.set(moves[event.key]);
    },
  },
};
</script>

<template>
  <div
    class="ui-resize-handle"
    :class="{ 'is-dragging': dragStart }"
    role="separator"
    aria-orientation="vertical"
    :aria-valuenow="modelValue ?? undefined"
    :aria-valuemin="min"
    :aria-valuemax="max === Infinity ? undefined : max"
    :aria-label="label"
    :title="label"
    tabindex="0"
    data-testid="ui-resize-handle"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @lostpointercapture="onPointerUp"
    @keydown="onKeydown"
    @dblclick="$emit('reset')"
  />
</template>

<style>
.ui-resize-handle {
  position: relative;
  z-index: 2;
  flex: none;
  width: 0;
  align-self: stretch;
  outline: none;
  touch-action: none;
  cursor: col-resize;
}
/* The hit area, 5px either side of the border */
.ui-resize-handle::before {
  content: '';
  position: absolute;
  inset: 0 -5px;
}
/* The line shown on hover, drag or focus, over the panes' border */
.ui-resize-handle::after {
  content: '';
  position: absolute;
  inset: 0 -1px;
  background: var(--accent);
  opacity: 0;
  transition: opacity 0.15s ease;
}
.ui-resize-handle:hover::after,
.ui-resize-handle:focus-visible::after,
.ui-resize-handle.is-dragging::after {
  opacity: 1;
}
/* Text is not selected while dragging */
.ui-resize-handle.is-dragging {
  user-select: none;
}
@media (prefers-reduced-motion: reduce) {
  .ui-resize-handle::after {
    transition: none;
  }
}
</style>
