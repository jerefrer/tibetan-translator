<script>
import draggable from 'vuedraggable';
import { useTheme } from 'vuetify';

import Storage from '../services/storage';
import DictionariesDetails from '../services/dictionaries-details';
import {
  getScannedDictionaries,
  isScanDownloaded,
  downloadScan,
  deleteScan,
  isAppMode
} from '../services/scan-service';

// Tauri event listener (lazy loaded)
let listen = null;
async function getTauriListen() {
  if (listen) return listen;
  try {
    // Only attempt to load in Tauri environment
    if (!window.__TAURI__) return null;
    const { listen: l } = await import('@tauri-apps/api/event');
    if (typeof l === 'function') {
      listen = l;
      return listen;
    }
    return null;
  } catch (e) {
    console.warn('Failed to load Tauri event listener:', e);
    return null;
  }
}

export default {
  components: {
    draggable,
  },
  inject: ['snackbar'],
  setup() {
    const theme = useTheme();
    return { theme };
  },
  data() {
    return {
      dictionaries: Storage.get('dictionaries').sort((a, b) => {
        return a.position - b.position;
      }),
      themePreference: Storage.get('themePreference') || 'system',
      scannedDictionaries: [],
      scanDownloadStatus: {},
      isAppMode: false,
      progressUnlisten: null,
    };
  },
  watch: {
    dictionaries: {
      deep: true,
      handler(newDictionaries) {
        Storage.set(
          'dictionaries',
          newDictionaries.map((dictionary, index) => {
            return { ...dictionary, position: index + 1 };
          })
        );
      },
    },
    themePreference(value) {
      Storage.set('themePreference', value);
      this.applyTheme(value);
    },
  },
  methods: {
    applyTheme(preference) {
      let actualTheme;
      if (preference === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        actualTheme = prefersDark ? 'dark' : 'light';
      } else {
        actualTheme = preference;
      }
      this.theme.global.name.value = actualTheme;
      Storage.set('darkTheme', actualTheme === 'dark');
    },
    getDetails(dictionary) {
      return DictionariesDetails[dictionary.name] || {};
    },
    getLanguageLabel(dictionary) {
      const details = this.getDetails(dictionary);
      if (!details.language || !Array.isArray(details.language)) return '';
      // language is like ["tib", "<->", "en"] or ["tib", "->", "skt"]
      const langs = details.language.filter(l => !['<->', '->', '<-'].includes(l));
      const langNames = {
        tib: 'Tib',
        en: 'En',
        skt: 'Skt',
        zh: 'Zh',
      };
      return langs.map(l => langNames[l] || l).join(' ↔ ');
    },
    showDictionaryInfo(dictionary) {
      const scrollTop = document.documentElement.scrollTop || window.scrollY;
      const details = this.getDetails(dictionary);
      if (!details.about) {
        this.snackbar.open(`<strong>${dictionary.name}</strong><br>No additional information available.`);
      } else {
        // Format the about text - split by | for line breaks
        const aboutHtml = details.about.split('|').join('<br>');
        this.snackbar.open(`<strong>${details.label || dictionary.name}</strong><br><br>${aboutHtml}`);
      }
      // Blur button to prevent focus-related scroll, restore scroll position
      document.activeElement?.blur();
      setTimeout(() => {
        document.documentElement.scrollTop = scrollTop;
        window.scrollTo(0, scrollTop);
      }, 0);
    },
    async loadScannedDictionaries() {
      this.scannedDictionaries = getScannedDictionaries();
      // Check download status for each
      for (const dict of this.scannedDictionaries) {
        this.scanDownloadStatus[dict.scanId] = {
          downloaded: await isScanDownloaded(dict.scanId),
          downloading: false,
          progress: 0,
          error: null
        };
      }
    },
    async setupProgressListener() {
      const listenFn = await getTauriListen();
      if (!listenFn) return;

      this.progressUnlisten = await listenFn('scan-download-progress', (event) => {
        const { scan_id, percent } = event.payload;
        if (this.scanDownloadStatus[scan_id]) {
          this.scanDownloadStatus[scan_id] = {
            ...this.scanDownloadStatus[scan_id],
            progress: Math.round(percent)
          };
        }
      });
    },
    async handleDownloadScan(scanId) {
      this.scanDownloadStatus[scanId] = {
        ...this.scanDownloadStatus[scanId],
        downloading: true,
        progress: 0,
        error: null
      };

      try {
        await downloadScan(scanId);
        this.scanDownloadStatus[scanId] = {
          downloaded: true,
          downloading: false,
          progress: 100,
          error: null
        };
        this.snackbar.open('Download complete!');
      } catch (e) {
        this.scanDownloadStatus[scanId] = {
          ...this.scanDownloadStatus[scanId],
          downloading: false,
          progress: 0,
          error: e.message || 'Download failed'
        };
        this.snackbar.open(`Download failed: ${e.message || 'Unknown error'}`);
      }
    },
    async handleDeleteScan(scanId) {
      try {
        await deleteScan(scanId);
        this.scanDownloadStatus[scanId] = {
          downloaded: false,
          downloading: false,
          progress: 0,
          error: null
        };
        this.snackbar.open('Deleted successfully');
      } catch (e) {
        this.snackbar.open(`Delete failed: ${e.message || 'Unknown error'}`);
      }
    },
    getEstimatedSize(pageCount) {
      // Rough estimate: ~200KB per page on average
      const sizeKB = pageCount * 200;
      if (sizeKB > 1024) {
        return `~${Math.round(sizeKB / 1024)} MB`;
      }
      return `~${sizeKB} KB`;
    }
  },
  async created() {
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.themePreference === 'system') {
        this.applyTheme('system');
      }
    });
    // Check if running in app mode and load scanned dictionaries
    this.isAppMode = await isAppMode();
    await this.loadScannedDictionaries();
    await this.setupProgressListener();
  },
  unmounted() {
    // Clean up event listener
    if (this.progressUnlisten) {
      this.progressUnlisten();
    }
  },
};
</script>

