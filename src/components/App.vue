<script>
import $ from "jquery";
import _ from "underscore";

import db from "../services/sql-database";
import Storage from "../services/storage";
import EventHandlers from "../services/event-handlers";
import PackManager from "../services/pack-manager";
import GlobalLookup from "../services/global-lookup";
import UpdateService from "../services/update-service";
import AudioPlayerService from "../services/audio-player-service";
import ResizeService from "../services/resize-service";
import { supportsModularPacks } from "../config/platform";
import { shortcutPaths } from "../config/navigation";
import { initDocumentTheme } from "../services/theme";

import TibdictInstaller from "../services/tibdict-installer";
import { substituteLinksWithATags } from "../utils.js";
import SelectedTibetanEntriesPopup from "./SelectedTibetanEntriesPopup.vue";
import OnboardingScreen from "./OnboardingScreen.vue";
import DefinePageHelpDialogWithButton from "./DefinePageHelpDialogWithButton.vue";
import SearchPageHelpDialogWithButton from "./SearchPageHelpDialogWithButton.vue";
import SplitPageHelpDialogWithButton from "./SplitPageHelpDialogWithButton.vue";
import CustomPackConflictModal from "./CustomPackConflictModal.vue";
import AppNav from "./AppNav.vue";

import "@mdi/font/css/materialdesignicons.css";

import "../css/tokens.css";
import "../css/fonts.css";
import "../css/layout.css";
import "../css/tibetan.css";
import "../css/scrollbar.css";
import "../css/help-dialog.css";

if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

if (Storage.get("autoFillWords") == undefined)
  Storage.set("autoFillWords", true);

if (Storage.get("keepLongestOnly") == undefined)
  Storage.set("keepLongestOnly", true);

export default {
  components: {
    AppNav,
    SelectedTibetanEntriesPopup,
    OnboardingScreen,
    DefinePageHelpDialogWithButton,
    SearchPageHelpDialogWithButton,
    SplitPageHelpDialogWithButton,
    CustomPackConflictModal,
  },
  inject: ["snackbar"],
  data() {
    return {
      loading: true,
      showOnboarding: false,
      isMobile: ResizeService.isMobile(),
    };
  },
  computed: {
    tibdictInstallerState() {
      return TibdictInstaller.state;
    },
    currentTabId() {
      return _.compact(this.$route.path.split("/"))[0];
    },
    updateReady() {
      return UpdateService.state.updateReady;
    },
  },
  methods: {
    setupTibdictDragDrop() {
      if (!supportsModularPacks()) return;
      // Use HTML5 drop events so vuedraggable's internal drag-to-reorder keeps
      // working (Tauri's own dragDropEnabled=true would intercept HTML5 drags).
      const onDragOver = (e) => {
        if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
      };
      const onDrop = async (e) => {
        if (!e.dataTransfer?.files?.length) return;
        const files = Array.from(e.dataTransfer.files);
        const tibdicts = files.filter((f) => f.name.toLowerCase().endsWith('.tibdict'));
        if (!tibdicts.length) return;
        e.preventDefault();
        const sources = await Promise.all(
          tibdicts.map(async (f) => ({
            name: f.name,
            bytes: Array.from(new Uint8Array(await f.arrayBuffer())),
          }))
        );
        TibdictInstaller.installMany(sources);
      };
      window.addEventListener('dragover', onDragOver);
      window.addEventListener('drop', onDrop);
      this._tibdictUnlisten = () => {
        window.removeEventListener('dragover', onDragOver);
        window.removeEventListener('drop', onDrop);
      };
    },
    onTibdictConfirmReplace() {
      TibdictInstaller.confirmReplace();
    },
    onTibdictCancelReplace() {
      TibdictInstaller.cancelReplace();
    },
    async onOnboardingComplete() {
      this.showOnboarding = false;
      // Refresh terms list to include any newly downloaded packs
      await db.setAllTermsVariable();
    },
    initializeTheme() {
      // data-theme on <html> for the tokens, from the stored themePreference
      // (light, dark or system). Settings' Appearance card applies changes.
      initDocumentTheme();
    },
    initializeFontSize() {
      const fontSize = Storage.get('fontSize') || 100;
      document.documentElement.style.setProperty('--app-font-size', `${fontSize}%`);
      document.documentElement.style.fontSize = `${fontSize}%`;
    },
    openSnackbarWith(text) {
      var html = substituteLinksWithATags(text);
      this.snackbar.open(html);
    },
    addListenerToOpenSnackbarOnAbbreviationClick() {
      $(document).on("click", ".definition abbr", (event) => {
        var html = $(event.currentTarget).attr("data-title");
        var html = substituteLinksWithATags(html);
        this.snackbar.open(html);
      });
    },
    addListenerForDefinitionLinks() {
      var vm = this;
      $(document).on("click", ".definition a[href^='/define/']", function(event) {
        event.preventDefault();
        var href = $(this).attr("href");
        vm.$router.push(href);
      });
    },
    addListenersForKeyboardTabNavigation() {
      var vm = this;
      const paths = shortcutPaths();
      EventHandlers.add({
        id: "tabs-shortcuts",
        type: "keydown",
        callback(event) {
          // Support both Ctrl (Windows/Linux) and Cmd (Mac)
          if (event.ctrlKey || event.metaKey) {
            const path = paths[event.key.toLowerCase()];
            if (path) {
              event.preventDefault();
              vm.$router.push(path);
            }
          }
        },
      });
    },
    handleResize() {
      this.isMobile = ResizeService.isMobile();
    }
  },
  async created() {
    this.initializeTheme();
    this.initializeFontSize();
    window.SqlDatabase = db;

    // Route installer snackbar messages through the app-level snackbar.
    TibdictInstaller.setSnackbar((text) => this.snackbar.open(text));

    // For Tauri with modular packs, init pack manager and check if onboarding is needed
    if (supportsModularPacks()) {
      await PackManager.init();
      if (PackManager.shouldShowOnboarding()) {
        this.showOnboarding = true;
      }
    }

    // Init database (core pack is bundled, so always available)
    await db.init();
    this.loading = false;

    // Initialize global lookup (desktop only)
    // The popup window is handled by the global-lookup service itself
    if (GlobalLookup.isSupported()) {
      await GlobalLookup.initialize();
    }

    // Check for app updates silently (desktop only)
    // UpdateService handles platform checks internally
    UpdateService.checkAndDownload((newVersion) => {
      this.snackbar.open(
        `Update to v${newVersion} ready! Will install on restart.`
      );
    });
  },
  mounted() {
    this.addListenerToOpenSnackbarOnAbbreviationClick();
    this.addListenerForDefinitionLinks();
    this.addListenersForKeyboardTabNavigation();
    AudioPlayerService.initialize();
    ResizeService.subscribe('app', () => this.handleResize());
    this.setupTibdictDragDrop();
  },
  async unmounted() {
    EventHandlers.remove("tabs-shortcuts");
    ResizeService.unsubscribe('app');
    if (GlobalLookup.isSupported()) {
      await GlobalLookup.cleanup();
    }
    if (typeof this._tibdictUnlisten === 'function') {
      this._tibdictUnlisten();
      this._tibdictUnlisten = null;
    }
  },
};
</script>

