import { createApp, reactive } from "vue";
// First, so every component style comes after it
import "./css/reset.css";
import router from "./router";

import App from "./components/App.vue";

// Add platform detection class to document for CSS targeting
if (/android/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('is-android');
}

// iOS detection
if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('is-ios');
}

// Create reactive snackbar state for provide/inject pattern
const snackbar = reactive({
  show: false,
  content: "",
  open(text) {
    this.content = text;
    this.show = true;
  },
  close() {
    this.show = false;
  },
});

const app = createApp(App);

// Provide snackbar globally (replaces this.$root.openSnackbarWith)
app.provide("snackbar", snackbar);

app.use(router);

app.mount("#app");
