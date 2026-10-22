/**
 * Theme helpers shared by the main window and the quick-lookup popup.
 *
 * The stored `themePreference` is 'light' | 'dark' | 'system'. The resolved
 * theme goes on <html> as `data-theme="light|dark"`, which selects the design
 * tokens (src/css/tokens.css) and the few dark rules in src/css.
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
  return name;
}

/** Resolves the stored preference and applies it. Returns 'light' or 'dark'. */
export function initDocumentTheme() {
  const theme = resolveTheme(Storage.get('themePreference'), systemPrefersDark());
  return applyDocumentTheme(theme);
}
