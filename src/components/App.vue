<script>
import $ from "jquery";
import _ from "underscore";
import { useTheme } from "vuetify";

import db from "../services/sql-database";
import Storage from "../services/storage";
import EventHandlers from "../services/event-handlers";
import PackManager from "../services/pack-manager";
import { supportsModularPacks } from "../config/platform";

import { substituteLinksWithATags } from "../utils.js";
import SelectedTibetanEntriesPopup from "./SelectedTibetanEntriesPopup.vue";
import OnboardingScreen from "./OnboardingScreen.vue";
import DefinePageHelpDialogWithButton from "./DefinePageHelpDialogWithButton.vue";
import SearchPageHelpDialogWithButton from "./SearchPageHelpDialogWithButton.vue";
import TranslatePageHelpDialogWithButton from "./TranslatePageHelpDialogWithButton.vue";

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
    TranslatePageHelpDialogWithButton,
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
    };
  },
  computed: {
    isDark() {
      return this.theme.global.current.value.dark;
    },
    tabs() {
      return [
        { id: "define", name: "<u>D</u>efine" },
        { id: "search", name: "<u>S</u>earch" },
        // { id: "translate", name: "<u>T</u>ranslate" }, // Hidden for now - to be improved for mobile
        { id: "configure", name: "Confi<u>g</u>ure" },
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
            // } else if (event.key.toLowerCase() == "t") {
            //   event.preventDefault();
            //   vm.$router.push("/translate");
            } else if (event.key.toLowerCase() == "g") {
              event.preventDefault();
              vm.$router.push("/configure");
            }
          }
        },
      });
    },
    addListenerForAudioPlayback() {
      let currentAudio = null;
      let currentPlayer = null;

      const formatTime = (seconds) => {
        if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
      };

      const updateProgress = (player, audio) => {
        const fill = player.find(".audio-progress-fill");
        const handle = player.find(".audio-progress-handle");
        const timeDisplay = player.find(".audio-time");
        const percent = (audio.currentTime / audio.duration) * 100 || 0;
        fill.css("width", percent + "%");
        handle.css("left", percent + "%");
        timeDisplay.text(`${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`);
      };

      const showPlayIcon = (btn) => {
        btn.find(".play-icon").show();
        btn.find(".pause-icon").hide();
      };

      const showPauseIcon = (btn) => {
        btn.find(".play-icon").hide();
        btn.find(".pause-icon").show();
      };

      const stopCurrentAudio = () => {
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          if (currentPlayer) {
            showPlayIcon(currentPlayer.find(".audio-play-btn"));
            currentPlayer.find(".audio-progress-fill").css("width", "0%");
            currentPlayer.find(".audio-progress-handle").css("left", "0%");
          }
          currentAudio = null;
          currentPlayer = null;
        }
      };

      // Play/pause button click
      $(document).on("click", ".audio-play-btn", function(event) {
        const btn = $(this);
        const player = btn.closest(".audio-player");
        const audioPath = player.attr("data-audio");

        // If clicking on a different player, stop the current one
        if (currentPlayer && currentPlayer[0] !== player[0]) {
          stopCurrentAudio();
        }

        // If no audio or different audio, create new one
        if (!currentAudio || currentPlayer[0] !== player[0]) {
          currentAudio = new Audio(audioPath);
          currentPlayer = player;

          currentAudio.addEventListener("timeupdate", () => {
            updateProgress(player, currentAudio);
          });

          currentAudio.addEventListener("loadedmetadata", () => {
            updateProgress(player, currentAudio);
          });

          currentAudio.addEventListener("ended", () => {
            showPlayIcon(btn);
            currentAudio.currentTime = 0;
            updateProgress(player, currentAudio);
          });

          currentAudio.play().catch(err => {
            console.error("Audio playback failed:", err);
          });
          showPauseIcon(btn);
        } else {
          // Toggle play/pause on same audio
          if (currentAudio.paused) {
            currentAudio.play();
            showPauseIcon(btn);
          } else {
            currentAudio.pause();
            showPlayIcon(btn);
          }
        }
      });

      // Progress bar click/drag for seeking
      $(document).on("mousedown", ".audio-progress-bar", function(event) {
        const player = $(this).closest(".audio-player");
        if (!currentAudio || currentPlayer[0] !== player[0]) return;

        const progressBar = $(this);
        const seek = (e) => {
          const rect = progressBar[0].getBoundingClientRect();
          const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          currentAudio.currentTime = percent * currentAudio.duration;
          updateProgress(player, currentAudio);
        };

        seek(event);

        const onMouseMove = (e) => seek(e);
        const onMouseUp = () => {
          $(document).off("mousemove", onMouseMove);
          $(document).off("mouseup", onMouseUp);
        };

        $(document).on("mousemove", onMouseMove);
        $(document).on("mouseup", onMouseUp);
      });

      // Touch support for mobile
      $(document).on("touchstart", ".audio-progress-bar", function(event) {
        const player = $(this).closest(".audio-player");
        if (!currentAudio || currentPlayer[0] !== player[0]) return;

        const progressBar = $(this);
        const seek = (e) => {
          const touch = e.touches ? e.touches[0] : e;
          const rect = progressBar[0].getBoundingClientRect();
          const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
          currentAudio.currentTime = percent * currentAudio.duration;
          updateProgress(player, currentAudio);
        };

        seek(event.originalEvent);

        const onTouchMove = (e) => seek(e.originalEvent);
        const onTouchEnd = () => {
          $(document).off("touchmove", onTouchMove);
          $(document).off("touchend", onTouchEnd);
        };

        $(document).on("touchmove", onTouchMove);
        $(document).on("touchend", onTouchEnd);
      });
    }
  },
  async created() {
    this.initializeTheme();
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
  },
  mounted() {
    this.addListenerToOpenSnackbarOnAbbreviationClick();
    this.addListenerForDefinitionLinks();
    this.addListenersForKeyboardTabNavigation();
    this.addListenerForAudioPlayback();
  },
  unmounted() {
    EventHandlers.remove("tabs-shortcuts");
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
            :class="{ configure: tab.id == 'configure' }"
          >
            <div class="tab-content">
              <span v-html="tab.name"></span>
              <DefinePageHelpDialogWithButton v-if="tab.id == 'define'" />
              <SearchPageHelpDialogWithButton v-if="tab.id == 'search'" />
              <TranslatePageHelpDialogWithButton v-if="tab.id == 'translate'" />
            </div>

            <div>
              <v-slide-y-transition appear>
                <div
                  v-if="tab.id == 'translate' && currentTabId == 'translate'"
                  style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    display: flex;
                    justify-content: center;
                  "
                >
                  <v-chip
                    variant="flat"
                    size="x-small"
                    style="
                      text-transform: lowercase;
                      background: var(--yellow) !important;
                      color: var(--deep-red) !important;
                      border-radius: 0 0 2px 2px !important;
                    "
                  >
                    experimental
                  </v-chip>
                </div>
              </v-slide-y-transition>
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