<template>
  <v-container class="configure-page">
    <v-card class="theme-selector mb-4">
      <v-toolbar>
        <v-icon size="x-large" color="grey">mdi-theme-light-dark</v-icon>
        <v-toolbar-title>
          Theme
        </v-toolbar-title>
      </v-toolbar>
      <v-radio-group v-model="themePreference" inline hide-details class="pa-4">
        <v-radio label="System" value="system" />
        <v-radio label="Light" value="light" />
        <v-radio label="Dark" value="dark" />
      </v-radio-group>
    </v-card>

    <!-- Scanned Dictionaries Section -->
    <v-card v-if="scannedDictionaries.length > 0" class="scanned-dictionaries mb-4">
      <v-toolbar>
        <v-icon size="x-large" color="grey">mdi-book-open-page-variant</v-icon>
        <v-toolbar-title>
          Scanned Dictionaries
          <div class="text-caption text-grey">
            Download for offline access
          </div>
        </v-toolbar-title>
      </v-toolbar>

      <v-list>
        <v-list-item
          v-for="dict in scannedDictionaries"
          :key="dict.scanId"
          class="scanned-dict-item"
        >
          <v-list-item-title>{{ dict.label.replace(' (scanned dictionary)', '') }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ dict.pageCount }} pages ({{ getEstimatedSize(dict.pageCount) }})
          </v-list-item-subtitle>

          <template v-slot:append>
            <!-- Download in progress - circular progress like iOS App Store -->
            <div
              v-if="scanDownloadStatus[dict.scanId]?.downloading"
              class="download-progress-container"
            >
              <v-progress-circular
                :model-value="scanDownloadStatus[dict.scanId]?.progress || 0"
                :size="36"
                :width="3"
                color="primary"
                bg-color="grey-lighten-2"
              />
              <span class="download-progress-text">
                {{ scanDownloadStatus[dict.scanId]?.progress || 0 }}%
              </span>
            </div>

            <!-- Downloaded - show delete button -->
            <v-btn
              v-else-if="scanDownloadStatus[dict.scanId]?.downloaded"
              icon
              variant="text"
              size="small"
              color="error"
              @click="handleDeleteScan(dict.scanId)"
            >
              <v-icon>mdi-delete</v-icon>
              <v-tooltip activator="parent" location="top">Delete download</v-tooltip>
            </v-btn>

            <!-- Not downloaded - show download button (only in app mode) -->
            <v-btn
              v-else-if="isAppMode"
              icon
              variant="text"
              size="small"
              color="primary"
              @click="handleDownloadScan(dict.scanId)"
            >
              <v-icon>mdi-download</v-icon>
              <v-tooltip activator="parent" location="top">Download for offline</v-tooltip>
            </v-btn>

            <!-- Web mode - show info -->
            <v-chip v-else size="small" color="grey" variant="outlined">
              Online only
            </v-chip>
          </template>
        </v-list-item>
      </v-list>

      <v-card-text v-if="!isAppMode" class="text-caption text-grey">
        Download for offline is only available in the desktop/mobile app.
      </v-card-text>
    </v-card>

    <v-card class="dictionaries-container">
      <v-toolbar>
        <v-icon size="x-large" color="grey">mdi-book-multiple</v-icon>
        <v-toolbar-title>
          Dictionaries
          <div class="text-caption text-grey">
            Reorder or disable them to match your preferences
          </div>
        </v-toolbar-title>
      </v-toolbar>

      <draggable v-model="dictionaries" handle=".handle" item-key="id">
        <template #item="{ element: dictionary, index }">
          <div
            class="dictionary list-item"
            :class="{
              disabled: !dictionary.enabled,
            }"
          >
            <v-icon class="handle" color="grey-darken-2">
              mdi-drag-horizontal-variant
            </v-icon>

            <div class="name">
              <span class="text-grey-darken-1">{{ index + 1 }}.</span>
              {{ getDetails(dictionary).label || dictionary.name }}
              <span v-if="getLanguageLabel(dictionary)" class="language-label text-caption text-grey">
                ({{ getLanguageLabel(dictionary) }})
              </span>
            </div>

            <v-btn
              icon
              variant="text"
              size="small"
              class="info-button"
              @click.stop.prevent="showDictionaryInfo(dictionary)"
            >
              <v-icon size="small" color="grey">mdi-information-outline</v-icon>
            </v-btn>

            <v-switch
              v-model="dictionary.enabled"
              hide-details
              class="switch"
              color="primary"
            />
          </div>
        </template>
      </draggable>
    </v-card>
  </v-container>
