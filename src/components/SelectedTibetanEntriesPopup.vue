<script>
  import $ from 'jquery'
  import _ from 'underscore'
  import TibetanRegExps from 'tibetan-regexps'

  import Entries from './Entries'
  import SqlDatabase from '../services/sql-database'
  import { withTrailingTshek } from '../utils'

  var mouseX;
  var mouseY;
  var selectionStartPosition;
  var selectionEndPosition;

  export default {
    components: {
      Entries
    },
    data () {
      return {
        term: '',
        top: 0,
        left: 0,
        show: false,
        loading: false,
        activator: undefined,
        entries: [],
      }
    },
    computed: {
      styles () {
        return {
          position: 'fixed',
          left: this.left,
          top: this.top,
          width: 'min(90vw, 640px)',
          height: '45vh',
          overflowY: 'auto',
          zIndex: 999,
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
          SqlDatabase.getEntriesFor(withTrailingTshek(this.term)).
          then((rows) => this.entries = rows).
          finally(() => this.loading = false)
        }
      },
      selectionHasMostlyTibetanAndIsNotInAnInputFieldAndIsNotWholeTerm () {
        var selection = document.getSelection();
        var selectionString = selection.toString().trim();
        if (!selectionString)
          return false;

        // Don't open the popup if selecting text within an input
        var selectingInsideAnInputField = !!$(selection.anchorNode).parents('.v-input').length;
        if (selectingInsideAnInputField)
          return false;

        // Don't open the popup if the selection has a lot of non-Tibetan text
        var numberOfNonTibetanCharacters =
          selectionString.match(TibetanRegExps.anythingNonTibetan)?.length || 0;
        if (numberOfNonTibetanCharacters > 15)
          return false;

        // Don't open the popup if selecting a whole entry term
        var entryTerm = $(document.getSelection().anchorNode).parents('.term').text();
        if (selectionString == entryTerm)
          return false;

        this.term = selectionString.
          replace(TibetanRegExps.anythingNonTibetan, '').  // Remove any non tibetan character, like in "= གོོ་ཏ་མ!"
          replace(TibetanRegExps.beginningPunctuation, ''); // Remove any punctuation before, like in "་ཡི་སྒྲ་"
        return this.term.match(TibetanRegExps.tibetanGroups);
      },
      calculateLeft () {
        var activatorLeft = selectionStartPosition.left;
        if (activatorLeft < $(window).width() / 2)
          return `${activatorLeft}px`;
        else
          return `calc(${activatorLeft}px - ${this.styles.width})`;
      },
      calculateTop () {
        var margin = 10;
        var activatorHeight = 35;
        var activatorTop = selectionEndPosition.top;
        if (activatorTop < $(window).height() / 2)
          return `${activatorTop + activatorHeight + margin}px`;
        else
          return `calc(${activatorTop}px - ${margin}px - ${this.styles.height})`;
      },
    },
    mounted () {
      var debouncedShowPopup = _.debounce(this.maybeShowPopup, 1000);
      document.onmousemove = (event) => {
        mouseX = event.x;
        mouseY = event.y;
      }
      document.onselectstart = (event) => {
        selectionStartPosition = {
          top: mouseY,
          left: mouseX,
        }
      }
      document.onselectionchange = (event) => {
        selectionEndPosition = {
          top: mouseY,
          left: mouseX,
        }
        this.show = false;
        debouncedShowPopup();
      }
      window.onscroll = () => this.show = false;
    }
  }
</script>

<template>
  <v-fade-transition>

    <v-card
      v-if="show"
      class="selected-tibetan-entries-popup"
      :style="styles"
      :color="$vuetify.theme.dark ? '' : 'grey lighten-4'"
    >

      <v-fade-transition mode="out-in">

        <div
          v-if="loading"
          class="flex-centered"
        >
          <v-progress-circular
            indeterminate
            size="64"
            style="filter: brightness(0.25)"
          />
        </div>

        <Entries
          v-else-if="entries.length"
          :entries="entries"
        />

        <div
          v-else
          class="flex-centered"
        >
          No entries.
        </div>

      </v-fade-transition>

    </v-card>

  </v-fade-transition>
</template>

<style lang="stylus">
  .theme--dark
    .selected-tibetan-entries-popup
      fieldset.entry
        border-color #5c5c5c
        legend
          color #5c5c5c
</style>