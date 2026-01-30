/**
 * Application-wide constants
 *
 * Centralizes magic numbers and configuration values that were previously
 * scattered throughout the codebase.
 */

// Mobile responsiveness
export const MOBILE_BREAKPOINT = 600;

// Popup window dimensions
export const POPUP_WIDTH = 650;
export const POPUP_HEIGHT = 500;

// Segment page merge detection
export const MAX_MERGE_TERM_COUNT = 5;

// Pack download configuration
export const PACK_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

// Database query limits
export const MAX_ENTRIES_PER_REQUEST = 5000;
export const ENTRIES_PER_PAGE = 25;
export const ENTRIES_BATCH_SIZE = 50;
export const TERMS_BATCH_SIZE = 100;

// Search history
export const MAX_PREVIOUS_QUERIES = 100;

// Database load timeout
export const DATABASE_LOAD_TIMEOUT_MS = 300000; // 5 minutes

// Debounce delays
export const DEBOUNCE_SEARCH_MS = 500;
export const DEBOUNCE_TEXTAREA_MS = 500;
export const DEBOUNCE_ENTRIES_MS = 300;

// Infinite scroll margins
export const INFINITE_SCROLL_ROOT_MARGIN = '100px';
export const INFINITE_SCROLL_ROOT_MARGIN_LARGE = '200px';

// Cookie expiry
export const COOKIE_EXPIRY_HOURS = 87600; // 10 years

export default {
  MOBILE_BREAKPOINT,
  POPUP_WIDTH,
  POPUP_HEIGHT,
  MAX_MERGE_TERM_COUNT,
  PACK_CHUNK_SIZE,
  MAX_ENTRIES_PER_REQUEST,
  ENTRIES_PER_PAGE,
  ENTRIES_BATCH_SIZE,
  TERMS_BATCH_SIZE,
  MAX_PREVIOUS_QUERIES,
  DATABASE_LOAD_TIMEOUT_MS,
  DEBOUNCE_SEARCH_MS,
  DEBOUNCE_TEXTAREA_MS,
  DEBOUNCE_ENTRIES_MS,
  INFINITE_SCROLL_ROOT_MARGIN,
  INFINITE_SCROLL_ROOT_MARGIN_LARGE,
  COOKIE_EXPIRY_HOURS,
};
