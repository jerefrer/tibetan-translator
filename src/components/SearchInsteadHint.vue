<script>
import { UiButton } from '../ui';

// Define reads what is typed as Tibetan. When the text carried Latin
// diacritics (Sanskrit, transliterated English), this offers Search with it.
export default {
  name: 'SearchInsteadHint',
  components: { UiButton },
  props: {
    // What the user typed, kept as typed (the Define field converts it to Tibetan)
    text: { type: String, required: true },
  },
  methods: {
    searchInstead() {
      this.$router.push('/search/' + encodeURIComponent(this.text));
    },
  },
};
</script>

<template>
  <section class="search-instead-hint" data-testid="search-instead-hint">
    <span class="hint-heading">Looking for a Sanskrit or English word?</span>
    <span class="hint-body">Define reads what you type as Tibetan.</span>
    <div>
      <ui-button variant="outline" size="sm" class="hint-button" data-testid="search-instead" @click="searchInstead">
        Search “{{ text }}”
      </ui-button>
    </div>
  </section>
</template>

<style lang="stylus" scoped>
.search-instead-hint
  flex-shrink 0
  display flex
  flex-direction column
  gap 8px
  padding 14px 18px
  background var(--surface)
  border 1px solid var(--line)
  border-radius var(--radius-card)
  box-shadow var(--shadow-card)
  color var(--ink)
  font-family var(--font-ui)

.hint-heading
  font-size var(--text-base)
  font-weight 600

.hint-body
  font-size var(--text-sm)
  line-height 1.45
  color var(--muted)

.hint-button
  height 2.25rem
  border-color var(--accent)
  color var(--accent)
  font-weight 600
  max-width 100%
  overflow-wrap anywhere
</style>
