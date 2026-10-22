<script>
import DictionaryCatalog from './DictionaryCatalog.vue';
import PackManager from '../services/pack-manager';
import { PACK_DEFINITIONS } from '../config/pack-definitions';
import { supportsModularPacks } from '../config/platform';
import { UiButton, UiIcon, UiProgress } from '../ui';

// "Dictionaries" in the app shell: the searchable catalog, with the packs and
// the user's glossary beside it. On a phone it is a sub-screen of Settings.
export default {
  name: 'DictionariesPage',
  components: { DictionaryCatalog, UiButton, UiIcon, UiProgress },
  computed: {
    catalogQuery() {
      return String(this.$route.query.find || '');
    },
    catalogStatus() {
      return String(this.$route.query.status || 'all');
    },
    // Packs and the glossary only exist where packs can be installed (Tauri)
    modular() {
      return supportsModularPacks();
    },
    packs() {
      return Object.values(PACK_DEFINITIONS).map((pack) => {
        const downloading = PackManager.downloadingPacks[pack.id];
        const updating = PackManager.updatingPacks[pack.id];
        return {
          id: pack.id,
          name: pack.name,
          meta: `${pack.dictionaries.length} dictionaries · ${pack.estimatedSize}`,
          installed: !!pack.included || PackManager.installedPacks.includes(pack.id),
          downloading: downloading ? Math.round(downloading.percentage || 0) : null,
          updating: updating ? Math.round(updating.percentage || 0) : null,
        };
      });
    },
    canInstall() {
      return PackManager.isInitialized;
    },
  },
  methods: {
    installPack(packId) {
      this.$refs.catalog.askInstallPack(packId);
    },
  },
};
</script>

<template>
  <div class="dictionaries-page-wrapper" data-testid="dictionaries-page">
    <div class="dictionaries-page">
      <router-link to="/settings" class="dictionaries-back" data-testid="dictionaries-back">
        <ui-icon name="chevron-left" :size="22" :stroke-width="2.4" />
        Settings
      </router-link>

      <dictionary-catalog
        ref="catalog"
        heading-tag="h1"
        :initial-query="catalogQuery"
        :initial-status="catalogStatus"
      >
        <template v-if="modular" #aside>
          <section class="side-card" aria-labelledby="dictionaries-packs" data-testid="dictionaries-packs">
            <span id="dictionaries-packs" class="side-card__overline">Packs</span>
            <div
              v-for="pack in packs"
              :key="pack.id"
              class="pack-row"
              data-testid="pack-row"
            >
              <div class="pack-row__head">
                <span class="pack-row__name">{{ pack.name }}</span>
                <span v-if="pack.updating !== null" class="pack-row__busy">
                  Updating {{ pack.updating }}%
                </span>
                <span v-else-if="pack.downloading !== null" class="pack-row__busy">
                  Downloading {{ pack.downloading }}%
                </span>
                <span v-else-if="pack.installed" class="pack-row__installed">Installed</span>
                <ui-button
                  v-else-if="canInstall"
                  size="sm"
                  data-testid="pack-install"
                  @click="installPack(pack.id)"
                >
                  Install
                </ui-button>
              </div>
              <ui-progress
                v-if="pack.updating !== null || pack.downloading !== null"
                :value="pack.updating ?? pack.downloading"
                :label="'Downloading ' + pack.name"
              />
              <span class="pack-row__meta">{{ pack.meta }}</span>
            </div>
            <router-link to="/settings" class="side-card__link">
              Updates and removal are in Settings
            </router-link>
          </section>

          <section class="side-card side-card--yours" aria-labelledby="dictionaries-yours">
            <span id="dictionaries-yours" class="side-card__overline">Yours</span>
            <span class="side-card__title">My glossary</span>
            <p class="side-card__text">
              Your own definitions, searched together with everything else. Start
              from a spreadsheet or add entries as you read.
            </p>
            <div class="side-card__actions">
              <ui-button
                variant="outline"
                size="sm"
                data-testid="open-glossary"
                @click="$router.push('/glossary')"
              >
                Open My glossary
              </ui-button>
            </div>
          </section>
        </template>
      </dictionary-catalog>
    </div>
  </div>
</template>

<style lang="stylus" scoped>
eyebrow()
  font-size var(--text-xs)
  font-weight 600
  letter-spacing 0.08em
  text-transform uppercase
  color var(--muted)

.dictionaries-page-wrapper
  height 100%
  overflow-y auto
  background var(--bg)

.dictionaries-page
  box-sizing border-box
  padding 28px 40px 40px
  font-family var(--font-ui)
  color var(--ink)

// A phone reaches this page from Settings, so it gets a way back
.dictionaries-back
  display none

.side-card
  box-sizing border-box
  display flex
  flex-direction column
  gap 4px
  padding 18px 20px
  background var(--surface)
  border 1px solid var(--line)
  border-radius var(--radius-card)
  box-shadow var(--shadow-card)

.side-card__overline
  eyebrow()
  margin-bottom 8px

.side-card--yours
  gap 10px

  .side-card__overline
    margin-bottom 0

.side-card__title
  font-size 0.9375rem
  font-weight 600

.side-card__text
  margin 0
  font-size var(--text-sm)
  line-height 1.5
  color var(--muted)

.side-card__actions
  display flex
  flex-wrap wrap
  gap 10px

.side-card__link
  margin-top 8px
  font-size var(--text-sm)
  color var(--muted)

  &:hover
    color var(--accent)

.pack-row
  display flex
  flex-direction column
  gap 6px
  padding 12px 0
  border-top 1px solid var(--soft)

.pack-row__head
  display flex
  align-items center
  justify-content space-between
  gap 12px
  min-height 2rem

.pack-row__name
  font-size 0.9375rem
  font-weight 600

.pack-row__installed
  font-size var(--text-sm)
  font-weight 600
  color var(--success-ink)

.pack-row__busy
  font-size var(--text-sm)
  font-weight 600
  color var(--accent)

.pack-row__meta
  font-size var(--text-sm)
  color var(--muted)

@media (max-width: 600px)
  .dictionaries-page
    padding 16px 16px 24px

  .dictionaries-back
    display inline-flex
    align-items center
    gap 6px
    min-height 44px
    margin 0 -6px 2px
    padding-right 8px
    color var(--accent)
    font-size 0.9375rem
    font-weight 600
    text-decoration none
</style>
