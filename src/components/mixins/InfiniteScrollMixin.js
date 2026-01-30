/**
 * InfiniteScrollMixin
 *
 * Provides shared IntersectionObserver-based infinite scroll logic.
 *
 * Usage:
 *   mixins: [InfiniteScrollMixin]
 *
 * Requirements:
 *   - Component must implement: loadMore() method
 *   - Component must implement: hasMore computed property
 *   - Component must have ref: loadMoreSentinel (the scroll trigger element)
 *
 * Configuration:
 *   - Override infiniteScrollRootMargin for custom margins
 *   - Override infiniteScrollRoot to specify a scroll container ref
 *
 * Example:
 *   <div ref="loadMoreSentinel" />
 *   computed: { hasMore() { return this.displayedCount < this.total; } }
 *   methods: { loadMore() { this.displayedCount += 50; } }
 */

import { INFINITE_SCROLL_ROOT_MARGIN } from '../../config/constants';

export default {
  data() {
    return {
      _infiniteScrollObserver: null,
    };
  },
  computed: {
    // Override in component to customize margin
    infiniteScrollRootMargin() {
      return INFINITE_SCROLL_ROOT_MARGIN;
    },
    // Override in component to specify a scroll container (ref name)
    infiniteScrollRoot() {
      return null;
    },
  },
  methods: {
    setupInfiniteScroll() {
      // Teardown existing observer first
      this.teardownInfiniteScroll();

      this.$nextTick(() => {
        const sentinel = this.$refs.loadMoreSentinel;
        if (!sentinel) return;

        const root = this.infiniteScrollRoot
          ? this.$refs[this.infiniteScrollRoot]
          : null;

        this._infiniteScrollObserver = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting && this.hasMore && !this.loading) {
              this.loadMore();
            }
          },
          {
            root: root,
            rootMargin: this.infiniteScrollRootMargin,
          }
        );

        this._infiniteScrollObserver.observe(sentinel);
      });
    },
    teardownInfiniteScroll() {
      if (this._infiniteScrollObserver) {
        this._infiniteScrollObserver.disconnect();
        this._infiniteScrollObserver = null;
      }
    },
  },
  beforeUnmount() {
    this.teardownInfiniteScroll();
  },
};
