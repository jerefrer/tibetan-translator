/**
 * Popup window entry point for Global Lookup
 * This creates a minimal Vue app for the always-on-top lookup popup
 * Desktop only - should never be shown on mobile
 */
import { isMobile } from "./config/platform";

// Global lookup popup is desktop-only. On mobile, redirect to main app.
if (isMobile()) {
  // On mobile, this popup should never be shown.
  // Redirect to the main app in case it somehow gets opened.
  window.location.href = '/';
} else {
  // Desktop: proceed with normal initialization
  initPopup();
}

async function initPopup() {
  const { createApp } = await import("vue");
  const { default: vuetify } = await import("./plugins/vuetify");
  const { default: GlobalLookupWindow } = await import("./components/GlobalLookupWindow.vue");
  const { default: Storage } = await import("./services/storage");

  await import("@mdi/font/css/materialdesignicons.css");
  await import("./css/layout.css");
  await import("./css/tibetan.css");
  await import("./css/scrollbar.css");

  // Initialize theme from storage
  const preference = Storage.get('themePreference');
  let actualTheme;
  if (preference === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    actualTheme = prefersDark ? 'dark' : 'light';
  } else {
    actualTheme = preference;
  }
  document.documentElement.classList.add(`theme--${actualTheme}`);

  const app = createApp(GlobalLookupWindow);
  app.use(vuetify);
  app.mount("#popup");
}
