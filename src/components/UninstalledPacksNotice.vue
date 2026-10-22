<script>
import PackManager from '../services/pack-manager';
import { PACK_DEFINITIONS } from '../config/pack-definitions';
import { supportsModularPacks } from '../config/platform';
import { getUninstalledPacks } from '../services/dictionary-catalog';

// A lookup that finds this few results is where a missing pack matters most
const FEW_RESULTS = 3;

export default {
  name: 'UninstalledPacksNotice',
  props: {
    resultCount: { type: Number, required: true },
    threshold: { type: Number, default: FEW_RESULTS },
  },
  computed: {
    uninstalledPacks() {
      if (!supportsModularPacks() || !PackManager.isInitialized) return [];
      return getUninstalledPacks(
        PACK_DEFINITIONS,
        (packId) =>
          !!PACK_DEFINITIONS[packId]?.included ||
          PackManager.installedPacks.includes(packId)
      );
    },
    visible() {
      return this.uninstalledPacks.length > 0 && this.resultCount < this.threshold;
    },
    heading() {
      const count = this.uninstalledPacks.length;
      return count === 1 ? '1 pack was not searched' : `${count} packs were not searched`;
    },
  },
  methods: {
    browse() {
      this.$router.push({ path: '/dictionaries', query: { status: 'available' } });
    },
  },
};
</script>

<template>
  <div v-if="visible" class="uninstalled-notice">
    <div class="notice-heading">{{ heading }}</div>
    <ul class="notice-packs">
      <li v-for="pack in uninstalledPacks" :key="pack.id">
        {{ pack.name }}, {{ pack.dictionaryCount }} dictionaries
      </li>
    </ul>
    <v-btn size="small" variant="tonal" color="primary" @click="browse">
      Browse and install
    </v-btn>
  </div>
</template>

<style lang="stylus" scoped>
.uninstalled-notice
  flex-shrink 0
  margin 12px 15px
  padding 12px 14px
  border 1px dashed unquote('rgb(var(--v-theme-warning))')
  border-radius 8px
  font-size 0.875rem

  .notice-heading
    font-weight 500
    margin-bottom 4px

  .notice-packs
    margin 0 0 10px
    padding-left 18px
    opacity 0.85
</style>
