<script>
import {
  getAudioDictionaries,
  isAudioDownloaded,
  downloadAudio,
  deleteAudio,
} from '../../services/audio-service';
import { isTauri } from '../../config/platform';
import { UiButton, UiChip, UiIcon, UiProgress, UiTooltip } from '../../ui';
import SettingsCard from './SettingsCard.vue';

// Tauri event listener, loaded lazily so the browser build never imports it.
// Checks for the runtime itself, as the scanned dictionaries card does.
async function getTauriListen() {
  if (!window.__TAURI_INTERNALS__) return null;
  try {
    const { listen } = await import('@tauri-apps/api/event');
    return typeof listen === 'function' ? listen : null;
  } catch (e) {
    console.warn('Failed to load Tauri event listener:', e);
    return null;
  }
}

export function formatMegabytes(bytes) {
  return `${Math.round(bytes / 1048576)} MB`;
}

// Tauri rejects with the Rust error as a plain string
function errorMessage(e) {
  return (typeof e === 'string' ? e : e?.message) || 'Unknown error';
}

// Recordings of the dictionaries that have audio. They stream from GitHub;
// in the app each dictionary's set can be downloaded for offline listening.
// Rows share the look of the scanned dictionaries card (.scanned-row).
export default {
  name: 'AudioCard',
  components: { SettingsCard, UiButton, UiChip, UiIcon, UiProgress, UiTooltip },
  inject: ['snackbar'],
  data() {
    return {
      dictionaries: [],
      status: {},
      isAppMode: isTauri(),
      progressUnlisten: null,
    };
  },
  async created() {
    await this.load();
    await this.listenForProgress();
  },
  unmounted() {
    this.progressUnlisten?.();
  },
  methods: {
    formatMegabytes,
    meta(dictionary) {
      return `${dictionary.count.toLocaleString('en-US')} recordings (${formatMegabytes(dictionary.bytes)})`;
    },
    async load() {
      this.dictionaries = await getAudioDictionaries();
      for (const dictionary of this.dictionaries) {
        this.status[dictionary.audioId] = {
          downloaded: await isAudioDownloaded(dictionary.audioId),
          downloading: false,
          progress: 0,
        };
      }
    },
    async listenForProgress() {
      const listen = await getTauriListen();
      if (!listen) return;
      this.progressUnlisten = await listen('audio-download-progress', (event) => {
        const { audio_id: audioId, percent } = event.payload;
        if (this.status[audioId]) {
          this.status[audioId] = { ...this.status[audioId], progress: Math.round(percent) };
        }
      });
    },
    async download(audioId) {
      this.status[audioId] = { ...this.status[audioId], downloading: true, progress: 0 };
      try {
        await downloadAudio(audioId);
        this.status[audioId] = { downloaded: true, downloading: false, progress: 100 };
        this.snackbar.open('Download complete!');
      } catch (e) {
        this.status[audioId] = { ...this.status[audioId], downloading: false, progress: 0 };
        this.snackbar.open(`Download failed: ${errorMessage(e)}`);
      }
    },
    async remove(audioId) {
      try {
        await deleteAudio(audioId);
        this.status[audioId] = { downloaded: false, downloading: false, progress: 0 };
        this.snackbar.open('Deleted successfully');
      } catch (e) {
        this.snackbar.open(`Delete failed: ${errorMessage(e)}`);
      }
    },
  },
};
</script>

<template>
  <settings-card
    v-if="dictionaries.length > 0"
    title="Audio recordings"
    subtitle="Listen online, or download for offline"
    class="audio-card"
    data-testid="audio-card"
  >
    <div class="scanned-card__list">
      <div
        v-for="dictionary in dictionaries"
        :key="dictionary.audioId"
        class="scanned-row"
        :data-testid="'audio-' + dictionary.audioId"
      >
        <div class="scanned-row__text">
          <span class="scanned-row__name">{{ dictionary.label }}</span>
          <span class="scanned-row__meta">{{ meta(dictionary) }}</span>
          <ui-progress
            v-if="status[dictionary.audioId]?.downloading"
            :value="status[dictionary.audioId]?.progress || 0"
            :label="'Downloading ' + dictionary.label"
            class="scanned-row__progress"
          />
        </div>

        <span
          v-if="status[dictionary.audioId]?.downloading"
          class="scanned-row__percent"
          data-testid="audio-progress"
        >
          {{ status[dictionary.audioId]?.progress || 0 }}%
        </span>
        <ui-tooltip v-else-if="status[dictionary.audioId]?.downloaded" text="Delete download">
          <ui-button
            icon
            size="sm"
            variant="ghost"
            class="scanned-row__delete"
            :aria-label="'Delete downloaded recordings of ' + dictionary.label"
            data-testid="audio-delete"
            @click="remove(dictionary.audioId)"
          >
            <ui-icon name="trash-2" :size="18" />
          </ui-button>
        </ui-tooltip>
        <ui-tooltip v-else-if="isAppMode" text="Download for offline">
          <ui-button
            icon
            size="sm"
            variant="ghost"
            :aria-label="'Download recordings of ' + dictionary.label + ' for offline'"
            data-testid="audio-download"
            @click="download(dictionary.audioId)"
          >
            <ui-icon name="download" :size="18" />
          </ui-button>
        </ui-tooltip>
        <ui-chip v-else tone="neutral" outlined data-testid="audio-online-only">Online only</ui-chip>
      </div>
    </div>
  </settings-card>
</template>
