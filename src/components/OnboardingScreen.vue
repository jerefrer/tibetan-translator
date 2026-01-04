<script>
import { ref, computed, watch } from 'vue';
import PackManager from '../services/pack-manager';
import { PACK_DEFINITIONS, getRequiredPackIds, getOptionalPackIds } from '../config/pack-definitions';

export default {
  name: 'OnboardingScreen',
  emits: ['complete'],
  setup(props, { emit }) {
    const step = ref(1);
    const selectedOptionalPacks = ref([]);
    const error = ref(null);
    const downloadComplete = ref(false);

    // Track which packs are being downloaded
    const downloadingPacks = computed(() => PackManager.downloadingPacks);
    const installedPacks = computed(() => PackManager.installedPacks);

    // Get pack definitions
    const requiredPacks = computed(() =>
      getRequiredPackIds().map(id => PACK_DEFINITIONS[id])
    );

    const optionalPacks = computed(() =>
      getOptionalPackIds().map(id => PACK_DEFINITIONS[id])
    );

    // Check if currently downloading
    const isDownloading = computed(() =>
      Object.keys(downloadingPacks.value).length > 0
    );

    // Current download progress for display
    const currentDownload = computed(() => {
      const downloads = Object.values(downloadingPacks.value);
      if (downloads.length === 0) return null;
      return downloads[0];
    });

    // Calculate total download size (only optional packs, core is bundled)
    const totalSelectedSize = computed(() => {
      let size = 0;
      for (const packId of selectedOptionalPacks.value) {
        const sizes = { 'extended-english': 8, 'tibetan-monolingual': 65, 'sanskrit-academic': 26 };
        size += sizes[packId] || 0;
      }
      return size;
    });

    // Check if any optional packs selected
    const hasSelectedPacks = computed(() => selectedOptionalPacks.value.length > 0);

    // Watch for download completion
    watch([installedPacks, isDownloading], () => {
      if (step.value === 2 && !isDownloading.value) {
        // Check if all selected packs are now installed
        const allInstalled = selectedOptionalPacks.value.every(
          packId => installedPacks.value.includes(packId)
        );
        if (allInstalled) {
          downloadComplete.value = true;
        }
      }
    });

    // Methods
    const toggleOptionalPack = (packId) => {
      const index = selectedOptionalPacks.value.indexOf(packId);
      if (index === -1) {
        selectedOptionalPacks.value.push(packId);
      } else {
        selectedOptionalPacks.value.splice(index, 1);
      }
    };

    const startDownload = async () => {
      // If no optional packs selected, just complete
      if (selectedOptionalPacks.value.length === 0) {
        complete();
        return;
      }

      step.value = 2;
      error.value = null;

      try {
        // Download selected optional packs
        for (const packId of selectedOptionalPacks.value) {
          if (!PackManager.isInstalled(packId)) {
            await PackManager.downloadPack(packId);
            await PackManager.waitForDownload(packId);
          }
        }

        downloadComplete.value = true;
      } catch (e) {
        error.value = e.message || 'Download failed. Please check your internet connection.';
      }
    };

    const complete = () => {
      PackManager.completeOnboarding();
      emit('complete');
    };

    const getPackIcon = (pack) => {
      if (pack.icon === 'tibetan-ka') return null;
      return pack.icon || 'mdi-book-open-variant';
    };

    const isTibetanKaIcon = (pack) => pack.icon === 'tibetan-ka';

    // Parse size string to get download and installed sizes
    // Input format: "~8 MB download, ~36 MB installed"
    const parseSize = (sizeStr) => {
      if (!sizeStr) return { download: '', installed: '' };
      const parts = sizeStr.split(',').map(s => s.trim());
      const download = (parts[0] || '').replace(/^~/, '').replace(' download', '').trim();
      const installed = (parts[1] || '').replace(/^~/, '').replace(' installed', '').trim();
      return { download, installed };
    };

    return {
      step,
      selectedOptionalPacks,
      error,
      downloadComplete,
      downloadingPacks,
      installedPacks,
      requiredPacks,
      optionalPacks,
      isDownloading,
      currentDownload,
      totalSelectedSize,
      hasSelectedPacks,
      toggleOptionalPack,
      startDownload,
      complete,
      getPackIcon,
      isTibetanKaIcon,
      parseSize,
      PACK_DEFINITIONS,
    };
  },
};
</script>

