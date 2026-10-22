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
import { initDocumentTheme, watchSystemTheme } from "../services/theme";

import TibdictInstaller from "../services/tibdict-installer";
import { substituteLinksWithATags } from "../utils.js";
import SelectedTibetanEntriesPopup from "./SelectedTibetanEntriesPopup.vue";
import OnboardingScreen from "./OnboardingScreen.vue";
import DefinePageHelpDialogWithButton from "./DefinePageHelpDialogWithButton.vue";
import SearchPageHelpDialogWithButton from "./SearchPageHelpDialogWithButton.vue";
import SplitPageHelpDialogWithButton from "./SplitPageHelpDialogWithButton.vue";
import CustomPackConflictModal from "./CustomPackConflictModal.vue";
import AppNav from "./AppNav.vue";
import { UiSpinner, UiToast } from "../ui";

import "../css/tokens.css";
import "../css/fonts.css";
import "../css/layout.css";
import "../css/tibetan.css";
import "../css/scrollbar.css";

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
    UiSpinner,
    UiToast,
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
      // (light, dark or system). Settings' Appearance card applies changes;
      // an OS theme change is followed here, whichever page is open.
      initDocumentTheme();
      this._unwatchSystemTheme = watchSystemTheme();
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
    this._unwatchSystemTheme?.();
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
  <div class="app">
    <transition name="ui-fade">
      <div v-if="loading" class="app-loading" data-testid="app-loading">
        <div class="app-loading__mark">
          <img src="/img/logo.png" width="100" height="100" alt="" class="app-loading__logo" />
          <ui-spinner :size="243" class="app-loading__spinner" />
        </div>
      </div>
    </transition>

    <selected-tibetan-entries-popup />

    <onboarding-screen
      v-if="showOnboarding"
      @complete="onOnboardingComplete"
    />

    <!-- Above the first-launch screen, so "Update ready" shows during onboarding -->
    <ui-toast v-model="snackbar.show">
      <div v-html="snackbar.content" />
    </ui-toast>

    <!-- inert while the first-launch screen covers it: no focus, no screen reader -->
    <div
      v-if="!loading"
      class="app-shell"
      :class="isMobile ? 'app-shell--phone' : 'app-shell--desktop'"
      :inert="showOnboarding"
      data-testid="app-shell"
    >
      <app-nav :is-mobile="isMobile" :update-ready="updateReady">
        <template #help>
          <DefinePageHelpDialogWithButton v-if="currentTabId == 'define'" />
          <SearchPageHelpDialogWithButton v-if="currentTabId == 'search'" />
          <SplitPageHelpDialogWithButton v-if="currentTabId == 'segment'" />
        </template>
      </app-nav>

      <main class="app-content">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" :key="currentTabId" />
          </keep-alive>
        </router-view>
      </main>
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
  </div>
</template>

<style>
/* Start-up overlay while the database loads: the logo inside a large ring. */
.app-loading {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}
/* Vuetify's scrim (black at 32%) over the background, as before */
[data-theme='dark'] .app-loading {
  background: color-mix(in srgb, var(--bg) 68%, black);
}
.app-loading__mark {
  position: relative;
  width: 100px;
  height: 100px;
  margin-bottom: 32px;
}
.app-loading__logo {
  display: block;
  width: 100px;
  height: 100px;
  filter: brightness(0.25);
}
/* A thin ring 192px across, centred 2px above the logo's centre */
.app-loading__spinner.ui-spinner {
  position: absolute;
  left: 50%;
  top: 48px;
  width: 243px !important;
  height: 243px !important;
  margin: -121.5px 0 0 -121.5px;
  color: var(--ink);
  filter: brightness(0.25);
}
[data-theme='light'] .app-loading__spinner.ui-spinner {
  color: var(--accent);
}
.app-loading__spinner circle,
.app-loading__spinner path {
  stroke-width: 0.99;
}
.app-loading__spinner circle {
  stroke: var(--ink);
  stroke-opacity: 0.12;
}
</style>