<template>
  <v-app>
    <v-overlay
      :model-value="loading"
      persistent
      class="align-center justify-center"
      scrim="black"
    >
      <div class="d-flex flex-column align-center">
        <v-img
          src="/img/logo.png"
          width="100"
          class="mb-8"
          style="filter: brightness(0.25)"
        />
        <v-progress-circular
          indeterminate
          :width="10"
          :size="192"
          style="position: absolute; top: -48px; filter: brightness(0.25)"
        />
      </div>
    </v-overlay>

    <selected-tibetan-entries-popup />

    <onboarding-screen
      v-if="showOnboarding"
      @complete="onOnboardingComplete"
    />

    <v-snackbar v-model="snackbar.show">
      <div v-html="snackbar.content" />
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.close()"> Close </v-btn>
      </template>
    </v-snackbar>

    <!-- Using div instead of v-main to avoid Vuetify's --v-layout-top magic that causes iOS layout shifts -->
    <div
      v-if="!loading"
      class="app-shell"
      :class="isMobile ? 'app-shell--phone' : 'app-shell--desktop'"
    >
      <app-nav :is-mobile="isMobile" :update-ready="updateReady">
        <template #help>
          <DefinePageHelpDialogWithButton v-if="currentTabId == 'define'" />
          <SearchPageHelpDialogWithButton v-if="currentTabId == 'search'" />
          <SplitPageHelpDialogWithButton v-if="currentTabId == 'segment'" />
        </template>
      </app-nav>

      <div class="app-content">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" :key="currentTabId" />
          </keep-alive>
        </router-view>
      </div>
    </div>

    <!-- Rendered at the app level so drag-drop confirmation works on every page -->
    <CustomPackConflictModal
      :model-value="tibdictInstallerState.conflictOpen"
      :existing-manifest="tibdictInstallerState.existingManifest"
      :incoming-manifest="tibdictInstallerState.incomingManifest"
      @update:model-value="(v) => !v && onTibdictCancelReplace()"
      @confirm="onTibdictConfirmReplace"
      @cancel="onTibdictCancelReplace"
    />
  </v-app>
</template>

<style lang="stylus">
/* Entry styling now handled by EntriesEntry.vue scoped styles */
</style>
