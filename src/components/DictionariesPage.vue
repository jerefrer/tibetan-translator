<script>
import DictionaryCatalog from './DictionaryCatalog.vue';

// Interim page for the new "Dictionaries" entry of the app shell: the
// searchable catalog, hosted on its own route. The redesigned screen replaces
// this body; the catalog also remains in Settings until then.
export default {
  name: 'DictionariesPage',
  components: { DictionaryCatalog },
  computed: {
    catalogQuery() {
      return String(this.$route.query.find || '');
    },
    catalogStatus() {
      return String(this.$route.query.status || 'all');
    },
  },
};
</script>

<template>
  <div class="dictionaries-page-wrapper" data-testid="dictionaries-page">
    <v-container class="dictionaries-page">
      <dictionary-catalog
        :initial-query="catalogQuery"
        :initial-status="catalogStatus"
      />
    </v-container>
  </div>
</template>

<style lang="stylus" scoped>
.dictionaries-page-wrapper
  height 100%
  overflow-y auto

.dictionaries-page
  margin-top 30px
  padding-bottom 20px
</style>
