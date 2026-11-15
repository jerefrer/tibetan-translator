<script>
import changelog from '../../../CHANGELOG.md?raw';
import UpdateService from '../../services/update-service';
import { renderReleaseNotes, releaseNotesFor } from '../../services/release-notes-markdown';
import { isTauri } from '../../config/platform';
import { UiButton, UiDialog, UiIcon } from '../../ui';
import SettingsGroup from './SettingsGroup.vue';
import SettingsRow from './SettingsRow.vue';

// Settings' About group: the app version with the update check or restart,
// "What's new", and the credits. In the app only: renders nothing in a
// browser, where there is no version to show.
export default {
  name: 'AboutCard',
  components: { SettingsGroup, SettingsRow, UiButton, UiDialog, UiIcon },
  inject: ['snackbar'],
  data() {
    return {
      appVersion: null,
      checkingForUpdates: false,
      dialogOpen: false,
    };
  },
  computed: {
    updateReady() {
      return UpdateService.state.updateReady;
    },
    updateVersion() {
      return UpdateService.state.version;
    },
    updateDownloading() {
      return UpdateService.state.downloading;
    },
    updateProgress() {
      return UpdateService.state.downloadProgress;
    },
    // The downloaded update's notes when one waits for a restart, otherwise
    // this version's section of CHANGELOG.md.
    notesVersion() {
      return this.updateReady ? this.updateVersion : this.appVersion;
    },
    notesHtml() {
      const markdown = this.updateReady
        ? UpdateService.state.notes
        : releaseNotesFor(changelog, this.appVersion);
      return renderReleaseNotes(markdown);
    },
    versionLine() {
      if (this.updateReady) return `Version ${this.appVersion} → v${this.updateVersion} ready`;
      return `Tibetan Translator ${this.appVersion}`;
    },
    versionState() {
      if (this.updateReady) return 'Restart the app to install it';
      if (this.updateDownloading) return `Downloading the update, ${this.updateProgress}%`;
      return '';
    },
  },
  async created() {
    if (isTauri()) {
      this.appVersion = await UpdateService.getVersion();
    }
  },
  methods: {
    openNotes() {
      this.dialogOpen = true;
    },
    async checkForUpdates() {
      this.checkingForUpdates = true;
      try {
        const update = await UpdateService.checkOnly();
        if (update) {
          this.snackbar.open(`Update to v${update.version} available! Downloading...`);
          // The reactive state drives the button and the Settings dot
          await UpdateService.checkAndDownload((newVersion) => {
            this.snackbar.open(`Update to v${newVersion} ready! Will install on restart.`);
          });
        } else {
          this.snackbar.open("You're running the latest version!");
        }
      } catch (e) {
        this.snackbar.open('Failed to check for updates');
        console.error('Update check failed:', e);
      } finally {
        this.checkingForUpdates = false;
      }
    },
    async confirmRestart() {
      this.dialogOpen = false;
      await UpdateService.installAndRelaunch();
    },
  },
};
</script>

<template>
  <settings-group v-if="appVersion" id="settings-about" title="About" class="about-card" data-testid="about-card">
    <settings-row :title="versionLine" :description="versionState" icon="info">
      <ui-button v-if="updateReady" size="sm" data-testid="about-restart" @click="openNotes">
        <ui-icon name="rotate-cw" :size="15" />
        Restart to update
      </ui-button>
      <ui-button v-else-if="updateDownloading" variant="outline" size="sm" disabled data-testid="about-downloading">
        <ui-icon name="download" :size="15" />
        Downloading… {{ updateProgress }}%
      </ui-button>
      <ui-button
        v-else
        variant="outline"
        size="sm"
        :loading="checkingForUpdates"
        data-testid="about-check"
        @click="checkForUpdates"
      >
        <ui-icon name="refresh-cw" :size="15" />
        Check for updates
      </ui-button>
    </settings-row>
    <settings-row
      :title="updateReady ? 'What’s new in v' + updateVersion : 'What’s new'"
      icon="sparkles"
      clickable
      data-testid="about-whats-new"
      @click="openNotes"
    />
    <settings-row
      title="Dictionary data"
      icon="library"
      description="Collected and maintained by Christian Steinert (github.com/christiansteinert/tibetan-dictionary)"
      data-testid="about-credits"
    />

    <ui-dialog
      v-model="dialogOpen"
      :title="'What’s new in v' + notesVersion"
      :max-width="560"
    >
      <div v-if="notesHtml" class="release-notes" data-testid="release-notes" v-html="notesHtml" />
      <p v-else class="about-card__muted" data-testid="release-notes-empty">
        No release notes were published for this version.
      </p>
      <p v-if="updateReady" class="about-card__caption">
        The update is already downloaded and will be applied when the app restarts.
      </p>
      <template #actions>
        <template v-if="updateReady">
          <ui-button variant="ghost" data-testid="restart-later" @click="dialogOpen = false">Later</ui-button>
          <ui-button data-testid="restart-now" @click="confirmRestart"><ui-icon name="rotate-cw" :size="16" />Restart now</ui-button>
        </template>
        <ui-button v-else variant="ghost" data-testid="notes-close" @click="dialogOpen = false">Close</ui-button>
      </template>
    </ui-dialog>
  </settings-group>
</template>

<style>
.about-card__muted {
  margin: 0;
  color: var(--muted);
}
.about-card__caption {
  margin: var(--space-4) 0 0;
  font-size: var(--text-xs);
  color: var(--muted);
}

/* The dialog is teleported to <body>, so these are not nested in the card */
.release-notes {
  max-height: 50vh;
  overflow-y: auto;
}
.release-notes h4 {
  margin: var(--space-3) 0 var(--space-1);
  font-size: var(--text-base);
  font-weight: 600;
}
.release-notes h4:first-child {
  margin-top: 0;
}
.release-notes ul {
  margin: 0;
  padding-left: var(--space-5);
}
.release-notes li {
  font-size: var(--text-base);
  line-height: 1.5;
  margin-bottom: var(--space-1);
}
.release-notes p {
  font-size: var(--text-base);
  margin: 0 0 var(--space-2);
}
</style>
