import { createApp, reactive } from "vue";
import vuetify from "./plugins/vuetify";
import router from "./router";

import App from "./components/App.vue";

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
app.use(vuetify);

app.mount("#app");
