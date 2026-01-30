/**
 * Resize Service
 *
 * Centralized window resize handling with debouncing.
 * Components subscribe to resize events instead of each
 * maintaining their own window resize listeners.
 *
 * Usage:
 *   import ResizeService from '../services/resize-service';
 *
 *   // Subscribe to resize events
 *   ResizeService.subscribe('my-component', (width, height) => {
 *     console.log(`Window resized to ${width}x${height}`);
 *   });
 *
 *   // Unsubscribe when component unmounts
 *   ResizeService.unsubscribe('my-component');
 *
 *   // Get current dimensions
 *   const { width, height } = ResizeService.getDimensions();
 *
 *   // Check if mobile
 *   if (ResizeService.isMobile()) { ... }
 */

import { MOBILE_BREAKPOINT } from '../config/constants';

const DEBOUNCE_MS = 100;

let listeners = new Map();
let debounceTimer = null;
let isInitialized = false;

/**
 * Get current window dimensions
 */
function getDimensions() {
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

/**
 * Check if window is mobile width
 */
function isMobile() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

/**
 * Handle window resize with debouncing
 */
function handleResize() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    const { width, height } = getDimensions();
    listeners.forEach((callback) => {
      try {
        callback(width, height);
      } catch (error) {
        console.error('[ResizeService] Listener error:', error);
      }
    });
  }, DEBOUNCE_MS);
}

/**
 * Initialize the resize listener (called automatically on first subscribe)
 */
function init() {
  if (isInitialized) return;
  window.addEventListener('resize', handleResize);
  isInitialized = true;
}

/**
 * Subscribe to resize events
 * @param {string} id - Unique identifier for the subscriber
 * @param {Function} callback - Called with (width, height) on resize
 */
function subscribe(id, callback) {
  if (!isInitialized) {
    init();
  }
  listeners.set(id, callback);
}

/**
 * Unsubscribe from resize events
 * @param {string} id - The subscriber identifier
 */
function unsubscribe(id) {
  listeners.delete(id);

  // Cleanup if no more listeners
  if (listeners.size === 0 && isInitialized) {
    window.removeEventListener('resize', handleResize);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    isInitialized = false;
  }
}

/**
 * Get the number of active subscribers (for debugging)
 */
function getSubscriberCount() {
  return listeners.size;
}

export default {
  subscribe,
  unsubscribe,
  getDimensions,
  isMobile,
  getSubscriberCount
};