<template>
  <div class="onboarding-screen">
    <div class="onboarding-content">
      <!-- Step 1: Welcome and Pack Selection -->
      <template v-if="step === 1">
        <div class="header">
          <v-img src="/img/app-icon.png" width="64" class="mb-3 mx-auto" />
          <h1 class="text-h5">Welcome to Tibetan Translator</h1>
        </div>

        <div class="body">
          <p class="text-body-1 mb-4">
            The core dictionaries are included with the app. You can optionally download additional dictionary packs:
          </p>

          <!-- Required Pack (Included) -->
          <v-card variant="outlined" class="mb-4 pack-card included">
            <div class="pack-card-content">
              <div class="prepend-wrapper">
                <v-icon :icon="getPackIcon(requiredPacks[0])" color="success" size="large" />
              </div>
              <div class="pack-info">
                <div class="pack-name">{{ requiredPacks[0]?.name }}</div>
                <div class="pack-description">{{ requiredPacks[0]?.description }}</div>
                <div class="pack-sizes">
                  <v-chip size="small" color="success" variant="tonal">
                    <v-icon start size="small">mdi-check</v-icon>
                    Included
                  </v-chip>
                  <span class="text-caption text-grey">{{ parseSize(requiredPacks[0]?.estimatedSize).installed }} installed</span>
                </div>
              </div>
            </div>
          </v-card>

          <!-- Optional Packs -->
          <div class="text-subtitle-2 mb-2 text-grey">Optional packs:</div>

          <v-card
            v-for="pack in optionalPacks"
            :key="pack.id"
            variant="outlined"
            class="mb-2 pack-card optional"
            :class="{ selected: selectedOptionalPacks.includes(pack.id) }"
            @click="toggleOptionalPack(pack.id)"
          >
            <div class="pack-card-content">
              <div class="prepend-wrapper">
                <v-checkbox
                  :model-value="selectedOptionalPacks.includes(pack.id)"
                  hide-details
                  density="compact"
                  @click.stop="toggleOptionalPack(pack.id)"
                />
              </div>
              <div class="pack-info">
                <div class="pack-name">{{ pack.name }}</div>
                <div class="pack-description">{{ pack.description }}</div>
                <div class="pack-sizes">
                  <span class="text-caption text-grey">{{ parseSize(pack.estimatedSize).download }} download</span>
                  <span class="text-caption text-grey separator">·</span>
                  <span class="text-caption text-grey">{{ parseSize(pack.estimatedSize).installed }} installed</span>
                </div>
              </div>
            </div>
          </v-card>

          <v-alert type="info" variant="tonal" density="compact" class="mt-4 info-alert">
            <template v-slot:prepend>
              <v-icon size="small">mdi-information</v-icon>
            </template>
            You can add or remove packs later from the Configure page.
          </v-alert>
        </div>

        <div class="actions">
          <v-btn
            v-if="hasSelectedPacks"
            color="primary"
            variant="elevated"
            size="large"
            class="px-8"
            @click="startDownload"
          >
            Download {{ totalSelectedSize }} MB
            <v-icon end>mdi-download</v-icon>
          </v-btn>
          <v-btn
            v-else
            color="primary"
            variant="elevated"
            size="large"
            class="px-8"
            @click="complete"
          >
            Get Started
            <v-icon end>mdi-arrow-right</v-icon>
          </v-btn>
        </div>
      </template>

      <!-- Step 2: Downloading -->
      <template v-if="step === 2">
        <div class="header">
          <template v-if="downloadComplete">
            <v-icon color="success" size="48" class="mb-2">mdi-check-circle</v-icon>
            <h1 class="text-h5">You're all set!</h1>
          </template>
          <template v-else-if="error">
            <v-icon color="error" size="48" class="mb-2">mdi-alert-circle</v-icon>
            <h1 class="text-h5">Download Failed</h1>
          </template>
          <template v-else>
            <v-progress-circular
              :size="48"
              :width="4"
              color="primary"
              indeterminate
              class="mb-2"
            />
            <h1 class="text-h5">Downloading...</h1>
          </template>
        </div>

        <div class="body">
          <template v-if="downloadComplete">
            <p class="text-body-1 mb-4 text-center">
              The additional dictionaries have been downloaded successfully.
              You can start using the app now!
            </p>
          </template>

          <template v-else-if="error">
            <v-alert type="error" variant="tonal" class="mb-4">
              {{ error }}
            </v-alert>
            <p class="text-body-2 text-grey">
              Please check your internet connection and try again.
            </p>
          </template>

          <template v-else>
            <div v-if="currentDownload" class="download-progress mb-4">
              <p class="text-body-2 mb-2 text-center">
                {{ PACK_DEFINITIONS[currentDownload.packId]?.name || currentDownload.packId }}
              </p>
              <v-progress-linear
                :model-value="currentDownload.percentage"
                color="primary"
                height="8"
                rounded
              />
              <p class="text-caption text-grey mt-1 text-center">
                {{ Math.round(currentDownload.percentage) }}% complete
              </p>
            </div>

            <p class="text-body-2 text-grey text-center">
              Please wait while we download the dictionary databases.
              This may take a few minutes depending on your connection.
            </p>
          </template>
        </div>

        <div class="actions">
          <v-btn
            v-if="downloadComplete"
            color="primary"
            variant="elevated"
            size="large"
            class="px-8"
            @click="complete"
          >
            Get Started
            <v-icon end>mdi-arrow-right</v-icon>
          </v-btn>
          <v-btn
            v-else-if="error"
            color="primary"
            variant="elevated"
            class="px-8"
            @click="startDownload"
          >
            Retry Download
            <v-icon end>mdi-refresh</v-icon>
          </v-btn>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="sass" scoped>
