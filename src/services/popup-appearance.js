/**
 * Theme and text size of the quick lookup window (src/popup.js).
 *
 * The window has its own Vue instance, so nothing the main window does to its
 * own document reaches it. It reads the same stored settings instead: the
 * theme through theme.js (shared with the main window) and the "Text size"
 * (`fontSize`, a percentage of the root font size, as App.vue applies it).
 * It is applied at start and again each time the window is shown, so a
 * change made in Settings meanwhile is picked up.
 */
import Storage from './storage';
import { initDocumentTheme } from './theme';

export function applyFontSize(root = document.documentElement) {
  const fontSize = Storage.get('fontSize') || 100;
  root.style.setProperty('--app-font-size', `${fontSize}%`);
  root.style.fontSize = `${fontSize}%`;
  return fontSize;
}

/** Applies the stored theme and text size. Returns { theme, fontSize }. */
export function applyPopupAppearance() {
  return { theme: initDocumentTheme(), fontSize: applyFontSize() };
}

/**
 * Follows the system theme while the preference is "system", and settings
 * changed by the main window (same origin, so a `storage` event reaches this
 * window when the engine shares storage between them). Returns a function
 * that stops listening.
 */
export function watchPopupAppearance() {
  const reapply = () => applyPopupAppearance();
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  media?.addEventListener?.('change', reapply);
  const onStorage = (event) => {
    const keys = [Storage.scopedKey('themePreference'), Storage.scopedKey('fontSize')];
    if (!event.key || keys.includes(event.key)) reapply();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    media?.removeEventListener?.('change', reapply);
    window.removeEventListener('storage', onStorage);
  };
}
