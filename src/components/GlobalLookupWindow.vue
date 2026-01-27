<script>
import _ from 'underscore';
import TibetanRegExps from 'tibetan-regexps';
import { useTheme } from 'vuetify';

import Entries from './Entries.vue';
import TibetanTextField from './TibetanTextField.vue';
import Storage from '../services/storage';

export default {
  components: {
    Entries,
    TibetanTextField,
  },
  setup() {
    const theme = useTheme();
    return { theme };
  },
  data() {
    return {
      searchTerm: '',
      selectedTerm: null,
      selectedTermIndex: 0,
      entries: [],
      initializing: true,
      displayedTermsCount: 50,
      termsBatchSize: 50,
      loadingEntries: false,
      allTerms: [],
    };
  },
  computed: {
    isDark() {
      return this.theme.global.current.value.dark;
    },
    termsStartingWithSearchTerm() {
      if (!this.searchTerm) return [];
      return this.allTerms
        .filter((key) => key.indexOf(this.searchTerm) == 0)
        .sort();
    },
    visibleTerms() {
      return this.termsStartingWithSearchTerm.slice(0, this.displayedTermsCount);
    },
    hasMoreTerms() {
      return this.displayedTermsCount < this.termsStartingWithSearchTerm.length;
    },
    numberOfTerms() {
      return this.termsStartingWithSearchTerm.length;
    },
  },
  watch: {
    searchTerm(newVal) {
      console.log('[GlobalLookupWindow] searchTerm changed to:', newVal);
      this.displayedTermsCount = this.termsBatchSize;
      this.selectedTermIndex = 0;
      // Clear stale entries if selected term is no longer in the filtered list
      if (this.selectedTerm && this.termsStartingWithSearchTerm.indexOf(this.selectedTerm) === -1) {
        this.entries = [];
        this.selectedTerm = null;
      }
      // Auto-select first term immediately when search changes
      this.$nextTick(() => {
        this.selectTermByIndex(0, true);
      });
    },
  },
  methods: {
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
      document.documentElement.classList.remove('theme--dark', 'theme--light');
      document.documentElement.classList.add(`theme--${actualTheme}`);
    },
    cleanTibetanText(text) {
      if (!text) return '';
      let cleaned = text
        .replace(TibetanRegExps.anythingNonTibetan, '')
        .replace(TibetanRegExps.beginningPunctuation, '');
      // Replace any trailing punctuation with a single tsheg
      cleaned = cleaned.replace(/[་།༑༔]*$/, '་');
      return cleaned;
    },
    async selectTermByIndex(index, immediate = false) {
      const terms = this.termsStartingWithSearchTerm;
      if (index < 0 || index >= terms.length) return;

      this.selectedTermIndex = index;
      const term = terms[index];
      if (!term) return;

      this.selectedTerm = term;
      this.loadingEntries = true;

      try {
        this.entries = await this.getEntriesForTerm(term);
      } catch (error) {
        console.error('Error fetching entries:', error);
        this.entries = [];
      } finally {
        this.loadingEntries = false;
      }

      // Scroll selected term into view
      this.$nextTick(() => {
        const termEl = this.$refs.termsList?.querySelector('.term-item.active');
        if (termEl) {
          termEl.scrollIntoView({ block: 'nearest', behavior: immediate ? 'auto' : 'smooth' });
        }
      });
    },
    async selectTerm(term) {
      const index = this.termsStartingWithSearchTerm.indexOf(term);
      if (index !== -1) {
        await this.selectTermByIndex(index);
      }
    },
    async getEntriesForTerm(term) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke('pack_get_entries_for_term', { term });
      } catch (error) {
        console.error('[GlobalLookupWindow] Error getting entries via IPC:', error);
        const SqlDatabase = await import('../services/sql-database');
        return await SqlDatabase.default.getEntriesFor(term);
      }
    },
    async readClipboardAndSetSearch() {
      try {
        const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
        const text = await readText();
        console.log('[GlobalLookupWindow] Clipboard text:', text);
        if (text) {
          const cleanedText = this.cleanTibetanText(text);
          console.log('[GlobalLookupWindow] Cleaned text:', cleanedText);
          if (cleanedText) {
            this.searchTerm = cleanedText;
          }
        }
      } catch (err) {
        console.error('[GlobalLookupWindow] Error reading clipboard:', err);
      }
    },
    loadMoreTerms() {
      if (this.hasMoreTerms) {
        this.displayedTermsCount += this.termsBatchSize;
      }
    },
    async close() {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        // Use the custom hide_lookup_panel command which uses NSPanel's orderOut
        // This hides the panel without affecting focus, allowing the previously
        // active app to remain in focus
        await invoke('hide_lookup_panel');
      } catch (err) {
        console.error('Error closing window:', err);
        // Fallback to regular window hide
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().hide();
        } catch (e) {
          console.error('Fallback hide also failed:', e);
        }
      }
    },
    handleKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.close();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        // Navigate through terms
        this.selectTermByIndex(this.selectedTermIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        // Navigate through terms
        this.selectTermByIndex(this.selectedTermIndex - 1);
      }
    },
    async startDrag(event) {
      // Manual window dragging since data-tauri-drag-region doesn't work reliably
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const currentWindow = getCurrentWindow();
        await currentWindow.startDragging();
      } catch (err) {
        console.error('Error starting drag:', err);
      }
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
        const fill = player.querySelector(".audio-progress-fill");
        const handle = player.querySelector(".audio-progress-handle");
        const timeDisplay = player.querySelector(".audio-time");
        const percent = (audio.currentTime / audio.duration) * 100 || 0;
        if (fill) fill.style.width = percent + "%";
        if (handle) handle.style.left = percent + "%";
        if (timeDisplay) timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
      };

      const showPlayIcon = (btn) => {
        const playIcon = btn.querySelector(".play-icon");
        const pauseIcon = btn.querySelector(".pause-icon");
        if (playIcon) playIcon.style.display = "";
        if (pauseIcon) pauseIcon.style.display = "none";
      };

      const showPauseIcon = (btn) => {
        const playIcon = btn.querySelector(".play-icon");
        const pauseIcon = btn.querySelector(".pause-icon");
        if (playIcon) playIcon.style.display = "none";
        if (pauseIcon) pauseIcon.style.display = "";
      };

      const stopCurrentAudio = () => {
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          if (currentPlayer) {
            showPlayIcon(currentPlayer.querySelector(".audio-play-btn"));
            const fill = currentPlayer.querySelector(".audio-progress-fill");
            const handle = currentPlayer.querySelector(".audio-progress-handle");
            if (fill) fill.style.width = "0%";
            if (handle) handle.style.left = "0%";
          }
          currentAudio = null;
          currentPlayer = null;
        }
      };

      // Play/pause button click
      document.addEventListener("click", (event) => {
        const btn = event.target.closest(".audio-play-btn");
        if (!btn) return;

        const player = btn.closest(".audio-player");
        if (!player) return;

        const audioPath = player.getAttribute("data-audio");

        // If clicking on a different player, stop the current one
        if (currentPlayer && currentPlayer !== player) {
          stopCurrentAudio();
        }

        // If no audio or different audio, create new one
        if (!currentAudio || currentPlayer !== player) {
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
      document.addEventListener("mousedown", (event) => {
        const progressBar = event.target.closest(".audio-progress-bar");
        if (!progressBar) return;

        const player = progressBar.closest(".audio-player");
        if (!currentAudio || currentPlayer !== player) return;

        const seek = (e) => {
          const rect = progressBar.getBoundingClientRect();
          const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          currentAudio.currentTime = percent * currentAudio.duration;
          updateProgress(player, currentAudio);
        };

        seek(event);

        const onMouseMove = (e) => seek(e);
        const onMouseUp = () => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });

      // Touch support for mobile
      document.addEventListener("touchstart", (event) => {
        const progressBar = event.target.closest(".audio-progress-bar");
        if (!progressBar) return;

        const player = progressBar.closest(".audio-player");
        if (!currentAudio || currentPlayer !== player) return;

        const seek = (e) => {
          const touch = e.touches ? e.touches[0] : e;
          const rect = progressBar.getBoundingClientRect();
          const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
          currentAudio.currentTime = percent * currentAudio.duration;
          updateProgress(player, currentAudio);
        };

        seek(event);

        const onTouchMove = (e) => seek(e);
        const onTouchEnd = () => {
          document.removeEventListener("touchmove", onTouchMove);
          document.removeEventListener("touchend", onTouchEnd);
        };

        document.addEventListener("touchmove", onTouchMove);
        document.addEventListener("touchend", onTouchEnd);
      }, { passive: true });
    },
  },
  async created() {
    this.initializeTheme();

    // Load allTerms via Tauri IPC
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      console.log('[GlobalLookupWindow] Loading allTerms via Tauri IPC...');

      if (typeof window.__TAURI__ === 'undefined' && typeof window.__TAURI_INTERNALS__ === 'undefined') {
        console.error('[GlobalLookupWindow] Tauri not available!');
        this.initializing = false;
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      this.allTerms = await invoke('pack_get_all_terms');
      console.log('[GlobalLookupWindow] Loaded', this.allTerms.length, 'terms via IPC');
    } catch (err) {
      console.error('[GlobalLookupWindow] Error loading terms via IPC:', err);
    }
    this.initializing = false;

    // Read clipboard and immediately show definition
    await this.readClipboardAndSetSearch();
  },
  async mounted() {
    document.addEventListener('keydown', this.handleKeydown);
    this.addListenerForAudioPlayback();

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');
      const currentWindow = getCurrentWindow();

      // Configure window for fullscreen overlay on macOS
      try {
        await invoke('configure_window_for_fullscreen');
        console.log('[GlobalLookupWindow] Configured for fullscreen overlay');
      } catch (err) {
        console.log('[GlobalLookupWindow] Fullscreen config not available:', err);
      }

      // Listen for panel-shown event from Rust to refresh clipboard
      // This is more reliable than onFocusChanged for NSPanel windows
      this._unlistenPanelShown = await listen('panel-shown', async () => {
        console.log('[GlobalLookupWindow] Panel shown event received, re-reading clipboard');
        await this.readClipboardAndSetSearch();
      });

      // Also listen for focus changes as a fallback
      this._unlistenFocus = await currentWindow.onFocusChanged(async ({ payload: focused }) => {
        if (focused) {
          console.log('[GlobalLookupWindow] Window focused, re-reading clipboard');
          await this.readClipboardAndSetSearch();
        }
      });
    } catch (err) {
      console.error('[GlobalLookupWindow] Error setting up listeners:', err);
    }
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
    if (this._unlistenPanelShown) {
      this._unlistenPanelShown();
    }
    if (this._unlistenFocus) {
      this._unlistenFocus();
    }
  }
};
</script>

