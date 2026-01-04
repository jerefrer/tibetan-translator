<script>
import { ref, computed, onMounted } from 'vue';
import PackManager from '../services/pack-manager';
import DictionariesDetails from '../services/dictionaries-details';
import db from '../services/sql-database';
import { PACK_DEFINITIONS, getRequiredPackIds, getOptionalPackIds } from '../config/pack-definitions';
import { supportsModularPacks } from '../config/platform';

export default {
  name: 'PackManagerCard',
  inject: ['snackbar'],
  setup(props, { emit }) {
    const isSupported = ref(false);
    const confirmDialog = ref(false);
    const packToRemove = ref(null);
    const expandedPacks = ref([]);
    const checkingUpdates = ref(false);

    // Reactive pack state from PackManager
    const downloadingPacks = computed(() => PackManager.downloadingPacks);
    const updatingPacks = computed(() => PackManager.updatingPacks);
    const availableUpdates = computed(() => PackManager.availableUpdates);
    const hasUpdates = computed(() => PackManager.hasUpdates);
    const installedPacks = computed(() => PackManager.installedPacks);
    const isInitialized = computed(() => PackManager.isInitialized);

    // All packs with their status
    const allPacks = computed(() => {
      const packs = [];

      // Add required packs first
      for (const packId of getRequiredPackIds()) {
        const def = PACK_DEFINITIONS[packId];
        if (def) {
          packs.push({
            ...def,
            installed: def.included || installedPacks.value.includes(packId),
            downloading: !!downloadingPacks.value[packId],
            downloadProgress: downloadingPacks.value[packId]?.percentage || 0,
            updating: !!updatingPacks.value[packId],
            updateProgress: updatingPacks.value[packId]?.percentage || 0,
            hasUpdate: !!availableUpdates.value[packId],
            updateSize: availableUpdates.value[packId]?.sizeMB,
          });
        }
      }

      // Then optional packs
      for (const packId of getOptionalPackIds()) {
        const def = PACK_DEFINITIONS[packId];
        if (def) {
          packs.push({
            ...def,
            installed: installedPacks.value.includes(packId),
            downloading: !!downloadingPacks.value[packId],
            downloadProgress: downloadingPacks.value[packId]?.percentage || 0,
            updating: !!updatingPacks.value[packId],
            updateProgress: updatingPacks.value[packId]?.percentage || 0,
            hasUpdate: !!availableUpdates.value[packId],
            updateSize: availableUpdates.value[packId]?.sizeMB,
          });
        }
      }

      return packs;
    });

    // Count stats
    const installedCount = computed(() =>
      allPacks.value.filter(p => p.installed).length
    );

    const totalCount = computed(() => allPacks.value.length);

    onMounted(async () => {
      isSupported.value = supportsModularPacks();
      if (isSupported.value && !PackManager.isInitialized) {
        await PackManager.init();
      }
    });

    // Methods
    const downloadPack = async (packId) => {
      try {
        await PackManager.downloadPack(packId);
        await PackManager.waitForDownload(packId);
        await db.reloadPack(packId);
      } catch (e) {
        console.error('Download failed:', e);
      }
    };

    const confirmRemovePack = (pack) => {
      if (pack.required || pack.included) return;
      packToRemove.value = pack;
      confirmDialog.value = true;
    };

    const removePack = async () => {
      if (!packToRemove.value) return;

      const packId = packToRemove.value.id;
      confirmDialog.value = false;

      try {
        db.unloadPack(packId);
        await PackManager.removePack(packId);
      } catch (e) {
        console.error('Remove failed:', e);
      }

      packToRemove.value = null;
    };

    const toggleExpanded = (packId) => {
      const index = expandedPacks.value.indexOf(packId);
      if (index === -1) {
        expandedPacks.value.push(packId);
      } else {
        expandedPacks.value.splice(index, 1);
      }
    };

    const isExpanded = (packId) => expandedPacks.value.includes(packId);

    const getPackIcon = (pack) => {
      if (pack.icon === 'tibetan-ka') return null; // Special case
      return pack.icon || 'mdi-book-open-variant';
    };

    const isTibetanKaIcon = (pack) => pack.icon === 'tibetan-ka';

    const getDictionaryLabel = (dictName) => {
      const details = DictionariesDetails[dictName];
      return details?.label || dictName;
    };

    const checkForUpdates = async () => {
      checkingUpdates.value = true;
      try {
        await PackManager.checkForUpdates();
      } catch (e) {
        console.error('Update check failed:', e);
      }
      checkingUpdates.value = false;
    };

    const updatePack = async (packId) => {
      try {
        await PackManager.updatePack(packId);
        await PackManager.waitForUpdate(packId);
        await db.reloadPack(packId);
      } catch (e) {
        console.error('Update failed:', e);
      }
    };

    const updateAllPacks = async () => {
      try {
        for (const pack of allPacks.value) {
          if (pack.hasUpdate) {
            await updatePack(pack.id);
          }
        }
      } catch (e) {
        console.error('Update all failed:', e);
      }
    };

    return {
      isSupported,
      confirmDialog,
      packToRemove,
      expandedPacks,
      allPacks,
      installedCount,
      totalCount,
      isInitialized,
      hasUpdates,
      checkingUpdates,
      downloadPack,
      confirmRemovePack,
      removePack,
      toggleExpanded,
      isExpanded,
      getPackIcon,
      isTibetanKaIcon,
      getDictionaryLabel,
      checkForUpdates,
      updatePack,
      updateAllPacks,
    };
  },
};
</script>

