<script>
import { getScanUrl, getScanInfo } from '../services/scan-service'

export default {
  props: {
    modelValue: Boolean,
    dictionaryId: String,
    initialPage: Number
  },
  emits: ['update:modelValue'],
  data() {
    return {
      currentPage: 1,
      loading: true,
      error: null,
      imageUrl: null,
      scanInfo: null,
      // Key to force image re-render on retry
      imageKey: 0,
      // Zoom state
      scale: 1,
      minScale: 1,
      maxScale: 4,
      // Touch/swipe state
      touchStartX: 0,
      touchStartY: 0,
      isSwiping: false,
      // Pinch zoom state
      initialPinchDistance: 0,
      initialScale: 1,
      isPinching: false,
      // Timeout for loading
      loadTimeout: null,
      // Platform detection
      isAndroid: /android/i.test(navigator.userAgent),
    }
  },
  computed: {
    dialog: {
      get() { return this.modelValue },
      set(value) { this.$emit('update:modelValue', value) }
    },
    canGoPrev() {
      return this.scanInfo && this.currentPage > this.scanInfo.min_page;
    },
    canGoNext() {
      return this.scanInfo && this.currentPage < this.scanInfo.max_page;
    },
    displayPageNum() {
      if (!this.scanInfo) return this.currentPage;
      return this.currentPage + (this.scanInfo.display_pageadjust || 0);
    },
    // Use width percentage instead of transform for proper scrolling
    imageStyle() {
      return {
        width: `${this.scale * 100}%`,
        maxWidth: 'none'
      };
    }
  },
  watch: {
    modelValue: {
      immediate: true,
      handler(isOpen) {
        if (isOpen) {
          this.scanInfo = getScanInfo(this.dictionaryId);
          this.currentPage = this.initialPage || this.scanInfo?.min_page || 1;
          this.scale = 1;
          this.loadImage();
        } else {
          // Clear timeout when closing
          this.clearLoadTimeout();
        }
      }
    },
    currentPage() {
      this.scale = 1; // Reset zoom on page change
      this.loadImage();
    }
  },
  methods: {
    clearLoadTimeout() {
      if (this.loadTimeout) {
        clearTimeout(this.loadTimeout);
        this.loadTimeout = null;
      }
    },
    async loadImage() {
      if (!this.scanInfo) return;

      // Clear any existing timeout
      this.clearLoadTimeout();

      // Reset state
      this.loading = true;
      this.error = null;

      // Clear URL first to force img element to reload
      this.imageUrl = null;

      // Increment key to force Vue to re-create the img element
      this.imageKey++;

      try {
        // Get the URL (with cache buster for retries on remote URLs)
        const baseUrl = await getScanUrl(this.scanInfo.scanId, this.currentPage);

        // Only add cache buster for remote URLs, not data URLs
        if (baseUrl.startsWith('data:')) {
          this.imageUrl = baseUrl;
        } else {
          const separator = baseUrl.includes('?') ? '&' : '?';
          this.imageUrl = `${baseUrl}${separator}_t=${Date.now()}`;
        }

        // Set a timeout in case the image never loads or errors
        this.loadTimeout = setTimeout(() => {
          if (this.loading) {
            this.loading = false;
            this.error = 'Image load timed out. Please retry.';
          }
        }, 30000); // 30 second timeout

      } catch (e) {
        this.loading = false;
        this.error = 'Failed to load scan image';
        console.error('Scan load error:', e);
      }
    },
    onImageLoad() {
      this.clearLoadTimeout();
      this.loading = false;
      this.error = null;
    },
    onImageError(e) {
      this.clearLoadTimeout();
      this.loading = false;
      this.error = 'Failed to load image. Please retry.';
      console.error('Image load error:', e);
    },
    retryLoad() {
      // Explicit retry with fresh state
      this.loadImage();
    },
    prevPage() {
      if (this.canGoPrev) {
        this.currentPage--;
      }
    },
    nextPage() {
      if (this.canGoNext) {
        this.currentPage++;
      }
    },
    close() {
      this.clearLoadTimeout();
      this.dialog = false;
    },
    // Zoom methods
    zoomIn() {
      this.scale = Math.min(this.scale * 1.5, this.maxScale);
    },
    zoomOut() {
      this.scale = Math.max(this.scale / 1.5, this.minScale);
    },
    resetZoom() {
      this.scale = 1;
    },
    // Touch handling - note: NOT using .passive so we can preventDefault
    onTouchStart(e) {
      if (e.touches.length === 1) {
        // Single touch - potential swipe
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.isSwiping = true;
        this.isPinching = false;
      } else if (e.touches.length === 2) {
        // Two finger touch - pinch zoom
        this.isSwiping = false;
        this.isPinching = true;
        this.initialPinchDistance = this.getPinchDistance(e.touches);
        this.initialScale = this.scale;
      }
    },
    onTouchMove(e) {
      if (e.touches.length === 2 && this.isPinching) {
        // Pinch zoom
        e.preventDefault(); // Prevent browser zoom
        e.stopPropagation();
        const currentDistance = this.getPinchDistance(e.touches);
        const scaleChange = currentDistance / this.initialPinchDistance;
        this.scale = Math.min(Math.max(this.initialScale * scaleChange, this.minScale), this.maxScale);
      }
    },
    onTouchEnd(e) {
      if (this.isSwiping && e.changedTouches.length === 1 && !this.isPinching) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const deltaX = touchEndX - this.touchStartX;
        const deltaY = touchEndY - this.touchStartY;

        // Only swipe if horizontal movement is dominant and significant
        // And only if not zoomed in
        if (this.scale === 1 && Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
          if (deltaX > 0) {
            this.prevPage();
          } else {
            this.nextPage();
          }
        }
      }
      this.isSwiping = false;
      this.isPinching = false;
    },
    getPinchDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    },
    handleKeydown(e) {
      if (!this.dialog) return;
      if (e.key === 'ArrowLeft') this.prevPage();
      else if (e.key === 'ArrowRight') this.nextPage();
      else if (e.key === 'Escape') this.close();
      else if (e.key === '+' || e.key === '=') this.zoomIn();
      else if (e.key === '-') this.zoomOut();
      else if (e.key === '0') this.resetZoom();
    }
  },
  mounted() {
    window.addEventListener('keydown', this.handleKeydown);
  },
  unmounted() {
    window.removeEventListener('keydown', this.handleKeydown);
    this.clearLoadTimeout();
  }
}
</script>