<template>
  <v-app class="lookup-window">
    <div class="lookup-container" :class="{ 'theme--dark': isDark }">
      <!-- Top drag bar -->
      <div class="drag-bar" @mousedown="startDrag">
        <span class="drag-dots">&#8943;&#8943;&#8943;</span>
      </div>

      <!-- Search bar -->
      <div class="search-bar">
        <TibetanTextField
          ref="input"
          density="compact"
          variant="plain"
          autofocus
          clearable
          hide-details
          v-model="searchTerm"
          placeholder="Type or paste Tibetan"
          class="flex-grow-1"
          @click:clear="searchTerm = ''"
        />
        <v-btn
          icon
          variant="text"
          size="small"
          @click="close"
          class="ml-1 close-btn"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>

      <!-- Content area -->
      <div class="content-area">
        <!-- Loading state -->
        <div v-if="initializing" class="flex-centered">
          <v-progress-circular indeterminate size="48" />
        </div>

        <template v-else>
          <!-- Split view: Terms on left, Definitions on right -->
          <div class="split-view">
            <!-- Terms list (always visible) -->
            <div class="terms-panel">
              <div v-if="visibleTerms.length" class="terms-header text-caption text-grey px-3 py-1">
                {{ numberOfTerms }} term{{ numberOfTerms !== 1 ? 's' : '' }}
              </div>
              <div v-if="visibleTerms.length" class="terms-scroll" ref="termsList">
                <div
                  v-for="(term, index) in visibleTerms"
                  :key="term"
                  class="term-item tibetan"
                  :class="{
                    'active bg-primary': selectedTermIndex === index,
                    'text-white': selectedTermIndex === index && !isDark,
                  }"
                  @click="selectTermByIndex(index)"
                >
                  {{ term }}
                </div>
                <div v-if="hasMoreTerms" class="load-more-sentinel">
                  <v-btn variant="text" size="small" @click="loadMoreTerms">
                    Load more...
                  </v-btn>
                </div>
              </div>
              <div v-else-if="searchTerm" class="flex-centered no-results">
                <v-icon size="32" color="grey" class="mb-1">mdi-book-search-outline</v-icon>
                <div class="text-body-2">No terms found</div>
              </div>
              <div v-else class="flex-centered instructions">
                <v-icon size="32" color="grey" class="mb-1">mdi-clipboard-text-search-outline</v-icon>
                <div class="text-body-2">Copy Tibetan text</div>
              </div>
            </div>

            <!-- Definitions panel (always visible) -->
            <div class="definitions-panel">
              <div v-if="loadingEntries" class="flex-centered">
                <v-progress-circular indeterminate size="32" />
              </div>
              <div v-else-if="entries.length" class="entries-scroll" ref="entriesScroll">
                <Entries :entries="entries" />
              </div>
              <div v-else-if="selectedTerm" class="flex-centered no-results">
                <v-icon size="32" color="grey" class="mb-1">mdi-book-search-outline</v-icon>
                <div class="text-body-2">No definitions for "{{ selectedTerm }}"</div>
              </div>
              <div v-else class="flex-centered instructions">
                <v-icon size="32" color="grey" class="mb-1">mdi-arrow-left</v-icon>
                <div class="text-body-2">Select a term</div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Footer -->
      <div class="popup-footer text-center text-caption text-grey">
        <kbd>Esc</kbd> close · <kbd>↑</kbd><kbd>↓</kbd> navigate terms
      </div>
    </div>
  </v-app>
