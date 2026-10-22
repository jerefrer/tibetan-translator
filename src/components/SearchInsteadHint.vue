<script>
export default {
  name: 'SearchInsteadHint',
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
  <div class="search-instead-hint">
    <div>Define looks up Tibetan only. For a Sanskrit or English word, use Search.</div>
    <v-btn size="small" variant="tonal" color="primary" @click="searchInstead">
      Search for “{{ text }}”
    </v-btn>
  </div>
</template>

<style lang="stylus" scoped>
.search-instead-hint
  flex-shrink 0
  display flex
  flex-direction column
  align-items flex-start
  gap 8px
  margin 12px 15px 0
  padding 12px 14px
  border-radius 8px
  background unquote('rgba(var(--v-theme-primary), 0.08)')
  font-size 0.875rem
</style>
