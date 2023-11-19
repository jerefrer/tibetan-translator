import Vue from "vue";
import vuetify from "./plugins/vuetify";
import router from "./router";

import App from "./components/App";

new Vue({
  router,
  vuetify,
  render: (h) => h(App),
  methods: {
    openSnackbarWith(text) {
      this.$children[0].openSnackbarWith(text);
    },
  },
}).$mount("#app");
