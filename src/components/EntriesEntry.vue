<script>
  import DictionariesDetailsMixin from './DictionariesDetailsMixin'

  export default {
    mixins: [DictionariesDetailsMixin],
    props: {
      entry: Object,
      isLastEntry: Boolean
    },
    methods: {
      intersect(entries, observer) {
        if (this.isLastEntry)
          this.$emit('intersect');
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
      @click="$root.openSnackbarWith(dictionaryAboutFor(entry.dictionary))"
    />

    <div
      class="definition"
      v-html="entry.definition"
    />

  </fieldset>
</template>
