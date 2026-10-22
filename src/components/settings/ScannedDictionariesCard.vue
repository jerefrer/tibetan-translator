<script>
import {
  getScannedDictionaries,
  isScanDownloaded,
  downloadScan,
  deleteScan,
  isAppMode,
} from '../../services/scan-service';
import { UiButton, UiChip, UiIcon, UiProgress, UiTooltip } from '../../ui';
import SettingsCard from './SettingsCard.vue';

// Tauri event listener, loaded lazily so the browser build never imports it
let listen = null;
async function getTauriListen() {
  if (listen) return listen;
  try {
    if (!window.__TAURI__ && !window.__TAURI_INTERNALS__) return null;
    const { listen: tauriListen } = await import('@tauri-apps/api/event');
    if (typeof tauriListen === 'function') {
      listen = tauriListen;
      return listen;
    }
    return null;
  } catch (e) {
    console.warn('Failed to load Tauri event listener:', e);
    return null;
  }
}

// Rough estimate: about 200 KB per scanned page
export function estimatedScanSize(pageCount) {
  const sizeKB = pageCount * 200;
  if (sizeKB > 1024) return `${Math.round(sizeKB / 1024)} MB`;
  return `${sizeKB} KB`;
}

// Page scans of the scanned dictionaries, downloadable for offline use in
// the app; online only in a browser.
export default {
  name: 'ScannedDictionariesCard',
  components: { SettingsCard, UiButton, UiChip, UiIcon, UiProgress, UiTooltip },
  inject: ['snackbar'],
  data() {
    return {
      dictionaries: [],
      status: {},
      isAppMode: false,
      progressUnlisten: null,
    };
  },
  async created() {
    this.isAppMode = await isAppMode();
    await this.load();
    await this.listenForProgress();
  },
  unmounted() {
    this.progressUnlisten?.();
  },
  methods: {
    label(dictionary) {
      return dictionary.label.replace(' (scanned dictionary)', '');
    },
    estimatedSize: estimatedScanSize,
    async load() {
      this.dictionaries = getScannedDictionaries();
      for (const dictionary of this.dictionaries) {
        this.status[dictionary.scanId] = {
          downloaded: await isScanDownloaded(dictionary.scanId),
          downloading: false,
          progress: 0,
          error: null,
        };
      }
    },
    async listenForProgress() {
      const listenFn = await getTauriListen();
      if (!listenFn) return;
      this.progressUnlisten = await listenFn('scan-download-progress', (event) => {
        const { scan_id: scanId, percent } = event.payload;
        if (this.status[scanId]) {
          this.status[scanId] = { ...this.status[scanId], progress: Math.round(percent) };
        }
      });
    },
    async download(scanId) {
      this.status[scanId] = { ...this.status[scanId], downloading: true, progress: 0, error: null };
      try {
        await downloadScan(scanId);
        this.status[scanId] = { downloaded: true, downloading: false, progress: 100, error: null };
        this.snackbar.open('Download complete!');
      } catch (e) {
        this.status[scanId] = {
          ...this.status[scanId],
          downloading: false,
          progress: 0,
          error: e.message || 'Download failed',
        };
        this.snackbar.open(`Download failed: ${e.message || 'Unknown error'}`);
      }
    },
    async remove(scanId) {
      try {
        await deleteScan(scanId);
        this.status[scanId] = { downloaded: false, downloading: false, progress: 0, error: null };
        this.snackbar.open('Deleted successfully');
      } catch (e) {
        this.snackbar.open(`Delete failed: ${e.message || 'Unknown error'}`);
      }
    },
  },
};
</script>

<template>
  <settings-card
    v-if="dictionaries.length > 0"
    title="Scanned dictionaries"
    subtitle="Download for offline access"
    class="scanned-card"
    data-testid="scanned-card"
  >
    <div class="scanned-card__list">
      <div
        v-for="dictionary in dictionaries"
        :key="dictionary.scanId"
        class="scanned-row"
        :data-testid="'scan-' + dictionary.scanId"
      >
        <div class="scanned-row__text">
          <span class="scanned-row__name">{{ label(dictionary) }}</span>
          <span class="scanned-row__meta">
            {{ dictionary.pageCount }} pages ({{ estimatedSize(dictionary.pageCount) }})
          </span>
          <ui-progress
            v-if="status[dictionary.scanId]?.downloading"
            :value="status[dictionary.scanId]?.progress || 0"
            :label="'Downloading ' + label(dictionary)"
            class="scanned-row__progress"
          />
        </div>

        <span
          v-if="status[dictionary.scanId]?.downloading"
          class="scanned-row__percent"
          data-testid="scan-progress"
        >
          {{ status[dictionary.scanId]?.progress || 0 }}%
        </span>
        <ui-tooltip v-else-if="status[dictionary.scanId]?.downloaded" text="Delete download">
          <ui-button
            icon
            size="sm"
            variant="ghost"
            class="scanned-row__delete"
            :aria-label="'Delete download of ' + label(dictionary)"
            data-testid="scan-delete"
            @click="remove(dictionary.scanId)"
          >
            <ui-icon name="trash-2" :size="18" />
          </ui-button>
        </ui-tooltip>
        <ui-tooltip v-else-if="isAppMode" text="Download for offline">
          <ui-button
            icon
            size="sm"
            variant="ghost"
            :aria-label="'Download ' + label(dictionary) + ' for offline'"
            data-testid="scan-download"
            @click="download(dictionary.scanId)"
          >
            <ui-icon name="download" :size="18" />
          </ui-button>
        </ui-tooltip>
        <ui-chip v-else tone="neutral" outlined data-testid="scan-online-only">Online only</ui-chip>
      </div>
    </div>

    <p v-if="!isAppMode" class="scanned-card__note" data-testid="scan-web-note">
      Download for offline is only available in the desktop/mobile app.
    </p>
  </settings-card>
</template>

<style>
.scanned-card__list {
  display: flex;
  flex-direction: column;
}
.scanned-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 3.25rem;
  padding: var(--space-2) 0;
  border-top: 1px solid var(--soft);
}
.scanned-row__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.scanned-row__name {
  font-size: var(--text-body);
}
.scanned-row__meta {
  font-size: var(--text-sm);
  color: var(--muted);
}
.scanned-row__progress {
  margin-top: var(--space-1);
}
.scanned-row__percent {
  flex: none;
  width: var(--control-sm);
  text-align: right;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--accent);
}
.scanned-row__delete.ui-button--ghost { color: var(--muted); }
.scanned-row__delete.ui-button--ghost:hover:not(:disabled) { color: var(--danger-ink); background: var(--danger-soft); }
.scanned-card__note {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--muted);
}
</style>
