<script>
import { wylieFor } from '../../services/transcription';

// The split text, a button per word, in reading order and wrapping like
// prose (boards DesktopReader and MobileReader).
//
// `words` are the words in order (duplicates kept), `merges` the longer
// expressions found across neighbouring words, laid out in lanes
// ([{ start, count, term, lane }], segmenter's mergeLanes), `selected` the
// selected word (its index) or expression ({ start, count }), `unknownWords`
// the words looked up and found in no dictionary (drawn in --faint).
//
// Each expression is a bar under its words, one lane per row of bars so that
// overlapping ones do not draw over each other. The bar is drawn as a piece
// under each of its words; the piece under the first word is the expression's
// button, the others answer a click the same way. Hovering a bar tints the
// words it covers, so the reader sees what a click will look up.
//
// Emits `select(selection)`: an index, or { start, count } for an expression.
export default {
  name: 'ReaderText',
  props: {
    words: { type: Array, default: () => [] },
    merges: { type: Array, default: () => [] },
    selected: { type: [Number, Object], default: null },
    unknownWords: { type: Array, default: () => [] },
    showWylie: { type: Boolean, default: false },
    isMobile: { type: Boolean, default: false },
  },
  emits: ['select'],
  data() {
    // The expression whose bar the pointer is on
    return { hovered: null };
  },
  computed: {
    lanes() {
      return this.merges.reduce((lanes, merge) => Math.max(lanes, merge.lane + 1), 0);
    },
    unknown() {
      return new Set(this.unknownWords);
    },
    wylie() {
      if (!this.showWylie) return [];
      return this.words.map((word) => {
        try {
          return wylieFor(word);
        } catch (error) {
          return '';
        }
      });
    },
    // The merges under each word: [[{ merge, isStart, isEnd }]]
    piecesByWord() {
      const pieces = this.words.map(() => []);
      for (const merge of this.merges) {
        for (let index = merge.start; index < merge.start + merge.count && index < pieces.length; index++) {
          pieces[index].push({
            merge,
            isStart: index === merge.start,
            isEnd: index === merge.start + merge.count - 1,
          });
        }
      }
      return pieces;
    },
    selectedRange() {
      if (this.selected && typeof this.selected === 'object') return this.selected;
      return null;
    },
  },
  watch: {
    selected() {
      this.$nextTick(() => this.scrollSelectionIntoView());
    },
  },
  methods: {
    isSelected(index) {
      return this.selected === index;
    },
    isPreviewed(index) {
      const merge = this.hovered;
      return !!merge && index >= merge.start && index < merge.start + merge.count;
    },
    isHovered(merge) {
      return !!this.hovered && this.mergeKey(this.hovered) === this.mergeKey(merge);
    },
    isInSelection(index) {
      const range = this.selectedRange;
      return !!range && index >= range.start && index < range.start + range.count;
    },
    mergeKey(merge) {
      return merge.start + '-' + merge.count;
    },
    isActiveMerge(merge) {
      const range = this.selectedRange;
      return !!range && range.start === merge.start && range.count === merge.count;
    },
    selectWord(index) {
      this.$emit('select', index);
    },
    selectMerge(merge) {
      this.$emit('select', { start: merge.start, count: merge.count });
    },
    scrollSelectionIntoView() {
      const element = this.$el?.querySelector?.('.reader-word.is-selected, .reader-word.is-in-selection');
      element?.scrollIntoView?.({ block: 'nearest' });
    },
  },
};
</script>