</template>

<style lang="stylus">
html, body
  margin: 0
  padding: 0
  overflow: hidden

.lookup-window
  background: transparent !important

  .v-application__wrap
    min-height: 100vh !important

.lookup-container
  height: 100vh
  display: flex
  flex-direction: column
  background: #ffffff
  overflow: hidden

  &.theme--dark
    background: #1e1e1e

.drag-bar
  height: 14px
  background: rgba(128, 128, 128, 0.15)
  cursor: grab
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0
  user-select: none

  &:active
    cursor: grabbing
    background: rgba(128, 128, 128, 0.25)

  .drag-dots
    color: rgba(128, 128, 128, 0.5)
    font-size: 10px
    letter-spacing: 2px
    line-height: 1
    user-select: none
    pointer-events: none

.search-bar
  display: flex
  align-items: center
  padding: 8px 12px
  border-bottom: 1px solid rgba(128, 128, 128, 0.2)
  flex-shrink: 0

  .v-input
    background: transparent !important
    cursor: text

  .v-field
    background: transparent !important

  .v-field__input
    font-size: 20px !important
    font-family: "DDC_Uchen" !important
    padding: 0 8px !important

  .v-field__input::placeholder
    font-family: "Segoe UI", "Roboto", sans-serif !important
    font-size: 14px !important
    opacity: 0.5

  .close-btn
    cursor: pointer

