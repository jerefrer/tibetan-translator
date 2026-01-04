/**
 * Platform detection utilities
 *
 * Determines whether we're running in Tauri (desktop/mobile) or web browser
 */

/**
 * Check if running in Tauri environment
 */
export function isTauri() {
  return typeof window !== 'undefined' &&
    (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined);
}

/**
 * Check if running in web browser (not Tauri)
 */
export function isWeb() {
  return !isTauri();
}

/**
 * Check if platform supports modular dictionary packs
 * Only Tauri apps support modular packs; web version uses full bundled database
 */
export function supportsModularPacks() {
  return isTauri();
}

/**
 * Get the platform type
 */
export function getPlatformType() {
  if (!isTauri()) return 'web';

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'desktop';
}

export default {
  isTauri,
  isWeb,
  supportsModularPacks,
  getPlatformType,
};