<template>
  <v-card v-if="isSupported" class="pack-manager-card mb-4">
    <v-toolbar>
      <v-icon size="x-large" color="grey">mdi-package-variant</v-icon>
      <v-toolbar-title>
        Dictionary Packs
        <div class="text-caption text-grey">
          {{ installedCount }} of {{ totalCount }} installed
        </div>
      </v-toolbar-title>
      <v-spacer />
      <v-btn
        variant="text"
        size="small"
        :loading="checkingUpdates"
        @click="checkForUpdates"
      >
        <v-icon start>mdi-refresh</v-icon>
        Check for updates
      </v-btn>
      <v-btn
        v-if="hasUpdates"
        variant="tonal"
        color="primary"
        size="small"
        class="ml-2"
        @click="updateAllPacks"
      >
        <v-icon start>mdi-download</v-icon>
        Update all
      </v-btn>
    </v-toolbar>

    <v-list v-if="isInitialized">
      <template v-for="pack in allPacks" :key="pack.id">
        <v-list-item class="pack-item">
          <template v-slot:prepend>
            <span v-if="isTibetanKaIcon(pack)" class="tibetan-ka-icon" :class="{ active: pack.installed }">ཀ</span>
            <v-icon v-else :icon="getPackIcon(pack)" :color="pack.installed ? 'primary' : 'grey'" />
          </template>

          <v-list-item-title>
            {{ pack.name }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ pack.description }}
            <br />
            <span class="text-caption">{{ pack.estimatedSize }}</span>
          </v-list-item-subtitle>

          <template v-slot:append>
            <!-- Updating: show progress -->
            <template v-if="pack.updating">
              <div class="download-progress-container">
                <v-progress-circular
                  :model-value="pack.updateProgress"
                  :size="36"
                  :width="3"
                  color="warning"
                  bg-color="grey-lighten-2"
                />
                <span class="download-progress-text update">{{ Math.round(pack.updateProgress) }}%</span>
              </div>
            </template>

            <!-- Downloading: show progress -->
            <template v-else-if="pack.downloading">
              <div class="download-progress-container">
                <v-progress-circular
                  :model-value="pack.downloadProgress"
                  :size="36"
                  :width="3"
                  color="primary"
                  bg-color="grey-lighten-2"
                />
                <span class="download-progress-text">{{ Math.round(pack.downloadProgress) }}%</span>
              </div>
            </template>

            <!-- Included (bundled with app) -->
            <template v-else-if="pack.included">
              <v-btn
                icon
                variant="text"
                size="small"
                @click="toggleExpanded(pack.id)"
              >
                <v-icon>{{ isExpanded(pack.id) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                <v-tooltip activator="parent" location="top">Show dictionaries</v-tooltip>
              </v-btn>
              <v-btn
                v-if="pack.hasUpdate"
                icon
                variant="text"
                size="small"
                color="warning"
                @click="updatePack(pack.id)"
              >
                <v-badge dot color="warning" floating>
                  <v-icon>mdi-download</v-icon>
                </v-badge>
                <v-tooltip activator="parent" location="top">Update available ({{ pack.updateSize }} MB)</v-tooltip>
              </v-btn>
              <v-btn
                v-else
                icon
                variant="text"
                size="small"
                class="included-check"
              >
                <v-icon color="success" size="24">mdi-check-circle</v-icon>
              </v-btn>
            </template>

            <!-- Installed: show status and remove button -->
            <template v-else-if="pack.installed">
              <v-btn
                icon
                variant="text"
                size="small"
                @click="toggleExpanded(pack.id)"
              >
                <v-icon>{{ isExpanded(pack.id) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                <v-tooltip activator="parent" location="top">Show dictionaries</v-tooltip>
              </v-btn>
              <v-btn
                v-if="pack.hasUpdate"
                icon
                variant="text"
                size="small"
                color="warning"
                @click="updatePack(pack.id)"
              >
                <v-badge dot color="warning" floating>
                  <v-icon>mdi-download</v-icon>
                </v-badge>
                <v-tooltip activator="parent" location="top">Update available ({{ pack.updateSize }} MB)</v-tooltip>
              </v-btn>
              <v-btn
                v-else
                icon
                variant="text"
                size="small"
                color="error"
                @click="confirmRemovePack(pack)"
              >
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent" location="top">Remove pack</v-tooltip>
              </v-btn>
            </template>

            <!-- Not installed: show download button -->
            <template v-else>
              <v-btn
                icon
                variant="text"
                size="small"
                @click="toggleExpanded(pack.id)"
              >
                <v-icon>{{ isExpanded(pack.id) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                <v-tooltip activator="parent" location="top">Show dictionaries</v-tooltip>
              </v-btn>
              <v-btn
                icon
                variant="text"
                size="small"
                color="primary"
                @click="downloadPack(pack.id)"
              >
                <v-icon>mdi-download</v-icon>
                <v-tooltip activator="parent" location="top">Download pack</v-tooltip>
              </v-btn>
            </template>
          </template>
        </v-list-item>

        <!-- Expandable dictionary list -->
        <v-expand-transition>
          <div v-if="isExpanded(pack.id)" class="dictionaries-list">
            <div
              v-for="dictName in pack.dictionaries"
              :key="dictName"
              class="dictionary-item text-caption"
            >
              {{ getDictionaryLabel(dictName) }}
            </div>
          </div>
        </v-expand-transition>
      </template>
    </v-list>

    <v-card-text v-else class="text-center py-8">
      <v-progress-circular indeterminate color="primary" />
      <p class="text-caption text-grey mt-2">Loading pack information...</p>
    </v-card-text>

    <!-- Confirm Remove Dialog -->
    <v-dialog v-model="confirmDialog" max-width="400">
      <v-card>
        <v-card-title>Remove Pack?</v-card-title>
        <v-card-text>
          Are you sure you want to remove <strong>{{ packToRemove?.name }}</strong>?
          You can download it again later.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmDialog = false">Cancel</v-btn>
          <v-btn color="error" variant="elevated" @click="removePack">Remove</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<style lang="sass" scoped>
.pack-manager-card
  width: 100%

  .v-toolbar .v-icon
    margin: 0 10px 0 10px

  .v-toolbar__title, .v-toolbar__title .text-caption
    line-height: 1em

  .v-toolbar__title .text-caption
    margin-top: 5px

  .pack-item
    border-bottom: thin solid rgba(0, 0, 0, 0.08)
    min-height: 72px

    &:last-child
      border-bottom: none
      margin-bottom: 0

    :deep(.v-list-item__prepend)
      width: 24px
      min-width: 24px
      margin-right: 12px

    :deep(.v-list-item__content)
      padding-left: 0

    :deep(.v-list-item-subtitle)
      white-space: normal
      -webkit-line-clamp: unset

  .tibetan-ka-icon
    font-family: 'DDC Uchen', 'Jomolhari', 'Tibetan Machine Uni', serif
    font-size: 1.5rem
    width: 24px
    min-width: 24px
    height: 24px
    line-height: 24px
    display: flex
    align-items: center
    justify-content: center
    text-align: center
    color: rgba(var(--v-theme-on-surface), 0.38)

    &.active
      color: rgb(var(--v-theme-primary))

  .download-progress-container
    position: relative
    display: flex
    align-items: center
    justify-content: center
    width: 44px
    height: 44px

  .download-progress-text
    position: absolute
    font-size: 9px
    font-weight: 600
    color: rgb(var(--v-theme-primary))

    &.update
      color: rgb(var(--v-theme-warning))

  .dictionaries-list
    background: rgba(var(--v-theme-on-surface), 0.02)
    padding: 8px 16px 8px 56px
    border-bottom: thin solid rgba(0, 0, 0, 0.08)
    display: flex
    flex-direction: column
    gap: 2px

    .dictionary-item
      color: rgba(var(--v-theme-on-surface), 0.7)

      &::before
        content: '•'
        margin-right: 6px
        opacity: 0.5
</style>
