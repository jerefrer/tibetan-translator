/**
 * MobileResponsiveMixin
 *
 * Provides shared mobile responsiveness logic for page components.
 * Uses the central ResizeService for efficient resize handling.
 *
 * Usage:
 *   mixins: [MobileResponsiveMixin]
 *
 * Provides:
 *   - data: isMobile, mobileShowDefinition
 *   - methods: handleResize, showTermsList, setMobileShowDefinition
 *   - lifecycle: mounted/beforeUnmount resize subscription management
 */

import ResizeService from '../../services/resize-service';

let instanceCounter = 0;

export default {
  data() {
    return {
      isMobile: ResizeService.isMobile(),
      mobileShowDefinition: false,
      _resizeSubscriptionId: null,
    };
  },
  methods: {
    handleResize(width) {
      this.isMobile = ResizeService.isMobile();
      if (!this.isMobile) {
        this.mobileShowDefinition = false;
      }
    },
    showTermsList() {
      if (this.isMobile) {
        this.mobileShowDefinition = false;
      }
    },
    setMobileShowDefinition(value) {
      if (this.isMobile) {
        this.mobileShowDefinition = value;
      }
    },
  },
  mounted() {
    this._resizeSubscriptionId = `mobile-responsive-${++instanceCounter}`;
    ResizeService.subscribe(this._resizeSubscriptionId, (width) => {
      this.handleResize(width);
    });
  },
  beforeUnmount() {
    if (this._resizeSubscriptionId) {
      ResizeService.unsubscribe(this._resizeSubscriptionId);
    }
  },
};