.onboarding-screen
  position: fixed
  top: 0
  left: 0
  right: 0
  bottom: 0
  background: rgb(var(--v-theme-background))
  display: flex
  align-items: center
  justify-content: center
  z-index: 9999

.onboarding-content
  width: 100%
  max-width: 500px
  padding: 24px
  display: flex
  flex-direction: column
  max-height: 100vh
  overflow-y: auto

  .header
    text-align: center
    margin-bottom: 24px

    h1
      margin-top: 8px

  .body
    flex: 1

  .actions
    display: flex
    justify-content: center
    padding-top: 24px
    padding-bottom: 16px

  .pack-card
    cursor: pointer
    transition: all 0.2s ease

    &.included
      cursor: default
      border-color: rgb(var(--v-theme-success))
      background: rgba(var(--v-theme-success), 0.05)

    &.optional
      &:hover
        border-color: rgb(var(--v-theme-primary))
        background: rgba(var(--v-theme-primary), 0.02)

      &.selected
        border-color: rgb(var(--v-theme-primary))
        background: rgba(var(--v-theme-primary), 0.08)

    .pack-card-content
      display: flex
      align-items: flex-start
      padding: 12px

    .prepend-wrapper
      display: flex
      align-items: center
      justify-content: center
      width: 42px
      min-width: 42px
      margin-right: 12px
      padding-top: 2px

      :deep(.v-checkbox)
        margin: 0

        .v-selection-control
          min-height: auto

    .pack-info
      flex: 1
      min-width: 0

    .pack-name
      font-size: 0.95rem
      font-weight: 500
      line-height: 1.3
      margin-bottom: 2px

    .pack-description
      font-size: 0.8rem
      line-height: 1.3
      color: rgba(var(--v-theme-on-surface), 0.7)
      margin-bottom: 6px

    .pack-sizes
      display: flex
      align-items: center
      gap: 6px
      flex-wrap: wrap

      .separator
        opacity: 0.5

  .info-alert
    :deep(.v-alert__content)
      display: flex
      align-items: center

    :deep(.v-alert__prepend)
      margin-right: 8px
      height: 100%
      display: flex
      align-items: center

  .download-progress
    max-width: 300px
    margin: 0 auto
</style>
