<script>
import $ from "jquery";
import "sugar";

import db from "../services/sql-database";
import Storage from "../services/storage";
import EventHandlers from "../services/event-handlers";

import { substituteLinksWithATags } from "../utils";
import SelectedTibetanEntriesPopup from "./SelectedTibetanEntriesPopup";
import DefinePageHelpDialogWithButton from "./DefinePageHelpDialogWithButton";
import SearchPageHelpDialogWithButton from "./SearchPageHelpDialogWithButton";
import TranslatePageHelpDialogWithButton from "./TranslatePageHelpDialogWithButton";

import "../../vendor/stylesheets/materialdesignicons.css";

import "../css/layout.css";
import "../css/tibetan.css";
import "../css/scrollbar.css";
import "../css/help-dialog.css";

if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

if (Storage.get("autoFillWords") == undefined)
  Storage.set("autoFillWords", true);

if (Storage.get("keepLongestOnly") == undefined)
  Storage.set("keepLongestOnly", true);

var allTerms;

export default {
  components: {
    SelectedTibetanEntriesPopup,
    DefinePageHelpDialogWithButton,
    SearchPageHelpDialogWithButton,
    TranslatePageHelpDialogWithButton,
  },
  watch: {
    "$vuetify.theme.dark"(value) {
      this.updateHtmlThemeClass();
    },
  },
  data() {
    return {
      loading: true,
      snackbar: false,
      snackbarContent: undefined,
    };
  },
  computed: {
    tabs() {
      return [
        { id: "define", name: "<u>D</u>efine" },
        { id: "search", name: "<u>S</u>earch" },
        { id: "translate", name: "<u>T</u>ranslate" },
        { id: "configure", name: "<u>C</u>onfigure" },
      ];
    },
    currentTabId() {
      return this.$route.path.split("/").compact(true).first();
    },
    tabIndex() {
      return this.tabs.findIndex({ id: this.currentTabId });
    },
  },
  methods: {
    toggleTheme() {
      this.$vuetify.theme.dark = !this.$vuetify.theme.dark;
      Storage.set("darkTheme", this.$vuetify.theme.dark);
    },
    updateHtmlThemeClass() {
      $("html")
        .removeClass("theme--dark")
        .removeClass("theme--light")
        .addClass("theme--" + (this.$vuetify.theme.dark ? "dark" : "light"));
    },
    openSnackbarWith(text) {
      this.snackbar = true;
      this.snackbarContent = text;
    },
    addListenerToOpenSnackbarOnAbbreviationClick() {
      $(document).on("click", ".definition abbr", (event) => {
        var html = $(event.currentTarget).attr("data-title");
        var html = substituteLinksWithATags(html);
        this.openSnackbarWith(html);
      });
    },
    addListenersForKeyboardTabNavigation() {
      var vm = this;
      EventHandlers.add({
        id: "tabs-shortcuts",
        type: "keydown",
        callback(event) {
          if (event.altKey) {
            if (event.key == "d")
              vm.$router.push("/define") && event.preventDefault();
            else if (event.key == "s")
              vm.$router.push("/search") && event.preventDefault();
            else if (event.key == "t")
              vm.$router.push("/translate") && event.preventDefault();
            else if (event.key == "c")
              vm.$router.push("/configure") && event.preventDefault();
          }
        },
      });
    }
  },
  async created() {
    this.updateHtmlThemeClass();
    window.SqlDatabase = db;
    await db.init();
    this.loading = false;
  },
  mounted() {
    this.addListenerToOpenSnackbarOnAbbreviationClick();
    this.addListenersForKeyboardTabNavigation();
  },
  destroyed() {
    EventHandlers.remove("tabs-shortcuts");
  },
};
</script>

<template>
  <v-app>
    <v-overlay opacity="1" :value="loading">
      <div class="d-flex flex-column align-center">
        <v-img
          src="/img/logo.png"
          width="100"
          class="mb-8"
          style="filter: brightness(0.25)"
        />
        <v-progress-circular
          indeterminate
          width="10"
          size="192"
          style="position: absolute; top: -48px; filter: brightness(0.25)"
        />
      </div>
    </v-overlay>

    <selected-tibetan-entries-popup />

    <v-snackbar v-model="snackbar">
      <div v-html="snackbarContent" />
      <template v-slot:action="{ attrs }">
        <v-btn text v-bind="attrs" @click="snackbar = false"> Close </v-btn>
      </template>
    </v-snackbar>

    <v-main v-if="!loading">
      <v-btn
        icon
        large
        color="grey darken-2"
        id="theme-button"
        @click="toggleTheme"
      >
        <v-icon>mdi-theme-light-dark</v-icon>
      </v-btn>

      <v-system-bar app height="63">
        <v-tabs grow height="63" :value="tabIndex">
          <v-tab
            v-for="tab in tabs"
            :key="tab.id"
            :to="'/' + tab.id"
            :class="{ configure: tab.id == 'configure' }"
          >
            <DefinePageHelpDialogWithButton v-if="tab.id == 'define'" />
            <SearchPageHelpDialogWithButton v-if="tab.id == 'search'" />
            <TranslatePageHelpDialogWithButton v-if="tab.id == 'translate'" />

            <div>
              <div v-html="tab.name"></div>
              <v-slide-y-reverse-transition appear>
                <div
                  v-if="tab.id == 'translate' && currentTabId == 'translate'"
                  style="
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    display: flex;
                    justify-content: center;
                  "
                >
                  <v-chip
                    label
                    x-small
                    style="
                      text-transform: lowercase;
                      background: #2196f3 !important;
                      border-bottom-left-radius: 0 !important;
                      border-bottom-right-radius: 0 !important;
                    "
                  >
                    Experimental
                  </v-chip>
                </div>
              </v-slide-y-reverse-transition>
            </div>
          </v-tab>
        </v-tabs>
      </v-system-bar>

      <v-container fluid class="pa-0">
        <v-tabs-items :value="currentTabId">
          <router-view :key="currentTabId" />
        </v-tabs-items>
      </v-container>
    </v-main>
  </v-app>
</template>

<style lang="stylus">
fieldset.entry
  margin 1em
  padding 0 15px 10px
  text-align justify
  border 1px dashed
  font-size 0.9em
  legend
    padding 0 5px
    margin-left -5px

.theme--dark
  fieldset.entry
    border-color #444
    legend
      color #444

.theme--light
  fieldset.entry
    border-color #999
    legend
      color #999
</style>
