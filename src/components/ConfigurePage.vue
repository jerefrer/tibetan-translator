<script>
import draggable from "vuedraggable";

import Storage from "../services/storage";

export default {
  components: {
    draggable,
  },
  data() {
    return {
      dictionaries: Storage.get("dictionaries").sort((a, b) => {
        return a.position - b.position;
      }),
    };
  },
  watch: {
    dictionaries: {
      deep: true,
      handler(newDictionaries) {
        Storage.set(
          "dictionaries",
          newDictionaries.map((dictionary, index) => {
            return { ...dictionary, position: index + 1 };
          })
        );
      },
    },
  },
  methods: {
    setPageTitle() {
      return;
      document.title = "Translator / Configure";
    }
  },
  created() {
    this.setPageTitle();
  },
};
</script>

<template>
  <v-container class="configure-page">
    <v-card class="dictionaries-container">
      <v-toolbar elevation="1">
        <v-icon x-large color="grey"> mdi-book-multiple </v-icon>
        <v-toolbar-title>
          Dictionaries
          <div class="caption grey--text">
            Reorder or disable them to match your preferences
          </div>
        </v-toolbar-title>
      </v-toolbar>
  
      <draggable v-model="dictionaries" handle=".handle">
        <transition-group name="list" tag="div" class="dictionaries">
          <div v-for="(dictionary, index) in dictionaries" :key="dictionary.id" class="dictionary list-item" :class="{
                        disabled: !dictionary.enabled,
                      }">
            <v-icon class="handle" color="grey darken-2">
              mdi-drag-horizontal-variant
            </v-icon>
  
            <div class="name">
              <span class="grey--text text--darken-1">{{ index + 1 }}.</span>
              {{ dictionary.name }}
            </div>
  
            <v-switch v-model="dictionary.enabled" hide-details class="switch" />
          </div>
        </transition-group>
      </draggable>
    </v-card>
  </v-container>
</template>

<style lang="sass">
.configure-page
  margin-top: 30px

  .dictionaries-container
    width: 100%

    .v-toolbar .v-icon
      margin: 0 10px 0 -4px

    .v-toolbar__title, .v-toolbar__title .caption
      line-height: 1em

    .v-toolbar__title .caption
      margin-top: 5px

    .dictionaries
      display: grid
      grid-template-columns: repeat(auto-fill, minmax(min(360px, 100%), 1fr))

      .dictionary
        display: flex

        &.disabled .v-icon:before, &.disabled .switch .v-input__control
          opacity: 0.25

        &.disabled > .name
          color: #525252

        > *
          display: table-cell
          padding: 8px
          border-bottom: thin solid rgba(255, 255, 255, 0.12)

        &:last-child > *
          border-bottom: none

        .handle
          width: 54px
          text-align: center
          cursor: move

        .v-icon:before, .name, &.disabled .switch .v-input__control
          transition: all 1s

        > .name
          flex: 1

        > .switch
          margin: 0

  .database-reinitialization .v-toolbar .v-icon
    margin: 0 9px 0 -6px

    .fd-zone
      width: 100%

      > div:not(.dndtxt), > div:not(.dndtxt) form, > div:not(.dndtxt) form input
        position: absolute !important
        left: 0
        top: 0
        right: 0
        bottom: 0
        margin: 0

      > div:not(.dndtxt) form
        margin-top: -30px
</style>
