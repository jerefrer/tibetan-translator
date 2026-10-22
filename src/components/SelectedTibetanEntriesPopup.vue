<script>
  import _ from 'underscore'
  import TibetanRegExps from 'tibetan-regexps'

  import Entries from './Entries.vue'
  import { UiSpinner } from '../ui'
  import SqlDatabase from '../services/sql-database'
  import Storage from '../services/storage'
  import { entriesForEnabledDictionaries } from '../services/quick-lookup'
  import { withTrailingTshek, strippedTibetanText } from '../utils.js'

  export const SHOW_DELAY_MS = 1000;
  const WIDTH = 'min(90vw, 640px)';
  const HEIGHT = '45vh';

  // Text fields: selecting text in one is not a lookup
  const INPUT_SELECTOR = '.ui-field, input, textarea, [contenteditable="true"]';
  // Elements that show a whole term: selecting all of one is not a lookup
  const TERM_SELECTOR = '.term, .term-item, .result-term, .headword';

  var mouseX;
  var mouseY;
  var selectionStartPosition;
  var selectionEndPosition;

  function closestElement(node, selector) {
    const element = node && (node.nodeType === 1 ? node : node.parentElement);
    return element?.closest?.(selector) || null;
  }

  // Selecting Tibetan text in the main window shows, after a second without
  // change, a card beside the selection with the entries of what is selected.
  export default {
    components: {
      Entries,
      UiSpinner
    },
    data () {
      return {
        term: '',
        top: 0,
        left: 0,
        show: false,
        loading: false,
        entries: [],
      }
    },
    computed: {
      styles () {
        return {
          left: this.left,
          top: this.top,
          width: WIDTH,
          height: HEIGHT,
        }
      }
    },
    methods: {
      maybeShowPopup () {
        if (this.selectionHasMostlyTibetanAndIsNotInAnInputFieldAndIsNotWholeTerm()) {
          this.top = this.calculateTop();
          this.left = this.calculateLeft();
          this.show = true;
          this.loading = true;
          const request = (this._request = (this._request || 0) + 1);
          SqlDatabase.getEntriesFor(withTrailingTshek(this.term)).
          then((rows) => {
            // The dictionaries enabled in Settings, in the Settings order
            if (request === this._request)
              this.entries = entriesForEnabledDictionaries(rows, Storage.get('dictionaries'));
          }).
          catch(() => { if (request === this._request) this.entries = []; }).
          finally(() => { if (request === this._request) this.loading = false; })
        }
      },
      selectionHasMostlyTibetanAndIsNotInAnInputFieldAndIsNotWholeTerm () {
        var selection = document.getSelection();
        var selectionString = selection?.toString().trim();
        if (!selectionString)
          return false;

        // Don't open the popup if selecting text within an input
        if (closestElement(selection.anchorNode, INPUT_SELECTOR))
          return false;

        // Don't open the popup on the Segment page (it has its own term lookup)
        if (closestElement(selection.anchorNode, '.segment-page'))
          return false;

        // Don't open the popup if the selection has a lot of non-Tibetan text
        var numberOfNonTibetanCharacters =
          selectionString.match(TibetanRegExps.anythingNonTibetan)?.length || 0;
        if (numberOfNonTibetanCharacters > 15)
          return false;

        // Don't open the popup if selecting a whole entry term
        var termElement = closestElement(selection.anchorNode, TERM_SELECTOR);
        if (termElement && selectionString == termElement.textContent.trim())
          return false;

        // Remove any non-Tibetan characters, like in "= གོོ་ཏ་མ!", and any
        // punctuation exposed at the start, like in "་ཡི་སྒྲ་"
        this.term = strippedTibetanText(selectionString);
        return this.term.match(TibetanRegExps.tibetanGroups);
      },
      calculateLeft () {
        var activatorLeft = selectionStartPosition?.left || 0;
        if (activatorLeft < window.innerWidth / 2)
          return `${activatorLeft}px`;
        else
          return `calc(${activatorLeft}px - ${WIDTH})`;
      },
      calculateTop () {
        var margin = 10;
        var activatorHeight = 35;
        var activatorTop = selectionEndPosition?.top || 0;
        if (activatorTop < window.innerHeight / 2)
          return `${activatorTop + activatorHeight + margin}px`;
        else
          return `calc(${activatorTop}px - ${margin}px - ${HEIGHT})`;
      },
    },
    mounted () {
      this._debouncedShowPopup = _.debounce(this.maybeShowPopup, SHOW_DELAY_MS);
      document.onmousemove = (event) => {
        mouseX = event.x;
        mouseY = event.y;
      }
      document.onselectstart = () => {
        selectionStartPosition = {
          top: mouseY,
          left: mouseX,
        }
      }
      document.onselectionchange = () => {
        selectionEndPosition = {
          top: mouseY,
          left: mouseX,
        }
        this.show = false;
        this._debouncedShowPopup();
      }
      window.onscroll = () => this.show = false;
    },
    beforeUnmount () {
      this._debouncedShowPopup?.cancel();
      document.onmousemove = null;
      document.onselectstart = null;
      document.onselectionchange = null;
      window.onscroll = null;
    }
  }
</script>

<template>
  <transition name="ui-fade">
    <section
      v-if="show"
      class="selected-tibetan-entries-popup"
      :style="styles"
      aria-label="Entries for the selection"
      data-testid="selection-popup"
    >
      <transition name="ui-fade" mode="out-in">
        <div
          v-if="loading"
          key="loading"
          class="selection-popup-state"
          data-testid="selection-popup-loading"
        >
          <ui-spinner :size="40" label="Loading definitions" />
        </div>

        <Entries
          v-else-if="entries.length"
          key="entries"
          :entries="entries"
        />

        <div
          v-else
          key="empty"
          class="selection-popup-state"
          data-testid="selection-popup-empty"
        >
          No entries.
        </div>
      </transition>
    </section>
  </transition>
</template>

<style scoped>
/* Floating card in the style of the Define board's definitions card */
.selected-tibetan-entries-popup {
  position: fixed;
  z-index: 999;
  box-sizing: border-box;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-pop);
  font-family: var(--font-ui);
}

.selection-popup-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 6rem;
  color: var(--muted);
  font-size: var(--text-base);
}
</style>
