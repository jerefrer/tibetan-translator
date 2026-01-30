<script>
import $ from "jquery";
import _ from "underscore";
import { useTheme } from "vuetify";

import db from "../services/sql-database";
import Storage from "../services/storage";
import EventHandlers from "../services/event-handlers";
import PackManager from "../services/pack-manager";
import GlobalLookup from "../services/global-lookup";
import UpdateService from "../services/update-service";
import AudioPlayerService from "../services/audio-player-service";
import ResizeService from "../services/resize-service";
import { supportsModularPacks } from "../config/platform";

import { substituteLinksWithATags } from "../utils.js";
import SelectedTibetanEntriesPopup from "./SelectedTibetanEntriesPopup.vue";
import OnboardingScreen from "./OnboardingScreen.vue";
import DefinePageHelpDialogWithButton from "./DefinePageHelpDialogWithButton.vue";
import SearchPageHelpDialogWithButton from "./SearchPageHelpDialogWithButton.vue";
import SplitPageHelpDialogWithButton from "./SplitPageHelpDialogWithButton.vue";

import "@mdi/font/css/materialdesignicons.css";

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
    SelectedTibetanEntriesPopup,
    OnboardingScreen,
    DefinePageHelpDialogWithButton,
    SearchPageHelpDialogWithButton,
    SplitPageHelpDialogWithButton,
  },
  inject: ["snackbar"],
  setup() {
    const theme = useTheme();
    return { theme };
  },
  watch: {
    'theme.global.current.value.dark'(value) {
      this.updateHtmlThemeClass();
    },
  },
  data() {
    return {
      loading: true,
      showOnboarding: false,
      isMobile: ResizeService.isMobile(),
    };
  },
  computed: {
    isDark() {
      return this.theme.global.current.value.dark;
    },
    tabs() {
      return [
        { id: "define", name: "<u>D</u>efine", mobileName: "Define" },
        { id: "search", name: "<u>S</u>earch", mobileName: "Search" },
        { id: "segment", name: "Spli<u>t</u>", mobileName: "Split" },
        { id: "settings", name: "Settin<u>g</u>s", mobileName: "", icon: "mdi-cog" },
      ];
    },
    currentTabId() {
      return _.compact(this.$route.path.split("/"))[0];
    },
    tabIndex() {
      return this.tabs.findIndex((tab) => tab.id == this.currentTabId);
    },
  },
  methods: {
    async onOnboardingComplete() {
      this.showOnboarding = false;
      // Refresh terms list to include any newly downloaded packs
      await db.setAllTermsVariable();
    },
    initializeTheme() {
      const preference = Storage.get('themePreference') || 'system';
      let actualTheme;
      if (preference === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        actualTheme = prefersDark ? 'dark' : 'light';
      } else {
        actualTheme = preference;
      }
      this.theme.global.name.value = actualTheme;
    },
    initializeFontSize() {
      const fontSize = Storage.get('fontSize') || 100;
      document.documentElement.style.setProperty('--app-font-size', `${fontSize}%`);
      document.documentElement.style.fontSize = `${fontSize}%`;
    },
    updateHtmlThemeClass() {
      $("html")
        .removeClass("theme--dark")
        .removeClass("theme--light")
        .addClass("theme--" + (this.isDark ? "dark" : "light"));
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
      EventHandlers.add({
        id: "tabs-shortcuts",
        type: "keydown",
        callback(event) {
          // Support both Ctrl (Windows/Linux) and Cmd (Mac)
          if (event.ctrlKey || event.metaKey) {
            if (event.key.toLowerCase() == "d") {
              event.preventDefault();
              vm.$router.push("/define");
            } else if (event.key.toLowerCase() == "s") {
              event.preventDefault();
              vm.$router.push("/search");
            } else if (event.key.toLowerCase() == "t") {
              event.preventDefault();
              vm.$router.push("/segment");
            } else if (event.key.toLowerCase() == "g") {
              event.preventDefault();
              vm.$router.push("/settings");
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
    this.updateHtmlThemeClass();
    window.SqlDatabase = db;

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
  },
  async unmounted() {
    EventHandlers.remove("tabs-shortcuts");
    ResizeService.unsubscribe('app');
    if (GlobalLookup.isSupported()) {
      await GlobalLookup.cleanup();
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
    <div v-if="!loading" class="app-layout">
      <div class="main-navbar">
        <v-tabs grow :model-value="tabIndex" height="63">
          <v-tab
            v-for="tab in tabs"
            :key="tab.id"
            :to="'/' + tab.id"
            :value="tabs.indexOf(tab)"
            :class="{ settings: tab.id == 'settings' }"
          >
            <div class="tab-content">
              <!-- Mobile: show icon for settings, plain text for others -->
              <template v-if="isMobile">
                <v-icon v-if="tab.icon">{{ tab.icon }}</v-icon>
                <span v-else>{{ tab.mobileName }}</span>
              </template>
              <!-- Desktop: show name with underlined shortcut key -->
              <span v-else v-html="tab.name"></span>
              <DefinePageHelpDialogWithButton v-if="tab.id == 'define' && currentTabId == 'define'" />
              <SearchPageHelpDialogWithButton v-if="tab.id == 'search' && currentTabId == 'search'" />
              <SplitPageHelpDialogWithButton v-if="tab.id == 'segment' && currentTabId == 'segment'" />
            </div>

          </v-tab>
        </v-tabs>
      </div>

      <div class="app-content">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" :key="currentTabId" />
          </keep-alive>
        </router-view>
      </div>
    </div>
  </v-app>
</template>

<style lang="stylus">
/* Entry styling now handled by EntriesEntry.vue scoped styles */
</style>