</template>

<style lang="sass">
.configure-page
  margin-top: 30px

  .theme-selector
    width: 100%

    .v-toolbar .v-icon
      margin: 0 10px 0 10px

    .v-radio-group
      justify-content: center

  .dictionaries-container
    width: 100%

    .v-toolbar .v-icon
      margin: 0 10px 0 10px

    .v-toolbar__title, .v-toolbar__title .text-caption
      line-height: 1em

    .v-toolbar__title .text-caption
      margin-top: 5px

    .dictionary
      display: flex
      align-items: center
      user-select: none
      height: 42px
      border-bottom: thin solid rgba(0, 0, 0, 0.08)

      &:last-child
        border-bottom: none

      &.disabled .v-icon:before, &.disabled .switch .v-input__control
        opacity: 0.25

      &.disabled > .name
        color: #525252

      .handle
        width: 48px
        display: flex
        align-items: center
        justify-content: center
        cursor: move
        height: 100%

      .v-icon:before, .name, &.disabled .switch .v-input__control
        transition: all 1s

      > .name
        flex: 1
        padding: 0 8px
        white-space: nowrap
        overflow: hidden
        text-overflow: ellipsis
        min-width: 0

      > .info-button
        flex: 0 0 auto
        margin: 0 4px

      > .switch
        margin: 0
        flex: 0 0 auto
        padding-right: 8px

      .switch .v-input__control
        height: 32px

      .switch .v-selection-control
        min-height: 32px

  .scanned-dictionaries
    width: 100%

    .v-toolbar .v-icon
      margin: 0 10px 0 10px

    .v-toolbar__title, .v-toolbar__title .text-caption
      line-height: 1em

    .v-toolbar__title .text-caption
      margin-top: 5px

    .scanned-dict-item
      border-bottom: thin solid rgba(0, 0, 0, 0.08)

      &:last-child
        border-bottom: none

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
      color: var(--v-theme-primary)

  .database-reinitialization .v-toolbar .v-icon
    margin: 0 9px 0 -6px

    .fd-zone
      width: 100%

      > div:not(.dndtxt), > div:not(.dndtxt) form, > div:not(.dndtxt) form input
        position: absolute !important
        left: 0
        top: 0
        right: 0
        bottom: 0
        margin: 0

      > div:not(.dndtxt) form
        margin-top: -30px

// Mobile styles
@media (max-width: 600px)
  .configure-page
    margin-top: 20px !important
    padding: 0 8px !important
    padding-top: 20px !important

    .v-toolbar__content > .v-toolbar-title
      margin-inline-start: 0

    .dictionaries-container .dictionary
      .handle
        width: 32px

      > .name
        font-size: 14px

        .language-label
          display: none
</style>
