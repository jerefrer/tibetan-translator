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
  <section v-if="visible" class="uninstalled-notice" data-testid="uninstalled-notice">
    <span class="notice-heading">{{ heading }}</span>
    <ul class="notice-packs">
      <li v-for="pack in uninstalledPacks" :key="pack.id">
        {{ pack.name }}, {{ pack.dictionaryCount }} dictionaries
      </li>
    </ul>
    <div>
      <button type="button" class="notice-button" data-testid="uninstalled-notice-browse" @click="browse">
        See packs
      </button>
    </div>
  </section>
</template>

<style lang="stylus" scoped>
// Board "B · Define": the amber notice under the terms list
.uninstalled-notice
  flex-shrink 0
  display flex
  flex-direction column
  gap 6px
  margin 12px 15px
  padding 12px 16px
  border 1.5px dashed var(--amber-line)
  border-radius var(--radius-xl)
  background var(--amber-bg)
  color var(--amber-ink)
  font-family var(--font-ui)

  .notice-heading
    font-size var(--text-base)
    font-weight 600

  .notice-packs
    margin 0 0 4px
    padding-left 18px
    font-size var(--text-sm)
    line-height 1.5

  .notice-button
    height var(--control-sm)
    padding 0 14px
    border 0
    border-radius var(--radius-md)
    background var(--amber-ink)
    color var(--on-dark)
    font 600 var(--text-sm) var(--font-ui)
    cursor pointer

    &:hover
      opacity 0.9

    &:focus-visible
      outline 2px solid var(--amber-ink)
      outline-offset 2px

@media (max-width: 600px)
  .uninstalled-notice .notice-button
    height 2.75rem
</style>
