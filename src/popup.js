/**
 * Popup window entry point for Global Lookup
 * This creates a minimal Vue app for the always-on-top lookup popup
 * Desktop only - should never be shown on mobile
 */
import { isMobile } from "./config/platform";
import { applyPopupAppearance, watchPopupAppearance } from "./services/popup-appearance";

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
  const { default: GlobalLookupWindow } = await import("./components/GlobalLookupWindow.vue");

  await import("./css/tokens.css");
  await import("./css/fonts.css");
  await import("./css/layout.css");
  await import("./css/tibetan.css");
  await import("./css/scrollbar.css");

  // Same theme initialisation as the main window (data-theme for the tokens,
  // theme--* for older styles), plus the Text size setting.
  applyPopupAppearance();
  watchPopupAppearance();

  createApp(GlobalLookupWindow).mount("#popup");
}
