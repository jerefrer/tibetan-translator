<script>
import changelog from '../../../CHANGELOG.md?raw';
import UpdateService from '../../services/update-service';
import { renderReleaseNotes, releaseNotesFor } from '../../services/release-notes-markdown';
import { isTauri } from '../../config/platform';
import { writeToClipboard } from '../../services/copy-service';
import { FEEDBACK_ADDRESS, openFeedbackMail } from '../../services/feedback';
import '../../css/release-notes.css';
import { UiButton, UiDialog, UiIcon } from '../../ui';
import SettingsGroup from './SettingsGroup.vue';
import SettingsRow from './SettingsRow.vue';

// Settings' About group: Send feedback (everywhere), then, in the app only,
// the app version with the update check or restart, "What's new", and the
// credits. In a browser there is no version to show, so the group holds
// Send feedback alone.
export default {
  name: 'AboutCard',
  components: { SettingsGroup, SettingsRow, UiButton, UiDialog, UiIcon },
  inject: ['snackbar'],
  data() {
    return {
      appVersion: null,
      checkingForUpdates: false,
      dialogOpen: false,
      feedbackAddress: FEEDBACK_ADDRESS,
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
    async sendFeedback() {
      try {
        await openFeedbackMail();
      } catch (e) {
        // No mail client: the address is on the row, to copy
        this.snackbar.open('Could not open your mail app. Copy the address instead.');
        console.error('Opening the feedback mail failed:', e);
      }
    },
    async copyAddress() {
      try {
        await writeToClipboard(FEEDBACK_ADDRESS);
        this.snackbar.open('Address copied');
      } catch (e) {
        this.snackbar.open('Could not copy the address');
        console.error('Copying the feedback address failed:', e);
      }
    },
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
  <settings-group id="settings-about" title="About" class="about-card" data-testid="about-card">
    <settings-row v-if="appVersion" :title="versionLine" :description="versionState" icon="info">
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
      v-if="appVersion"
      :title="updateReady ? 'What’s new in v' + updateVersion : 'What’s new'"
      icon="sparkles"
      clickable
      data-testid="about-whats-new"
      @click="openNotes"
    />
    <settings-row
      title="Send feedback"
      icon="mail"
      :description="feedbackAddress"
      data-testid="about-feedback"
    >
      <ui-button variant="outline" size="sm" data-testid="about-feedback-send" @click="sendFeedback">
        Send email
      </ui-button>
      <ui-button variant="outline" size="sm" data-testid="about-feedback-copy" @click="copyAddress">
        Copy
      </ui-button>
    </settings-row>
    <settings-row
      v-if="appVersion"
      title="Dictionary data"
      icon="library"
      description="Collected and maintained by Christian Steinert (github.com/christiansteinert/tibetan-dictionary)"
      data-testid="about-credits"
    />

    <ui-dialog
      v-if="appVersion"
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
</style>
