/**
 * Theme helpers shared by the main window and the quick-lookup popup.
 *
 * The stored `themePreference` is 'light' | 'dark' | 'system'. The document
 * carries the resolved theme in two forms:
 *   - `data-theme="light|dark"` drives the design tokens (src/css/tokens.css);
 *   - `theme--light|theme--dark` is the class existing styles still key on.
 */
import Storage from './storage';

export function resolveTheme(preference, prefersDark) {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference === 'dark' ? 'dark' : 'light';
}

export function systemPrefersDark() {
  return !!(
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function applyDocumentTheme(theme, root = document.documentElement) {
  const name = theme === 'dark' ? 'dark' : 'light';
  root.setAttribute('data-theme', name);
  root.classList.remove('theme--dark', 'theme--light');
  root.classList.add(`theme--${name}`);
  return name;
}

/** Resolves the stored preference and applies it. Returns 'light' or 'dark'. */
export function initDocumentTheme() {
  const theme = resolveTheme(Storage.get('themePreference'), systemPrefersDark());
  return applyDocumentTheme(theme);
}
