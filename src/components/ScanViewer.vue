<script>
import { DialogRoot, DialogPortal, DialogContent, DialogTitle, DialogDescription } from 'reka-ui'
import { UiIcon, UiSpinner } from '../ui'
import { getScanUrl, getScanInfo } from '../services/scan-service'
import DICTIONARIES_DETAILS from '../services/dictionaries-details'

// Full-screen viewer for a scanned dictionary page (board "B · Scan viewer").
// It always sits on a dark surface, whatever the theme, so the page stands out.
export default {
  components: { DialogRoot, DialogPortal, DialogContent, DialogTitle, DialogDescription, UiIcon, UiSpinner },
  props: {
    modelValue: Boolean,
    dictionaryId: String,
    initialPage: Number,
    // The stored page number is a guess (it carried a "?")
    approximate: { type: Boolean, default: false }
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
      return !!this.scanInfo && this.currentPage > this.scanInfo.min_page;
    },
    canGoNext() {
      return !!this.scanInfo && this.currentPage < this.scanInfo.max_page;
    },
    displayPageNum() {
      if (!this.scanInfo) return this.currentPage;
      return this.currentPage + (this.scanInfo.display_pageadjust || 0);
    },
    // "Jäschke (scanned dictionary)" -> "Jäschke"
    dictionaryName() {
      const label = DICTIONARIES_DETAILS[this.dictionaryId]?.label || '';
      return label
        .replace(/\s*\(scanned dictionary\)$/i, '')
        .replace(/,\s*scanned dictionary\)$/i, ')')
        .trim();
    },
    title() {
      const page = `Page ${this.displayPageNum}`;
      return this.dictionaryName ? `${this.dictionaryName} · ${page}` : page;
    },
    // Only the page the entry pointed to is a guess
    showApproximate() {
      return this.approximate && this.currentPage === this.initialPage;
    },
    zoomPercent() {
      return Math.round(this.scale * 100);
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
    // Focus the viewer itself rather than its first button (no ring on the
    // close button at open), so Tab stays inside it and Escape reaches it
    focusViewer(event) {
      event.preventDefault();
      event.target?.focus?.({ preventScroll: true });
    },
    handleKeydown(e) {
      if (!this.dialog) return;
      if (e.key === 'ArrowLeft') this.prevPage();
      else if (e.key === 'ArrowRight') this.nextPage();
      // Escape is handled by the dialog itself
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
  <dialog-root :open="dialog" @update:open="dialog = $event">
    <dialog-portal>
      <dialog-content
        class="scan-viewer"
        :class="{ 'is-android': isAndroid }"
        data-testid="scan-viewer"
        @open-auto-focus="focusViewer"
      >
        <div class="scan-toolbar">
          <button type="button" class="scan-icon-button scan-close" aria-label="Close" data-testid="scan-close" @click="close">
            <ui-icon name="x" :size="22" :stroke-width="2" />
          </button>

          <div class="scan-heading">
            <dialog-title class="scan-title" data-testid="scan-title">{{ title }}</dialog-title>
            <dialog-description v-if="showApproximate" class="scan-approximate" data-testid="scan-approximate">
              approximate
            </dialog-description>
            <dialog-description v-else class="scan-hidden-description">Scanned dictionary page</dialog-description>
          </div>

          <span class="scan-spacer" />

          <button
            type="button"
            class="scan-icon-button scan-icon-button--bordered"
            aria-label="Zoom out"
            data-testid="scan-zoom-out"
            :disabled="scale <= minScale"
            @click="zoomOut"
          >
            <ui-icon name="minus" :size="20" :stroke-width="2" />
          </button>
          <span class="zoom-level" data-testid="scan-zoom">{{ zoomPercent }}%</span>
          <button
            type="button"
            class="scan-icon-button scan-icon-button--bordered"
            aria-label="Zoom in"
            data-testid="scan-zoom-in"
            :disabled="scale >= maxScale"
            @click="zoomIn"
          >
            <ui-icon name="plus" :size="20" :stroke-width="2" />
          </button>
        </div>

        <div class="scan-stage">
          <button
            type="button"
            class="scan-nav-button scan-nav-button--side"
            data-testid="scan-prev"
            :disabled="!canGoPrev"
            @click="prevPage"
          >
            <ui-icon name="chevron-left" :size="18" :stroke-width="2.2" />
            Previous
          </button>

          <!-- Content area with touch handlers -->
          <div
            class="scan-content"
            @touchstart="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
          >
            <div v-if="loading" class="scan-loading" data-testid="scan-loading">
              <ui-spinner :size="48" label="Loading scan" />
              <p>Loading scan...</p>
            </div>

            <div v-else-if="error" class="scan-error" data-testid="scan-error">
              <ui-icon name="circle-alert" :size="48" />
              <p>{{ error }}</p>
              <button type="button" class="scan-nav-button" data-testid="scan-retry" @click="retryLoad">
                Retry
              </button>
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

          <button
            type="button"
            class="scan-nav-button scan-nav-button--side"
            data-testid="scan-next"
            :disabled="!canGoNext"
            @click="nextPage"
          >
            Next
            <ui-icon name="chevron-right" :size="18" :stroke-width="2.2" />
          </button>
        </div>

        <!-- Phone: previous and next sit under the page -->
        <div class="scan-footer">
          <button type="button" class="scan-footer-button" :disabled="!canGoPrev" @click="prevPage">
            <ui-icon name="chevron-left" :size="18" :stroke-width="2.2" />
            Previous
          </button>
          <span class="scan-footer-divider" />
          <button type="button" class="scan-footer-button" :disabled="!canGoNext" @click="nextPage">
            Next
            <ui-icon name="chevron-right" :size="18" :stroke-width="2.2" />
          </button>
        </div>
      </dialog-content>
    </dialog-portal>
  </dialog-root>
</template>

<style scoped>
/* Fixed colours: the viewer is dark in both themes (they are the dark
   theme's own surface, line and muted values). */
.scan-viewer {
  --scan-bg: #1b1512;
  --scan-ink: #F3E8D6;
  --scan-muted: #B8A998;
  --scan-line: #3D312B;
  --scan-line-strong: #54453B;

  position: fixed;
  inset: 0;
  z-index: 2400;
  display: flex;
  flex-direction: column;
  background: var(--scan-bg);
  color: var(--scan-ink);
  font-family: var(--font-ui);
  font-size: var(--text-base);
  /* Safe area for the notch and landscape orientation */
  padding-top: env(safe-area-inset-top, 0px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  box-sizing: border-box;
}
.scan-viewer:focus {
  outline: none;
}

.scan-toolbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  height: 64px;
  padding: 0 20px;
  border-bottom: 1px solid var(--scan-line);
  box-sizing: border-box;
}

.scan-heading {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 14px;
}

.scan-title {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-md);
  font-weight: 600;
}

.scan-approximate {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--scan-muted);
}

