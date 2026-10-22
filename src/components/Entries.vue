<script>
  import Decorator from '../services/decorator'
  import Entry from './EntriesEntry.vue'
  import DictionaryAboutDialog from './DictionaryAboutDialog.vue'

  const ENTRIES_BATCH_SIZE = 10;

  export default {
    props: {
      entries: Array,
      initialNumberOfEntries: Number,
      // One card per entry (phone board) instead of rows in the caller's card
      cards: Boolean
    },
    components: {
      Entry,
      DictionaryAboutDialog
    },
    data () {
      return {
        numberOfEntriesShown: this.initialNumberOfEntries || ENTRIES_BATCH_SIZE,
        aboutDictionary: '',
        aboutOpen: false
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
      },
      showAbout (dictionary) {
        this.aboutDictionary = dictionary;
        this.aboutOpen = true;
      }
    }
  }
</script>

<template>
  <div class="entries" :class="{ 'entries--cards': cards }" data-testid="entries">
    <entry
      v-for="(entry, index) in limitedAndDecoratedEntries"
      :key="index"
      :entry="entry"
      :isLastEntry="index == numberOfEntriesShown - 1"
      @intersect="incrementNumberOfEntries"
      @show-about="showAbout"
    />
    <DictionaryAboutDialog v-model="aboutOpen" :dictionary="aboutDictionary" />
  </div>
</template>

<style scoped>
.entries--cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.entries--cards :deep(.entry-row) {
  gap: 6px;
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}
.entries:not(.entries--cards) :deep(.entry-row:last-of-type) {
  border-bottom: 0;
}
</style>