<template>
  <div
    class="reader-text"
    :class="{ 'is-phone': isMobile, 'has-wylie': showWylie }"
    :style="{ '--lanes': lanes }"
    lang="bo"
    data-testid="reader-text"
  >
    <span
      v-for="(word, index) in words"
      :key="index"
      class="reader-text__item"
    >
      <button
        type="button"
        class="reader-word"
        :class="{
          'is-selected': isSelected(index),
          'is-in-selection': isInSelection(index),
          'is-unknown': unknown.has(word),
          'is-previewed': isPreviewed(index),
        }"
        :aria-pressed="isSelected(index) ? 'true' : 'false'"
        :title="unknown.has(word) ? 'No entry in your dictionaries' : undefined"
        data-testid="reader-word"
        @click="selectWord(index)"
      >
        <span class="reader-word__text">{{ word }}</span>
        <span v-if="showWylie" class="reader-word__wylie" lang="en">{{ wylie[index] }}</span>
      </button>
      <template v-for="piece in piecesByWord[index]" :key="piece.merge.start + '-' + piece.merge.count">
        <button
          v-if="piece.isStart"
          type="button"
          class="reader-merge"
          :class="{ 'is-start': true, 'is-end': piece.isEnd, 'is-active': isActiveMerge(piece.merge), 'is-hover': isHovered(piece.merge) }"
          :style="{ '--lane': piece.merge.lane }"
          :aria-label="'Look up ' + piece.merge.term"
          :title="piece.merge.term"
          data-testid="reader-merge"
          @click="selectMerge(piece.merge)"
          @mouseenter="hovered = piece.merge"
          @mouseleave="hovered = null"
        />
        <span
          v-else
          class="reader-merge"
          :class="{ 'is-end': piece.isEnd, 'is-active': isActiveMerge(piece.merge), 'is-hover': isHovered(piece.merge) }"
          :style="{ '--lane': piece.merge.lane }"
          :title="piece.merge.term"
          aria-hidden="true"
          @click="selectMerge(piece.merge)"
          @mouseenter="hovered = piece.merge"
          @mouseleave="hovered = null"
        />
      </template>
    </span>
  </div>
</template>

<style scoped>
/* The words flow as prose. Under them, one lane per row of brackets. */
.reader-text {
  --word-gap: 2px;
  /* A lane of 14px holding a 4px bar, hit areas of 18px */
  --lane-height: 14px;
  --bar: 4px;
  --hit-extend: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px var(--word-gap);
  font-family: var(--font-tibetan);
  font-size: var(--text-reader-word);
  line-height: 1.7;
  color: var(--ink);
}
.reader-text.is-phone {
  /* Tall enough to tap: 22px lanes holding a 5px bar, hit areas of 30px */
  --lane-height: 22px;
  --bar: 5px;
  --hit-extend: 4px;
  gap: var(--space-1) var(--word-gap);
  font-size: var(--text-tibetan-lg);
}

.reader-text__item {
  position: relative;
  display: inline-flex;
  padding-bottom: calc(var(--lanes, 0) * var(--lane-height));
}

.reader-word {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  margin: 0;
  padding: 0 3px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: inherit;
  cursor: pointer;
}
.reader-text.is-phone .reader-word {
  padding: 0 2px;
}
.reader-word:hover {
  background: var(--soft);
}
.reader-word:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.reader-word.is-unknown {
  color: var(--faint);
}
.reader-word.is-previewed {
  background: var(--accent-soft);
}
.reader-word.is-selected,
.reader-word.is-in-selection {
  background: var(--accent-soft);
  color: var(--accent);
}
.reader-word.is-selected {
  box-shadow: inset 0 -2px 0 var(--accent);
}

.reader-word__wylie {
  margin-top: -0.35em;
  padding-bottom: 2px;
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  line-height: 1.3;
  color: var(--muted);
  white-space: nowrap;
}
.reader-word.is-selected .reader-word__wylie,
.reader-word.is-in-selection .reader-word__wylie {
  color: var(--accent);
}

/* A piece of an expression's bar: a rounded line under the word, running on
   into the gap after it so that the pieces join, inset at the first and the
   last word so that neighbouring expressions stay apart. The piece is a whole
   lane tall and clickable; the bar is drawn in its middle (::after) and the
   hit area reaches past it (::before). */
.reader-merge {
  --bracket: color-mix(in srgb, var(--accent) 35%, var(--surface));
  position: absolute;
  left: 0;
  right: calc(-1 * var(--word-gap));
  top: calc(100% - var(--lanes) * var(--lane-height) + var(--lane) * var(--lane-height));
  box-sizing: border-box;
  height: var(--lane-height);
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  cursor: pointer;
}
.reader-merge::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: calc((var(--lane-height) - var(--bar)) / 2);
  height: var(--bar);
  background: var(--bracket);
  transition: background-color 0.12s ease;
}
.reader-merge.is-start {
  left: 4px;
}
.reader-merge.is-end {
  right: 4px;
}
.reader-merge.is-start::after {
  border-top-left-radius: var(--bar);
  border-bottom-left-radius: var(--bar);
}
.reader-merge.is-end::after {
  border-top-right-radius: var(--bar);
  border-bottom-right-radius: var(--bar);
}
/* The invisible hit area, a little beyond the lane */
.reader-merge::before {
  content: '';
  position: absolute;
  inset: calc(-1 * var(--hit-extend)) 0;
}
.reader-merge.is-hover,
.reader-merge.is-active {
  --bracket: var(--accent);
}
.reader-merge:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>
