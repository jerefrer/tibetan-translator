<script>
  import DictionariesDetailsMixin from './DictionariesDetailsMixin'

  export default {
    mixins: [DictionariesDetailsMixin],
    inject: ['snackbar'],
    props: {
      entry: Object,
      isLastEntry: Boolean
    },
    methods: {
      intersect(entries, observer) {
        if (this.isLastEntry)
          this.$emit('intersect');
      },
      showDictionaryAbout() {
        this.snackbar.open(this.dictionaryAboutFor(this.entry.dictionary));
      }
    }
  }
</script>

<template>
  <fieldset
    class="entry"
    v-intersect.quiet="intersect"
  >

    <legend
      v-html="dictionaryLabelFor(entry.dictionary)"
      @click="showDictionaryAbout"
    />

    <div
      class="definition"
      v-html="entry.definition"
    />

  </fieldset>
</template>
