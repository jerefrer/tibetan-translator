<script>
  import Decorator from '../services/decorator'
  import Entry from './EntriesEntry.vue'

  const ENTRIES_BATCH_SIZE = 10;

  export default {
    props: {
      entries: Array,
      initialNumberOfEntries: Number
    },
    components: {
      Entry
    },
    data () {
      return {
        numberOfEntriesShown: this.initialNumberOfEntries || ENTRIES_BATCH_SIZE
      }
    },
    computed: {
      limitedEntries () {
        return this.entries.slice(0, this.numberOfEntriesShown);
      },
      limitedAndDecoratedEntries () {
        return this.limitedEntries.map((entry) => {
          return { ...entry, definition: Decorator.decorate(entry) };
        })
      }
    },
    methods: {
      incrementNumberOfEntries () {
        this.numberOfEntriesShown += ENTRIES_BATCH_SIZE;
      }
    }
  }
</script>

<template>
  <div>
    <entry
      v-for="(entry, index) in limitedAndDecoratedEntries"
      :key="index"
      :entry="entry"
      :isLastEntry="index == numberOfEntriesShown - 1"
      @intersect="incrementNumberOfEntries"
    />
  </div>
</template>
