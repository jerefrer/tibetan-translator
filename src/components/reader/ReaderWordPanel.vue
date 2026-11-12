<script>
import { UiIcon } from '../../ui';
import TermEntry from '../entry/TermEntry.vue';

// How far the sheet must be dragged down to close, in px
const SWIPE_CLOSE_DISTANCE = 80;

// The selected word's (or expression's) entry, condensed (TermEntry compact).
// Desktop: a panel on the right, --reader-panel-width wide (board
// DesktopReader). Phone: a bottom sheet over the text, 60% of what the
// keyboard leaves visible (--visible-height), with a grab handle; it closes
// when swiped down, when the dimmed text is tapped, or with Escape (handled by
// the page, which owns the window's keyboard listener) (board MobileReader).
//
// Emits `close` (phone) and `open-entry(term)` (Open entry →).
export default {
  name: 'ReaderWordPanel',
  components: { TermEntry, UiIcon },
  props: {
    term: { type: String, default: '' },
    isMobile: { type: Boolean, default: false },
    // Phone: whether the sheet is shown
    open: { type: Boolean, default: false },
  },
  emits: ['close', 'open-entry'],
  data() {
    return {
      dragStartY: null,
      dragOffset: 0,
    };
  },
  computed: {
    sheetShown() {
      return this.isMobile && this.open && !!this.term;
    },
    sheetStyle() {
      if (!this.dragOffset) return {};
      return { transform: `translateY(${this.dragOffset}px)`, transition: 'none' };
    },
  },
  watch: {
    sheetShown(shown) {
      if (!shown) this.resetDrag();
    },
  },
  methods: {
    // Drags start on the handle strip. Pointer and touch events both arrive on
    // a touch screen: whichever comes first leads, the other is ignored.
    startDrag(y) {
      if (this.dragStartY !== null || typeof y !== 'number') return;
      this.dragStartY = y;
      this.dragOffset = 0;
    },
    moveDrag(y) {
      if (this.dragStartY === null || typeof y !== 'number') return;
      this.dragOffset = Math.max(0, y - this.dragStartY);
    },
    endDrag(y) {
      if (this.dragStartY === null) return;
      if (typeof y === 'number') this.moveDrag(y);
      const close = this.dragOffset >= SWIPE_CLOSE_DISTANCE;
      this.resetDrag();
      if (close) this.$emit('close');
    },
    resetDrag() {
      this.dragStartY = null;
      this.dragOffset = 0;
    },
    onPointerDown(event) {
      this.startDrag(event.clientY);
      event.target?.setPointerCapture?.(event.pointerId);
    },
    onPointerMove(event) {
      this.moveDrag(event.clientY);
    },
    onPointerUp(event) {
      this.endDrag(event.clientY);
    },
    touchY(event, list = 'touches') {
      return event[list]?.[0]?.clientY;
    },
    onTouchStart(event) {
      this.startDrag(this.touchY(event));
    },
    onTouchMove(event) {
      this.moveDrag(this.touchY(event));
    },
    onTouchEnd(event) {
      this.endDrag(this.touchY(event, 'changedTouches'));
    },
    openEntry(term) {
      this.$emit('open-entry', term);
    },
  },
};
</script>

<template>
  <aside
    v-if="!isMobile"
    class="reader-panel"
    aria-label="Word"
    data-testid="reader-panel"
  >
    <term-entry v-if="term" :term="term" compact @open-entry="openEntry" />
    <p v-else class="reader-panel__empty">Select a word to see its entry.</p>
  </aside>

  <template v-else>
    <transition name="reader-scrim">
      <div
        v-if="sheetShown"
        class="reader-scrim"
        data-testid="reader-scrim"
        @click="$emit('close')"
      />
    </transition>
    <transition name="reader-sheet">
      <section
        v-if="sheetShown"
        class="reader-sheet"
        :style="sheetStyle"
        :aria-label="term"
        data-testid="reader-sheet"
      >
        <div
          class="reader-sheet__grip"
          aria-hidden="true"
          data-testid="reader-sheet-handle"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="resetDrag"
          @touchstart.passive="onTouchStart"
          @touchmove.passive="onTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="resetDrag"
        >
          <span class="reader-sheet__handle" />
        </div>
        <div class="reader-sheet__body">
          <term-entry :term="term" compact @open-entry="openEntry">
            <template #leading>
              <button
                type="button"
                class="reader-sheet__close"
                aria-label="Close"
                data-testid="reader-sheet-close"
                @click="$emit('close')"
              >
                <ui-icon name="chevron-down" :size="22" :stroke-width="2.4" />
              </button>
            </template>
          </term-entry>
        </div>
      </section>
    </transition>
  </template>
</template>

<style scoped>
/* Desktop: the panel on the right (board DesktopReader) */
.reader-panel {
  flex: none;
  box-sizing: border-box;
  width: var(--reader-panel-width);
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  /* The top as the Reader's header, so the entry's buttons line up with
     Edit and Show Wylie */
  padding: var(--space-4) var(--space-7) var(--space-7);
  border-left: 1px solid var(--line);
  background: var(--bg);
}
.reader-panel__empty {
  margin: 0;
  font-size: var(--text-base);
  color: var(--muted);
}

/* Phone: the sheet over the dimmed text (board MobileReader) */
.reader-scrim {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: var(--scrim);
}
.reader-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 11;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: calc(var(--visible-height, 100dvh) * 0.6);
  max-height: 100%;
  border-radius: 20px 20px 0 0;
  background: var(--surface);
  box-shadow: var(--shadow-pop);
  transition: transform 0.2s ease;
}
.reader-sheet__grip {
  flex: none;
  display: flex;
  justify-content: center;
  padding: 10px 0 var(--space-2);
  touch-action: none;
  cursor: grab;
}
.reader-sheet__handle {
  width: 36px;
  height: 5px;
  border-radius: 3px;
  background: var(--line-strong);
}
.reader-sheet__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 0 var(--space-5) var(--space-6);
}
.reader-sheet__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  margin-left: -10px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  cursor: pointer;
}
.reader-sheet__close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.reader-sheet-enter-active,
.reader-sheet-leave-active {
  transition: transform 0.22s ease;
}
.reader-sheet-enter-from,
.reader-sheet-leave-to {
  transform: translateY(100%);
}
.reader-scrim-enter-active,
.reader-scrim-leave-active {
  transition: opacity 0.22s ease;
}
.reader-scrim-enter-from,
.reader-scrim-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .reader-sheet,
  .reader-sheet-enter-active,
  .reader-sheet-leave-active,
  .reader-scrim-enter-active,
  .reader-scrim-leave-active {
    transition: none;
  }
}
</style>