.content-area
  flex: 1
  overflow: hidden
  display: flex
  flex-direction: column
  min-height: 0

.split-view
  flex: 1
  display: flex
  overflow: hidden
  min-height: 0

.terms-panel
  display: flex
  flex-direction: column
  overflow: hidden
  border-right: 1px solid rgba(128, 128, 128, 0.2)
  width: 40%
  min-width: 150px
  max-width: 250px

.definitions-panel
  flex: 1
  display: flex
  flex-direction: column
  overflow: hidden
  min-width: 0

.terms-header
  flex-shrink: 0
  border-bottom: 1px solid rgba(128, 128, 128, 0.1)

.terms-scroll
  flex: 1
  overflow-y: auto
  min-height: 0

.entries-scroll
  flex: 1
  overflow-y: auto
  min-height: 0
  padding: 12px

.term-item
  padding: 8px 12px
  font-size: 16px
  cursor: pointer
  border-bottom: 1px solid rgba(128, 128, 128, 0.1)
  transition: background 0.15s ease
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis

  &:hover
    background: rgba(128, 128, 128, 0.1)

  &.active
    &:hover
      background: var(--v-theme-primary)

.load-more-sentinel
  display: flex
  justify-content: center
  padding: 8px

.flex-centered
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  flex: 1
  min-height: 100px
  text-align: center
  padding: 12px

.no-results, .instructions
  color: rgba(128, 128, 128, 0.8)

.popup-footer
  flex-shrink: 0
  padding: 4px 12px
  border-top: 1px solid rgba(128, 128, 128, 0.2)
  background: rgba(128, 128, 128, 0.05)

  kbd
    background: rgba(128, 128, 128, 0.2)
    border-radius: 3px
    padding: 1px 5px
    font-family: monospace
    font-size: 11px
</style>
