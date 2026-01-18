/**
 * Popup window entry point for Global Lookup
 * This creates a minimal Vue app for the always-on-top lookup popup
 */
import { createApp } from "vue";
import vuetify from "./plugins/vuetify";
import GlobalLookupWindow from "./components/GlobalLookupWindow.vue";
import Storage from "./services/storage";

import "@mdi/font/css/materialdesignicons.css";
import "./css/layout.css";
import "./css/tibetan.css";
import "./css/scrollbar.css";

// Initialize theme from storage
const preference = Storage.get('themePreference') || 'system';
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
