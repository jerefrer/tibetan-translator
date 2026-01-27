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
 * Check if running on a mobile platform (iOS or Android)
 */
export function isMobile() {
  if (!isTauri()) return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('android') || ua.includes('iphone') || ua.includes('ipad');
}

/**
 * Check if platform supports modular dictionary packs
 * All Tauri apps (desktop and mobile) support modular packs
 * Web uses full bundled database
 */
export function supportsModularPacks() {
  return isTauri();
}

/**
 * Check if running on macOS
 */
export function isMacOS() {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
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
  isMobile,
  isMacOS,
  supportsModularPacks,
  getPlatformType,
};