<template>
  <v-dialog
    v-model="dialog"
    fullscreen
    transition="dialog-bottom-transition"
  >
    <v-card class="scan-viewer" :class="{ 'is-android': isAndroid }">
      <!-- Toolbar - just close, page info, and zoom controls -->
      <div class="scan-toolbar">
        <v-btn icon variant="text" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>

        <span class="toolbar-title">Page {{ displayPageNum }}</span>

        <v-spacer></v-spacer>

        <!-- Zoom controls -->
        <v-btn icon variant="text" size="small" @click="zoomOut" :disabled="scale <= minScale">
          <v-icon size="small">mdi-minus</v-icon>
        </v-btn>

        <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>

        <v-btn icon variant="text" size="small" @click="zoomIn" :disabled="scale >= maxScale">
          <v-icon size="small">mdi-plus</v-icon>
        </v-btn>
      </div>

      <!-- Content area with touch handlers -->
      <div
        class="scan-content"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
      >
        <!-- Loading overlay -->
        <div v-if="loading" class="scan-loading">
          <v-progress-circular
            indeterminate
            color="white"
            size="64"
          ></v-progress-circular>
          <p class="mt-4 text-caption">Loading scan...</p>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="scan-error">
          <v-icon size="64" color="yellow">mdi-alert-circle</v-icon>
          <p class="mt-4">{{ error }}</p>
          <v-btn
            color="white"
            variant="outlined"
            class="mt-4"
            @click="retryLoad"
          >
            Retry
          </v-btn>
        </div>

        <!-- Image container - always render img so load/error events fire -->
        <div class="scan-image-wrapper" :class="{ 'visually-hidden': loading || error }">
          <img
            v-if="imageUrl"
            :key="imageKey"
            :src="imageUrl"
            @load="onImageLoad"
            @error="onImageError"
            class="scan-image"
            :style="imageStyle"
            alt="Dictionary scan"
          />
        </div>
      </div>

      <!-- Bottom Navigation - prev/next only here -->
      <div class="scan-footer">
        <v-btn
          variant="text"
          :disabled="!canGoPrev"
          @click="prevPage"
          class="flex-grow-1"
        >
          <v-icon start>mdi-chevron-left</v-icon>
          Previous
        </v-btn>

        <v-divider vertical></v-divider>

        <v-btn
          variant="text"
          :disabled="!canGoNext"
          @click="nextPage"
          class="flex-grow-1"
        >
          Next
          <v-icon end>mdi-chevron-right</v-icon>
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.scan-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  /* Red background everywhere - matches app theme */
  background: var(--deep-red, #A30000);
}

