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
// Each expression is a thin bracket under its words, one lane per row of
// brackets so that overlapping ones do not draw over each other. The bracket
// is drawn as a piece under each of its words; the piece under the first word
// is the expression's button, the others answer a click the same way.
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
          :class="{ 'is-start': true, 'is-end': piece.isEnd, 'is-active': isActiveMerge(piece.merge), 'is-hover': hovered === mergeKey(piece.merge) }"
          :style="{ '--lane': piece.merge.lane }"
          :aria-label="'Look up ' + piece.merge.term"
          :title="piece.merge.term"
          data-testid="reader-merge"
          @click="selectMerge(piece.merge)"
          @mouseenter="hovered = mergeKey(piece.merge)"
          @mouseleave="hovered = null"
        />
        <span
          v-else
          class="reader-merge"
          :class="{ 'is-end': piece.isEnd, 'is-active': isActiveMerge(piece.merge), 'is-hover': hovered === mergeKey(piece.merge) }"
          :style="{ '--lane': piece.merge.lane }"
          :title="piece.merge.term"
          aria-hidden="true"
          @click="selectMerge(piece.merge)"
          @mouseenter="hovered = mergeKey(piece.merge)"
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
  --lane-height: 7px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px var(--word-gap);
  font-family: var(--font-tibetan);
  font-size: var(--text-reader-word);
  line-height: 1.7;
  color: var(--ink);
}
.reader-text.is-phone {
  --lane-height: 9px;
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

/* A piece of an expression's bracket: a line under the word, with an end
   turned up at the first and the last word; it runs on into the gap after
   the word so that the pieces join */
.reader-merge {
  position: absolute;
  left: 0;
  right: calc(-1 * var(--word-gap));
  top: calc(100% - var(--lanes) * var(--lane-height) + var(--lane) * var(--lane-height));
  box-sizing: border-box;
  height: calc(var(--lane-height) - 2px);
  margin: 0;
  padding: 0;
  border: 0 solid var(--accent-line);
  border-bottom-width: 2px;
  border-radius: 0;
  background: none;
  cursor: pointer;
}
.reader-merge.is-start {
  left: 4px;
  border-left-width: 2px;
  border-bottom-left-radius: 4px;
}
.reader-merge.is-end {
  right: 4px;
  border-right-width: 2px;
  border-bottom-right-radius: 4px;
}
/* A taller invisible hit area, within the lane's own row */
.reader-merge::before {
  content: '';
  position: absolute;
  inset: -2px 0 -1px;
}
.reader-merge.is-hover {
  border-color: var(--accent);
}
.reader-merge.is-active {
  border-color: var(--accent);
}
.reader-merge:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>