.scan-hidden-description {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.scan-spacer {
  flex: 1;
}

.scan-icon-button {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: var(--radius-lg);
  background: none;
  color: inherit;
  cursor: pointer;
}
.scan-icon-button--bordered {
  border: 1.5px solid var(--scan-line-strong);
}
.scan-icon-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
}
.scan-icon-button:disabled,
.scan-nav-button:disabled,
.scan-footer-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.scan-icon-button:focus-visible,
.scan-nav-button:focus-visible,
.scan-footer-button:focus-visible {
  outline: 2px solid var(--scan-ink);
  outline-offset: 2px;
}

.zoom-level {
  width: 56px;
  text-align: center;
  font-size: var(--text-sm-plus);
}

.scan-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 0 20px;
}

.scan-nav-button {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 18px;
  border: 1.5px solid var(--scan-line-strong);
  border-radius: var(--radius-xl);
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.scan-nav-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
}

.scan-content {
  position: relative;
  align-self: stretch;
  flex: 0 1 46rem;
  min-width: 0;
  overflow: auto;
  /* Prevent text selection */
  user-select: none;
  -webkit-user-select: none;
  /* Smooth scrolling on iOS */
  -webkit-overflow-scrolling: touch;
  /* Allow pan but prevent browser pinch zoom */
  touch-action: pan-x pan-y;
}

.scan-loading,
.scan-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px;
  text-align: center;
  color: var(--scan-muted);
  z-index: 1;
}
.scan-loading p,
.scan-error p {
  margin: 0;
}
.scan-error {
  color: var(--scan-ink);
}

.scan-image-wrapper {
  min-width: 100%;
  min-height: 100%;
  padding: 20px 0;
  box-sizing: border-box;
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
  margin: 0 auto;
  border-radius: 6px;
  /* Prevent drag */
  -webkit-user-drag: none;
  user-drag: none;
}

.scan-footer {
  display: none;
}

/* Phone: the page takes the full width; previous and next move under it */
@media (max-width: 600px) {
  .scan-toolbar {
    gap: 8px;
    height: 56px;
    padding: 0 8px;
  }
  .zoom-level {
    display: none;
  }
  /* "approximate" goes under the title */
  .scan-heading {
    flex-direction: column;
    gap: 0;
  }
  .scan-title {
    font-size: var(--text-base);
  }
  .scan-approximate {
    font-size: var(--text-xs);
  }
  .scan-stage {
    padding: 0;
  }
  .scan-nav-button--side {
    display: none;
  }
  .scan-content {
    flex: 1 1 auto;
  }
  .scan-image-wrapper {
    padding: 0;
  }
  .scan-image {
    border-radius: 0;
  }
  .scan-footer {
    flex: none;
    display: flex;
    align-items: center;
    height: 56px;
    margin-bottom: env(safe-area-inset-bottom, 0px);
    border-top: 1px solid var(--scan-line);
  }
  .scan-footer-button {
    flex: 1;
    height: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .scan-footer-divider {
    width: 1px;
    height: 28px;
    background: var(--scan-line-strong);
  }
}

/* Android: the status bar is not reported through env() */
.scan-viewer.is-android {
  padding-top: 24px;
}
</style>
