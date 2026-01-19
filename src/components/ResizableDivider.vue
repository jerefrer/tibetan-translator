<template>
  <div
    class="resizable-divider"
    :class="[direction, { dragging: isDragging }]"
    @mousedown="startDrag"
    @touchstart.prevent="startDrag"
  >
    <div class="divider-handle"></div>
  </div>
</template>

<script>
export default {
  name: 'ResizableDivider',

  props: {
    direction: {
      type: String,
      default: 'horizontal',
      validator: (v) => ['horizontal', 'vertical'].includes(v)
    }
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
    }
  },

  beforeUnmount() {
    this.stopDrag();
  }
};
</script>

<style lang="stylus" scoped>
.resizable-divider
  position relative
  flex-shrink 0
  z-index 10
  user-select none
  -webkit-user-select none

  &.horizontal
    width 100%
    height 8px
    cursor row-resize

    .divider-handle
      position absolute
      left 50%
      top 50%
      transform translate(-50%, -50%)
      width 40px
      height 4px
      background rgba(128, 128, 128, 0.3)
      border-radius 2px

  &.vertical
    width 8px
    height 100%
    cursor col-resize

    .divider-handle
      position absolute
      left 50%
      top 50%
      transform translate(-50%, -50%)
      width 4px
      height 40px
      background rgba(128, 128, 128, 0.3)
      border-radius 2px

  &:hover, &.dragging
    .divider-handle
      background #1976d2
      opacity 0.6

  &.dragging
    .divider-handle
      background #1976d2
      opacity 0.8
</style>