.scan-toolbar {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: 56px;
  padding: 0 8px;
  /* Safe area for landscape orientation */
  padding-left: max(8px, env(safe-area-inset-left, 0px));
  padding-right: max(8px, env(safe-area-inset-right, 0px));
  /* Safe area margin pushes toolbar below notch/status bar */
  margin-top: env(safe-area-inset-top, 0px);
  /* Red background like the rest of the app */
  background: var(--deep-red, #A30000);
  box-sizing: border-box;
}

.scan-toolbar .v-btn {
  color: white;
}

.scan-toolbar .v-btn:disabled {
  color: rgba(255, 255, 255, 0.4);
}

.toolbar-title {
  color: white;
  font-size: 1rem;
  font-weight: 500;
  margin-left: 8px;
}

.zoom-level {
  min-width: 50px;
  text-align: center;
  color: white;
  font-size: 0.85rem;
}

.scan-content {
  flex: 1;
  overflow: auto;
  /* Keep content area with neutral dark background for readability */
  background: #1a1a1a;
  position: relative;
  /* Prevent text selection */
  user-select: none;
  -webkit-user-select: none;
  /* Smooth scrolling on iOS */
  -webkit-overflow-scrolling: touch;
  /* Allow pan but prevent browser pinch zoom */
  touch-action: pan-x pan-y;
  /* Safe area for landscape orientation */
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}

.scan-loading,
.scan-error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  text-align: center;
  padding: 20px;
  z-index: 10;
  background: #1a1a1a;
}

.scan-image-wrapper {
  min-width: 100%;
  min-height: 100%;
  /* Space for footer including safe area */
  padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px));
  display: block;
}

/* Hide but keep in DOM so image loads */
.scan-image-wrapper.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.scan-image {
  /* Width controlled by imageStyle computed property */
  height: auto;
  display: block;
  /* Prevent drag */
  -webkit-user-drag: none;
  user-drag: none;
}

.scan-footer {
  position: fixed;
  bottom: env(safe-area-inset-bottom, 0px);
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  height: 56px;
  /* Red background like the toolbar */
  background: var(--deep-red, #A30000);
  /* iOS safe area for sides */
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  box-sizing: border-box;
}

/* Red fill below footer for safe area */
.scan-viewer::after {
  content: '';
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: env(safe-area-inset-bottom, 0px);
  background: var(--deep-red, #A30000);
  z-index: 1;
}

.scan-footer .v-btn {
  height: 56px;
  border-radius: 0;
  color: white;
}

.scan-footer .v-btn:disabled {
  color: rgba(255, 255, 255, 0.4);
}

.scan-footer .v-divider {
  border-color: rgba(255, 255, 255, 0.3);
}

/* Mobile specific */
@media (max-width: 600px) {
  .zoom-level {
    display: none;
  }
}

/* Android specific - status bar doesn't report via env() */
.scan-viewer.is-android .scan-toolbar {
  margin-top: 24px; /* Android status bar height */
}

.scan-viewer.is-android::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 24px;
  background: var(--deep-red, #A30000);
  z-index: 2;
}
</style>
