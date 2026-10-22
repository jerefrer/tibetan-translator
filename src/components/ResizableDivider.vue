<template>
  <div
    class="resizable-divider"
    :class="[direction, { dragging: isDragging }]"
    role="separator"
    tabindex="0"
    :aria-orientation="direction"
    :aria-label="label"
    data-testid="resizable-divider"
    @mousedown="startDrag"
    @touchstart.prevent="startDrag"
    @keydown="onKeydown"
  >
    <div class="divider-handle"></div>
  </div>
</template>

<script>
// Arrow keys move the divider by this many pixels
const KEYBOARD_STEP = 16;

export default {
  name: 'ResizableDivider',

  props: {
    // "horizontal": a bar between panes stacked vertically (drag up/down);
    // "vertical": a bar between panes side by side (drag left/right)
    direction: {
      type: String,
      default: 'horizontal',
      validator: (v) => ['horizontal', 'vertical'].includes(v)
    },
    label: { type: String, default: 'Resize' }
  },

  emits: ['resize'],

  data() {
    return {
      isDragging: false,
      startPos: 0
    };
  },

  methods: {
    startDrag(e) {
      this.isDragging = true;
      const pos = e.touches ? e.touches[0] : e;
      this.startPos = this.direction === 'horizontal' ? pos.clientY : pos.clientX;

      document.addEventListener('mousemove', this.onDrag);
      document.addEventListener('mouseup', this.stopDrag);
      document.addEventListener('touchmove', this.onDrag);
      document.addEventListener('touchend', this.stopDrag);
      document.body.style.cursor = this.direction === 'horizontal' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
    },

    onDrag(e) {
      if (!this.isDragging) return;

      const pos = e.touches ? e.touches[0] : e;
      const currentPos = this.direction === 'horizontal' ? pos.clientY : pos.clientX;
      const delta = currentPos - this.startPos;

      if (delta !== 0) {
        this.$emit('resize', delta);
        this.startPos = currentPos;
      }
    },

    stopDrag() {
      this.isDragging = false;
      document.removeEventListener('mousemove', this.onDrag);
      document.removeEventListener('mouseup', this.stopDrag);
      document.removeEventListener('touchmove', this.onDrag);
      document.removeEventListener('touchend', this.stopDrag);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    },

    onKeydown(e) {
      const keys = this.direction === 'horizontal'
        ? { ArrowUp: -1, ArrowDown: 1 }
        : { ArrowLeft: -1, ArrowRight: 1 };
      const sign = keys[e.key];
      if (!sign) return;
      // The page listens to Up/Down on window to move through its terms
      e.preventDefault();
      e.stopPropagation();
      this.$emit('resize', sign * KEYBOARD_STEP);
    }
  },

  beforeUnmount() {
    this.stopDrag();
  }
};
</script>

<style lang="stylus" scoped>
// Boards "B · Split": a 14px gutter with a 44×4 grip in --line-strong
.resizable-divider
  position relative
  flex-shrink 0
  z-index 10
  display flex
  align-items center
  justify-content center
  user-select none
  -webkit-user-select none
  outline none

  &.horizontal
    width 100%
    height 14px
    cursor row-resize

    .divider-handle
      width 44px
      height 4px

  &.vertical
    width 14px
    height 100%
    cursor col-resize

    .divider-handle
      width 4px
      height 44px

  .divider-handle
    border-radius 4px
    background var(--line-strong)
    transition background 0.12s

  &:hover, &.dragging, &:focus-visible
    .divider-handle
      background var(--accent)

  &:focus-visible .divider-handle
    box-shadow 0 0 0 4px var(--ring)
</style>
